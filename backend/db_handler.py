# import datetime
# import gc
# import os
# import sys
# import traceback
# import time
# import random
# from datetime import date
# from sqlalchemy.orm import Session
# from sqlalchemy import func, select
# from database import models
# from scripts.scraper import get_shutuba_html_content, get_race_result_html_content, get_horse_page_html
# from scripts import parser, database_loader, predictor
# from typing import List, Tuple, Dict, Optional
# from tqdm import tqdm

# BANEI_VENUE_CODES = ["33", "65"]


# def _fetch_and_load_horse_past_data(db: Session, horse_ids: set):
#     """
#     指定された馬リストの過去成績を取得しDBに保存する。

#     ★ 修正①: N+1クエリ問題を解消
#         変更前: 馬1頭ごとに COUNT + MAX の2クエリを個別発行
#                 → 16頭レース × 全レース数 = 数千クエリ/日
#         変更後: DBへの事前チェッククエリ自体を削除

#     ★ 修正②: 成績更新スキップバグを修正（「6日で出走しても更新されない」原因）
#         変更前: valid_results_count >= 5 かつ最終出走1年以内 → continue でスキップ
#                 → 一度成績が5件溜まった馬は永遠に新しい成績が取得されない
#         変更後: continue ブロックを完全削除
#                 scraper.py の HORSE_HTML_CACHE_MAX_AGE_SECONDS（5日）が鮮度を制御する
#                   - キャッシュ < 5日: ファイルから返す（ネットアクセスなし）
#                   - キャッシュ ≥ 5日 or 未取得: ネットから最新ページを取得
#                 → 6日に1回出走する馬は、次のパイプライン実行時に確実に更新される

#     ★ 不要なドライバ引数を削除
#         get_horse_page_html は use_selenium=False / requests で動作する。
#         driver 引数は内部で完全に無視されており、引き渡す意味がない。
#         （呼び出し元の _prepare_chrome_driver() 起動コストも節約）
#     """
#     if not horse_ids:
#         return

#     print(f"\n--- [PREDICTIONS] Fetching past data for {len(horse_ids)} horses ---")

#     for idx, horse_id in enumerate(
#         tqdm(sorted(list(horse_ids)), desc="  -> Fetching horse data", leave=False)
#     ):
#         try:
#             # ★ 修正①②: DBへのスキップ判定クエリ（COUNT/MAX）を完全削除。
#             # scraper.py の 5日キャッシュ制御（max_age_seconds）に委ねる。
#             # force_download=False → キャッシュ未期限切れなら再取得しない。
#             html, was_scraped = get_horse_page_html(horse_id, force_download=False)

#             if html:
#                 parsed_data = parser.parse_horse_results_page(html)
#                 if parsed_data and parsed_data.get('results'):
#                     horse_name = parsed_data.get('horse_name')
#                     results = parsed_data.get('results')
#                     if horse_name:
#                         database_loader.load_past_results(db, horse_name, results, horse_id)
#                 del parsed_data

#             if was_scraped:
#                 time.sleep(random.uniform(2.5, 5.0))

#             if idx % 10 == 0:
#                 gc.collect()

#         except Exception as e:
#             tqdm.write(f"\n[ERROR] Failed to process horse_id {horse_id}: {e}")
#             db.rollback()

#     sys.stdout.flush()
#     sys.stderr.flush()
#     gc.collect()


# def update_race_results(db: Session, target_date: datetime.date):
#     """
#     指定日のレース結果をスクレイピングしてDBに更新する。

#     ★ 修正③: force_download=True を追加
#         変更前: force_download 指定なし（デフォルト False）
#                 → レース前の暫定ページや 404 のキャッシュが残り続け、
#                   結果・払い戻しが永遠に反映されない
#         変更後: force_download=True で常に最新の確定結果を取得
#     """
#     print(f"\n--- [RESULTS] Updating race results for {target_date.strftime('%Y-%m-%d')} ---")
#     races_in_db = db.query(models.Race).filter(models.Race.race_date == target_date).all()
#     if not races_in_db:
#         print(f"No races found in DB for {target_date.strftime('%Y-%m-%d')}.")
#         return

