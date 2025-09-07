# backend/debug_api_logic.py
import os
import sys
import traceback
from datetime import datetime
from sqlalchemy.orm import joinedload
from dotenv import load_dotenv

# プロジェクトのルートパスをsys.pathに追加
# これにより、別階層のモジュールを正しくインポートできる
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from database import models

def debug_api_logic_for_date(target_date_str: str):
    """
    指定された日付の全レースについて、APIと同様のデータ取得ロジックを
    1レースずつ実行し、問題のあるレースを特定する。
    """
    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print("=" * 80)
    print(f"--- APIロジックデバッグ開始 ({target_date_str}) ---")
    print("=" * 80)

    db = SessionLocal()
    try:
        # 1. 対象日の全レースIDを取得
        race_ids_query = db.query(models.Race.id).filter(models.Race.race_date == target_date)
        race_ids = [r.id for r in race_ids_query.all()]

        if not race_ids:
            print(f"対象日にレースデータが見つかりませんでした。")
            return

        print(f"{len(race_ids)}件のレースを1件ずつ検証します...")
        all_successful = True

        # 2. レースIDごとに、APIと同様のデータ読み込みを試行
        for i, race_id in enumerate(race_ids):
            try:
                print(f"({i+1}/{len(race_ids)}) [検証中] Race ID: {race_id}", end="")
                
                # APIのcrud.py内のクエリを模倣
                race_data = db.query(models.Race).options(
                    joinedload(models.Race.predictions),
                    joinedload(models.Race.results).joinedload(models.Result.horse)
                ).filter(models.Race.id == race_id).first()

                # データへのアクセスを試みることで、関連データの問題をあぶり出す
                if not race_data:
                    raise ValueError("Race not found in DB.")
                
                _ = len(race_data.predictions)
                _ = len(race_data.results)
                
                # ここまでエラーが出なければ成功
                print(" -> ✅ OK")

            except Exception as e:
                print(f" -> ❌ エラー発生！")
                print("\n" + "-"*40)
                print(f"[エラー詳細] Race ID: {race_id}")
                traceback.print_exc()
                print("-" * 40 + "\n")
                all_successful = False
                # エラーが発生しても次のレースの検証を続ける
                continue

        print("\n" + "="*80)
        if all_successful:
            print("🎉 全てのレースデータは正常に読み込めました。データ破損が原因ではない可能性があります。")
        else:
            print("🚨 上記のレースIDでデータ読み込みエラーが確認されました。このレースのデータが破損している可能性が高いです。")
        print("--- デバッグ完了 ---")

    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n使い方: python backend/debug_api_logic.py <日付>")
        print("例: python backend/debug_api_logic.py 2025-09-07")
        sys.exit(1)
    
    # .envファイルをロード
    load_dotenv()
    debug_api_logic_for_date(sys.argv[1])