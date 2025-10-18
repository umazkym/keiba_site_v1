import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from database import models
from scripts.scraper import get_shutuba_html_content, get_race_result_html_content, get_horse_page_html
from scripts import parser, database_loader, predictor
from typing import List, Tuple
from tqdm import tqdm
import os
import traceback
import time
import random

BANEI_VENUE_CODES = ["33", "65"]

def _fetch_and_load_horse_past_data(db: Session, horse_ids: set):
    """
    指定された馬リストの過去成績を取得しDBに保存する。
    スクレイピング実行後にはランダムな待機時間を設け、サーバー負荷を軽減する。
    """
    if not horse_ids:
        return

    print(f"\n--- [PREDICTIONS] Fetching past data for {len(horse_ids)} horses ---")

    for horse_id in tqdm(sorted(list(horse_ids)), desc="  -> Fetching horse data", leave=False):
        try:
            existing_results_count = db.query(func.count(models.Result.id)).filter(models.Result.horse_id == horse_id).scalar()

            if existing_results_count >= 5:
                continue

            html, was_scraped = get_horse_page_html(horse_id, force_download=False)
            if html:
                parsed_data = parser.parse_horse_results_page(html)
                if parsed_data and parsed_data.get('results'):
                    horse_name = parsed_data.get('horse_name')
                    results = parsed_data.get('results')
                    if horse_name:
                        database_loader.load_past_results(db, horse_name, results, horse_id)
            
            if was_scraped:
                time.sleep(random.uniform(2.5, 5.0))

        except Exception as e:
            tqdm.write(f"\n[ERROR] Failed to process horse_id {horse_id}: {e}")
            db.rollback()

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

    print(f"Found {len(all_race_ids)} races in DB to update results.")
    for race_id, is_nar in tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False):
        try:
            result_html = get_race_result_html_content(race_id, is_nar=is_nar)
            if result_html:
                race_data = parser.parse_race_result_page(result_html, race_id)
                if race_data and race_data.get('results'):
                    database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
                else:
                    tqdm.write(f"  -> [Info] No results data to update for {race_id} (e.g., cancelled race).")
            else:
                tqdm.write(f"  -> [Warning] Failed to get result HTML for {race_id}.")
        except Exception as e:
            tqdm.write(f"\n[CRITICAL ERROR] Race Result processing for {race_id} failed: {e}")
            traceback.print_exc()
            db.rollback()

def insert_new_predictions(db: Session, target_date: datetime.date):
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")
    try:
        print(f"  -> Deleting any existing data for {target_date.strftime('%Y-%m-%d')} to ensure a clean state.")
        races_to_delete_stmt = select(models.Race.id).where(models.Race.race_date == target_date)
        db.query(models.Matchup).filter(models.Matchup.race_id.in_(races_to_delete_stmt)).delete(synchronize_session=False)
        db.query(models.Prediction).filter(models.Prediction.race_id.in_(races_to_delete_stmt)).delete(synchronize_session=False)
        db.query(models.Result).filter(models.Result.race_id.in_(races_to_delete_stmt)).delete(synchronize_session=False)
        db.query(models.RaceReturn).filter(models.RaceReturn.race_id.in_(races_to_delete_stmt)).delete(synchronize_session=False)
        db.query(models.Race).filter(models.Race.id.in_(races_to_delete_stmt)).delete(synchronize_session=False)
        db.commit()
        print("  -> Deletion of old data complete.")
    except Exception as e:
        print(f"  -> An error occurred during cleanup, rolling back: {e}")
        db.rollback()
        return

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
    _fetch_and_load_horse_past_data(db, all_horse_ids_to_fetch)

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