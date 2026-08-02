import datetime
import gc
import math
import os
import sys
import traceback
import time
import random
from dataclasses import dataclass
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
from scripts.scraper import get_shutuba_html_content, get_race_result_html_content, get_horse_page_html, get_race_list_html
from scripts import parser, database_loader, predictor
from scripts.race_classification import prediction_exclusion_reason
from typing import Any, List, Tuple, Dict, Optional, Set
from tqdm import tqdm

BANEI_VENUE_CODES = ["33", "65"]

_IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"
_DEFAULT_RESULT_BATCH = 3 if _IS_GITHUB_ACTIONS else 10

# スキップ判定の閾値（日数）
# DB上の最終出走日がこの日数以内の馬 → データが新しいのでスキップ
# DB上の最終出走日がこの日数より古い馬 → データが古い可能性があるので再取得
# ★ 2026-04-14 バグ修正: 旧値7日 + 比較方向が逆だったため、
#   ほぼ全馬がスキップされ過去走データが永遠に更新されないバグがあった。
#   run_pipeline.py HISTORYモード（L110: days < 365）と同じ方向に統一。
_RECENT_RACE_DAYS = 60


def _build_horses_to_skip(db: Session, horse_ids: Set[str], target_date: date) -> Set[str]:
    """
    【バッチクエリ】取得をスキップすべき馬のIDセットを返す。

    なぜ必要か:
      GitHub Actions は毎回クリーンな環境で起動し、ローカルHTMLキャッシュが
      存在しない。scraper.py の5日キャッシュ判定はファイルの存在に依存するため、
      GitHub Actions では全馬が毎回ネット取得の対象になってしまう。
      622頭 × 8秒 = 83分 → 90分タイムアウトを超過して毎回強制キャンセルされる。

    解決策:
      DBのデータを基準にスキップを判断する。ファイルキャッシュに依存しない。

    スキップ条件（AND）:
      ① DB に finish_time_sec ありのレース成績が5件以上存在する
      ② 最終出走日が _RECENT_RACE_DAYS 日以内である
         （= データが十分に新しく、再取得の必要がない）

    フェッチ対象になる馬:
      ・DB成績が4件以下（新馬・転入馬など、データが不足）
      ・最終出走日が60日より古い馬（データが古く、新たな出走が反映されていない可能性大）

    ★ 2026-04-13 バッチ分割 + 接続リフレッシュ修正:
      この関数の呼び出し前に「Collecting horses」ステップで5-6分の
      スクレイピングが行われる。その間にNullPool接続が失効し、
      さらにGCE e2-micro (vCPU 0.25) への外部IP経由の重いJOIN+GROUP BY
      クエリがタイムアウトを引き起こす。
      対策:
        1. バッチサイズを50に縮小（e2-micro安全圏）
        2. 各バッチ実行前にDB接続をリフレッシュ
        3. バッチごとに3回リトライ
    """
    if not horse_ids:
        return set()

    # ★ クエリ高速化のための部分インデックスを自動作成
    # e2-micro (vCPU 0.25) ではJOIN+GROUP BYが遅いため、適切なインデックスが不可欠。
    # IF NOT EXISTS なので既に存在すれば即座にスキップされる（性能影響ゼロ）。
    try:
        from sqlalchemy import text as sa_text
        db.execute(sa_text(
            "CREATE INDEX IF NOT EXISTS idx_results_horse_id_finish_time "
            "ON results (horse_id, finish_time_sec) WHERE finish_time_sec IS NOT NULL"
        ))
        db.commit()
    except Exception as idx_err:
        print(f"  -> [INFO] Index creation skipped: {idx_err}")
        try:
            db.rollback()
        except Exception:
            pass

    recent_cutoff = target_date - timedelta(days=_RECENT_RACE_DAYS)

    # ★ GCE e2-micro (vCPU 0.25) + 外部IP接続でも安全なバッチサイズ
    _SKIP_QUERY_BATCH_SIZE = 50
    _MAX_RETRIES = 3
    horse_list = sorted(list(horse_ids))
    horse_stats = []
    total_batches = (len(horse_list) + _SKIP_QUERY_BATCH_SIZE - 1) // _SKIP_QUERY_BATCH_SIZE

    for batch_idx, batch_start in enumerate(range(0, len(horse_list), _SKIP_QUERY_BATCH_SIZE)):
        batch = horse_list[batch_start:batch_start + _SKIP_QUERY_BATCH_SIZE]

        for retry in range(_MAX_RETRIES):
            try:
                # ★ 各バッチ前にDB接続をリフレッシュ
                # 「Collecting horses」で5-6分のスクレイピング後、
                # NullPoolの接続が腐っている可能性があるため、
                # close() で既存接続を切断してから新規接続でクエリを実行する。
                try:
                    db.close()
                except Exception:
                    pass

                batch_stats = (
                    db.query(
                        models.Result.horse_id,
                        func.count(models.Result.id).label('valid_count'),
                        func.max(models.Race.race_date).label('last_race_date'),
                    )
                    .join(models.Race, models.Result.race_id == models.Race.id)
                    .filter(
                        models.Result.horse_id.in_(batch),
                        models.Result.finish_time_sec.isnot(None),
                    )
                    .group_by(models.Result.horse_id)
                    .all()
                )
                horse_stats.extend(batch_stats)

                if (batch_idx + 1) % 5 == 0 or batch_idx == total_batches - 1:
                    print(f"  -> Skip query progress: batch {batch_idx + 1}/{total_batches}")

                break  # 成功したらリトライループを抜ける

            except Exception as e:
                if retry < _MAX_RETRIES - 1:
                    wait_sec = (retry + 1) * 5
                    print(f"  -> [RETRY {retry + 1}/{_MAX_RETRIES}] Skip query batch {batch_idx + 1} failed: {e}")
                    print(f"     Waiting {wait_sec}s before retry...")
                    time.sleep(wait_sec)
                    try:
                        db.rollback()
                        db.close()
                    except Exception:
                        pass
                else:
                    print(f"  -> [FAILED] Skip query batch {batch_idx + 1} failed after {_MAX_RETRIES} retries: {e}")
                    # 最終リトライも失敗 → スキップ判定を諦めて全馬フェッチ対象にする
                    # （保守的な選択: データ不足よりはフェッチ過剰の方がまし）
                    print(f"  -> Falling back: all {len(horse_ids)} horses will be fetched (no skip)")
                    return set()

    skip_set = {
        row.horse_id
        for row in horse_stats
        if row.valid_count >= 5
        and row.last_race_date is not None
        and row.last_race_date >= recent_cutoff  # データが新しい馬のみスキップ
    }

    total = len(horse_ids)
    skip_count = len(skip_set)
    fetch_count = total - skip_count
    print(
        f"  -> Horse fetch plan: {total} total / "
        f"{skip_count} skip (DB data fresh, within {_RECENT_RACE_DAYS}d) / "
        f"{fetch_count} fetch (stale or insufficient data)"
    )
    return skip_set


