# check_ids.py - IDの確認用スクリプト
import pandas as pd
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://user:password@host/dbname"

try:
    engine = create_engine(DATABASE_URL, connect_args={'client_encoding': 'utf8'})
    
    # 調教師IDのトップ10を取得
    print("=== 出走数の多い調教師 TOP10 ===")
    trainer_query = """
    SELECT t.id, t.name, COUNT(*) as races
    FROM trainers t
    JOIN results r ON t.id = r.trainer_id
    GROUP BY t.id, t.name
    ORDER BY races DESC
    LIMIT 10;
    """
    trainers = pd.read_sql(trainer_query, engine)
    print(trainers.to_string(index=False))
    
    # 馬IDのトップ10を取得
    print("\n=== 出走数の多い馬 TOP10 ===")
    horse_query = """
    SELECT h.id, h.name, COUNT(*) as races
    FROM horses h
    JOIN results r ON h.id = r.horse_id
    GROUP BY h.id, h.name
    ORDER BY races DESC
    LIMIT 10;
    """
    horses = pd.read_sql(horse_query, engine)
    print(horses.to_string(index=False))
    
    print("\n✅ 確認完了")
    
except Exception as e:
    print(f"❌ エラー: {e}")