#     all_race_ids = []
#     for race in races_in_db:
#         is_nar = int(race.id[4:6]) >= 30
#         all_race_ids.append((race.id, is_nar))

#     is_render = os.getenv('RENDER') == 'true'
#     BATCH_SIZE = 3 if is_render else 10

#     print(f"Found {len(all_race_ids)} races in DB to update results.")
#     sys.stdout.flush()
#     print(f"Processing in batches of {BATCH_SIZE} (Render mode: {is_render})")

#     for i, (race_id, is_nar) in enumerate(
#         tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False),
#         1
#     ):
#         try:
#             # ★ 修正③: force_download=True — 結果確定後の最新HTMLを必ず取得
#             result_html = get_race_result_html_content(race_id, is_nar=is_nar, force_download=True)
#             if result_html:
#                 race_data = parser.parse_race_result_page(result_html, race_id)
#                 if race_data and race_data.get('results'):
#                     database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
#                 else:
#                     tqdm.write(
#                         f"  -> [Info] No results data to update for {race_id} (e.g., cancelled race)."
#                     )
#                 del race_data
#             else:
#                 tqdm.write(f"  -> [Warning] Failed to get result HTML for {race_id}.")
#             del result_html

#             if i % BATCH_SIZE == 0:
#                 gc.collect()

#         except Exception as e:
#             tqdm.write(f"\n[CRITICAL ERROR] Race Result processing for {race_id} failed: {e}")
#             traceback.print_exc()
#             db.rollback()

#     sys.stdout.flush()
#     sys.stderr.flush()
#     gc.collect()


# def insert_new_predictions(db: Session, target_date: datetime.date):
#     """
#     指定日の出走表を取得し、予測を生成してDBに保存する。

#     ★ 修正③: get_shutuba_html_content に force_download=True を追加
#         変更前: force_download 指定なし
#                 → 枠順未確定・取消前の古い出走表がキャッシュに残り、
#                   予測に誤った情報が使われる
#         変更後: force_download=True で常に最新の出走表を取得

#     ★ 二重ダウンロード問題を解消
#         変更前: step[1/4]（馬ID収集）と step[3/4]（出走表DB投入）で
#                 同じ race_id の shutuba_html を2回取得
#                 force_download=True にすると2回ともネット通信が発生する
#         変更後: step[1/4] の取得結果を shutuba_cache に保持し、
#                 step[3/4] ではキャッシュから再利用（ネット通信1回のみ）

#     ★ 不要なドライバ初期化を削除
#         変更前: _prepare_chrome_driver() を起動して _fetch_and_load_horse_past_data に渡していた
#                 get_horse_page_html は内部で requests を使うため driver は無視される
#         変更後: driver 関連コードを削除（Chrome起動コスト・メモリを節約）
#     """
#     print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")

#     # --- 既存の予測・マッチアップをクリーンアップ ---
#     try:
#         print(f"  -> Cleaning predictions/matchups for {target_date.strftime('%Y-%m-%d')}...")
#         races_for_date_stmt = select(models.Race.id).where(models.Race.race_date == target_date)

#         BATCH_SIZE = 100
#         total_cleaned = 0

#         while True:
#             batch_stmt = races_for_date_stmt.limit(BATCH_SIZE)
#             race_ids_batch = [r[0] for r in db.execute(batch_stmt).fetchall()]
#             if not race_ids_batch:
#                 break

#             db.query(models.Matchup).filter(
#                 models.Matchup.race_id.in_(race_ids_batch)
#             ).delete(synchronize_session=False)
#             db.query(models.Prediction).filter(
#                 models.Prediction.race_id.in_(race_ids_batch)
#             ).delete(synchronize_session=False)
#             db.commit()

#             total_cleaned += len(race_ids_batch)
#             del race_ids_batch
#             gc.collect()

#             if total_cleaned >= 1000:
#                 break

#         if total_cleaned > 0:
#             print(f"  -> Cleaned predictions/matchups for {total_cleaned} races.")
#         else:
#             print(f"  -> No existing predictions found for {target_date.strftime('%Y-%m-%d')}")
#     except Exception as e:
#         print(f"  -> An error occurred during cleanup, rolling back: {e}")
#         db.rollback()
#         return
#     finally:
#         gc.collect()