def _fetch_and_load_horse_past_data(db: Session, horse_ids: Set[str], target_date: date):
    """
    指定された馬リストの過去成績を取得しDBに保存する。

    ★ バルク1クエリでスキップ判定（N+1クエリ完全排除）
        変更前: 馬1頭ごとに COUNT + MAX を個別発行（N+1問題）
                または全馬をスキップなしで全件取得（622頭×8秒=タイムアウト）
        変更後: ループ前に1クエリで全馬の stats を取得 → スキップ対象を決定

    ★ ファイルキャッシュに依存しないDB基準のスキップ
        GitHub Actions はクリーンな環境のためファイルキャッシュが存在しない。
        DBデータが十分な馬（5件以上かつ最近未出走）は無条件でスキップ。
    """
    if not horse_ids:
        return

    print(f"\n--- [PREDICTIONS] Fetching past data for {len(horse_ids)} horses ---")

    # ★ スキップ対象を1クエリで決定
    horses_to_skip = _build_horses_to_skip(db, horse_ids, target_date)

    fetched_count = 0
    skipped_count = 0

    for idx, horse_id in enumerate(
        tqdm(sorted(list(horse_ids)), desc="  -> Fetching horse data", leave=False)
    ):
        # ★ スキップ判定（DBベース。ファイルキャッシュ不要）
        if horse_id in horses_to_skip:
            skipped_count += 1
            continue

        try:
            html, was_scraped = get_horse_page_html(horse_id, force_download=False)

            if html:
                parsed_data = parser.parse_horse_results_page(html)
                if parsed_data and parsed_data.get('results'):
                    horse_name = parsed_data.get('horse_name')
                    results = parsed_data.get('results')
                    if horse_name:
                        database_loader.load_past_results(db, horse_name, results, horse_id)
                del parsed_data
                fetched_count += 1

            if was_scraped:
                time.sleep(random.uniform(2.5, 5.0))

            if idx % 10 == 0:
                gc.collect()

        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to process horse_id {horse_id}: {e}")
            db.rollback()

    print(f"  -> Horse data complete: {fetched_count} fetched / {skipped_count} skipped")
    sys.stdout.flush()
    sys.stderr.flush()
    gc.collect()


