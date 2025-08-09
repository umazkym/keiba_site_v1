# C:\Users\tnszk\program\GitHub\backend\run_pipeline.py
import winsound
import datetime
import time
import os
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
        # キャッシュを優先するため force_download=False
        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)

def backfill_historical_data(db: Session, start_date: datetime.date, end_date: datetime.date):
    """
    指定された期間のレース結果を DB に保存する。
    HTMLキャッシュを最大限活用する。
    """
    print(f"Backfilling historical data from {start_date} to {end_date}...")
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime('%Y%m%d')
        for is_nar in [False, True]:
            race_type = "NAR" if is_nar else "JRA"
            
            # データベースにその日のレース情報が既にあればスキップ
            race_exists_in_db = db.query(models.Race).filter(
                models.Race.race_date == current_date,
                models.Race.race_type == ('地方' if is_nar else '中央')
            ).count() > 0

            if race_exists_in_db:
                print(f"Skipping {date_str} ({race_type}) - already processed and in DB.")
                continue

            print(f"Processing {race_type} race list for {date_str}...")
            # force_download=False でキャッシュを優先
            list_html = scraper.get_race_list_html(date_str, is_nar=is_nar, force_download=False)
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)
                for race_id in race_ids:
                    # force_download=False でキャッシュを優先
                    result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=False)
                    if result_html:
                        race_data = parser.parse_race_result_page(result_html, race_id)
                        if race_data:
                            database_loader.load_race_result_data(
                                db, race_data, race_id, current_date, is_nar
                            )
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
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')
    
    if PIPELINE_MODE == 'HISTORY':
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!!  RUNNING IN HISTORY MODE !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        # ★★★ 修正箇所: 分析期間を開始日 '2025-06-09', 終了日 '2025-06-22' に変更 ★★★
        ANALYSIS_START_DATE = datetime.date(2025, 6, 22)
        ANALYSIS_END_DATE = datetime.date(2025, 6, 22)
        # ★★★ 修正ここまで ★★★
        prediction_dates = []
        current_pred_date = ANALYSIS_START_DATE
        while current_pred_date <= ANALYSIS_END_DATE:
            prediction_dates.append(current_pred_date)
            current_pred_date += datetime.timedelta(days=1)
    else: # PRODUCTIONモード（デフォルト）
        print("--- RUNNING IN PRODUCTION MODE ---")
        ANALYSIS_START_DATE = datetime.date(2024, 1, 1)  
        ANALYSIS_END_DATE = datetime.date.today()
        prediction_dates = [ANALYSIS_END_DATE + datetime.timedelta(days=1)]
        
        print(f"\n--- Performing pre-calculation based on period: {ANALYSIS_START_DATE} to {ANALYSIS_END_DATE} ---")
        db_precalc: Session = SessionLocal()
        try:
            backfill_historical_data(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE)
            process_advantage_in_chunks(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE, chunk_size_days=30)
        finally:
            db_precalc.close()

    for target_date in prediction_dates:
        print(f"\n{'='*25} Processing for target date: {target_date.strftime('%Y-%m-%d')} {'='*25}")

        db_session: Session = SessionLocal()
        try:
            if PIPELINE_MODE == 'HISTORY':
                backfill_historical_data(db_session, target_date, target_date)
            
            target_date_str = target_date.strftime('%Y%m%d')
            all_race_ids: List[Tuple[str, bool]] = []

            for is_nar in [False, True]:
                race_type = "NAR" if is_nar else "JRA"
                print(f"Processing {race_type} race list for {target_date_str}...")
                list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, force_download=True)
                if list_html:
                    race_ids = parser.parse_race_ids_from_list(list_html)
                    filtered_race_ids = [rid for rid in race_ids if not rid.startswith(target_date_str[:4] + '65')]
                    all_race_ids.extend([(rid, is_nar) for rid in filtered_race_ids])
                    print(f"Found {len(race_ids)} {race_type} races ({len(filtered_race_ids)} after filtering).")

            if not all_race_ids:
                print(f"No races found for {target_date.strftime('%Y-%m-%d')}.")
                db_session.close()
                continue

            all_horse_ids_to_fetch = set()
            for race_id, is_nar in all_race_ids:
                shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
                if shutuba_html:
                    shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                    if shutuba_data:
                        database_loader.load_shutuba_data(db_session, shutuba_data, race_id, target_date, is_nar)
                        for horse in shutuba_data.get("horses", []):
                            if horse.get("horse_id"):
                                all_horse_ids_to_fetch.add(horse["horse_id"])

            if all_horse_ids_to_fetch:
                fetch_and_load_past_data(db_session, list(all_horse_ids_to_fetch))

            for race_id, is_nar in all_race_ids:
                print(f"Creating predictions for Race ID: {race_id}")
                predictions = predictor.create_predictions_for_race(db_session, race_id)
                if predictions:
                    database_loader.save_prediction(db_session, race_id, predictions)
                    print(f"  Saved {len(predictions)} predictions for race {race_id}")
                    horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
                    if horse_ids_in_race:
                        predictor.calculate_and_save_matchups_for_race(db_session, race_id, horse_ids_in_race)
            print(f"--- Pipeline Finished for {target_date.strftime('%Y-%m-%d')} ---")

        finally:
            if db_session.is_active:
                db_session.close()

    if PIPELINE_MODE == 'HISTORY':
        print("\n--- Recalculating all horse number advantages after history generation ---")
        db_final: Session = SessionLocal()
        try:
            # ★★★ 修正箇所: 再計算期間も分析期間に合わせる ★★★
            history_start_date = datetime.date(2025, 6, 22)
            history_end_date = datetime.date(2025, 6, 22)
            # ★★★ 修正ここまで ★★★
            process_advantage_in_chunks(db_final, history_start_date, history_end_date, chunk_size_days=30)
        finally:
            db_final.close()

    print("\nAll processing finished.")

if __name__ == "__main__":
    winsound.Beep(880, 500)
    main()
    winsound.Beep(880, 500)