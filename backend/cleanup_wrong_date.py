# backend/cleanup_wrong_date.py
import os
import sys
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv()

# 必要なモジュールをインポート
try:
    from database.database import SessionLocal, engine
    from database import models
except ImportError as e:
    print(f"[エラー] 必要なモジュールのインポートに失敗しました: {e}")
    print("このスクリプトは 'backend' ディレクトリから実行してください。")
    sys.exit(1)

def cleanup_data_for_date(target_date_str: str):
    """
    指定された日付のレース関連データをすべて削除する。
    """
    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print("=" * 80)
    print(f"--- データベースクリーンアップツール ---")
    print(f"[*] 削除対象の日付: {target_date_str}")
    print("=" * 80)

    db = SessionLocal()
    try:
        print("\n[*] 関連するレースIDを検索しています...")
        races_to_delete_stmt = select(models.Race.id).where(models.Race.race_date == target_date)
        race_ids_to_delete = [r[0] for r in db.execute(races_to_delete_stmt).fetchall()]

        if not race_ids_to_delete:
            print("✅ 削除対象のデータは見つかりませんでした。")
            return

        print(f"[*] {len(race_ids_to_delete)}件のレースが見つかりました。関連データの削除を開始します...")

        # 外部キー制約を考慮し、依存しているテーブルから削除
        deleted_counts = {}
        
        # 1. Matchups
        count = db.query(models.Matchup).filter(models.Matchup.race_id.in_(race_ids_to_delete)).delete(synchronize_session=False)
        deleted_counts['Matchups'] = count
        
        # 2. Predictions
        count = db.query(models.Prediction).filter(models.Prediction.race_id.in_(race_ids_to_delete)).delete(synchronize_session=False)
        deleted_counts['Predictions'] = count
        
        # 3. Results
        count = db.query(models.Result).filter(models.Result.race_id.in_(race_ids_to_delete)).delete(synchronize_session=False)
        deleted_counts['Results'] = count
        
        # 4. RaceReturns
        count = db.query(models.RaceReturn).filter(models.RaceReturn.race_id.in_(race_ids_to_delete)).delete(synchronize_session=False)
        deleted_counts['RaceReturns'] = count
        
        # 5. Races (最後)
        count = db.query(models.Race).filter(models.Race.id.in_(race_ids_to_delete)).delete(synchronize_session=False)
        deleted_counts['Races'] = count

        db.commit()
        
        print("\n--- 削除結果 ---")
        for table, count in deleted_counts.items():
            print(f"  - {table}: {count}件")

        print("\n✅ クリーンアップが正常に完了しました。")

    except Exception as e:
        print(f"\n❌ クリーンアップ中にエラーが発生しました。")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print("\nデータベース接続をクローズしました。")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n使い方: python backend/cleanup_wrong_date.py <日付>")
        print("例: python backend/cleanup_wrong_date.py 2025-01-01")
        sys.exit(1)
    
    cleanup_data_for_date(sys.argv[1])