def update_race_results(db: Session, target_date: datetime.date):
    """
    指定日のレース結果をスクレイピングしてDBに更新する。

    force_download=True で結果確定後の最新HTMLを常に取得する。
    """
    print(f"\n--- [RESULTS] Updating race results for {target_date.strftime('%Y-%m-%d')} ---")
    races_in_db = db.query(models.Race).filter(models.Race.race_date == target_date).all()
    if not races_in_db:
        print(f"No races found in DB for {target_date.strftime('%Y-%m-%d')}.")
        return

    all_race_ids = []
    for race in races_in_db:
        is_nar = int(race.id[4:6]) >= 30
        all_race_ids.append((race.id, is_nar))

    print(f"Found {len(all_race_ids)} races in DB to update results.")
    sys.stdout.flush()
    print(f"Processing in batches of {_DEFAULT_RESULT_BATCH} (GitHub Actions: {_IS_GITHUB_ACTIONS})")

    for i, (race_id, is_nar) in enumerate(
        tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False),
        1,
    ):
        try:
            result_html = get_race_result_html_content(race_id, is_nar=is_nar, force_download=True)
            if result_html:
                race_data = parser.parse_race_result_page(result_html, race_id)
                if race_data and race_data.get('results'):
                    database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
                else:
                    tqdm.write(
                        f"  -> [Info] No results data for {race_id} (e.g., cancelled)."
                    )
                del race_data
            else:
                tqdm.write(f"  -> [Warning] Failed to get result HTML for {race_id}.")
            del result_html

            if i % _DEFAULT_RESULT_BATCH == 0:
                gc.collect()

        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Race Result processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

    sys.stdout.flush()
    sys.stderr.flush()
    gc.collect()


@dataclass(frozen=True)
class PredictionCompletenessIssue:
    """対象日の予測データを公開できない理由。"""

    race_id: str
    venue_name: str
    race_number: Optional[int]
    race_name: str
    reason: str

    def format_for_log(self) -> str:
        race_number = f"{self.race_number}R" if self.race_number is not None else "R番号不明"
        return (
            f"{self.race_id} {self.venue_name or '会場不明'} {race_number} "
            f"{self.race_name or 'レース名不明'}: {self.reason}"
        )


def _prediction_value(row: Any, key: str) -> Any:
    if isinstance(row, dict):
        return row.get(key)
    return getattr(row, key, None)


