# backend/run_pipeline.py

from dotenv import load_dotenv
load_dotenv()

import os
import datetime
import multiprocessing
import sys
import time
import random
import requests # ★ 通知機能のために追加
import traceback # ★ 通知機能のために追加
from sqlalchemy.orm import Session
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor, scraper, parser, database_loader
from db_handler import update_race_results, insert_new_predictions

# --- 設定 ---
try:
    CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
except NotImplementedError:
    CPU_COUNT = 1

MAX_WORKERS = 4
BANEI_VENUE_CODES = ["33", "65"]

DRIVER_RESTART_INTERVAL = 500
LONG_BREAK_INTERVAL = 1000
LONG_BREAK_SECONDS = 300
SHORT_BREAK_INTERVAL = 50
SHORT_BREAK_SECONDS_MIN = 60
SHORT_BREAK_SECONDS_MAX = 120


def _force_cleanup_processes():
    """
    Windows環境で実行中の可能性のあるChromeおよびChromeDriverのプロセスを強制終了する。
    これにより、長時間実行時のゴーストプロセス問題を解消する。
    """
    try:
        os.system("taskkill /F /IM chromedriver.exe /T > nul 2>&1")
        os.system("taskkill /F /IM chrome.exe /T > nul 2>&1")
        tqdm.write("  -> クリーンアップ: 既存のChrome/ChromeDriverプロセスを強制終了しました。")
        time.sleep(2)
    except Exception as e:
        tqdm.write(f"  -> クリーンアップ中に軽微なエラーが発生しました (無視できます): {e}")


# --- ★★★ ここからコード追加 (通知機能) ★★★ ---
def send_notification(message: str, is_error: bool = False):
    """
    指定されたメッセージをWebhook URLに送信する。
    """
    webhook_url = os.getenv("WEBHOOK_URL")
    if not webhook_url:
        # WEBHOOK_URLが設定されていない場合は、コンソールに出力するだけ
        print(f"[NOTIFICATION]\n{message}")
        return

    color = 15746887 if is_error else 3066993 # Discordの色 (赤 or 緑)
    payload = {
        "embeds": [{
            "title": "🏇 Keiba AI Batch Status",
            "description": message,
            "color": color,
            "timestamp": datetime.datetime.now().isoformat()
        }]
    }
    try:
        requests.post(webhook_url, json=payload, timeout=10)
    except requests.RequestException as e:
        print(f"Webhookへの通知送信に失敗しました: {e}")
# --- ★★★ ここまでコード追加 ★★★ ---


# --- 初期化 ---
Base.metadata.create_all(bind=engine)


def pre_scrape_all_data(start_date: datetime.date, end_date: datetime.date) -> set:
    """
    [STAGE 1/4]
    指定された期間のスクレイピングを逐次実行し、HTMLをキャッシュする。
    返り値として、収集対象となった全てのユニークな馬IDのセットを返す。
    """
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
                if driver:
                    driver.quit()
                _force_cleanup_processes()
                driver = scraper._prepare_chrome_driver()

            target_date_str = target_date.strftime('%Y%m%d')
            all_race_ids_for_date = []

            for is_nar in [False, True]:
                race_type_str = "地方競馬(NAR)" if is_nar else "中央競馬(JRA)"
                list_html, was_scraped = scraper.get_race_list_html(target_date_str, is_nar=is_nar, driver=driver)
                if was_scraped: newly_scraped_count += 1
                
                if not list_html: continue

                race_ids = parser.parse_race_ids_from_list(list_html)
                if not race_ids: continue
                
                if is_nar:
                    original_count = len(race_ids)
                    race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                    if original_count - len(race_ids) > 0:
                        tqdm.write(f"                     -> 地方競馬から、ばんえい競馬のレース {original_count - len(race_ids)} 件を除外しました。")
                
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
                            if horse.get("horse_id"):
                                all_horse_ids_to_fetch.add(horse["horse_id"])
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
                        tqdm.write(f"\n--- {SHORT_BREAK_INTERVAL}件の新規スクレイピングを実行しました。サーバー負荷軽減のため {int(break_time)}秒間 休憩します ---")
                        time.sleep(break_time)
        finally:
            if driver_instance:
                driver_instance.quit()
                tqdm.write("\n--- 全ての馬の処理が完了したため、最終的なWebDriverを終了しました ---")
                _force_cleanup_processes()

    print("\n--- 事前スクレイピングが正常に完了しました ---")
    return all_horse_ids_to_fetch


