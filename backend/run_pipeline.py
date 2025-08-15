# backend/run_pipeline.py

import os
import datetime
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from scripts import predictor
from core.config import VENUE_CODE_MAP

# ★★★ 新規作成したdb_handlerをインポート ★★★
from db_handler import update_race_results, insert_new_predictions

# --- 初期化 ---
Base.metadata.create_all(bind=engine)

# --- HISTORYモードの処理（変更なし・既存のまま） ---
def backfill_historical_data(db: Session, start_date: datetime.date, end_date: datetime.date):
    """
    指定された期間のレース情報を網羅的に取得・予測し、DBに格納する。
    db_health_checker.pyで検出された欠損・不整合データの補完に使用する。
    """
    from scripts import scraper, parser, database_loader # 遅延インポート
    from typing import List, Tuple
    print(f"Backfilling historical data from {start_date} to {end_date}...")
    
    current_date = start_date
    while current_date <= end_date:
        # 予測の追加処理
        insert_new_predictions(db, current_date)
        # 結果の更新処理
        update_race_results(db, current_date)
        current_date += datetime.timedelta(days=1)

def process_advantage_in_chunks(db: Session, start_date: datetime.date, end_date: datetime.date, chunk_size_days: int = 30):
    """メモリ対策：指定された期間をチャンクに分割して馬番有利不利を計算する"""
    print(f"\n--- Calculating Horse Number Advantage in chunks from {start_date} to {end_date} ---")
    current_start = start_date
    while current_start <= end_date:
        current_end = min(current_start + datetime.timedelta(days=chunk_size_days - 1), end_date)
        predictor.calculate_and_save_horse_number_advantage_for_period(db, current_start, current_end)
        current_start = current_end + datetime.timedelta(days=1)
    print("--- Finished all advantage calculations ---\n")

def main():
    """モードに応じて指定された日付の予測を生成する一連の処理を実行する。"""
    PIPELINE_MODE = os.getenv('PIPELINE_MODE', 'PRODUCTION')
    db: Session = SessionLocal()

    try:
        if PIPELINE_MODE == 'HISTORY':
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("!!!  RUNNING IN HISTORY MODE            !!!")
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            # ▼▼▼ データを補完したい日付をここに設定 ▼▼▼
            ANALYSIS_START_DATE = datetime.date(2025, 8, 11)
            ANALYSIS_END_DATE = datetime.date(2025, 8, 12)
            # ▲▲▲ ここまで ▲▲▲
            
            # 1. 欠損・不整合データの補完
            backfill_historical_data(db, ANALYSIS_START_DATE, ANALYSIS_END_DATE)
            
            # 2. 補完したデータを含む期間で馬番有利不利を再計算
            #    （広めの範囲で実行しても重複計算はされないので安全）
            print("\n--- Recalculating all horse number advantages after history backfill ---")
            history_start_date = datetime.date(2020, 1, 1) # プロジェクトのデータ開始日
            history_end_date = datetime.date.today()
            process_advantage_in_chunks(db, history_start_date, history_end_date, chunk_size_days=90)

        else: # PRODUCTIONモード（デフォルト）
            print("--- RUNNING IN PRODUCTION MODE ---")
            
            # 日本時間 (JST) を基準に今日の日付を取得
            # RenderのサーバーはUTCなので、時差を考慮する
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
    try:
        import winsound
        winsound.Beep(880, 500)
    except ImportError:
        print("winsound module not found, skipping sound.")
    
    main()
    
    try:
        import winsound
        winsound.Beep(880, 500)
    except ImportError:
        print("winsound module not found, skipping sound.")