# backend/db_handler.py

import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
from scripts import scraper, parser, database_loader, predictor
from typing import List, Tuple
from tqdm import tqdm

def update_race_results(db: Session, target_date: datetime.date):
    """
    指定された日付（通常は前日）のレース結果と払い戻し情報を取得し、DBを更新する。
    この関数は既存の予測データを上書きせず、結果情報のみを追記・更新する。
    """
    print(f"\n--- [RESULTS] Updating race results for {target_date.strftime('%Y-%m-%d')} ---")
    target_date_str = target_date.strftime('%Y%m%d')
    
    all_race_ids: List[Tuple[str, bool]] = []
    for is_nar in [False, True]:
        race_type = "NAR" if is_nar else "JRA"
        # scraper側でキャッシュ戦略が実装されているため、ここでは常に最新を取得する意図でTrueを渡す
        list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, force_download=True)
        if list_html:
            race_ids = parser.parse_race_ids_from_list(list_html)
            all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    print(f"Found {len(all_race_ids)} races to update results.")
    for race_id, is_nar in tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False):
        race_exists = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race_exists:
            continue

        result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True)
        if result_html:
            race_data = parser.parse_race_result_page(result_html, race_id)
            if race_data:
                database_loader.load_race_result_data(db, race_data, race_id, target_date, is_nar)
            else:
                print(f"  -> [Warning] Failed to parse result page for {race_id}.")
        else:
            print(f"  -> [Warning] Failed to get result HTML for {race_id}.")

def insert_new_predictions(db: Session, target_date: datetime.date):
    """
    指定された日付（通常は翌日）の出馬表を取得し、AI予測を行い、DBに新規追加する。
    既に予測データが存在する場合は処理をスキップし、既存データを上書きしない。
    """
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")
    
    prediction_exists = db.query(models.Prediction.id).join(models.Race)\
        .filter(models.Race.race_date == target_date).limit(1).first()
    
    if prediction_exists:
        print(f"Predictions for {target_date.strftime('%Y-%m-%d')} already exist. Skipping.")
        return

    target_date_str = target_date.strftime('%Y%m%d')
    all_race_ids: List[Tuple[str, bool]] = []
    for is_nar in [False, True]:
        race_type = "NAR" if is_nar else "JRA"
        list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, force_download=True)
        if list_html:
            race_ids = parser.parse_race_ids_from_list(list_html)
            all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    # 1. 全レースの出走馬情報を先に収集・保存
    all_horse_ids_to_fetch = set()
    desc_step1 = f"[1/3] Fetching Shutuba ({target_date.strftime('%m-%d')})"
    for race_id, is_nar in tqdm(all_race_ids, desc=desc_step1, leave=False):
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if shutuba_html:
            shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
            if shutuba_data:
                database_loader.load_shutuba_data(db, shutuba_data, race_id, target_date, is_nar)
                for horse in shutuba_data.get("horses", []):
                    if horse.get("horse_id"):
                        all_horse_ids_to_fetch.add(horse["horse_id"])

    # 2. 予測に必要な全馬の過去成績をまとめて取得
    if all_horse_ids_to_fetch:
        horse_ids_list = list(all_horse_ids_to_fetch)
        desc_step2 = f"[2/3] Fetching Past Data ({target_date.strftime('%m-%d')})"
        for horse_id in tqdm(horse_ids_list, desc=desc_step2, leave=False):
            # 過去データは常にキャッシュを優先するため force_download=False
            html = scraper.get_horse_page_html(horse_id, force_download=False)
            if html:
                results = parser.parse_horse_results_page(html)
                if results:
                    database_loader.load_past_results(db, results, horse_id)

    # 3. 各レースの予測を生成・保存
    desc_step3 = f"[3/3] Predicting Races ({target_date.strftime('%m-%d')})"
    for race_id, is_nar in tqdm(all_race_ids, desc=desc_step3, leave=False):
        predictions = predictor.create_predictions_for_race(db, race_id)
        if predictions:
            database_loader.save_prediction(db, race_id, predictions)
            horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
            if horse_ids_in_race:
                predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
        else:
            print(f"  -> [Warning] No predictions were generated for {race_id}.")