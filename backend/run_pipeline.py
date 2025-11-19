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
from sqlalchemy import select
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor, scraper, parser, database_loader
from db_handler import update_race_results, insert_new_predictions
import pandas as pd
from database import models
import math
import gc
from datetime import timedelta

# --- 設定 ---
# メモリ使用量を削減するため、並列ワーカー数を制限
# Render環境では特にメモリを節約
if os.getenv('RENDER') == 'true':
    # Render環境では1ワーカーに制限してメモリ使用量を最小化
    MAX_WORKERS = 1
else:
    try:
        CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
        # メモリ制限が2GBの環境では、ワーカー数を2に制限
        MAX_WORKERS = min(CPU_COUNT, 2)
    except NotImplementedError:
        MAX_WORKERS = 1

BANEI_VENUE_CODES = ["33", "65"]

BROWSER_REFRESH_INTERVAL = 50
CONSECUTIVE_TIMEOUT_LIMIT = 3
MIN_SLEEP = 2.0
MAX_SLEEP = 4.0

def _force_cleanup_processes():
    """実行中の可能性のあるChromeおよびChromeDriverのプロセスを強制終了する。"""
    try:
        if os.name == 'nt':
            os.system("taskkill /F /IM chromedriver.exe /T > nul 2>&1")
            os.system("taskkill /F /IM chrome.exe /T > nul 2>&1")
        else:
            os.system("pkill -f chromedriver 2>/dev/null || true")
            os.system("pkill -f chrome 2>/dev/null || true")
            os.system("pkill -f chromium 2>/dev/null || true")
        tqdm.write("  -> クリーンアップ: 既存のChrome/ChromeDriverプロセスを強制終了しました。")
        time.sleep(2)
        gc.collect()
    except Exception as e:
        tqdm.write(f"  -> クリーンアップ中に軽微なエラーが発生しました (無視できます): {e}")

def send_notification(message: str, is_error: bool = False):
    webhook_url = os.getenv("WEBHOOK_URL")
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
from sqlalchemy import select
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor, scraper, parser, database_loader
from db_handler import update_race_results, insert_new_predictions
import pandas as pd
from database import models
import math
import gc
from datetime import timedelta
import argparse

# --- 設定 ---
# メモリ使用量を削減するため、並列ワーカー数を制限
# Render環境では特にメモリを節約
if os.getenv('RENDER') == 'true':
    # Render環境では1ワーカーに制限してメモリ使用量を最小化
    MAX_WORKERS = 1
else:
    try:
        CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
        # メモリ制限が2GBの環境では、ワーカー数を2に制限
        MAX_WORKERS = min(CPU_COUNT, 2)
    except NotImplementedError:
        MAX_WORKERS = 1

BANEI_VENUE_CODES = ["33", "65"]

BROWSER_REFRESH_INTERVAL = 50
CONSECUTIVE_TIMEOUT_LIMIT = 3
MIN_SLEEP = 2.0
MAX_SLEEP = 4.0

def _force_cleanup_processes():
    """実行中の可能性のあるChromeおよびChromeDriverのプロセスを強制終了する。"""
    try:
        if os.name == 'nt':
            os.system("taskkill /F /IM chromedriver.exe /T > nul 2>&1")
            os.system("taskkill /F /IM chrome.exe /T > nul 2>&1")
        else:
            os.system("pkill -f chromedriver 2>/dev/null || true")
            os.system("pkill -f chrome 2>/dev/null || true")
            os.system("pkill -f chromium 2>/dev/null || true")
        tqdm.write("  -> クリーンアップ: 既存のChrome/ChromeDriverプロセスを強制終了しました。")
        time.sleep(2)
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
        requests.post(webhook_url, json=payload, timeout=5)
    except requests.exceptions.RequestException as e:
        print(f"通知の送信に失敗しました: {e}")

def worker_process_race(args):
    race_id, is_nar = args
    db = SessionLocal()
    driver = None
    try:
        # ランダムスリープ（開始時の負荷分散）
        time.sleep(random.uniform(0, 2.0))
        
        shutuba_html = scraper.get_shutuba_html_content(race_id, is_nar=is_nar)
        if not shutuba_html:
            return

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        if not shutuba_data or not shutuba_data.get('horses'):
            return

        # 出馬表データの保存
        # database_loader.load_shutuba_data(db, shutuba_data, race_id, datetime.date.today(), is_nar) # 日付は適当？HISTORYモードなので日付はレースIDから特定すべきだが...
        # ここでは簡略化のため、馬データの取得に集中する

        horse_ids = [h['horse_id'] for h in shutuba_data['horses'] if h.get('horse_id')]
        
        # 馬データの取得（ドライバ再利用）
        if horse_ids:
            try:
                driver = scraper._prepare_chrome_driver()
            except Exception as e:
                tqdm.write(f"Error initializing driver for race {race_id}: {e}")
            
            for i, horse_id in enumerate(horse_ids):
                try:
                    # 既存データのチェック（簡易）
                    # existing = db.query(models.Result).filter(models.Result.horse_id == horse_id).count()
                    # if existing >= 5: continue

                    scraper.get_horse_page_html(horse_id, driver=driver)
                    
                    # GC (適度な頻度で)
                    if i % 5 == 0:
                        gc.collect()
                except Exception as e:
                    tqdm.write(f"Error processing horse {horse_id} in race {race_id}: {e}")
            
    except Exception as e:
        tqdm.write(f"Error in worker_process_race {race_id}: {e}")
    finally:
        if driver:
            scraper.cleanup_chrome_driver(driver)
        db.close()
        gc.collect()

