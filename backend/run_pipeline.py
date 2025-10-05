from dotenv import load_dotenv
load_dotenv()

import os
import datetime
import multiprocessing
import sys
import time
import random
import requests
import traceback
from sqlalchemy.orm import Session
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor, scraper, parser, database_loader
from db_handler import update_race_results, insert_new_predictions
import subprocess

# --- 設定 ---
try:
    CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
except NotImplementedError:
    CPU_COUNT = 1

MAX_WORKERS = 4
BANEI_VENUE_CODES = ["33", "65"]
DRIVER_RESTART_INTERVAL = 200  # WebDriverを再起動する間隔（馬の数）
DRIVER_MEMORY_CHECK_INTERVAL = 100 # メモリチェックを行う間隔
LONG_BREAK_INTERVAL = 1000 # 長時間休憩に入るまでのスクレイピング回数
# ▼▼▼ 修正 ▼▼▼
LONG_BREAK_SECONDS = 600 # 長時間休憩の秒数 (10分)
# ▲▲▲ 修正 ▲▲▲
SHORT_BREAK_INTERVAL = 50 # 短時間休憩に入るまでのスクレイピング回数
# ▼▼▼ 修正 ▼▼▼
SHORT_BREAK_SECONDS_MIN = 120 # 短時間休憩の最小秒数 (2分)
SHORT_BREAK_SECONDS_MAX = 240 # 短時間休憩の最大秒数 (4分)
# ▲▲▲ 修正 ▲▲▲

def _force_cleanup_processes():
    """
    実行中の可能性のあるChromeおよびChromeDriverのプロセスを強制終了する。
    これにより、長時間実行時のゴーストプロセス問題を解消する。
    """
    try:
        if os.name == 'nt':  # Windows
            os.system("taskkill /F /IM chromedriver.exe /T > nul 2>&1")
            os.system("taskkill /F /IM chrome.exe /T > nul 2>&1")
        else:  # Linux/Unix (Render環境)
            os.system("pkill -f chromedriver 2>/dev/null")
            os.system("pkill -f chrome 2>/dev/null")
            os.system("pkill -f chromium 2>/dev/null")
        tqdm.write("  -> クリーンアップ: 既存のChrome/ChromeDriverプロセスを強制終了しました。")
        time.sleep(2)
        import gc
        gc.collect()
    except Exception as e:
        tqdm.write(f"  -> クリーンアップ中に軽微なエラーが発生しました (無視できます): {e}")

def send_notification(message: str, is_error: bool = False):
    webhook_url = os.getenv("WEBHOOK_URL")
    if not webhook_url:
        print(f"[NOTIFICATION]\n{message}")
        return
    color = 15746887 if is_error else 3066993
    payload = { "embeds": [{"title": "🏇 Keiba AI Batch Status", "description": message, "color": color, "timestamp": datetime.datetime.now().isoformat() }] }
    try:
        requests.post(webhook_url, json=payload, timeout=10)
    except requests.RequestException as e:
        print(f"Webhookへの通知送信に失敗しました: {e}")

Base.metadata.create_all(bind=engine)