#     # --- キャッシュされたレース一覧から race_id を収集 ---
#     all_race_ids: List[Tuple[str, bool]] = []
#     for is_nar in [False, True]:
#         dir_path = os.path.join("data", "html_cache", "nar_racelist" if is_nar else "racelist")
#         file_path = os.path.join(dir_path, f"{target_date.strftime('%Y%m%d')}.bin")
#         if os.path.exists(file_path):
#             with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
#                 list_html = f.read()
#             if list_html:
#                 race_ids = parser.parse_race_ids_from_list(list_html)
#                 if is_nar:
#                     race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
#                 all_race_ids.extend([(rid, is_nar) for rid in race_ids])

#     if not all_race_ids:
#         print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
#         return

#     # ★ shutuba HTML を step[1/5] で一度だけ取得し辞書に保持
#     # step[3/5] ではこの辞書から再利用する（二重ダウンロードを排除）
#     shutuba_cache: Dict[str, Optional[str]] = {}
#     all_horse_ids_to_fetch: set = set()

#     print(f"\n  -> [1/5] Collecting all horse IDs for {target_date.strftime('%Y-%m-%d')}")
#     for race_id, is_nar in tqdm(all_race_ids, desc="  -> Collecting horses", leave=False):
#         try:
#             # ★ 修正③: force_download=True — 枠順確定後の最新出走表を必ず取得
#             shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar, force_download=True)
#             # ★ 二重ダウンロード解消: 取得結果をキャッシュ
#             shutuba_cache[race_id] = shutuba_html
#             if shutuba_html:
#                 shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
#                 if shutuba_data and shutuba_data.get('horses'):
#                     for horse in shutuba_data.get("horses", []):
#                         if horse.get("horse_id"):
#                             all_horse_ids_to_fetch.add(horse["horse_id"])
#         except Exception as e:
#             tqdm.write(f"\n[ERROR] Failed to collect horses for {race_id}: {e}")

#     print(f"\n  -> [2/5] Fetching past performance data for prediction")
#     # ★ 不要なドライバ初期化を削除
#     # get_horse_page_html は requests を使うため Chrome は不要
#     _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch)

#     print(f"\n  -> [3/5] Loading shutuba data into database")
#     desc_step3 = f"Loading Shutuba data ({target_date.strftime('%m-%d')})"
#     for race_id, is_nar in tqdm(all_race_ids, desc=desc_step3, leave=False):
#         try:
#             # ★ 二重ダウンロード解消: step[1/5] で取得済みのHTMLを再利用
#             shutuba_html = shutuba_cache.get(race_id)
#             if shutuba_html:
#                 shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
#                 if shutuba_data and shutuba_data.get('horses'):
#                     database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
#         except Exception as e:
#             tqdm.write(f"\n[CRITICAL ERROR] Shutuba data processing for {race_id} failed: {e}")
#             traceback.print_exc()
#             db.rollback()

#     # メモリ解放
#     del shutuba_cache
#     gc.collect()

#     print(f"\n  -> [4/5] Predicting races and calculating matchups")
#     desc_step4 = f"Predicting Races ({target_date.strftime('%m-%d')})"
#     for race_id, is_nar in tqdm(all_race_ids, desc=desc_step4, leave=False):
#         try:
#             predictions = predictor.create_predictions_for_race(race_id, db)
#             if predictions:
#                 database_loader.save_prediction(db, race_id, predictions)
#                 horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
#                 if horse_ids_in_race:
#                     predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
#             else:
#                 tqdm.write(f"  -> [Warning] No predictions were generated for {race_id}.")
#         except Exception as e:
#             tqdm.write(f"\n[CRITICAL ERROR] Prediction processing for {race_id} failed: {e}")
#             traceback.print_exc()
#             db.rollback()

#     print(f"\n  -> [5/5] Generating AI Analysis text for races in batches")
#     try:
#         from scripts import llm_generator
#         target_races = [rid for rid, _ in all_race_ids]
#         llm_generator.generate_analyses_in_batches(db, target_races)
#     except Exception as e:
#         print(f"  -> [CRITICAL ERROR] LLM Batch Generation failed: {e}")
#         traceback.print_exc()
#         db.rollback()

