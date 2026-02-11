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
from typing import List, Tuple
from tqdm import tqdm

BANEI_VENUE_CODES = ["33", "65"]

def _fetch_and_load_horse_past_data(db: Session, horse_ids: set, driver=None):
    """
    指定された馬リストの過去成績を取得しDBに保存する。
    スクレイピング実行後にはランダムな待機時間を設け、サーバー負荷を軽減する。
    driverが渡された場合はそれを使用し、渡されない場合は都度起動（非推奨）する。
    """
    if not horse_ids:
        return

    print(f"\n--- [PREDICTIONS] Fetching past data for {len(horse_ids)} horses ---")

    # ドライバが渡されていない場合、この関数内で管理するか、都度起動するか。
    # ここでは「渡されない場合は都度起動（既存動作）」とするが、
    # 呼び出し元で管理することを強く推奨。
    
    for idx, horse_id in enumerate(tqdm(sorted(list(horse_ids)), desc="  -> Fetching horse data", leave=False)):
        try:
            existing_results_count = db.query(func.count(models.Result.id)).filter(models.Result.horse_id == horse_id).scalar()

            # 件数だけでなくデータの鮮度も考慮してスキップ判定
            # finish_time_sec が非NULLのレース（実際の成績）のみで判定
            # 出走表エントリ（finish_time_sec=NULL）は除外
            force_download = False
            if existing_results_count >= 5:
                latest_race_date = db.query(func.max(models.Race.race_date))\
                    .join(models.Result, models.Result.race_id == models.Race.id)\
                    .filter(models.Result.horse_id == horse_id)\
                    .filter(models.Result.finish_time_sec.isnot(None))\
                    .scalar()
                if latest_race_date and (date.today() - latest_race_date).days < 365:
                    continue
                # データが古い場合はキャッシュを無視して最新データを取得
                force_download = True

            # driverを渡す
            html, was_scraped = get_horse_page_html(horse_id, force_download=force_download, driver=driver)
            
            if html:
                parsed_data = parser.parse_horse_results_page(html)
                if parsed_data and parsed_data.get('results'):
                    horse_name = parsed_data.get('horse_name')
                    results = parsed_data.get('results')
                    if horse_name:
                        database_loader.load_past_results(db, horse_name, results, horse_id)
                # メモリ解放
                del parsed_data

            if was_scraped:
                time.sleep(random.uniform(2.5, 5.0))

            # 10頭ごとにガベージコレクション
            if idx % 10 == 0:
                gc.collect()

        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to process horse_id {horse_id}: {e}")
            db.rollback()

    sys.stdout.flush()
    sys.stderr.flush()
    gc.collect()

def update_race_results(db: Session, target_date: datetime.date):
    print(f"\n--- [RESULTS] Updating race results for {target_date.strftime('%Y-%m-%d')} ---")
    races_in_db = db.query(models.Race).filter(models.Race.race_date == target_date).all()
    if not races_in_db:
        print(f"No races found in DB for {target_date.strftime('%Y-%m-%d')}.")
        return

    all_race_ids = []
    for race in races_in_db:
        is_nar = int(race.id[4:6]) >= 30
        all_race_ids.append((race.id, is_nar))

    # メモリ使用量を削減するため、バッチサイズを設定
    is_render = os.getenv('RENDER') == 'true'
    BATCH_SIZE = 3 if is_render else 10  # Render環境では3件ずつ処理

    print(f"Found {len(all_race_ids)} races in DB to update results.")
    sys.stdout.flush()
    print(f"Processing in batches of {BATCH_SIZE} (Render mode: {is_render})")

    for i, (race_id, is_nar) in enumerate(tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False), 1):
        try:
            result_html = get_race_result_html_content(race_id, is_nar=is_nar)
            if result_html:
                race_data = parser.parse_race_result_page(result_html, race_id)
                if race_data and race_data.get('results'):
                    database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
                else:
                    tqdm.write(f"  -> [Info] No results data to update for {race_id} (e.g., cancelled race).")
                # メモリ解放
                del race_data
            else:
                tqdm.write(f"  -> [Warning] Failed to get result HTML for {race_id}.")
            # メモリ解放
            del result_html

            # バッチごとにガベージコレクション実行
            if i % BATCH_SIZE == 0:
                gc.collect()

        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Race Result processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

    # 最後にガベージコレクション実行
    sys.stdout.flush()
    sys.stderr.flush()
    gc.collect()

def insert_new_predictions(db: Session, target_date: datetime.date):
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")
    try:
        print(f"  -> Cleaning predictions/matchups for {target_date.strftime('%Y-%m-%d')}...")
        # predictions と matchups のみ削除（races, results, race_returns は温存）
        # load_shutuba_data は UPSERT（ON CONFLICT DO UPDATE）を使用するため、
        # 事前にraces/resultsを削除する必要はない。
        # races/resultsを削除すると、馬の過去成績が失われ偏差値計算に悪影響を与える。
        races_for_date_stmt = select(models.Race.id).where(models.Race.race_date == target_date)

        BATCH_SIZE = 100
        total_cleaned = 0

        while True:
            batch_stmt = races_for_date_stmt.limit(BATCH_SIZE)
            race_ids_batch = [r[0] for r in db.execute(batch_stmt).fetchall()]
            if not race_ids_batch:
                break

            db.query(models.Matchup).filter(models.Matchup.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.query(models.Prediction).filter(models.Prediction.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
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
                    race_ids = [
                        rid for rid in race_ids
                        if rid[4:6] not in BANEI_VENUE_CODES
                    ]
                all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    all_horse_ids_to_fetch = set()
    print(f"\n  -> [1/4] Collecting all horse IDs for {target_date.strftime('%Y-%m-%d')}")
    for race_id, is_nar in tqdm(all_race_ids, desc="  -> Collecting horses", leave=False):
        shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar)
        if shutuba_html:
            shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
            if shutuba_data and shutuba_data.get('horses'):
                for horse in shutuba_data.get("horses", []):
                    if horse.get("horse_id"):
                        all_horse_ids_to_fetch.add(horse["horse_id"])

    print(f"\n  -> [2/4] Fetching past performance data for prediction")
    
    # ドライバをここで初期化して渡す
    from scripts.scraper import _prepare_chrome_driver, cleanup_chrome_driver
    driver = None
    try:
        # 馬データ取得が必要な場合のみドライバを起動
        if all_horse_ids_to_fetch:
             # 既にDBにデータがある馬を除外して、本当にスクレイピングが必要か確認しても良いが、
             # _fetch_and_load_horse_past_data 内でもチェックしている。
             # ここではシンプルに起動する。
             try:
                 driver = _prepare_chrome_driver()
             except Exception as e:
                 print(f"Warning: Failed to initialize driver: {e}")
        
        _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch, driver=driver)
    
    finally:
        if driver:
            cleanup_chrome_driver(driver)
        gc.collect()

    print(f"\n  -> [3/4] Loading shutuba data into database")
    desc_step3 = f"Loading Shutuba data ({target_date.strftime('%m-%d')})"
    for race_id, is_nar in tqdm(all_race_ids, desc=desc_step3, leave=False):
        try:
            shutuba_html = get_shutuba_html_content(race_id, is_nar=is_nar)
            if shutuba_html:
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if shutuba_data and shutuba_data.get('horses'):
                    database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Shutuba data processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

    print(f"\n  -> [4/4] Predicting races and calculating matchups")
    desc_step4 = f"Predicting Races ({target_date.strftime('%m-%d')})"
    for race_id, is_nar in tqdm(all_race_ids, desc=desc_step4, leave=False):
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