def pre_scrape_all_data(start_date: datetime.date, end_date: datetime.date) -> set:
    print(f"\n--- [STAGE 1/4] 事前スクレイピングを逐次実行します ---")
    print(" -> 起動前クリーンアップを実行します...")
    _force_cleanup_processes()
    dates_to_process = [start_date + datetime.timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    all_horse_ids_to_fetch = set()
    newly_scraped_count = 0
    print("\n[Step 1/2] レース関連ページ (レース一覧、出馬表、結果) をキャッシュ中...")
    driver = None
    try:
        print(" -> WebDriverを初期化しています...")
        driver = scraper._prepare_chrome_driver()
        print(" -> WebDriverの初期化が完了しました。")
        for i, target_date in enumerate(tqdm(dates_to_process, desc="[1/4] 日付ごと", unit="day", leave=True)):
            if i > 0 and i % 100 == 0:
                tqdm.write(f"\n--- 定期メンテナンス: 100日分のレース一覧を処理したためWebDriverを再起動します ---")
                if driver: driver.quit()
                _force_cleanup_processes()
                driver = scraper._prepare_chrome_driver()
            target_date_str = target_date.strftime('%Y%m%d')
            all_race_ids_for_date = []
            for is_nar in [False, True]:
                list_html, was_scraped = scraper.get_race_list_html(target_date_str, is_nar=is_nar, driver=driver)
                if was_scraped: newly_scraped_count += 1
                if not list_html: continue
                race_ids = parser.parse_race_ids_from_list(list_html)
                if not race_ids: continue
                if is_nar:
                    original_count = len(race_ids)
                    race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                    if original_count - len(race_ids) > 0:
                        tqdm.write(f"                                  -> 地方競馬から、ばんえい競馬のレース {original_count - len(race_ids)} 件を除外しました。")
                all_race_ids_for_date.extend([(rid, is_nar) for rid in race_ids])
            for race_id, is_nar in tqdm(all_race_ids_for_date, desc=f"  [2/4] レース処理中 ({target_date_str})", unit="race", leave=False):
                shutuba_html, was_scraped_s = scraper.get_shutuba_html(race_id, is_nar=is_nar)
                if was_scraped_s: newly_scraped_count += 1
                _, was_scraped_r = scraper.get_race_result_html(race_id, is_nar=is_nar)
                if was_scraped_r: newly_scraped_count += 1
                if shutuba_html:
                    shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                    if shutuba_data:
                        for horse in shutuba_data.get("horses", []):
                            if horse.get("horse_id"): all_horse_ids_to_fetch.add(horse["horse_id"])
    finally:
        if driver:
            print("\n -> WebDriverを終了しています...")
            driver.quit()
            _force_cleanup_processes()
    print(f"\n[Step 2/2] {len(all_horse_ids_to_fetch)}頭のユニークな馬を検出。過去成績ページをキャッシュ中...")
    if all_horse_ids_to_fetch:
        horse_ids_list = sorted(list(all_horse_ids_to_fetch))
        driver_instance = None
        try:
            for i, horse_id in enumerate(tqdm(horse_ids_list, desc="  [3/4] 馬の過去成績", unit="horse", leave=True)):
                if i > 0 and i % DRIVER_MEMORY_CHECK_INTERVAL == 0 and os.getenv("RENDER"):
                    import gc
                    gc.collect()

                if driver_instance is None or (i > 0 and i % DRIVER_RESTART_INTERVAL == 0):
                    if driver_instance:
                        tqdm.write(f"\n--- 定期メンテナンス: {DRIVER_RESTART_INTERVAL}頭処理したためWebDriverを再起動します ---")
                        driver_instance.quit()
                        _force_cleanup_processes()
                    driver_instance = scraper._prepare_chrome_driver()

                if newly_scraped_count > 0 and newly_scraped_count % LONG_BREAK_INTERVAL == 0:
                    tqdm.write(f"\n--- 長時間アクセス継続のため、{int(LONG_BREAK_SECONDS / 60)}分間のクールダウンに入ります ---")
                    time.sleep(LONG_BREAK_SECONDS)
                    tqdm.write("--- 処理を再開します ---")

                _, was_scraped = scraper.get_horse_page_html(horse_id, force_download=False, driver=driver_instance)

                if was_scraped:
                    newly_scraped_count += 1
                    if newly_scraped_count > 0 and newly_scraped_count % SHORT_BREAK_INTERVAL == 0:
                        break_time = random.uniform(SHORT_BREAK_SECONDS_MIN, SHORT_BREAK_SECONDS_MAX)
                        tqdm.write(f"\n--- {SHORT_BREAK_INTERVAL}件の新規スクレイピングを実行。サーバー負荷軽減のため {int(break_time)}秒間 休憩します ---")
                        time.sleep(break_time)
        finally:
            if driver_instance:
                driver_instance.quit()
                tqdm.write("\n--- 全ての馬の処理が完了したため、最終的なWebDriverを終了しました ---")
                _force_cleanup_processes()
    print("\n--- 事前スクレイピングが正常に完了しました ---")
    return all_horse_ids_to_fetch

def process_single_horse_worker(horse_id: str):
    load_dotenv()
    from database.database import SessionLocal
    db: Session = SessionLocal()
    try:
        html, _ = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            parsed_data = parser.parse_horse_results_page(html)
            if parsed_data and parsed_data['results']:
                horse_name = parsed_data.get('horse_name')
                results = parsed_data.get('results')
                if horse_name:
                    database_loader.load_past_results(db, horse_name, results, horse_id)
    except Exception as e:
        print(f"\n[ERROR] Horse data processing failed for {horse_id}: {e}\n")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

def process_and_load_past_horse_data(horse_ids: set):
    print(f"\n--- [STAGE 2/4] 馬の過去成績データを並列でDBにロードします ---")
    if not horse_ids:
        print("ロード対象の馬データがありません。")
        return
    horse_ids_list = list(horse_ids)
    with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
        with tqdm(total=len(horse_ids_list), desc="[HISTORY] 馬の過去成績をDBへ保存中", unit="horse") as pbar:
            for _ in pool.imap_unordered(process_single_horse_worker, horse_ids_list):
                pbar.update(1)

def process_single_date_worker(target_date: datetime.date):
    load_dotenv()
    from database.database import SessionLocal
    db: Session = SessionLocal()
    try:
        insert_new_predictions(db, target_date)
        today_jst = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))).date()
        if target_date <= today_jst:
            update_race_results(db, target_date)
    except Exception as e:
        print(f"\n[ERROR] Worker failed on date {target_date}: {e}\n")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    return target_date

