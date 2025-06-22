# C:\Users\tnszk\program\GitHub\backend\run_pipeline.py

import datetime
from collections import defaultdict
from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, database_loader, predictor
from sqlalchemy.orm import Session
from typing import List
from core.config import VENUE_CODE_MAP # VENUE_CODE_MAPをインポート

# --- 初期化 ---
Base.metadata.create_all(bind=engine)
db: Session = SessionLocal()

def fetch_and_load_past_data(horse_ids: List[str]):
    """ 指定された馬リストの過去成績を取得しDBに保存する """
    print(f"Fetching past data for {len(horse_ids)} horses...")
    for horse_id in horse_ids:
        print(f"  - Horse ID: {horse_id}")
        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)

def main():
    """
    指定された日付の予測を生成する一連の処理を実行する。
    """
    # --- ★★★ デバッグ用設定 ★★★ ---
    # Trueにすると、下の制限数で処理が実行される
    DEBUG_MODE = False
    RACE_LIMIT_PER_VENUE = 2  # 各競馬場から処理するレース数を2つに制限
    HORSE_LIMIT_TOTAL = 10      # 過去データを取得する馬の合計数を10頭に制限
    # ---------------------------------

    if DEBUG_MODE:
        # デバッグモード時は日付を固定
        target_date = datetime.date(2025, 6, 22)
        print(f"--- DEBUG MODE ON: Targeting fixed date {target_date.strftime('%Y-%m-%d')} ---")
    else:
        # 通常実行時は翌日の日付
        target_date = datetime.date.today() + datetime.timedelta(days=1)
    
    print(f"--- Starting Pipeline for {target_date.strftime('%Y-%m-%d')} ---")
    
    target_date_str = target_date.strftime('%Y%m%d')
    all_race_ids = []
    
    for is_nar in [False, True]:
        race_type = "NAR" if is_nar else "JRA"
        print(f"Fetching {race_type} race list for {target_date_str}...")
        list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, force_download=True)
        if list_html:
            race_ids = parser.parse_race_ids_from_list(list_html)
            filtered_race_ids = [rid for rid in race_ids if not rid.startswith('202565')] # ばんえい除外
            all_race_ids.extend([(rid, is_nar) for rid in filtered_race_ids])
            print(f"Found {len(race_ids)} {race_type} races ({len(filtered_race_ids)} after filtering).")

    if not all_race_ids:
        print("No races found for the target date.")
        return

    # ★★★ デバッグモードがONの場合、各会場ごとにレース数を制限 ★★★
    if DEBUG_MODE:
        races_by_venue = defaultdict(list)
        for race_id, is_nar in all_race_ids:
            venue_code = race_id[4:6]
            venue_name = VENUE_CODE_MAP.get(venue_code, "UnknownVenue")
            races_by_venue[venue_name].append((race_id, is_nar))
        
        limited_races = []
        for venue_name, race_list in races_by_venue.items():
            limited_races.extend(race_list[:RACE_LIMIT_PER_VENUE])
        
        print(f"--- DEBUG MODE: Limiting races to {RACE_LIMIT_PER_VENUE} per venue. Total races: {len(limited_races)} ---")
        all_race_ids = limited_races

    all_horse_ids_to_fetch = set()
    for race_id, is_nar in all_race_ids:
        print(f"Processing Shutuba for Race ID: {race_id}")
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if shutuba_html:
            shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
            if shutuba_data:
                database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
                for horse in shutuba_data['horses']:
                    if horse.get('horse_id'):
                        all_horse_ids_to_fetch.add(horse['horse_id'])

    horse_ids_list = list(all_horse_ids_to_fetch)
    if DEBUG_MODE and len(horse_ids_list) > HORSE_LIMIT_TOTAL:
        print(f"--- DEBUG MODE: Limiting horses to {HORSE_LIMIT_TOTAL} ---")
        horse_ids_list = horse_ids_list[:HORSE_LIMIT_TOTAL]
    
    fetch_and_load_past_data(horse_ids_list)

    for race_id, is_nar in all_race_ids:
        print(f"Creating predictions for Race ID: {race_id}")
        predictions = predictor.create_predictions_for_race(db, race_id)
        if predictions:
            database_loader.save_prediction(db, race_id, predictions)
            print(f"Saved {len(predictions)} predictions for race {race_id}")

    db.close()
    print(f"--- Pipeline Finished for {target_date.strftime('%Y-%m-%d')} ---")

if __name__ == "__main__":
    main()