def _has_valid_deviation_score(row: Any) -> bool:
    value = _prediction_value(row, "deviation_score")
    if value is None:
        return False
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _prediction_rows_issue(race: Optional[models.Race], predictions: List[Any]) -> Optional[str]:
    if race is None:
        return "Raceレコードがありません"
    if not predictions:
        return "Predictionレコードがありません"
    if any(_has_valid_deviation_score(prediction) for prediction in predictions):
        return None

    exclusion_reason = prediction_exclusion_reason(race.race_name, race.course_type)
    if exclusion_reason:
        reasons = {
            str(_prediction_value(prediction, "unpredictable_reason") or "").strip()
            for prediction in predictions
        }
        if reasons == {exclusion_reason}:
            return None
        return "新馬・障害の予測対象外理由が不完全です"

    reasons = {
        str(_prediction_value(prediction, "unpredictable_reason") or "").strip()
        for prediction in predictions
        if _prediction_value(prediction, "unpredictable_reason")
    }
    if "予測計算中にエラーが発生" in reasons:
        return "一般レースの予測計算エラーが残っています"
    return "一般レースに有効なAI偏差値がありません"


def _prediction_payload_issue(
    db: Session,
    race_id: str,
    predictions: Optional[List[Dict[str, Any]]],
) -> Optional[str]:
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    return _prediction_rows_issue(race, list(predictions or []))


def _generate_and_save_prediction(db: Session, race_id: str) -> Optional[str]:
    predictions = predictor.create_predictions_for_race(race_id, db)
    issue = _prediction_payload_issue(db, race_id, predictions)
    if issue:
        return issue

    database_loader.save_prediction(db, race_id, predictions or [])
    horse_ids_in_race = [
        prediction["horse_id"]
        for prediction in predictions or []
        if prediction.get("horse_id")
    ]
    if horse_ids_in_race:
        try:
            predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
        except Exception as error:
            # 予測本体はsave_prediction()で既に確定済み。対戦成績だけの失敗で
            # 有効な予測を公開不可にしない。
            db.rollback()
            tqdm.write(f"  -> [Warning] Matchup calculation for {race_id} failed: {error}")
    return None


def _retry_prediction_race(
    db: Session,
    race_id: str,
    is_nar: bool,
    target_date: date,
) -> Optional[str]:
    """失敗した1レースだけを再取得し、予測の原子的置換まで行う。"""
    try:
        shutuba_html = get_shutuba_html_content(
            race_id,
            is_nar=is_nar,
            force_download=True,
        )
        if not shutuba_html:
            return "再試行でも出馬表HTMLを取得できません"

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        horses = shutuba_data.get("horses", []) if shutuba_data else []
        if not horses:
            return "再試行した出馬表に出走馬がありません"

        database_loader.load_shutuba_data(
            db,
            shutuba_data,
            race_id,
            target_date,
            is_nar,
        )
        horse_ids = {
            horse["horse_id"]
            for horse in horses
            if horse.get("horse_id")
        }
        _fetch_and_load_horse_past_data(db, horse_ids, target_date)
        return _generate_and_save_prediction(db, race_id)
    except Exception as error:
        db.rollback()
        traceback.print_exc()
        return f"再試行中の例外: {error}"


def audit_prediction_completeness(
    db: Session,
    expected_races: List[Tuple[str, bool]],
    refresh_failures: Optional[Dict[str, str]] = None,
) -> List[PredictionCompletenessIssue]:
    """今回の更新結果とDB上の公開可能性を対象レース単位で監査する。"""
    race_ids = list(dict.fromkeys(race_id for race_id, _ in expected_races))
    if not race_ids:
        return []

    races = db.query(models.Race).filter(models.Race.id.in_(race_ids)).all()
    race_by_id = {race.id: race for race in races}
    predictions = db.query(models.Prediction).filter(
        models.Prediction.race_id.in_(race_ids)
    ).all()
    predictions_by_race: Dict[str, List[models.Prediction]] = {}
    for prediction in predictions:
        predictions_by_race.setdefault(prediction.race_id, []).append(prediction)

    issues: List[PredictionCompletenessIssue] = []
    failures = refresh_failures or {}
    for race_id in race_ids:
        race = race_by_id.get(race_id)
        stored_issue = _prediction_rows_issue(
            race,
            predictions_by_race.get(race_id, []),
        )
        refresh_issue = failures.get(race_id)
        if not stored_issue and not refresh_issue:
            continue

        reasons = []
        if refresh_issue:
            reasons.append(f"今回の更新が未完了です（{refresh_issue}）")
        if stored_issue:
            reasons.append(stored_issue)
        issues.append(
            PredictionCompletenessIssue(
                race_id=race_id,
                venue_name=race.venue_name if race else "",
                race_number=race.race_number if race else None,
                race_name=race.race_name if race else "",
                reason=" / ".join(reasons),
            )
        )
    return issues


