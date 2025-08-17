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
        print("\n❌ エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        print("💡 使い方: python backend/db_health_checker.py YYYY-MM-DD")
        return

    load_dotenv()
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    # --- テーブル名・カラム名設定 ---
    # 基本的に変更不要ですが、もし変更した場合はここを修正してください
    PREDICTION_TABLE_NAME = 'predictions'
    DATE_COLUMN_NAME = 'race_date'
    # ---

    print("\nデータベースに接続しています...")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            print("✅ 接続に成功しました。データの健全性チェックを開始します。")
            
            # --- チェック1: 欠損日の検出 ---
            print("\n--- [チェック1/2] データ欠損日の検出 ---")
            
            dates_query = text(f"""
                SELECT DISTINCT CAST({DATE_COLUMN_NAME} AS DATE) as race_date 
                FROM races 
                WHERE CAST({DATE_COLUMN_NAME} AS DATE) >= :start_date 
                ORDER BY race_date;
            """)
            result = connection.execute(dates_query, {'start_date': start_date})
            db_dates = {row[0] for row in result}

            if not db_dates:
                print(f"⚠️ 警告: {start_date_str} 以降のレースデータが見つかりませんでした。")
                print("   -> PIPELINE_MODE=HISTORY で run_pipeline.py を実行してデータを取得してください。")
                return

            max_date = max(db_dates)
            print(f"チェック対象期間: {start_date.strftime('%Y-%m-%d')} ～ {max_date.strftime('%Y-%m-%d')}")
            
            missing_dates = []
            current_date = start_date
            while current_date <= max_date:
                if current_date not in db_dates:
                    missing_dates.append(current_date)
                current_date += timedelta(days=1)
            
            if not missing_dates:
                print("✅ 問題なし: 指定された期間内にデータが存在しない日はありませんでした。")
            else:
                print(f"🚨 問題発見: {len(missing_dates)}件のデータ欠損日が見つかりました。")
                formatted_dates = [d.strftime('%Y-%m-%d') for d in missing_dates]
                
                # 連続した日付をまとめる
                ranges = []
                if formatted_dates:
                    start_range = formatted_dates[0]
                    for i in range(1, len(formatted_dates)):
                        prev_date = datetime.strptime(formatted_dates[i-1], '%Y-%m-%d').date()
                        curr_date = datetime.strptime(formatted_dates[i], '%Y-%m-%d').date()
                        if (curr_date - prev_date).days > 1:
                            ranges.append((start_range, formatted_dates[i-1]))
                            start_range = formatted_dates[i]
                    ranges.append((start_range, formatted_dates[-1]))

                print("\n👇 対処法:")
                print("   以下のコマンドを実行して、欠損している期間のデータを取得してください。")
                for start, end in ranges:
                    print(f"   python backend/run_pipeline.py {start} {end}")

            # --- チェック2: データ不整合の検出 ---
            print(f"\n--- [チェック2/2] 予測データとの不整合チェック ---")
            
            integrity_query = text(f"""
                SELECT r.id, CAST(r.{DATE_COLUMN_NAME} AS DATE) as race_date
                FROM races r
                LEFT JOIN {PREDICTION_TABLE_NAME} p ON r.id = CAST(p.id AS VARCHAR)
                WHERE p.id IS NULL AND CAST(r.{DATE_COLUMN_NAME} AS DATE) >= :start_date
                ORDER BY race_date, r.id;
            """)
            
            integrity_result = connection.execute(integrity_query, {'start_date': start_date})
            inconsistent_races_by_date = {}
            for race_id, race_date in integrity_result:
                if race_date not in inconsistent_races_by_date:
                    inconsistent_races_by_date[race_date] = []
                inconsistent_races_by_date[race_date].append(race_id)

            if not inconsistent_races_by_date:
                print("✅ 問題なし: レースデータと予測データの間に不整合はありませんでした。")
            else:
                total_inconsistent_races = sum(len(ids) for ids in inconsistent_races_by_date.values())
                print(f"🚨 問題発見: {total_inconsistent_races}件のレースで予測データが欠損していました。")
                
                # 日付ごとにグループ化して対処コマンドを提示
                print("\n👇 対処法:")
                print("   以下のコマンドを実行して、予測データが欠損している日付の再処理を行ってください。")
                sorted_dates = sorted(inconsistent_races_by_date.keys())
                for race_date in sorted_dates:
                    print(f"   # {race_date.strftime('%Y-%m-%d')} ({len(inconsistent_races_by_date[race_date])}レース)")
                    date_str = race_date.strftime('%Y-%m-%d')
                    print(f"   $env:PIPELINE_MODE=\"HISTORY\"")
                    print(f"   python backend/run_pipeline.py {date_str} {date_str}")
            
            print("\n" + "="*30)
            print("🎉 ヘルスチェック完了")
            print("="*30)

    except Exception as e:
        if "does not exist" in str(e):
             print(f"\n❌ エラー: テーブルまたはカラムが存在しません。スクリプト上部の設定を確認してください。")
             print(f"詳細: {e}")
        else:
             print(f"\n❌ 予期せぬエラーが発生しました: {e}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        start_date_input = sys.argv[1]
        check_database_health(start_date_input)
    else:
        print("\n💡 使い方: python backend/db_health_checker.py YYYY-MM-DD")
        print("   -> 指定した日付から最新のデータ取得日までをチェックします。")
        print("\n例: python backend/db_health_checker.py 2020-01-01")