import datetime
import gc
import os
import sys
import traceback
import time
import random
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from database import models
from scripts.scraper import get_shutuba_html_content, get_race_result_html_content, get_horse_page_html
from scripts import parser, database_loader, predictor
from typing import List, Tuple, Dict, Optional
from tqdm import tqdm

BANEI_VENUE_CODES = ["33", "65"]

# GitHub Actions は短命バッチプロセスのため小バッチで処理
# ローカルはリソース余裕あり
_IS_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"
_DEFAULT_RESULT_BATCH = 3 if _IS_GITHUB_ACTIONS else 10


def _fetch_and_load_horse_past_data(db: Session, horse_ids: set):
    """
    指定された馬リストの過去成績を取得しDBに保存する。

    ★ 修正①: N+1クエリ問題を解消
        変更前: 馬1頭ごとに COUNT + MAX の2クエリを個別発行
                → 16頭レース × 全レース数 = 数千クエリ/日
        変更後: DBへの事前チェッククエリ自体を削除

    ★ 修正②: 成績更新スキップバグを修正（「6日で出走しても更新されない」原因）
        変更前: valid_results_count >= 5 かつ最終出走1年以内 → continue でスキップ
                → 一度成績が5件溜まった馬は永遠に新しい成績が取得されない
        変更後: continue ブロックを完全削除。
                scraper.py の HORSE_HTML_CACHE_MAX_AGE_SECONDS（5日）が鮮度を制御する:
                  - キャッシュ < 5日: ファイルから返す（ネットアクセスなし）
                  - キャッシュ ≥ 5日 or 未取得: ネットから最新ページを取得
                → 6日に1回出走する馬は次のパイプライン実行時に確実に更新される

    ★ 不要なドライバ引数を削除
        get_horse_page_html は use_selenium=False / requests で動作する。
        driver 引数は内部で完全に無視されており、引き渡す意味がない。
    """
    if not horse_ids:
        return

    print(f"\n--- [PREDICTIONS] Fetching past data for {len(horse_ids)} horses ---")

    # ★ 修正②: N+1防止のためのバルククエリ
    # 各馬の既存成績（finish_time_sec が有効な実戦成績）の件数を一括取得
    horse_stats = {}
    if horse_ids:
        # BATCHでIN句を分割（PostgreSQLの制限やメモリ制限対策）
        batch_size = 500
        horse_ids_list = list(horse_ids)
        for i in range(0, len(horse_ids_list), batch_size):
            batch_ids = horse_ids_list[i:i + batch_size]
            stmt = select(
                models.Result.horse_id,
                func.count(models.Result.id)
            ).where(
                models.Result.horse_id.in_(batch_ids),
                models.Result.finish_time_sec.isnot(None)
            ).group_by(models.Result.horse_id)
            
            for hid, count in db.execute(stmt).fetchall():
                horse_stats[hid] = count

    for idx, horse_id in enumerate(
        tqdm(sorted(list(horse_ids)), desc="  -> Fetching horse data", leave=False)
    ):
        try:
            # ★ 修正①②: DBへのスキップ判定クエリ（COUNT/MAX）を完全削除。
            # scraper.py の 5日キャッシュ制御に委ねる。
            html, was_scraped = get_horse_page_html(horse_id, force_download=False)

            existing_count = horse_stats.get(horse_id, 0)
            
            # ★ 修正: was_scraped == True（通信した）か、既存件数が5件未満の場合のみパースとUPSERTを実行
            if html and (was_scraped or existing_count < 5):
                parsed_data = parser.parse_horse_results_page(html)
                if parsed_data and parsed_data.get('results'):
                    horse_name = parsed_data.get('horse_name')
                    results = parsed_data.get('results')
                    if horse_name:
                        database_loader.load_past_results(db, horse_name, results, horse_id)
                del parsed_data

            if was_scraped:
                time.sleep(random.uniform(2.5, 5.0))

            if idx % 10 == 0:
                gc.collect()

        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to process horse_id {horse_id}: {e}")
            db.rollback()

    sys.stdout.flush()
    sys.stderr.flush()
    gc.collect()


