# backend/db_health_checker.py
import os
import sys
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def check_database_health(start_date_str: str):
    """
    データベースの健全性をチェックする統合スクリプト。
    1. 指定期間内にレースデータが全く存在しない「欠損日」を検出する。
    2. レースデータはあるが予測データがない「不整合データ」を検出する。
    """
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    except ValueError:
        print("Error: Invalid date format. Please use YYYY-MM-DD.")
        print("Example: python db_health_checker.py 2025-01-01")
        return

    load_dotenv()
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("Error: DATABASE_URL is not set in .env file.")
        return

    # --- ▼▼▼ ご自身の環境に合わせてここを編集してください ▼▼▼ ---
    PREDICTION_TABLE_NAME = 'predictions'
    DATE_COLUMN_NAME = 'race_date' # racesテーブルの日付カラム名
    # --- ▲▲▲ ここまで ▲▲▲ ---

    print("Connecting to the database...")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            
            # --- チェック1: 欠損日の検出 ---
            print("\n--- [Check 1/2] Checking for missing dates ---")
            
            dates_query = text(f"""
                SELECT DISTINCT CAST({DATE_COLUMN_NAME} AS DATE) as race_date 
                FROM races 
                WHERE CAST({DATE_COLUMN_NAME} AS DATE) >= :start_date 
                ORDER BY race_date;
            """)
            result = connection.execute(dates_query, {'start_date': start_date})
            db_dates = {row[0] for row in result}

            if not db_dates:
                print(f"No race data found on or after {start_date_str}. Cannot check for missing dates.")
            else:
                max_date = max(db_dates)
                print(f"Checking period: {start_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
                
                missing_dates = []
                current_date = start_date
                while current_date <= max_date:
                    if current_date not in db_dates:
                        missing_dates.append(current_date)
                    current_date += timedelta(days=1)
                
                if not missing_dates:
                    print("✅ No missing dates found.")
                else:
                    print(f"🚨 Found {len(missing_dates)} missing dates (no races in 'races' table):")
                    # 1行に7個の日付を表示
                    formatted_dates = [d.strftime('%Y-%m-%d') for d in missing_dates]
                    chunk_size = 7
                    for i in range(0, len(formatted_dates), chunk_size):
                        chunk = formatted_dates[i:i + chunk_size]
                        print("  " + ", ".join(chunk))

            # --- チェック2: データ不整合の検出 ---
            print(f"\n--- [Check 2/2] Checking for data integrity against '{PREDICTION_TABLE_NAME}' table ---")
            
            integrity_query = text(f"""
                SELECT r.id, CAST(r.{DATE_COLUMN_NAME} AS DATE) as race_date
                FROM races r
                LEFT JOIN {PREDICTION_TABLE_NAME} p ON r.id = CAST(p.id AS VARCHAR)
                WHERE p.id IS NULL AND CAST(r.{DATE_COLUMN_NAME} AS DATE) >= :start_date
                ORDER BY race_date, r.id;
            """)
            
            integrity_result = connection.execute(integrity_query, {'start_date': start_date})
            inconsistent_races = list(integrity_result)

            if not inconsistent_races:
                print("✅ Data integrity check passed. No inconsistencies found.")
            else:
                print(f"🚨 Found {len(inconsistent_races)} races with missing prediction data:")
                
                races_by_date = {}
                for race_id, race_date in inconsistent_races:
                    if race_date not in races_by_date:
                        races_by_date[race_date] = []
                    races_by_date[race_date].append(race_id)
                
                for race_date, ids in sorted(races_by_date.items()):
                    print(f"  - Date: {race_date.strftime('%Y-%m-%d')} ({len(ids)} races):")
                    # 1行に5個のIDを表示
                    chunk_size = 5
                    for i in range(0, len(ids), chunk_size):
                        chunk = ids[i:i + chunk_size]
                        print("    " + ", ".join(chunk))

            print("\n" + "="*30)
            print("Health check finished.")
            print("="*30)

    except Exception as e:
        if "does not exist" in str(e):
             print(f"\n[Error] A table or column does not exist. Please check your settings at the top of the script.")
             print(f"Details: {e}")
        else:
            print(f"An error occurred: {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        start_date_input = sys.argv[1]
        check_database_health(start_date_input)
    else:
        print("Usage: python db_health_checker.py YYYY-MM-DD")
        print("Example: python db_health_checker.py 2025-01-01")
