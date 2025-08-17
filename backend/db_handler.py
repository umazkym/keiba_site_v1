# backend/db_handler.py

import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import models
from scripts import scraper, parser, database_loader, predictor
from typing import List, Tuple
from tqdm import tqdm
import os 

# ★★★ 修正箇所1: ばんえい競馬の会場コードを定数として定義 ★★★
BANEI_VENUE_CODES = ["33", "65"]

def update_race_results(db: Session, target_date: datetime.date):
    """
    指定された日付（通常は前日）のレース結果と払い戻し情報を取得し、DBを更新する。
    """
    print(f"\n--- [RESULTS] Updating race results for {target_date.strftime('%Y-%m-%d')} ---")
    
    all_race_ids: List[Tuple[str, bool]] = []
    for is_nar in [False, True]:
        dir_path = os.path.join("data", "html_cache", "nar_racelist" if is_nar else "racelist")
        file_path = os.path.join(dir_path, f"{target_date.strftime('%Y%m%d')}.bin")
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                list_html = f.read()
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)

                # ★★★ 修正箇所2: ばんえい競馬のレースIDを除外するフィルタリング処理 ★★★
                if is_nar:
                    race_ids = [
                        rid for rid in race_ids
                        if rid[4:6] not in BANEI_VENUE_CODES
                    ]
                
                all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    print(f"Found {len(all_race_ids)} races to update results.")
    for race_id, is_nar in tqdm(all_race_ids, desc=f"Updating Results ({target_date.strftime('%m-%d')})", leave=False):
        race_exists = db.query(models.Race).filter(models.Race.id == race_id).first()
        if not race_exists:
            continue

        # scraper側のキャッシュポリシーに任せるため、force_download引数は使用しない
        result_html = scraper.get_race_result_html(race_id, is_nar=is_nar)
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
    """
    print(f"\n--- [PREDICTIONS] Inserting new predictions for {target_date.strftime('%Y-%m-%d')} ---")
    
    prediction_exists = db.query(models.Prediction.id).join(models.Race)\
        .filter(models.Race.race_date == target_date).limit(1).first()
    
    if prediction_exists:
        print(f"Predictions for {target_date.strftime('%Y-%m-%d')} already exist. Skipping.")
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
                
                # ★★★ 修正箇所3: ばんえい競馬のレースIDを除外するフィルタリング処理 ★★★
                if is_nar:
                    race_ids = [
                        rid for rid in race_ids
                        if rid[4:6] not in BANEI_VENUE_CODES
                    ]

                all_race_ids.extend([(rid, is_nar) for rid in race_ids])

    if not all_race_ids:
        print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
        return

    # 1. 全レースの出走馬情報を先に収集・保存
    all_horse_ids_to_fetch = set()
    desc_step1 = f"[1/3] Fetching Shutuba ({target_date.strftime('%m-%d')})"
    for race_id, is_nar in tqdm(all_race_ids, desc=desc_step1, leave=False):
        # scraper側のキャッシュポリシーに任せるため、force_download引数は使用しない
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar)
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
            # 過去データは常にキャッシュを優先するため force_download=False のまま（引数なしでOK）
            html = scraper.get_horse_page_html(horse_id)
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