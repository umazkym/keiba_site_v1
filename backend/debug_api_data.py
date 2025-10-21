import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine
import traceback

# プロジェクトルートをパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# .envファイルからデータベースURLを読み込み
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def inspect_database_for_api(target_date_str: str):
    """
    指定された日付のracesテーブルとpredictionsテーブルの状態を調査し、
    APIでデータが表示されない原因を特定する。
    """
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"\n❌ エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print("=" * 80)
    print(f"--- APIデータデバッグツール ({target_date_str}) ---")
    print("=" * 80)

    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            print("✅ データベース接続成功。")

            # --- 1. races テーブルの調査 ---
            print("\n--- [調査1/2] races テーブルの race_type を確認します ---")
            races_query = f"""
                SELECT id, venue_name, race_number, race_name, race_type
                FROM races
                WHERE race_date = '{target_date}'
                ORDER BY venue_name, race_number;
            """
            races_df = pd.read_sql(races_query, connection)

            if races_df.empty:
                print(f"🚨 問題発見: {target_date_str} のレースデータが `races` テーブルに存在しません。")
            else:
                print(f"✅ `races` テーブルに {len(races_df)} 件のレースを発見しました。")
                print("--- 取得データプレビュー ---")
                print(races_df.to_markdown(index=False))
                print("--------------------------\n")
                
                # JRAデータのrace_typeを検証
                jra_races = races_df[races_df['race_type'] == '中央']
                if not jra_races.empty:
                    print(f"✅ {len(jra_races)}件のJRAレースで race_type が正しく '中央' に設定されています。")
                else:
                    print(f"🚨【重要】JRAレースの race_type が '中央' になっていません。これがAPIに表示されない根本原因の可能性があります。")
                    
                    # '中央' 以外の race_type を表示
                    other_types = races_df[~races_df['race_type'].isin(['地方', '中央'])]['race_type'].unique()
                    if len(other_types) > 0:
                        print(f"   -> 代わりに検出された値: {other_types}")


            # --- 2. predictions テーブルの調査 ---
            print("\n--- [調査2/2] predictions テーブルにデータが存在するか確認します ---")
            predictions_query = f"""
                SELECT r.venue_name, p.race_id, COUNT(p.id) as prediction_count
                FROM predictions p
                JOIN races r ON p.race_id = r.id
                WHERE r.race_date = '{target_date}'
                GROUP BY r.venue_name, p.race_id
                ORDER BY r.venue_name;
            """
            predictions_df = pd.read_sql(predictions_query, connection)

            if predictions_df.empty:
                print(f"🚨 問題発見: {target_date_str} の予測データが `predictions` テーブルに1件も存在しません。")
            else:
                print(f"✅ `predictions` テーブルに {len(predictions_df)} レース分の予測データを発見しました。")
                print("--- レースごとの予測件数 ---")
                print(predictions_df.to_markdown(index=False))
                print("----------------------------\n")

    except Exception as e:
        print(f"\n❌ データベース調査中にエラーが発生しました: {e}")
        traceback.print_exc()

    print("=" * 80)
    print("--- デバッグ完了 ---")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/debug_api_data.py <日付>")
        print("   例: python backend/debug_api_data.py 2025-10-12")
        sys.exit(1)
        
    target_date_input = sys.argv[1]
    inspect_database_for_api(target_date_input)