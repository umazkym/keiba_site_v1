# backend/run_pipeline.py

from dotenv import load_dotenv
load_dotenv()

import os
import datetime
import multiprocessing
import sys
import time
import random
from sqlalchemy.orm import Session
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor, scraper, parser

# db_handlerをインポート
from db_handler import update_race_results, insert_new_predictions

# --- 設定 ---
try:
    CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
except NotImplementedError:
    CPU_COUNT = 1
MAX_WORKERS = int(os.getenv('MAX_WORKERS', str(CPU_COUNT)))

# ★★★ 修正箇所1: ばんえい競馬の会場コードを定数として定義 ★★★
BANEI_VENUE_CODES = ["33", "65"]

# --- 初期化 ---
# Base.metadata.create_all(bind=engine)


def pre_scrape_all_data(start_date: datetime.date, end_date: datetime.date):
    """
    指定された期間のスクレイピングを逐次実行し、HTMLをキャッシュする。
    """
    print(f"\n--- [STAGE 1/3] 事前スクレイピングを逐次実行します ---")

    dates_to_process = []
    current_date = start_date
    while current_date <= end_date:
        dates_to_process.append(current_date)
        current_date += datetime.timedelta(days=1)

    all_horse_ids_to_fetch = set()
    
    driver = None
    try:
        print(" -> WebDriverを初期化しています...")
        driver = scraper._prepare_chrome_driver()
        print(" -> WebDriverの初期化が完了しました。")
        
        print("\n[Step 1/2] レース関連ページ (レース一覧、出馬表、結果) をキャッシュ中...")
        for target_date in tqdm(dates_to_process, desc="[1/3] 日付ごと", unit="day", leave=True):
            target_date_str = target_date.strftime('%Y%m%d')
            all_race_ids_for_date = []

            for is_nar in [False, True]:
                race_type_str = "地方競馬(NAR)" if is_nar else "中央競馬(JRA)"
                list_html = scraper.get_race_list_html(target_date_str, is_nar=is_nar, driver=driver)
                
                # HTMLが取得できない場合（非開催日など）はスキップ
                if not list_html:
                    tqdm.write(f"  -> {target_date_str}: {race_type_str}のレース一覧が見つかりませんでした。スキップします。")
                    continue

                race_ids = parser.parse_race_ids_from_list(list_html)

                # レースIDが1つも見つからない場合もスキップ
                if not race_ids:
                    tqdm.write(f"  -> {target_date_str}: {race_type_str}でレースIDが見つかりませんでした。スキップします。")
                    continue
                
                # ★★★ 修正箇所2: ばんえい競馬のレースIDを除外するフィルタリング処理 ★★★
                if is_nar:
                    original_count = len(race_ids)
                    race_ids = [
                        rid for rid in race_ids
                        if rid[4:6] not in BANEI_VENUE_CODES
                    ]
                    banei_count = original_count - len(race_ids)
                    if banei_count > 0:
                        tqdm.write(f"      -> 地方競馬から、ばんえい競馬のレース {banei_count} 件を除外しました。")
                
                all_race_ids_for_date.extend([(rid, is_nar) for rid in race_ids])
            
            for race_id, is_nar in tqdm(all_race_ids_for_date, desc=f"  [2/3] レース処理中 ({target_date_str})", unit="race", leave=False):
                shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar)
                scraper.get_race_result_html(race_id, is_nar=is_nar)

                if shutuba_html:
                    shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                    if shutuba_data:
                        for horse in shutuba_data.get("horses", []):
                            if horse.get("horse_id"):
                                all_horse_ids_to_fetch.add(horse["horse_id"])

        print(f"\n[Step 2/2] {len(all_horse_ids_to_fetch)}頭のユニークな馬を検出。過去成績ページをキャッシュ中...")
        if all_horse_ids_to_fetch:
            horse_ids_list = sorted(list(all_horse_ids_to_fetch))
            
            scraped_counter = 0
            for horse_id in tqdm(horse_ids_list, desc="  [3/3] 馬の過去成績", unit="horse", leave=True):
                # 実際にスクレイピングしたかどうかのステータスを受け取る
                _, was_scraped = scraper.get_horse_page_html(horse_id, force_download=False, driver=driver, return_status=True)

                # 実際にスクレイピングした場合のみカウンターを増やす
                if was_scraped:
                    scraped_counter += 1

                    # スクレピング件数が50の倍数になったら休憩する
                    if scraped_counter > 0 and scraped_counter % 50 == 0:
                        break_time = random.uniform(60, 120)
                        tqdm.write(f"\n--- 50件の新規スクレイピングを実行しました。サーバー負荷軽減のため {int(break_time)}秒間 休憩します ---")
                        time.sleep(break_time)

    finally:
        if driver:
            print("\n -> WebDriverを終了しています...")
            driver.quit()
            print(" -> WebDriverを終了しました。")

    print("\n--- 事前スクレイピングが正常に完了しました ---")


