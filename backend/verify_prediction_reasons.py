# backend/verify_prediction_reasons.py
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from database.models import Race, Prediction, Base
from collections import defaultdict

# .envファイルから環境変数を読み込む
load_dotenv()

def verify_reasons(start_date_str: str, end_date_str: str):
    """
    指定された期間内にDBに保存されている「予測不能理由」を一覧表示する。
    """
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"\n❌ エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
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
        print(f"\n--- 予測不能理由の検証 ---")
        print(f"集計期間: {start_date_str} から {end_date_str}")
        print("-" * 50)

        # ==============================================================================
        # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        # PostgreSQLのエラー(DISTINCT ON と ORDER BY の不一致)を解消
        results = session.query(
            Race.race_date,
            Race.id.label("race_id"),
            Race.venue_name,
            Race.race_number,
            Race.race_name,
            Prediction.unpredictable_reason
        ).join(
            Prediction, Race.id == Prediction.race_id
        ).filter(
            Race.race_date.between(start_date, end_date),
            Prediction.unpredictable_reason.isnot(None)
        ).distinct( # distinctの対象をORDER BYの先頭と一致させる
            Race.race_date,
            Race.id
        ).order_by(
            Race.race_date,
            Race.id
        ).all()
        # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        # ==============================================================================

        if not results:
            print("✅ 問題なし: 指定期間内に「予測不能」と判定されたレースは見つかりませんでした。")
            return

        # 日付ごとにグループ化
        reasons_by_date = defaultdict(list)
        for r in results:
            reasons_by_date[r.race_date].append(r)

        total_count = 0
        for target_date in sorted(reasons_by_date.keys()):
            date_str = target_date.strftime('%Y-%m-%d')
            print(f"\n🗓️  {date_str}")
            for r in reasons_by_date[target_date]:
                print(f"  - [{r.venue_name}{r.race_number}R] {r.race_name}")
                print(f"    ➡️  理由: {r.unpredictable_reason}")
                total_count += 1
        
        print("-" * 50)
        print(f"✅ 検証完了: 合計 {total_count} 件の予測不能レースをデータベースで確認しました。")


    except Exception as e:
        print(f"\n❌ 集計中にエラーが発生しました: {e}")
    finally:
        session.close()
        print("\nデータベース接続を閉じました。")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("\n💡 使い方: python backend/verify_prediction_reasons.py <開始日> <終了日>")
        print("   例: python backend/verify_prediction_reasons.py 2025-08-01 2025-08-19")
        sys.exit(1)
    
    verify_reasons(sys.argv[1], sys.argv[2])