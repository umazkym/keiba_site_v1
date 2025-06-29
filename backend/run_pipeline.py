# C:\Users\tnszk\program\GitHub\backend\run_pipeline.py
import datetime
import time
from collections import defaultdict
from database.database import SessionLocal, engine, Base
from database import models
from scripts import scraper, parser, database_loader, predictor
from sqlalchemy.orm import Session
from typing import List, Tuple
from core.config import VENUE_CODE_MAP

# --- 初期化 ---
Base.metadata.create_all(bind=engine)

def fetch_and_load_past_data(db: Session, horse_ids: List[str]):
    """指定された馬リストの過去成績を取得し DB に保存する"""
    print(f"Fetching past data for {len(horse_ids)} horses...")
    for horse_id in horse_ids:
        print(f"  - Horse ID: {horse_id}")
        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)

def backfill_historical_data(db: Session, start_date: datetime.date, end_date: datetime.date):
    """指定された期間のレース結果を DB に保存する"""
    print(f"Backfilling historical data from {start_date} to {end_date}...")
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime('%Y%m%d')
        for is_nar in [False, True]:
            race_type = "NAR" if is_nar else "JRA"
            
            race_exists = db.query(models.Race).filter(
                models.Race.race_date == current_date,
                models.Race.race_type == ('地方' if is_nar else '中央')
            ).first()

            if race_exists:
                print(f"Skipping {date_str} ({race_type}) - already in DB.")
                continue

            print(f"Fetching {race_type} race list for {date_str}...")
            list_html = scraper.get_race_list_html(date_str, is_nar=is_nar, force_download=False)
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)
                for race_id in race_ids:
                    result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=False)
                    if result_html:
                        race_data = parser.parse_race_result_page(result_html, race_id)
                        if race_data:
                            database_loader.load_race_result_data(
                                db, race_data, race_id, current_date, is_nar
                            )
                            print(f"  Loaded result for race {race_id}")
        current_date += datetime.timedelta(days=1)


def process_advantage_in_chunks(db: Session, start_date: datetime.date, end_date: datetime.date, chunk_size_days: int = 30):
    """
    メモリ対策：指定された期間をチャンクに分割して馬番有利不利を計算する
    """
    print(f"\n--- Calculating Horse Number Advantage in chunks from {start_date} to {end_date} ---")
    current_start = start_date
    while current_start <= end_date:
        current_end = min(current_start + datetime.timedelta(days=chunk_size_days - 1), end_date)
        
        predictor.calculate_and_save_horse_number_advantage_for_period(db, current_start, current_end)
        
        current_start = current_end + datetime.timedelta(days=1)
        time.sleep(1) 
    print("--- Finished all advantage calculations ---\n")


def main():
    """モードに応じて指定された日付の予測を生成する一連の処理を実行する。"""
    DEBUG_MODE = False
    
    ANALYSIS_START_DATE = datetime.date(2024, 1, 1) 
    ANALYSIS_END_DATE = datetime.date.today()

    prediction_dates: List[datetime.date] = [ANALYSIS_END_DATE + datetime.timedelta(days=1)]

    if DEBUG_MODE:
        print(f"--- DEBUG MODE ON: Targeting {prediction_dates[0].strftime('%Y-%m-%d')} with limits ---")
    else:
        print(f"--- PRODUCTION MODE ON: Targeting {prediction_dates[0].strftime('%Y-%m-%d')} with no limits ---")

    print(f"\n--- Performing pre-calculation based on fixed period: {ANALYSIS_START_DATE} to {ANALYSIS_END_DATE} ---")
    db_precalc: Session = SessionLocal()
    try:
        backfill_historical_data(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        process_advantage_in_chunks(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE, chunk_size_days=30)
    finally:
        db_precalc.close()

    for target_date in prediction_dates:
        print(f"\n{'='*25} Processing for target date: {target_date.strftime('%Y-%m-%d')} {'='*25}")

        db: Session = SessionLocal()

        try:
            print(f"--- Starting Prediction Pipeline for {target_date.strftime('%Y-%m-%d')} ---")
            target_date_str = target_date.strftime('%Y%m%d')
            all_race_ids: List[Tuple[str, bool]] = []

            for is_nar in [False, True]:
                race_type = "NAR" if is_nar else "JRA"
                print(f"Fetching {race_type} race list for {target_date_str}...")
                list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, force_download=True)
                if list_html:
                    race_ids = parser.parse_race_ids_from_list(list_html)
                    filtered_race_ids = [rid for rid in race_ids if not rid.startswith(target_date_str[:4] + '65')]
                    all_race_ids.extend([(rid, is_nar) for rid in filtered_race_ids])
                    print(f"Found {len(race_ids)} {race_type} races ({len(filtered_race_ids)} after filtering).")

            if not all_race_ids:
                print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
                continue

            all_horse_ids_to_fetch = set()
            for race_id, is_nar in all_race_ids:
                print(f"Processing Shutuba for Race ID: {race_id}")
                shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
                if shutuba_html:
                    shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                    if shutuba_data:
                        database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
                        for horse in shutuba_data.get("horses", []):
                            if horse.get("horse_id"):
                                all_horse_ids_to_fetch.add(horse["horse_id"])

            if all_horse_ids_to_fetch:
                fetch_and_load_past_data(db, list(all_horse_ids_to_fetch))

            for race_id, is_nar in all_race_ids:
                print(f"Creating predictions for Race ID: {race_id}")
                predictions = predictor.create_predictions_for_race(db, race_id)
                if predictions:
                    database_loader.save_prediction(db, race_id, predictions)
                    print(f"  Saved {len(predictions)} predictions for race {race_id}")

                    horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
                    if horse_ids_in_race:
                        print(f"  Calculating matchups for Race ID: {race_id}")
                        predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)

            print(f"--- Pipeline Finished for {target_date.strftime('%Y-%m-%d')} ---")

        finally:
            db.close()

    print("\nAll processing finished.")


if __name__ == "__main__":
    main()