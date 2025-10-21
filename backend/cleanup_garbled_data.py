import os
import sys
import re
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# .envファイルとプロジェクトパスを読み込み
load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from database.database import SessionLocal
    from database import models
except ImportError as e:
    print(f"[エラー] 必要なモジュールのインポートに失敗しました: {e}")
    print("このスクリプトは 'backend' ディレクトリから実行してください。")
    sys.exit(1)

def is_garbled(name: str) -> bool:
    """
    文字列が文字化けしているかどうかを判定する。
    日本語、英数字（全角・半角）で一般的に使われる文字以外が含まれているかをチェックする最終版。
    """
    if not name:
        return False
    # ==============================================================================
    # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    # 許可する文字セットを拡張。全角アルファベット、全角数字、全角ドットなどを追加。
    # ☆や△などの記号も許可する。
    allowed_chars_pattern = re.compile(
        r'^[ぁ-んァ-ヶ一-龠々ー・\s()\[\]\.－’\'" a-zA-Z0-9Ａ-Ｚａ-ｚ０-９．☆★◇△▲]+$'
    )
    # 許可された文字セットにマッチしない場合は、文字化けと判定
    return not bool(allowed_chars_pattern.match(name))
    # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    # ==============================================================================

def cleanup_garbled_names():
    """
    horses, jockeys, trainers テーブル内の文字化けした名前を持つレコードを削除する。
    """
    print("=" * 80)
    print("--- 文字化けデータ クリーンアップツール (最終修正版) ---")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        total_deleted_count = 0
        
        # チェック対象のテーブルとモデル
        tables_to_check = {
            "馬 (horses)": models.Horse,
            "騎手 (jockeys)": models.Jockey,
            "調教師 (trainers)": models.Trainer,
        }

        for table_name, model in tables_to_check.items():
            print(f"\n[*] {table_name} テーブルをスキャンしています...")
            
            # 文字化けしているレコードを特定
            garbled_records = []
            all_records = db.query(model).all()
            for record in all_records:
                if hasattr(record, 'name') and is_garbled(record.name):
                    garbled_records.append(record)
            
            if not garbled_records:
                print("  -> ✅ 文字化けデータは見つかりませんでした。")
                continue
                
            print(f"  -> 🚨 {len(garbled_records)}件の文字化けデータを検出しました。削除します。")
            
            ids_to_delete = []
            for record in garbled_records:
                print(f"    - ID: {record.id}, Name: '{record.name}'")
                ids_to_delete.append(record.id)
            
            # 削除実行
            if ids_to_delete:
                # 関連するResultレコードの外部キーをNULLに設定
                if model == models.Horse:
                    db.query(models.Result).filter(models.Result.horse_id.in_(ids_to_delete)).delete(synchronize_session=False)
                elif model == models.Jockey:
                    db.query(models.Result).filter(models.Result.jockey_id.in_(ids_to_delete)).update({"jockey_id": None}, synchronize_session=False)
                elif model == models.Trainer:
                    db.query(models.Result).filter(models.Result.trainer_id.in_(ids_to_delete)).update({"trainer_id": None}, synchronize_session=False)

                # 本体レコードを削除
                db.query(model).filter(model.id.in_(ids_to_delete)).delete(synchronize_session=False)
                total_deleted_count += len(ids_to_delete)

        if total_deleted_count > 0:
            print("\n[*] データベースに変更をコミットしています...")
            db.commit()
            print("  -> ✅ コミット完了。")
        
        print("\n" + "=" * 80)
        print("🎉 クリーンアップが正常に完了しました。")
        print(f"合計 {total_deleted_count} 件の文字化けレコードを削除しました。")
        print("=" * 80)

    except Exception as e:
        print("\n❌ クリーンアップ中にエラーが発生しました。変更はロールバックされます。")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print("\nデータベース接続をクローズしました。")

if __name__ == "__main__":
    cleanup_garbled_names()