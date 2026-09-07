import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

if DATABASE_URL.startswith("postgres"):

    # PostgreSQLはGCE VM上で稼働する。
    # ActionsはIAP経由で、接続をプールへ保持せず返却時に閉じる。
    # Cloud Runは内部VPC経由で、各インスタンスの接続を最大3本に抑える。
    # ローカル保守の接続先もIAPで転送したlocalhostを使う。

    _is_github_actions = os.getenv("GITHUB_ACTIONS") == "true"
    _is_cloud_run = bool(os.getenv("K_SERVICE"))  # Cloud Run が自動付与

    _connect_args = {
        "client_encoding": "utf8",
        "options": "-c client_encoding=UTF8",
    }

    if _is_github_actions:
        # ① GitHub Actions: NullPool（接続プールなし）
        from sqlalchemy.pool import NullPool
        engine = create_engine(
            DATABASE_URL,
            poolclass=NullPool,
            connect_args=_connect_args,
        )
        print("[DB] NullPool mode (GitHub Actions)")

    elif _is_cloud_run:
        # 切断済み接続を利用前に確認し、15分経過した接続は再利用時に更新する。
        engine = create_engine(
            DATABASE_URL,
            connect_args=_connect_args,
            pool_pre_ping=True,
            pool_recycle=900,    # 15分
            pool_size=2,
            max_overflow=1,      # 最大3接続（2 + 1）
            pool_timeout=30,
        )
        print("[DB] Minimal pool mode (Google Cloud Run - Neon Free Tier)")

    else:
        # ③ ローカル開発
        engine = create_engine(
            DATABASE_URL,
            connect_args=_connect_args,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
        )
        print("[DB] Standard pool mode (Local)")

else:
    # SQLite（ローカル開発用フォールバック）
    os.makedirs("data", exist_ok=True)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