def process_single_horse_worker(horse_id: str):
    """
    単一の馬IDに対して、キャッシュからHTMLを読み込み、解析し、DBに保存するワーカー関数
    """
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
    """
    [STAGE 2/4]
    キャッシュされた全馬の過去成績HTMLを並列処理でDBにロードする。
    """
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
    """
    単一の日付に対して、予測生成と結果更新を行うワーカー関数
    """
    load_dotenv()
    from database.database import SessionLocal
    db: Session = SessionLocal()
    try:
        insert_new_predictions(db, target_date)
        
        today_jst = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))).date()
        if target_date <= today_jst: # 未来のレース結果は更新しない
            update_race_results(db, target_date)

    except Exception as e:
        print(f"\n[ERROR] Worker failed on date {target_date}: {e}\n")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    return target_date

def process_races_and_predictions(start_date: datetime.date, end_date: datetime.date):
    """
    [STAGE 3/4]
    レース情報のDB保存とAI予測を並列処理する。
    """
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

# ==============================================================================
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
def calculate_advantages(db: Session):
    """
    [STAGE 4/4]
    馬番有利不利データをDB全体のデータから再計算する。
    """
    print(f"\n--- [STAGE 4/4] 馬番有利不利データを計算します ---")
    try:
        # DB全体を対象に計算する新しい関数を呼び出す
        predictor.calculate_and_save_all_horse_number_advantages(db)
        print("--- 全ての有利不利計算が完了しました ---\n")
    except Exception as e:
        print(f"--- 馬番有利不利データの計算中にエラーが発生しました: {e} ---")
        traceback.print_exc()
# ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲
# ==============================================================================

def scrape_race_lists_for_date(target_date: datetime.date):
    """
    指定された単一日付のJRAおよびNARのレース一覧HTMLを取得し、キャッシュに保存する。
    PRODUCTIONモードでの実行を想定した軽量版。
    """
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
    # --- ★★★ ここからコード修正 (main関数) ★★★ ---
    start_time = time.time()
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')

    # 処理開始を通知
    send_notification(f"パイプライン処理を開始します。\n**モード**: `{PIPELINE_MODE}`")

    try:
        if PIPELINE_MODE == 'HISTORY':
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("!!!  HISTORYモードで実行します (パイプライン処理を最適化)  !!!")
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            
            if len(sys.argv) != 3:
                raise ValueError("開始日と終了日を 'YYYY-MM-DD' 形式で指定してください。")
            
            start_date_str = sys.argv[1]
            end_date_str = sys.argv[2]
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
                # ==============================================================================
                # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
                # 修正した関数を呼び出す
                calculate_advantages(db_session_for_advantage)
                # ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲
                # ==============================================================================
            finally:
                db_session_for_advantage.close()

        else: # PRODUCTIONモード
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

        # 処理成功を通知
        elapsed_time = time.time() - start_time
        success_message = (
            f"✅ パイプライン処理が正常に完了しました。\n"
            f"**モード**: `{PIPELINE_MODE}`\n"
            f"**処理時間**: `{elapsed_time:.2f} 秒`"
        )
        send_notification(success_message)

    except Exception as e:
        # 処理失敗を通知
        elapsed_time = time.time() - start_time
        error_message = (
            f"🚨 パイプライン処理中にエラーが発生しました。\n"
            f"**モード**: `{PIPELINE_MODE}`\n"
            f"**経過時間**: `{elapsed_time:.2f} 秒`\n"
            f"**エラー**: \n```\n{traceback.format_exc()}\n```"
        )
        send_notification(error_message, is_error=True)
        # エラーが発生したことを呼び出し元に伝えるために再スローする
        raise
    
    finally:
        print("\n全ての処理が完了しました。")
    # --- ★★★ ここまでコード修正 ★★★ ---

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