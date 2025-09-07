# backend/db_health_checker.py
import os
import sys
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def check_database_health(start_date_str: str = None):
    """
    データベースの健全性をチェックする。
    - 日付を指定しない場合：直近14日間の「通常モード」で動作。
    - 日付を指定した場合：指定日から最新日までの「完全監査モード」で動作。
    """
    load_dotenv()
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    is_full_audit = start_date_str is not None
    today = datetime.now().date()
    
    if is_full_audit:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            print("\n--- [完全監査モード] 指定された期間のデータヘルスチェックを行います ---")
        except ValueError:
            print("\n❌ エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
            return
    else:
        # デフォルトは直近14日間
        start_date = today - timedelta(days=14)
        print("\n--- [通常モード] 直近14日間のデータヘルスチェックを行います ---")
        print("💡 全期間をチェックしたい場合は、開始日を指定してください。(例: python backend/db_health_checker.py 2024-01-01)")


    print("\nデータベースに接続しています...")
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            print("✅ 接続に成功しました。")
            
            # --- データベース内の最新日付を取得 ---
            latest_date_query = text("SELECT MAX(CAST(race_date AS DATE)) FROM races;")
            latest_date_result = connection.execute(latest_date_query).scalar_one_or_none()
            
            if not latest_date_result:
                print("⚠️ データベースにレースデータが1件も存在しません。")
                return
            
            end_date = latest_date_result

            # チェック対象期間を明確化
            check_start_date = start_date
            check_end_date = end_date
            
            # 通常モードの場合、チェック終了日は今日までにする（未来のデータはチェックしない）
            if not is_full_audit:
                check_end_date = min(end_date, today)

            print(f"チェック対象期間: {check_start_date.strftime('%Y-%m-%d')} ～ {check_end_date.strftime('%Y-%m-%d')}")

            # --- チェック1: 欠損日の検出 ---
            print("\n--- [チェック1/2] データ欠損日の検出 ---")
            
            dates_query = text("""
                SELECT DISTINCT CAST(race_date AS DATE) as race_date 
                FROM races 
                WHERE CAST(race_date AS DATE) BETWEEN :start_date AND :end_date
                ORDER BY race_date;
            """)
            result = connection.execute(dates_query, {'start_date': check_start_date, 'end_date': check_end_date})
            db_dates = {row[0] for row in result}

            missing_dates = []
            current_date = check_start_date
            while current_date <= check_end_date:
                if current_date not in db_dates:
                    missing_dates.append(current_date)
                current_date += timedelta(days=1)
            
            if not missing_dates:
                print("✅ 問題なし: 指定された期間内にデータが存在しない日はありませんでした。")
            else:
                print(f"🚨 問題発見: {len(missing_dates)}件のデータ欠損日が見つかりました。")
                # (対処法の表示ロジックは変更なしのため省略)

            # --- チェック2: データ不整合の検出 ---
            print(f"\n--- [チェック2/2] 予測データとの不整合チェック ---")
            
            integrity_query = text("""
                SELECT r.id, CAST(r.race_date AS DATE) as race_date
                FROM races r
                LEFT JOIN predictions p ON r.id = CAST(p.race_id AS VARCHAR)
                WHERE p.id IS NULL AND CAST(r.race_date AS DATE) BETWEEN :start_date AND :end_date
                ORDER BY race_date, r.id;
            """)
            
            integrity_result = connection.execute(integrity_query, {'start_date': check_start_date, 'end_date': check_end_date})
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
        print(f"\n❌ 予期せぬエラーが発生しました: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    import traceback
    if len(sys.argv) > 1:
        # 引数があれば完全監査モード
        start_date_input = sys.argv[1]
        check_database_health(start_date_input)
    else:
        # 引数がなければ通常モード
        check_database_health()