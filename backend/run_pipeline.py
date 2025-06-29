# C:\Users\tnszk\program\GitHub\backend\run_pipeline.py
import datetime
from collections import defaultdict
from database.database import SessionLocal, engine, Base
# ★★★ 不足していた import 文 ★★★
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
            # 既に DB にその日のレースがあればスキップ
            if db.query(models.Race).filter(
                models.Race.race_date == current_date,
                models.Race.race_type == ('地方' if is_nar else '中央')
            ).first():
                print(f"Skipping {date_str} ({race_type}) - already in DB.")
                continue

            print(f"Fetching {race_type} race list for {date_str}...")
            # 過去のレース結果リストはキャッシュを利用する
            list_html = scraper.get_race_list_html(date_str, is_nar=is_nar, force_download=False)
            if list_html:
                race_ids = parser.parse_race_ids_from_list(list_html)
                for race_id in race_ids:
                    # 過去のレース結果はキャッシュを利用する
                    result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=False)
                    if result_html:
                        race_data = parser.parse_race_result_page(result_html, race_id)
                        if race_data:
                            database_loader.load_race_result_data(
                                db, race_data, race_id, current_date, is_nar
                            )
                            print(f"  Loaded result for race {race_id}")
        current_date += datetime.timedelta(days=1)

def main():
    """モードに応じて指定された日付の予測を生成する一連の処理を実行する。"""
    # --- 実行モード設定 ---
    # DEBUG_MODE: 明日のレースを対象に、少ないデータで高速に動作確認するためのモード
    # DEBUG_MODE_2: 2025/1/1から明日までの全日付のページを生成するモード
    # どちらも False の場合: 本番モード (明日のレースのみ対象)
    DEBUG_MODE = True
    DEBUG_MODE_2 = False
    RACE_LIMIT_PER_VENUE = 2

    if DEBUG_MODE and DEBUG_MODE_2:
        print("[ERROR] DEBUG_MODE and DEBUG_MODE_2 cannot be True at the same time.")
        return

    # --- ★★★ 全ての予測で共通して使用する傾向分析の期間を定義 ★★★ ---
    # 要件に基づき、傾向分析期間を2024年1月1日から本日までに固定
    ANALYSIS_START_DATE = datetime.date(2025, 6, 25)
    ANALYSIS_END_DATE = datetime.date.today()

    # --- 処理対象の日付リストを決定 ---
    prediction_dates: List[datetime.date] = []
    tomorrow = ANALYSIS_END_DATE + datetime.timedelta(days=1)

    if DEBUG_MODE_2:
        print("--- DEBUG MODE 2 ON: Generating pages from 2025-01-01 to tomorrow ---")
        start_prediction_date = datetime.date(2025, 1, 1)
        end_prediction_date = tomorrow
        
        current_date = start_prediction_date
        while current_date <= end_prediction_date:
            prediction_dates.append(current_date)
            current_date += datetime.timedelta(days=1)
    else:
        # DEBUG_MODE または本番モード
        prediction_dates.append(tomorrow)
        if DEBUG_MODE:
            print(f"--- DEBUG MODE ON: Targeting {tomorrow.strftime('%Y-%m-%d')} with limits ---")
        else:
            print(f"--- PRODUCTION MODE ON: Targeting {tomorrow.strftime('%Y-%m-%d')} with no limits ---")

    # --- Step 1: 重い分析処理を最初に一度だけ実行 ---
    print(f"\n--- Performing pre-calculation based on fixed period: {ANALYSIS_START_DATE} to {ANALYSIS_END_DATE} ---")
    db_precalc: Session = SessionLocal()
    try:
        # 1-a. 必要な全期間の過去レース結果をバックフィル
        backfill_historical_data(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        
        # 1-b. 全データを使って馬番有利不利指数を計算
        print(f"\n--- Calculating Horse Number Advantage for the entire period ---")
        predictor.calculate_and_save_horse_number_advantage(db_precalc, ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        print("--- Finished all pre-calculations ---\n")
    finally:
        db_precalc.close()


    # --- Step 2: メインループ: 各対象日の予測ページ生成に専念 ---
    for target_date in prediction_dates:
        print(f"\n{'='*25} Processing for target date: {target_date.strftime('%Y-%m-%d')} {'='*25}")

        db: Session = SessionLocal()

        try:
            # 2-a. ターゲット日のレースリスト取得
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

            # デバッグモードの場合のみレース数を制限
            if DEBUG_MODE:
                races_by_venue = defaultdict(list)
                for race_id, is_nar in all_race_ids:
                    venue_code = race_id[4:6]
                    venue_name = VENUE_CODE_MAP.get(venue_code, "UnknownVenue")
                    races_by_venue[venue_name].append((race_id, is_nar))

                limited_races = [
                    race
                    for v_races in races_by_venue.values()
                    for race in v_races[:RACE_LIMIT_PER_VENUE]
                ]
                print(f"--- DEBUG MODE: Limiting races to {RACE_LIMIT_PER_VENUE} per venue. Total races: {len(limited_races)} ---")
                all_race_ids = limited_races

            # 2-b. 出馬表の取得とDBへのロード
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

            # 2-c. 出走馬の過去成績を取得（未取得の場合のみ）
            # これは予測計算に必要なのでループ内で実行
            if all_horse_ids_to_fetch:
                fetch_and_load_past_data(db, list(all_horse_ids_to_fetch))

            # 2-d. 予測とマッチアップを生成
            # この処理は内部でDBに保存された共通の傾向データを参照する
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