def process_races_and_predictions(start_date: datetime.date, end_date: datetime.date):
    print(f"\n--- [STAGE 3/4] DB保存とAI予測を並列処理します ---")
    print(f"最大 {MAX_WORKERS} 個のワーカープロセスを使用します...")
    dates_to_process = [start_date + datetime.timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    if not dates_to_process:
        print("処理対象の日付がありません。")
        return
    with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
        with tqdm(total=len(dates_to_process), desc="[HISTORY] 日付ごとに並列処理中", unit="day") as pbar:
            for _ in pool.imap_unordered(process_single_date_worker, dates_to_process):
                pbar.update(1)

def calculate_advantages(db: Session):
    print(f"\n--- [STAGE 4/4] 馬番有利不利データを計算します ---")
    try:
        predictor.calculate_and_save_all_horse_number_advantages(db)
        print("--- 全ての有利不利計算が完了しました ---\n")
    except Exception as e:
        print(f"--- 馬番有利不利データの計算中にエラーが発生しました: {e} ---")
        traceback.print_exc()

def scrape_race_lists_for_date(target_date: datetime.date):
    print(f"\n--- [PRODUCTION] Updating race lists for {target_date.strftime('%Y-%m-%d')} ---")
    driver = None
    try:
        driver = scraper._prepare_chrome_driver()
        target_date_str = target_date.strftime('%Y%m%d')
        for is_nar in [False, True]:
            race_type = "NAR" if is_nar else "JRA"
            print(f"  -> Fetching {race_type} race list...")
            scraper.get_race_list_html(target_date_str, is_nar=is_nar, driver=driver, force_download=True)
        print(f"--- Finished updating race lists for {target_date.strftime('%Y-%m-%d')} ---")
    except Exception as e:
        print(f"[ERROR] Failed to scrape race lists for {target_date}: {e}")
    finally:
        if driver:
            driver.quit()
            _force_cleanup_processes()

def main():
    start_time = time.time()
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')
    send_notification(f"パイプライン処理を開始します。\n**モード**: `{PIPELINE_MODE}`")
    try:
        if PIPELINE_MODE == 'HISTORY':
            # ★★★ 既存のHISTORYモード処理（そのまま残す）★★★
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("!!!  HISTORYモードで実行します (パイプライン処理を最適化)  !!!")
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            if len(sys.argv) != 3:
                raise ValueError("開始日と終了日を 'YYYY-MM-DD' 形式で指定してください。")
            start_date_str, end_date_str = sys.argv[1], sys.argv[2]
            ANALYSIS_START_DATE = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            ANALYSIS_END_DATE = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            if ANALYSIS_START_DATE > ANALYSIS_END_DATE:
                raise ValueError("開始日は終了日より前の日付にしてください。")
            print(f"\n処理対象期間: {ANALYSIS_START_DATE.strftime('%Y-%m-%d')} から {ANALYSIS_END_DATE.strftime('%Y-%m-%d')} まで")
            target_horse_ids = pre_scrape_all_data(ANALYSIS_START_DATE, ANALYSIS_END_DATE)
            process_and_load_past_horse_data(target_horse_ids)
            process_races_and_predictions(ANALYSIS_START_DATE, ANALYSIS_END_DATE)
            db_session_for_advantage = SessionLocal()
            try:
                calculate_advantages(db_session_for_advantage)
            finally:
                db_session_for_advantage.close()
        
        elif PIPELINE_MODE == 'RESULTS_ONLY':
            # ★★★ 新規追加: 前日の結果のみ取得 ★★★
            print("--- RUNNING IN RESULTS_ONLY MODE (前日の結果取得) ---")
            jst = datetime.timezone(datetime.timedelta(hours=9))
            today_jst = datetime.datetime.now(jst).date()
            target_date_results = today_jst - datetime.timedelta(days=1)
            
            scrape_race_lists_for_date(target_date_results)
            
            db: Session = SessionLocal()
            try:
                update_race_results(db, target_date_results)
            finally:
                if db.is_active:
                    db.close()
                    
        elif PIPELINE_MODE == 'PREDICTIONS_ONLY':
            # ★★★ 新規追加: 翌日の予測のみ取得 ★★★
            print("--- RUNNING IN PREDICTIONS_ONLY MODE (翌日の予測取得) ---")
            jst = datetime.timezone(datetime.timedelta(hours=9))
            today_jst = datetime.datetime.now(jst).date()
            target_date_predictions = today_jst + datetime.timedelta(days=1)
            
            scrape_race_lists_for_date(target_date_predictions)
            
            db: Session = SessionLocal()
            try:
                insert_new_predictions(db, target_date_predictions)
            finally:
                if db.is_active:
                    db.close()
                    
        else: # PRODUCTIONモード（従来通り、両方実行）
            print("--- RUNNING IN PRODUCTION MODE ---")
            jst = datetime.timezone(datetime.timedelta(hours=9))
            today_jst = datetime.datetime.now(jst).date()
            
            target_date_results = today_jst - datetime.timedelta(days=1)
            target_date_predictions = today_jst + datetime.timedelta(days=1)

            scrape_race_lists_for_date(target_date_results)
            scrape_race_lists_for_date(target_date_predictions)

            db: Session = SessionLocal()
            try:
                update_race_results(db, target_date_results)
                insert_new_predictions(db, target_date_predictions)
            finally:
                if db.is_active:
                    db.close()

        elapsed_time = time.time() - start_time
        success_message = (f"✅ パイプライン処理が正常に完了しました。\n**モード**: `{PIPELINE_MODE}`\n**処理時間**: `{elapsed_time:.2f} 秒`")
        send_notification(success_message)
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        error_message = (f"🚨 パイプライン処理中にエラーが発生しました。\n"
                         f"**モード**: `{PIPELINE_MODE}`\n"
                         f"**経過時間**: `{elapsed_time:.2f} 秒`\n"
                         f"**エラー**: \n```\n{traceback.format_exc()}\n```")
        send_notification(error_message, is_error=True)
        raise
    
    finally:
        print("\n全ての処理が完了しました。")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()