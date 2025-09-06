import os
import sys
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from database.models import Race, Base
from collections import defaultdict

# .envファイルから環境変数を読み込む
load_dotenv()

def log_race_counts(start_date_str: str, end_date_str: str):
    """
    指定された期間内の各日付・競馬場ごとのレース数を集計して表示する。
    """
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"\n❌ エラー: 日付の形式が正しくありません。'{start_date_str}' または '{end_date_str}' を 'YYYY-MM-DD'形式で指定してください。")
        return

    print("\nデータベースに接続しています...")
    try:
        engine = create_engine(DATABASE_URL)
        Base.metadata.bind = engine
        Session = sessionmaker(bind=engine)
        session = Session()
        print("✅ 接続に成功しました。")
    except Exception as e:
        print(f"\n❌ データベース接続エラー: {e}")
        return

    try:
        print(f"\n--- データベース内のレース数集計 ---")
        print(f"集計期間: {start_date_str} から {end_date_str}")
        print("-" * 40)

        results = session.query(
            Race.race_date,
            Race.venue_name,
            func.count(Race.id).label('race_count')
        ).filter(
            Race.race_date.between(start_date, end_date)
        ).group_by(
            Race.race_date,
            Race.venue_name
        ).order_by(
            Race.race_date,
            Race.venue_name
        ).all()

        if not results:
            print("指定期間内にレースデータが見つかりません。")
            return

        # 日付ごとに結果を整形して表示
        counts_by_date = defaultdict(list)
        for r in results:
            counts_by_date[r.race_date].append(f"{r.venue_name}: {r.race_count}R")

        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')
            if current_date in counts_by_date:
                print(f"🗓️  {date_str}: {', '.join(counts_by_date[current_date])}")
            else:
                print(f"🗓️  {date_str}: データなし")
            current_date += timedelta(days=1)
        
        print("-" * 40)

    except Exception as e:
        print(f"\n❌ 集計中にエラーが発生しました: {e}")
    finally:
        session.close()
        print("データベース接続を閉じました。")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("\n💡 使い方: python backend/log_race_counts.py <開始日> <終了日>")
        print("   例: python backend/log_race_counts.py 2025-08-01 2025-08-19")
        sys.exit(1)
    
    log_race_counts(sys.argv[1], sys.argv[2])