# C:\Users\tnszk\program\GitHub\backend\database\database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# 本番環境のPostgreSQLのURLを環境変数から取得。なければローカルのSQLiteを使う。
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

# 接続設定を分岐
if DATABASE_URL.startswith("postgres"):
    # 本番環境 (PostgreSQL)
    engine = create_engine(DATABASE_URL)
else:
    # ローカル開発環境 (SQLite)
    # dataディレクトリがなければ作成
    os.makedirs("data", exist_ok=True)
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False} # SQLiteに必要
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# DB接続のセッションを取得する
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()