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

def worker_process_race(race_id_tuple):
    """
    並列処理ワーカー。1つのレースIDに関する全ての処理を行う。
    """
    race_id, is_nar = race_id_tuple
    worker_id = multiprocessing.current_process().pid

    db = SessionLocal()
    try:
        shutuba_html, _ = scraper.get_shutuba_html(race_id, is_nar=is_nar)
        if not shutuba_html:
            return

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        if not shutuba_data or not shutuba_data.get('horses'):
            return

        race_date = shutuba_data.get('race_info', {}).get('race_date')
        if not isinstance(race_date, datetime.date):
            # HTMLから日付を取得できなかった場合はスキップ
            # 注意: レースIDから日付を抽出できない（NN=開催回数、DD=開催日数であり、月日ではない）
            tqdm.write(f"[WARNING] Race date not found in HTML for race {race_id}. Skipping.")
            return

        database_loader.load_shutuba_data(db, shutuba_data, race_id, race_date, is_nar)

        horse_ids_in_race = {h['horse_id'] for h in shutuba_data['horses'] if h.get('horse_id')}
        for horse_id in horse_ids_in_race:
            if db.query(models.Result).filter(models.Result.horse_id == horse_id).count() >= 5:
                continue
            html, was_scraped = scraper.get_horse_page_html(horse_id, force_download=False)
            if html:
                parsed_data = parser.parse_horse_results_page(html)
                if parsed_data and parsed_data.get('results'):
                    horse_name = parsed_data.get('horse_name')
                    results = parsed_data.get('results')
                    if horse_name:
                        database_loader.load_past_results(db, horse_name, results, horse_id)
                # メモリ解放
                del parsed_data
            if was_scraped:
                time.sleep(random.uniform(MIN_SLEEP, MAX_SLEEP))

        predictions = predictor.create_predictions_for_race(race_id, db)
        if predictions:
            database_loader.save_prediction(db, race_id, predictions)
            predictor.calculate_and_save_matchups_for_race(db, race_id, list(horse_ids_in_race))

        # メモリ解放
        del predictions
        del shutuba_data

        result_html, _ = scraper.get_race_result_html(race_id, is_nar=is_nar)
        if result_html:
            race_data = parser.parse_race_result_page(result_html, race_id)
            if race_data and race_data.get('results'):
                database_loader.load_race_result_data(db, race_data, race_id, race_date, is_nar)
            del race_data

        # ガベージコレクション
        gc.collect()

    except Exception as e:
        tqdm.write(f"[Worker-{worker_id}] Error processing race {race_id}: {e}")
        db.rollback()
    finally:
        db.close()
        # セッション後もメモリを確実に解放
        gc.collect()

def backfill_historical_data(start_date: datetime.date, end_date: datetime.date):
    """
    指定された日付範囲のレースデータを並列処理で取得・保存する。
    メモリ使用量を削減するため、バッチ処理を実施。
    """
    tqdm.write(f"\n--- {start_date} から {end_date} までの処理を開始 ---")

    # === [修正箇所] 処理開始前に、対象期間の全データを削除する（バッチ処理で） ===
    db = SessionLocal()
    try:
        tqdm.write(f"\n[*] 既存のデータをクリーンアップします (期間: {start_date} to {end_date})...")
        races_to_delete_stmt = select(models.Race.id).where(models.Race.race_date.between(start_date, end_date))

        # メモリ使用量を削減するため、バッチ処理で削除
        BATCH_SIZE = 500
        total_deleted = 0

        while True:
            race_ids_batch = [r[0] for r in db.execute(races_to_delete_stmt).limit(BATCH_SIZE).fetchall()]
            if not race_ids_batch:
                break

            db.query(models.Matchup).filter(models.Matchup.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.query(models.Prediction).filter(models.Prediction.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.query(models.Result).filter(models.Result.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.query(models.RaceReturn).filter(models.RaceReturn.race_id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.query(models.Race).filter(models.Race.id.in_(race_ids_batch)).delete(synchronize_session=False)
            db.commit()

            total_deleted += len(race_ids_batch)
            del race_ids_batch
            gc.collect()

            # 次のバッチが残っているか確認
            if len(race_ids_batch if 'race_ids_batch' in locals() else []) < BATCH_SIZE:
                break

        if total_deleted > 0:
            tqdm.write(f"[*] {total_deleted} レース分の関連データを削除しました。")
        else:
            tqdm.write("[*] クリーンアップ対象のデータはありませんでした。")
    finally:
        db.close()
        gc.collect()
    # === 修正ここまで ===

    dates_to_process = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]

    all_race_ids = []
    driver = None
    try:
        driver = scraper._prepare_chrome_driver()
        for target_date in tqdm(dates_to_process, desc="レースURL収集"):
            date_str = target_date.strftime('%Y%m%d')
            for is_nar in [False, True]:
                list_html, _ = scraper.get_race_list_html(date_str, is_nar=is_nar, driver=driver, force_download=True)
                if list_html:
                    race_ids = parser.parse_race_ids_from_list(list_html)
                    if is_nar:
                        race_ids = [rid for rid in race_ids if rid[4:6] not in BANEI_VENUE_CODES]
                    all_race_ids.extend([(rid, is_nar) for rid in race_ids])
            # 定期的にガベージコレクション
            if len(all_race_ids) % 100 == 0:
                gc.collect()
    finally:
        scraper.cleanup_chrome_driver(driver)
        gc.collect()

    unique_race_ids = sorted(list(set(all_race_ids)))
    del all_race_ids  # 元のリストを削除してメモリ解放
    gc.collect()

    if not unique_race_ids:
        tqdm.write(f"指定期間に処理対象のレースがありませんでした。")
        return

    # クリーンアップ処理を追加したため、未処理チェックは不要になる
    unprocessed_races = unique_race_ids
    tqdm.write(f"{len(unique_race_ids)}件のレースを検出。うち未処理は{len(unprocessed_races)}件。")
    if not unprocessed_races:
        return

    # メモリ使用量を削減するため、バッチ処理で並列実行
    # Render環境ではさらに小さいバッチサイズを使用
    if os.getenv('RENDER') == 'true':
        RACE_BATCH_SIZE = int(os.getenv('RACE_BATCH_SIZE', '20'))
    else:
        RACE_BATCH_SIZE = int(os.getenv('RACE_BATCH_SIZE', '50'))
    total_races = len(unprocessed_races)

    for batch_start in range(0, total_races, RACE_BATCH_SIZE):
        batch_end = min(batch_start + RACE_BATCH_SIZE, total_races)
        batch_races = unprocessed_races[batch_start:batch_end]

        tqdm.write(f"\n[バッチ {batch_start//RACE_BATCH_SIZE + 1}/{math.ceil(total_races/RACE_BATCH_SIZE)}] {len(batch_races)}件のレースを処理中...")

        with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
            with tqdm(total=len(batch_races), desc=f"並列処理中 (バッチ {batch_start//RACE_BATCH_SIZE + 1})") as pbar:
                for _ in pool.imap_unordered(worker_process_race, batch_races):
                    pbar.update(1)

        # バッチ処理後にメモリを解放
        del batch_races
        gc.collect()

    tqdm.write(f"\n全 {total_races} レースの処理が完了しました。")

def main():
    import argparse

    # コマンドライン引数のパース
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
            if len(sys.argv) != 3:
                raise ValueError("開始日と終了日を 'YYYY-MM-DD' 形式で指定してください。")
            
            start_date = datetime.datetime.strptime(sys.argv[1], '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
            if start_date > end_date:
                raise ValueError("開始日は終了日より前の日付にしてください。")
            
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