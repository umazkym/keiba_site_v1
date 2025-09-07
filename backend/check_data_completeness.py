import os
import sys
from datetime import datetime
from sqlalchemy import text
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal

def find_missing_predictions(target_date_str: str):
    """
    指定された日付で、racesテーブルには存在するがpredictionsテーブルに
    レコードが存在しないレースを一覧表示する。
    """
    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        print("エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print("=" * 80)
    print(f"--- 予測データ欠損レースの調査 ({target_date_str}) ---")
    print("=" * 80)

    db = SessionLocal()
    try:
        # 予測が成功したレースのサンプルを1件取得
        print("\n--- [参考] 予測が成功したレースのデータ ---")
        successful_race_query = text("""
            SELECT p.race_id, r.race_name, p.horse_name, p.mark, p.deviation_score
            FROM predictions p
            JOIN races r ON p.race_id = r.id
            WHERE r.race_date = :target_date
            ORDER BY p.deviation_score DESC
            LIMIT 5;
        """)
        successful_results = db.execute(successful_race_query, {'target_date': target_date}).fetchall()
        if successful_results:
            print(f"{'Race ID':<15} | {'Race Name':<20} | {'Horse Name':<15} | {'Mark':<5} | {'Score'}")
            print("-" * 80)
            for row in successful_results:
                # rowがKeyedTupleの場合があるので、インデックスでもアクセスできるようにする
                print(f"{row[0]:<15} | {row[1][:18]:<20} | {row[2][:13]:<15} | {row[3]:<5} | {row[4]}")
        else:
            print("成功したレースデータが見つかりませんでした。")


        # 予測が欠損しているレースIDをすべて取得
        print("\n\n--- 🚨【重要】予測データが欠損しているレース一覧 ---")
        missing_query = text("""
            SELECT r.id, r.race_name
            FROM races r
            LEFT JOIN predictions p ON r.id = p.race_id
            WHERE r.race_date = :target_date
            GROUP BY r.id, r.race_name
            HAVING COUNT(p.id) = 0
            ORDER BY r.id;
        """)
        missing_races = db.execute(missing_query, {'target_date': target_date}).fetchall()

        if not missing_races:
            print("✅ 予測が欠損しているレースはありませんでした。")
        else:
            print(f"{len(missing_races)}件のレースで予測データが欠損しています。これらのレースがエラーの原因です。")
            for i, race in enumerate(missing_races):
                print(f" - {i+1:2d}. Race ID: {race[0]}, Race Name: {race[1]}")

    finally:
        db.close()
        print("\n" + "="*80)
        print("--- 調査完了 ---")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n使い方: python backend/find_missing_predictions.py <日付>")
        print("例: python backend/find_missing_predictions.py 2025-09-07")
        sys.exit(1)
    
    load_dotenv()
    find_missing_predictions(sys.argv[1])