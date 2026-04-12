"""
GCE VM (e2-micro) 上の PostgreSQL に複合インデックスを追加するスクリプト。

背景:
  _build_horses_to_skip() が実行するクエリ:
    SELECT results.horse_id, count(results.id), max(races.race_date)
    FROM results JOIN races ON results.race_id = races.id
    WHERE results.horse_id IN (...) AND results.finish_time_sec IS NOT NULL
    GROUP BY results.horse_id

  このクエリは e2-micro (vCPU 0.25) では50件のIN句でもタイムアウトする可能性がある。
  適切なインデックスを追加することで、クエリ実行時間を大幅に短縮する。

実行方法:
  ローカル:
    DATABASE_URL=postgresql://keiba_user:***@34.182.6.97:5432/keiba_db python scripts/add_skip_query_index.py

  GitHub Actions:
    環境変数 DATABASE_URL が設定されている前提で実行。
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from database.database import engine

def add_indexes():
    """_build_horses_to_skip クエリを高速化するインデックスを追加"""
    indexes = [
        # 複合インデックス: horse_id + finish_time_sec のフィルタリングを高速化
        # WHERE results.horse_id IN (...) AND results.finish_time_sec IS NOT NULL
        (
            "idx_results_horse_id_finish_time",
            "CREATE INDEX IF NOT EXISTS idx_results_horse_id_finish_time ON results (horse_id, finish_time_sec) WHERE finish_time_sec IS NOT NULL"
        ),
        # results.race_id のインデックス（JOINの高速化、既にあるかもしれないが念のため）
        (
            "idx_results_race_id",
            "CREATE INDEX IF NOT EXISTS idx_results_race_id ON results (race_id)"
        ),
    ]
    
    with engine.connect() as conn:
        for idx_name, sql in indexes:
            print(f"Creating index: {idx_name} ...")
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"  -> OK: {idx_name}")
            except Exception as e:
                print(f"  -> Error: {e}")
                conn.rollback()
    
    # インデックスの確認
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'results' ORDER BY indexname"
        ))
        print("\n=== Current indexes on 'results' table ===")
        for row in result:
            print(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    add_indexes()