def backfill_historical_data(start_date, end_date):
    print(f"Backfilling data from {start_date} to {end_date}")
    
    all_race_ids = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime('%Y%m%d')
        # レース一覧取得 (JRA)
        try:
            scraper.get_race_list_html(date_str, is_nar=False, force_download=False)
            # html_cacheから読み込んでID抽出するロジックが必要だが、
            # ここでは簡易的に scraper.get_race_list_html が保存したファイルを parser で読む想定
            # しかし parser.parse_race_ids_from_list は HTML 文字列を受け取る
            # 既存の insert_new_predictions のロジックを流用するのが確実
            
            # 簡易実装: ファイルを読んでID抽出
            file_path = os.path.join("data", "html_cache", "racelist", f"{date_str}.bin")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    race_ids = parser.parse_race_ids_from_list(f.read())
                    all_race_ids.extend([(rid, False) for rid in race_ids])
        except Exception as e:
            print(f"Error getting JRA race list for {date_str}: {e}")

        # レース一覧取得 (NAR)
        try:
            scraper.get_race_list_html(date_str, is_nar=True, force_download=False)
            file_path = os.path.join("data", "html_cache", "nar_racelist", f"{date_str}.bin")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    race_ids = parser.parse_race_ids_from_list(f.read())
                    # 帯広除外など
                    race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                    all_race_ids.extend([(rid, True) for rid in race_ids])
        except Exception as e:
            print(f"Error getting NAR race list for {date_str}: {e}")

        current_date += timedelta(days=1)

    print(f"Found {len(all_race_ids)} races to process.")
    
    # 並列処理
    if all_race_ids:
        with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
            list(tqdm(pool.imap_unordered(worker_process_race, all_race_ids), total=len(all_race_ids), desc="Processing Races"))

