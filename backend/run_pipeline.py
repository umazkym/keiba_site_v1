# backend/run_pipeline.py

import os
import datetime
import multiprocessing
from sqlalchemy.orm import Session
from tqdm import tqdm
from database.database import SessionLocal, engine, Base
from scripts import predictor

# db_handlerをインポート
from db_handler import update_race_results, insert_new_predictions

# --- 設定 ---
# RenderのDBプランの最大同時接続数やローカル環境に応じて調整します。
# 安全マージンを見て、実際の最大接続数より少し少ない値に設定することを推奨します。
# 例: 最大接続数が20なら、10-15程度に設定
# デフォルトでは、論理CPUコア数 - 1 を使用します。
try:
    CPU_COUNT = max(1, multiprocessing.cpu_count() - 1)
except NotImplementedError:
    CPU_COUNT = 1
MAX_WORKERS = int(os.getenv('MAX_WORKERS', str(CPU_COUNT)))


# --- 初期化 ---
# メインプロセスで一度だけ実行
Base.metadata.create_all(bind=engine)

def process_single_date_worker(target_date: datetime.date):
    """
    単一の日付に対するデータ処理を行うワーカー関数。
    各プロセスで独立したDBセッションを生成・破棄するため、デッドロックやセッション共有の問題を回避します。
    """
    db: Session = SessionLocal()
    try:
        # 予測の追加処理 (レース情報取得、予測、保存)
        insert_new_predictions(db, target_date)
        # 結果の更新処理 (払い戻し情報など)
        update_race_results(db, target_date)
    except Exception as e:
        # エラーが発生しても他のプロセスの処理を止めないようにログを出力
        print(f"\n[ERROR] Worker failed on date {target_date}: {e}\n")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    return target_date

def backfill_historical_data(start_date: datetime.date, end_date: datetime.date):
    """
    指定された期間のデータを並列処理で取得・予測し、DBに格納します。
    """
    print(f"\n--- [HISTORY MODE] Backfilling data from {start_date} to {end_date} ---")
    print(f"Using up to {MAX_WORKERS} worker processes...")
    
    dates_to_process = []
    current_date = start_date
    while current_date <= end_date:
        dates_to_process.append(current_date)
        current_date += datetime.timedelta(days=1)

    if not dates_to_process:
        print("No dates to process.")
        return

    # マルチプロセッシングプールで日付ごとの処理を並列実行
    # imap_unorderedを使うことで、完了したタスクから順次結果を受け取れるため、進捗バーの更新がスムーズになります。
    with multiprocessing.Pool(processes=MAX_WORKERS) as pool:
        with tqdm(total=len(dates_to_process), desc="[HISTORY] Processing dates", unit="day") as pbar:
            for _ in pool.imap_unordered(process_single_date_worker, dates_to_process):
                pbar.update(1)

def process_advantage_in_chunks(db: Session, start_date: datetime.date, end_date: datetime.date, chunk_size_days: int = 30):
    """メモリ対策：指定された期間をチャンクに分割して馬番有利不利を計算する"""
    print(f"\n--- Calculating Horse Number Advantage in chunks from {start_date} to {end_date} ---")
    current_start = start_date
    date_chunks = []
    while current_start <= end_date:
        current_end = min(current_start + datetime.timedelta(days=chunk_size_days - 1), end_date)
        date_chunks.append((current_start, current_end))
        current_start = current_end + datetime.timedelta(days=1)
    
    for start, end in tqdm(date_chunks, desc="Calculating advantage", unit="chunk"):
         predictor.calculate_and_save_horse_number_advantage_for_period(db, start, end)

    print("--- Finished all advantage calculations ---\n")

def main():
    """モードに応じて指定された日付の予測を生成する一連の処理を実行する。"""
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')

    if PIPELINE_MODE == 'HISTORY':
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!!  RUNNING IN HISTORY MODE (Parallel)   !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        # ▼▼▼ データを補完したい日付をここに設定 ▼▼▼
        ANALYSIS_START_DATE = datetime.date(2025, 8, 16)
        ANALYSIS_END_DATE = datetime.date(2025, 8, 16)
        # ▲▲▲ ここまで ▲▲▲
        
        # 1. 欠損・不整合データの補完 (並列処理)
        backfill_historical_data(ANALYSIS_START_DATE, ANALYSIS_END_DATE)
        
        # 2. 補完したデータを含む期間で馬番有利不利を再計算 (逐次処理)
        # この処理は全期間のデータを扱うため、並列化せずメインプロセスで実行します。
        print("\n--- Recalculating all horse number advantages after history backfill ---")
        db_session_for_advantage = SessionLocal()
        try:
            history_start_date = datetime.date(2020, 1, 1) # プロジェクトのデータ開始日
            history_end_date = datetime.date.today()
            process_advantage_in_chunks(db_session_for_advantage, history_start_date, history_end_date, chunk_size_days=90)
        finally:
            db_session_for_advantage.close()

    else: # PRODUCTIONモード（デフォルト、逐次処理）
        print("--- RUNNING IN PRODUCTION MODE ---")
        db: Session = SessionLocal()
        try:
            # 日本時間 (JST) を基準に今日の日付を取得
            jst_offset = datetime.timedelta(hours=9)
            today_jst = (datetime.datetime.utcnow() + jst_offset).date()

            # 1. 前日のレース結果を「更新」
            target_date_results = today_jst - datetime.timedelta(days=1)
            update_race_results(db, target_date_results)

            # 2. 翌日のレース予測を「新規追加」
            target_date_predictions = today_jst + datetime.timedelta(days=1)
            insert_new_predictions(db, target_date_predictions)
            
        finally:
            if db.is_active:
                db.close()

    print("\nAll processing finished.")

if __name__ == "__main__":
    # Windowsでmultiprocessingを使用する際の必須設定
    multiprocessing.freeze_support()
    
    try:
        import winsound
        winsound.Beep(880, 200) # 開始音
    except ImportError:
        pass # winsoundがない環境では何もしない
    
    main()
    
    try:
        import winsound
        winsound.Beep(1046, 500) # 終了音
    except ImportError:
        pass