# C:\Users\tnszk\program\GitHub\backend\database\database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

# ==============================================================================
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
# .envファイルの読み込みをモジュールのトップレベルで行う
load_dotenv()

# 環境変数からデータベースURLを取得。Render環境ではこれが使われる。
# 設定がなければ、ローカルのSQLiteをデフォルト値として使用する。
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

# 接続設定をURLのプレフィックスで判定
if DATABASE_URL.startswith("postgres"):
    # 本番環境 (PostgreSQL on Render)
    # Render環境では接続数を制限してリソースを節約
    is_render = os.getenv("RENDER") == "true"

    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "client_encoding": "utf8",
            "options": "-c client_encoding=UTF8"
        },
        pool_pre_ping=True,
        pool_recycle=3600,
        # Render環境では接続プールサイズを制限
        pool_size=3 if is_render else 5,
        max_overflow=2 if is_render else 10,
        pool_timeout=30
    )
else:
    # ローカル開発環境 (SQLite)
    # dataディレクトリが存在しない場合は作成
    os.makedirs("data", exist_ok=True)
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False} # SQLite特有の接続引数
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# DB接続のセッションを取得するための依存性関数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
# ==============================================================================