import os
from sqlalchemy import create_engine, text

# RenderのDB接続URL（ハードコードでも環境変数でも可）
DB_URL = os.environ.get("DATABASE_URL", "postgresql://user:password@host/dbname")

engine = create_engine(DB_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE sns_posts ADD COLUMN tweet_id VARCHAR;"))
        conn.commit()
        print("Success: Added tweet_id column to sns_posts")
except Exception as e:
    print(f"Error (maybe column already exists): {e}")