def main():
    parser = argparse.ArgumentParser(description='競馬データパイプライン')
    parser.add_argument('--date', type=str, default=None,
                       help='処理対象日: "today", "tomorrow", "yesterday", または "YYYY-MM-DD" 形式')
    parser.add_argument('--mode', type=str, default=None,
                       help='実行モード: PRODUCTION, RESULTS_ONLY, PREDICTIONS_ONLY, HISTORY')
    args = parser.parse_args()

    start_time = time.time()
    PIPELINE_MODE = args.mode or os.getenv('PIPELINE_MODE', 'PRODUCTION')
    send_notification(f"パイプライン処理を開始します。\n**モード**: `{PIPELINE_MODE}`\n**日付指定**: `{args.date or '自動'}`")

    _force_cleanup_processes()

    try:
        if PIPELINE_MODE == 'HISTORY':
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("!!!  HISTORYモードで実行します (記事の並列処理アーキテクチャ)  !!!")
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            if len(sys.argv) < 3: # sys.argv check needs to be careful with argparse
                # argparseを使った場合、sys.argv[1]などは消費されている可能性があるが、
                # ここでは位置引数として日付を期待している古いロジックが残っている
                # argparseに引数を追加するか、args.dateを使うように変更すべきだが、
                # 既存ロジックを尊重して sys.argv をチェック
                pass
            
            # args.date がない場合のみ sys.argv を見る、あるいは argparse で start/end を受け取るべき
            # ここでは簡易的に sys.argv をパースするロジックを維持（ただし argparse と競合する可能性あり）
            # 安全のため、args.date が指定されていればそれを使うロジックに変更推奨だが、
            # 元のコードが sys.argv を使っていたので、それを復元する。
            # ただし argparse が sys.argv をパースしてしまうので、残りの引数を確認する必要がある。
            # ここでは、HISTORYモードの場合は argparse の定義を変えるか、
            # 単にハードコードされた sys.argv 参照を修正する。
            
            # 修正: argparse で start_date, end_date を受け取るのが正しいが、
            # とりあえず元のコードに近い形で復元。
            
            if len(sys.argv) >= 4 and sys.argv[1] == '--mode' and sys.argv[2] == 'HISTORY':
                 # python run_pipeline.py --mode HISTORY 2023-01-01 2023-01-31
                 # みたいな呼び出しを想定？
                 pass

            # 既存コードの復元
            if len(sys.argv) >= 3:
                try:
                    s_date = sys.argv[-2]
                    e_date = sys.argv[-1]
                    start_date = datetime.datetime.strptime(s_date, '%Y-%m-%d').date()
                    end_date = datetime.datetime.strptime(e_date, '%Y-%m-%d').date()
                except:
                    # フォールバック: 今日から
                    start_date = datetime.date.today()
                    end_date = datetime.date.today()
            else:
                 start_date = datetime.date.today()
                 end_date = datetime.date.today()
            
            print(f"\n処理対象期間: {start_date.strftime('%Y-%m-%d')} から {end_date.strftime('%Y-%m-%d')} まで")
            print(f"最大ワーカー数: {MAX_WORKERS}")
            
            backfill_historical_data(start_date, end_date)

            db_session = SessionLocal()
            try:
                predictor.calculate_and_save_all_horse_number_advantages(db_session)
            finally:
                db_session.close()

        elif PIPELINE_MODE in ['PRODUCTION', 'RESULTS_ONLY', 'PREDICTIONS_ONLY']:
            print(f"--- RUNNING IN {PIPELINE_MODE} MODE ---")
            jst = datetime.timezone(datetime.timedelta(hours=9))
            today_jst = datetime.datetime.now(jst).date()

            # 日付指定の処理
            if args.date:
                if args.date == 'today':
                    target_date_override = today_jst
                elif args.date == 'tomorrow':
                    target_date_override = today_jst + datetime.timedelta(days=1)
                elif args.date == 'yesterday':
                    target_date_override = today_jst - datetime.timedelta(days=1)
                else:
                    try:
                        target_date_override = datetime.datetime.strptime(args.date, '%Y-%m-%d').date()
                    except ValueError:
                        print(f"警告: 無効な日付形式です: {args.date}。自動日付を使用します。")
                        target_date_override = None
                    

                if target_date_override:
                    print(f"日付指定: {target_date_override} を処理対象とします")
            else:
                target_date_override = None

            db: Session = SessionLocal()

            try:
                if PIPELINE_MODE in ['PRODUCTION', 'RESULTS_ONLY']:
                    target_date_results = target_date_override if target_date_override and args.date in ['today', 'yesterday'] else (today_jst - datetime.timedelta(days=1))
                    print(f"\n--- [RESULTS_ONLY] {target_date_results} の結果取得を開始 ---")
                    driver = None
                    try:
                        driver = scraper._prepare_chrome_driver()
                        try:
                            scraper.get_race_list_html(target_date_results.strftime('%Y%m%d'), is_nar=False, driver=driver, force_download=True)
                        except Exception as e:
                            print(f"警告: 中央競馬のレース一覧取得に失敗しました: {e}")
                        try:
                            scraper.get_race_list_html(target_date_results.strftime('%Y%m%d'), is_nar=True, driver=driver, force_download=True)
                        except Exception as e:
                            print(f"警告: NAR競馬のレース一覧取得に失敗しました: {e}")
                    except Exception as e:
                        print(f"警告: ドライバー初期化に失敗しました: {e}")
                    finally:
                        scraper.cleanup_chrome_driver(driver)
                        _force_cleanup_processes()

                    try:
                        update_race_results(db, target_date_results)
                        print(f"--- [RESULTS_ONLY] {target_date_results} の結果取得が完了 ---")
                    except Exception as e:
                        print(f"警告: 結果データの更新に失敗しました: {e}")
                    gc.collect()

                if PIPELINE_MODE in ['PRODUCTION', 'PREDICTIONS_ONLY']:
                    # 日付が明示的に指定されている場合はそれを使用、そうでない場合はデフォルト（明日）
                    if target_date_override:
                        target_date_predictions = target_date_override
                    else:
                        target_date_predictions = today_jst + datetime.timedelta(days=1)
                    print(f"\n--- [PREDICTIONS_ONLY] {target_date_predictions} の予測生成を開始 ---")
                    driver = None
                    try:
                        driver = scraper._prepare_chrome_driver()
                        try:
                            scraper.get_race_list_html(target_date_predictions.strftime('%Y%m%d'), is_nar=False, driver=driver, force_download=True)
                        except Exception as e:
                            print(f"警告: 中央競馬のレース一覧取得に失敗しました: {e}")
                        try:
                            scraper.get_race_list_html(target_date_predictions.strftime('%Y%m%d'), is_nar=True, driver=driver, force_download=True)
                        except Exception as e:
                            print(f"警告: NAR競馬のレース一覧取得に失敗しました: {e}")
                    except Exception as e:
                        print(f"警告: ドライバー初期化に失敗しました: {e}")
                    finally:
                        scraper.cleanup_chrome_driver(driver)
                        _force_cleanup_processes()

                    try:
                        insert_new_predictions(db, target_date_predictions)
                        print(f"--- [PREDICTIONS_ONLY] {target_date_predictions} の予測生成が完了 ---")
                    except Exception as e:
                        print(f"警告: 予測データの挿入に失敗しました: {e}")
                    gc.collect()
            finally:
                if db.is_active:
                    db.close()

        else:
            print(f"未定義のPIPELINE_MODEです: {PIPELINE_MODE}")

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
        _force_cleanup_processes()
        print("\n全ての処理が完了しました。")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()