def update_race_results(db: Session, target_date: datetime.date):
    """
    指定日のレース結果をスクレイピングしてDBに更新する。

    ★ 修正③: force_download=True を追加
        変更前: キャッシュが残り結果・払い戻しが永遠に反映されない
        変更後: 常に最新の確定結果を取得
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
        1
    ):
        try:
            # ★ 修正③: force_download=True ではなく target_date を渡してキャッシュ制御
            result_html = get_race_result_html_content(race_id, is_nar=is_nar, force_download=False, target_date=target_date)
            if result_html:
                race_data = parser.parse_race_result_page(result_html, race_id)
                if race_data and race_data.get('results'):
                    database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
                else:
                    tqdm.write(
                        f"  -> [Info] No results data to update for {race_id} (e.g., cancelled race)."
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

    ★ 修正③: get_shutuba_html_content に force_download=True を追加
        枠順確定前・取消前の古い出走表がキャッシュに残る問題を修正。

    ★ 二重ダウンロード問題を解消
        step[1/5] と step[3/5] で同じ shutuba_html を2回取得していた。
        shutuba_cache に保持して step[3/5] で再利用（ネット通信1回のみ）。

    ★ 不要なドライバ初期化を削除
        get_horse_page_html は requests を使うため Chrome は不要。
    """
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")

    # --- 既存の予測・マッチアップをクリーンアップ ---
    try:
        print(f"  -> Cleaning predictions/matchups for {target_date.strftime('%Y-%m-%d')}...")
        races_for_date_stmt = select(models.Race.id).where(models.Race.race_date == target_date)

        CLEANUP_BATCH = 100
        total_cleaned = 0

        while True:
            batch_stmt = races_for_date_stmt.limit(CLEANUP_BATCH)
            race_ids_batch = [r[0] for r in db.execute(batch_stmt).fetchall()]
            if not race_ids_batch:
                break

            db.query(models.Matchup).filter(
                models.Matchup.race_id.in_(race_ids_batch)
            ).delete(synchronize_session=False)
            db.query(models.Prediction).filter(
                models.Prediction.race_id.in_(race_ids_batch)
            ).delete(synchronize_session=False)
            db.commit()

            total_cleaned += len(race_ids_batch)
            del race_ids_batch
            gc.collect()

            if total_cleaned >= 1000:
                break

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
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    # ★ shutuba HTML を step[1/5] で一度だけ取得してキャッシュ
    # step[3/5] ではこの辞書から再利用（二重ダウンロードを排除）
    shutuba_cache: Dict[str, Optional[str]] = {}
    all_horse_ids_to_fetch: set = set()

    print(f"\n  -> [1/5] Collecting all horse IDs for {target_date.strftime('%Y-%m-%d')}")
    for race_id, is_nar in tqdm(all_race_ids, desc="  -> Collecting horses", leave=False):
        try:
            # ★ 修正③: force_download=True ではなく target_date を渡してキャッシュ制御
            shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar, force_download=False, target_date=target_date)
            shutuba_cache[race_id] = shutuba_html  # ★ キャッシュ保持
            if shutuba_html:
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if shutuba_data and shutuba_data.get('horses'):
                    for horse in shutuba_data.get("horses", []):
                        if horse.get("horse_id"):
                            all_horse_ids_to_fetch.add(horse["horse_id"])
        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to collect horses for {race_id}: {e}")

    print(f"\n  -> [2/5] Fetching past performance data for prediction")
    # ★ 不要な Chrome ドライバ初期化を削除
    # get_horse_page_html は requests を使うため driver は不要
    _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch)

    print(f"\n  -> [3/5] Loading shutuba data into database")
    for race_id, is_nar in tqdm(
        all_race_ids,
        desc=f"Loading Shutuba data ({target_date.strftime('%m-%d')})",
        leave=False
    ):
        try:
            # ★ 二重ダウンロード解消: step[1/5] 取得済みの HTML を再利用
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
        leave=False
    ):
        try:
            predictions = predictor.create_predictions_for_race(race_id, db)
            if predictions:
                database_loader.save_prediction(db, race_id, predictions)
                horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
                if horse_ids_in_race:
                    predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
            else:
                tqdm.write(f"  -> [Warning] No predictions were generated for {race_id}.")
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
        print(f"  -> [CRITICAL ERROR] LLM Batch Generation failed: {e}")
        traceback.print_exc()
        db.rollback()