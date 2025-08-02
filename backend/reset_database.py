# backend/reset_database.py の全文
import os
import shutil
from sqlalchemy import create_engine, MetaData
from dotenv import load_dotenv

# .envファイルからデータベース接続情報を読み込む
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ★★★ 修正箇所: プロジェクトルートからの相対パスに修正 ★★★
DATA_DIR = "data"

if not DATABASE_URL:
    print("エラー: .envファイルにDATABASE_URLが設定されていません。")
else:
    print(f"接続先データベース: {DATABASE_URL}")
    print(f"削除対象データディレクトリ: {os.path.abspath(DATA_DIR)}")
    confirm = input("本当にデータベースの全テーブルと全キャッシュファイルを削除しますか？この操作は元に戻せません。(yes/no): ")

    if confirm.lower() == 'yes':
        # --- データベースのテーブル削除 ---
        try:
            engine = create_engine(DATABASE_URL)
            with engine.connect() as connection:
                print("DB接続成功。テーブルを削除しています...")
                meta = MetaData()
                meta.reflect(bind=engine)
                meta.drop_all(bind=engine)
                print("すべてのテーブルが正常に削除されました。")
        except Exception as e:
            print(f"データベースのテーブル削除中にエラーが発生しました: {e}")
            print("処理を続行します...")

        # --- dataディレクトリの削除処理 ---
        try:
            if os.path.exists(DATA_DIR):
                print(f"'{DATA_DIR}' ディレクトリを削除しています...")
                shutil.rmtree(DATA_DIR)
                print(f"'{DATA_DIR}' ディレクトリ（キャッシュファイル等）が正常に削除されました。")
            else:
                print(f"'{DATA_DIR}' ディレクトリは存在しないため、スキップします。")
        except Exception as e:
            print(f"データディレクトリの削除中にエラーが発生しました: {e}")
        
        print("\nクリーンアップ処理が完了しました。")
        print("次回 run_pipeline.py を実行すると、テーブルとディレクトリは自動的に再作成されます。")

    else:
        print("処理を中断しました。")