def _record_prediction_failure(failures: Dict[str, str], race_id: str, reason: str) -> None:
    current = failures.get(race_id)
    if not current:
        failures[race_id] = reason
    elif reason not in current:
        failures[race_id] = f"{current} / {reason}"


def insert_new_predictions(db: Session, target_date: datetime.date):
    """
    指定日の出走表を取得し、予測を生成してDBに保存する。

    更新中も公開中の予測を維持するため、既存データの一括削除は行わない。
    新しい予測が完成したレースだけを save_prediction() で原子的に置き換え、
    取得失敗や予測生成失敗が起きたレースは前回の正常データを残す。
    """
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")

    print(
        "  -> Existing predictions remain available until each refreshed race "
        "is ready to replace them."
    )

    # JRA・NARを別々に確認し、一方だけキャッシュがある場合も他方を取りこぼさない。
    all_race_ids: List[Tuple[str, bool]] = []
    for is_nar in [False, True]:
        dir_path = os.path.join("data", "html_cache", "nar_racelist" if is_nar else "racelist")
        file_path = os.path.join(dir_path, f"{target_date.strftime('%Y%m%d')}.bin")
        race_ids: List[str] = []
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                list_html = f.read()
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)
                if is_nar:
                    race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]

        if not race_ids:
            # キャッシュ書き込み失敗・ネットワーク一時エラー・データ公開後の再取得に対応。
            label = "NAR" if is_nar else "JRA"
            try:
                list_html, fetched = get_race_list_html(
                    target_date.strftime('%Y%m%d'),
                    is_nar=is_nar,
                    force_download=True
                )
                if list_html:
                    race_ids = parser.parse_race_ids_from_list(list_html)
                    if is_nar:
                        race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                    if race_ids:
                        print(f"  -> [FALLBACK] {label}: Found {len(race_ids)} races via direct fetch")
                    else:
                        print(f"  -> [FALLBACK] {label}: No races found via direct fetch")
            except Exception as e:
                print(f"  -> [FALLBACK ERROR] Failed to fetch {label} race list: {e}")
        all_race_ids.extend((race_id, is_nar) for race_id in race_ids)

    # 一覧取得が一時失敗しても、既にDBへ入っている対象日のレースを復旧対象に含める。
    known_race_ids = {race_id for race_id, _ in all_race_ids}
    races_in_db = db.query(models.Race.id).filter(models.Race.race_date == target_date).all()
    for row in races_in_db:
        race_id = row.id
        if race_id in known_race_ids or race_id[4:6] in BANEI_VENUE_CODES:
            continue
        is_nar = len(race_id) >= 6 and int(race_id[4:6]) >= 30
        all_race_ids.append((race_id, is_nar))

    all_race_ids = list(dict.fromkeys(all_race_ids))

    if not all_race_ids:
        raise RuntimeError(
            f"{target_date.strftime('%Y-%m-%d')} のレース一覧とDBレコードを取得できませんでした"
        )

    # step[1/5] で解析した出馬表をキャッシュし、同じHTMLの再解析を避ける。
    shutuba_data_cache: Dict[str, Optional[Dict[str, Any]]] = {}
    all_horse_ids_to_fetch: Set[str] = set()
    refresh_failures: Dict[str, str] = {}

    print(f"\n  -> [1/5] Collecting all horse IDs for {target_date.strftime('%Y-%m-%d')}")
    for race_id, is_nar in tqdm(all_race_ids, desc="  -> Collecting horses", leave=False):
        try:
            shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar, force_download=True)
            if not shutuba_html:
                _record_prediction_failure(
                    refresh_failures,
                    race_id,
                    "出馬表HTMLを取得できません",
                )
                continue
            shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
            shutuba_data_cache[race_id] = shutuba_data
            horses = shutuba_data.get('horses', []) if shutuba_data else []
            if not horses:
                _record_prediction_failure(
                    refresh_failures,
                    race_id,
                    "出馬表に出走馬がありません",
                )
                continue
            for horse in horses:
                if horse.get("horse_id"):
                    all_horse_ids_to_fetch.add(horse["horse_id"])
        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to collect horses for {race_id}: {e}")
            shutuba_data_cache[race_id] = None
            _record_prediction_failure(
                refresh_failures,
                race_id,
                f"出走馬収集中の例外: {e}",
            )

    print(f"\n  -> [2/5] Fetching past performance data for prediction")
    _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch, target_date)

    print(f"\n  -> [3/5] Loading shutuba data into database")
    for race_id, is_nar in tqdm(
        all_race_ids,
        desc=f"Loading Shutuba data ({target_date.strftime('%m-%d')})",
        leave=False,
    ):
        try:
            shutuba_data = shutuba_data_cache.get(race_id)
            if shutuba_data and shutuba_data.get('horses'):
                database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
            else:
                _record_prediction_failure(
                    refresh_failures,
                    race_id,
                    "出馬表をDBへ保存できません",
                )
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Shutuba data processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()
            _record_prediction_failure(
                refresh_failures,
                race_id,
                f"出馬表保存中の例外: {e}",
            )

    del shutuba_data_cache
    gc.collect()

    print(f"\n  -> [4/5] Predicting races and calculating matchups")
    for race_id, is_nar in tqdm(
        all_race_ids,
        desc=f"Predicting Races ({target_date.strftime('%m-%d')})",
        leave=False,
    ):
        try:
            issue = _generate_and_save_prediction(db, race_id)
            if issue:
                tqdm.write(f"  -> [Warning] Prediction for {race_id} is incomplete: {issue}")
                _record_prediction_failure(
                    refresh_failures,
                    race_id,
                    issue,
                )
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Prediction processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()
            _record_prediction_failure(
                refresh_failures,
                race_id,
                f"予測保存中の例外: {e}",
            )

    # DB監査で見つかった欠損も再試行対象へ加え、正常レースは再処理しない。
    for issue in audit_prediction_completeness(db, all_race_ids):
        _record_prediction_failure(refresh_failures, issue.race_id, issue.reason)

    if refresh_failures:
        print(f"\n  -> Retrying {len(refresh_failures)} incomplete races once")
    race_type_by_id = dict(all_race_ids)
    for race_id in list(refresh_failures):
        retry_issue = _retry_prediction_race(
            db,
            race_id,
            race_type_by_id[race_id],
            target_date,
        )
        if retry_issue:
            refresh_failures[race_id] = retry_issue
            tqdm.write(f"  -> [FAILED] Retry for {race_id}: {retry_issue}")
        else:
            refresh_failures.pop(race_id, None)
            tqdm.write(f"  -> [RECOVERED] Retry completed for {race_id}")

    completeness_issues = audit_prediction_completeness(
        db,
        all_race_ids,
        refresh_failures,
    )
    if completeness_issues:
        formatted = "\n".join(
            f"  - {issue.format_for_log()}"
            for issue in completeness_issues
        )
        raise RuntimeError(
            f"{target_date.strftime('%Y-%m-%d')} の予測データ完全性監査に失敗しました:\n{formatted}"
        )

    print(f"  -> Prediction completeness audit passed: {len(all_race_ids)} races")

    print(f"\n  -> [5/5] Generating AI Analysis text for races in batches")
    try:
        from scripts import llm_generator
        target_races = [rid for rid, _ in all_race_ids]
        llm_generator.generate_analyses_in_batches(db, target_races)
    except Exception as e:
        print(f"  -> [WARNING] LLM text generation failed (predictions data is safe): {e}")
        traceback.print_exc()
        # db.rollback() 削除: 予測データは既にコミット済みのため不要