def process_single_date_worker(target_date: datetime.date):
    db: Session = SessionLocal()
    try:
        insert_new_predictions(db, target_date)
        update_race_results(db, target_date)
    except Exception as e:
        print(f"\n[ERROR] Worker failed on date {target_date}: {e}\n")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    return target_date

def backfill_historical_data(start_date: datetime.date, end_date: datetime.date):
    print(f"\n--- [STAGE 2/3] DB保存とAI予測を並列処理します ---")
    print(f"最大 {MAX_WORKERS} 個のワーカープロセスを使用します...")
    
    dates_to_process = []
    current_date = start_date
    while current_date <= end_date:
        dates_to_process.append(current_date)
        current_date += datetime.timedelta(days=1)

    if not dates_to_process:
        print("処理対象の日付がありません。")
        return

    with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
        with tqdm(total=len(dates_to_process), desc="[HISTORY] 日付ごとに並列処理中", unit="day") as pbar:
            for _ in pool.imap_unordered(process_single_date_worker, dates_to_process):
                pbar.update(1)

def process_advantage_in_chunks(db: Session, start_date: datetime.date, end_date: datetime.date, chunk_size_days: int = 30):
    print(f"\n--- [STAGE 3/3] 馬番有利不利データを計算します ---")
    current_start = start_date
    date_chunks = []
    while current_start <= end_date:
        current_end = min(current_start + datetime.timedelta(days=chunk_size_days - 1), end_date)
        date_chunks.append((current_start, current_end))
        current_start = current_end + datetime.timedelta(days=1)
    
    for start, end in tqdm(date_chunks, desc="チャンクごとに有利不利を計算中", unit="chunk"):
        predictor.calculate_and_save_horse_number_advantage_for_period(db, start, end)

    print("--- 全ての有利不利計算が完了しました ---\n")

def main():
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')

    if PIPELINE_MODE == 'HISTORY':
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!!  HISTORYモードで実行します (スクレイピングは逐次、DB処理は並列)  !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        
        try:
            if len(sys.argv) != 3:
                raise ValueError("開始日と終了日を 'YYYY-MM-DD' 形式で指定してください。")
            
            start_date_str = sys.argv[1]
            end_date_str = sys.argv[2]
            
            ANALYSIS_START_DATE = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            ANALYSIS_END_DATE = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()

            if ANALYSIS_START_DATE > ANALYSIS_END_DATE:
                    raise ValueError("開始日は終了日より前の日付にしてください。")

        except ValueError as e:
            print(f"\nエラー: {e}")
            print("実行例: python backend/run_pipeline.py 2025-01-01 2025-01-05")
            return
            
        print(f"\n処理対象期間: {ANALYSIS_START_DATE.strftime('%Y-%m-%d')} から {ANALYSIS_END_DATE.strftime('%Y-%m-%d')} まで")
        
        pre_scrape_all_data(ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        backfill_historical_data(ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        
        db_session_for_advantage = SessionLocal()
        try:
            history_start_date = datetime.date(2020, 1, 1)
            history_end_date = datetime.date.today()
            process_advantage_in_chunks(db_session_for_advantage, history_start_date, history_end_date, chunk_size_days=90)
        finally:
            db_session_for_advantage.close()

    else: # PRODUCTIONモード
        print("--- RUNNING IN PRODUCTION MODE ---")
        db: Session = SessionLocal()
        try:
            jst_offset = datetime.timedelta(hours=9)
            today_jst = (datetime.datetime.utcnow() + jst_offset).date()

            target_date_results = today_jst - datetime.timedelta(days=1)
            update_race_results(db, target_date_results)

            target_date_predictions = today_jst + datetime.timedelta(days=1)
            insert_new_predictions(db, target_date_predictions)
            
        finally:
            if db.is_active:
                db.close()

    print("\n全ての処理が完了しました。")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    
    try:
        import winsound
        winsound.Beep(880, 200)
    except (ImportError, RuntimeError):
        pass
    
    main()
    
    try:
        import winsound
        winsound.Beep(1046, 500)
    except (ImportError, RuntimeError):
        pass