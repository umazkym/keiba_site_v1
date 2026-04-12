import datetime
import gc
import os
import sys
import traceback
import time
import random
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from database import models
from scripts.scraper import get_shutuba_html_content, get_race_result_html_content, get_horse_page_html, get_race_list_html
from scripts import parser, database_loader, predictor
from typing import List, Tuple, Dict, Optional, Set
from tqdm import tqdm

BANEI_VENUE_CODES = ["33", "65"]

_IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"
_DEFAULT_RESULT_BATCH = 3 if _IS_GITHUB_ACTIONS else 10

# 最近出走した馬とみなす日数
# この日数以内に出走実績がある馬 → 成績が更新されている可能性が高いので再取得
# それ以外で既にDB成績5件以上の馬 → スキップ（データは十分で変化なし）
_RECENT_RACE_DAYS = 7


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
      ② 最終出走日が _RECENT_RACE_DAYS 日より前である
         （= 最近出走しておらず、成績に変化がない可能性が高い）

    フェッチ対象になる馬:
      ・DB成績が4件以下（新馬・転入馬など、データが不足）
      ・最近7日以内に出走した馬（成績が更新されている可能性大）

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
        and row.last_race_date < recent_cutoff
    }

    total = len(horse_ids)
    skip_count = len(skip_set)
    fetch_count = total - skip_count
    print(
        f"  -> Horse fetch plan: {total} total / "
        f"{skip_count} skip (DB data sufficient) / "
        f"{fetch_count} fetch (new or recently raced)"
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


def insert_new_predictions(db: Session, target_date: datetime.date):
    """
    指定日の出走表を取得し、予測を生成してDBに保存する。
    """
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")

    # --- 既存の予測・マッチアップをクリーンアップ ---
    try:
        print(f"  -> Cleaning predictions/matchups for {target_date.strftime('%Y-%m-%d')}...")
        races_for_date_stmt = select(models.Race.id).where(models.Race.race_date == target_date)

        # ★ クリーンアップループバグ修正
        # 旧: while True + LIMIT でレースを削除せず無限ループ → 1034件という誤表示
        # 新: 1クエリで全件取得してからまとめて削除
        all_race_ids_for_cleanup = [
            r[0] for r in db.execute(races_for_date_stmt).fetchall()
        ]
        total_cleaned = len(all_race_ids_for_cleanup)

        if all_race_ids_for_cleanup:
            db.query(models.Matchup).filter(
                models.Matchup.race_id.in_(all_race_ids_for_cleanup)
            ).delete(synchronize_session=False)
            db.query(models.Prediction).filter(
                models.Prediction.race_id.in_(all_race_ids_for_cleanup)
            ).delete(synchronize_session=False)
            db.commit()
            del all_race_ids_for_cleanup
            gc.collect()

        if total_cleaned > 0:
            print(f"  -> Cleaned predictions/matchups for {total_cleaned} races.")
        else:
            print(f"  -> No existing predictions found for {target_date.strftime('%Y-%m-%d')}")

    except Exception as e:
        print(f"  -> An error occurred during cleanup, rolling back: {e}")
        db.rollback()
        return
    finally:
        gc.collect()

    # --- キャッシュされたレース一覧から race_id を収集 ---
    all_race_ids: List[Tuple[str, bool]] = []
    for is_nar in [False, True]:
        dir_path = os.path.join("data", "html_cache", "nar_racelist" if is_nar else "racelist")
        file_path = os.path.join(dir_path, f"{target_date.strftime('%Y%m%d')}.bin")
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                list_html = f.read()
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)
                if is_nar:
                    race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        # フォールバック: キャッシュが空の場合、直接netkeibaから再取得を試みる
        # キャッシュ書き込み失敗・ネットワーク一時エラー・データ未公開後の公開 等に対応
        print(f"  -> [FALLBACK] No cached race data found for {target_date.strftime('%Y-%m-%d')}. Retrying direct fetch...")
        for is_nar in [False, True]:
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
                        all_race_ids.extend([(rid, is_nar) for rid in race_ids])
                        print(f"  -> [FALLBACK] {label}: Found {len(race_ids)} races via direct fetch")
                    else:
                        print(f"  -> [FALLBACK] {label}: No races found via direct fetch")
            except Exception as e:
                print(f"  -> [FALLBACK ERROR] Failed to fetch {label} race list: {e}")

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    # step[1/5] で取得した shutuba HTML をキャッシュ（二重ダウンロード防止）
    shutuba_cache: Dict[str, Optional[str]] = {}
    all_horse_ids_to_fetch: Set[str] = set()

    print(f"\n  -> [1/5] Collecting all horse IDs for {target_date.strftime('%Y-%m-%d')}")
    for race_id, is_nar in tqdm(all_race_ids, desc="  -> Collecting horses", leave=False):
        try:
            shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar, force_download=True)
            shutuba_cache[race_id] = shutuba_html
            if shutuba_html:
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if shutuba_data and shutuba_data.get('horses'):
                    for horse in shutuba_data.get("horses", []):
                        if horse.get("horse_id"):
                            all_horse_ids_to_fetch.add(horse["horse_id"])
        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to collect horses for {race_id}: {e}")

    print(f"\n  -> [2/5] Fetching past performance data for prediction")
    _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch, target_date)

    print(f"\n  -> [3/5] Loading shutuba data into database")
    for race_id, is_nar in tqdm(
        all_race_ids,
        desc=f"Loading Shutuba data ({target_date.strftime('%m-%d')})",
        leave=False,
    ):
        try:
            shutuba_html = shutuba_cache.get(race_id)
            if shutuba_html:
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if shutuba_data and shutuba_data.get('horses'):
                    database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Shutuba data processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

    del shutuba_cache
    gc.collect()

    print(f"\n  -> [4/5] Predicting races and calculating matchups")
    for race_id, is_nar in tqdm(
        all_race_ids,
        desc=f"Predicting Races ({target_date.strftime('%m-%d')})",
        leave=False,
    ):
        try:
            predictions = predictor.create_predictions_for_race(race_id, db)
            if predictions:
                database_loader.save_prediction(db, race_id, predictions)
                horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
                if horse_ids_in_race:
                    predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
            else:
                tqdm.write(f"  -> [Warning] No predictions generated for {race_id}.")
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Prediction processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

    print(f"\n  -> [5/5] Generating AI Analysis text for races in batches")
    try:
        from scripts import llm_generator
        target_races = [rid for rid, _ in all_race_ids]
        llm_generator.generate_analyses_in_batches(db, target_races)
    except Exception as e:
        print(f"  -> [WARNING] LLM text generation failed (predictions data is safe): {e}")
        traceback.print_exc()
        # db.rollback() 削除: 予測データは既にコミット済みのため不要