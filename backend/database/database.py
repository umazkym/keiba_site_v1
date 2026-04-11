# import os
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, DeclarativeBase
# from dotenv import load_dotenv

# load_dotenv()

# DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

# if DATABASE_URL.startswith("postgres"):

#     # ==============================================================================
#     # ★★★ 接続プール戦略（Neon通信量・コスト削減）★★★
#     #
#     # 実行環境を3パターンに分類して最適化:
#     #
#     # [1] GitHub Actions（GITHUB_ACTIONS=true）
#     #     - 短命プロセス（数分で終了）
#     #     - NullPoolを使用: 接続プールを持たず、使用後すぐ切断
#     #     - 理由: 長寿命の接続プールはActionが終了するまでNeonへ接続し続け、
#     #       pool_recycle まで余分なセッションが残る。
#     #       NullPoolならクエリ発行 → 即切断 → Neon側のアイドル接続が消える
#     #
#     # [2] Render本番サーバー（RENDER=true）
#     #     - 長寿命プロセスだがメモリ制約あり（Free: 512MB）
#     #     - 小さいプールサイズで接続数を制限
#     #     - pool_pre_ping=True で Neon の自動スリープ後の接続エラーを防ぐ
#     #
#     # [3] ローカル開発
#     #     - 通常のプール設定
#     #
#     # Neonのネットワーク転送量への影響:
#     #   - 接続確立自体は数KBのデータを消費（TLSハンドシェイク等）
#     #   - GitHub Actionsが pool_size=5 で起動すると5接続分のオーバーヘッド
#     #   - NullPoolなら必要な分だけ接続 → 最小限のオーバーヘッド
#     # ==============================================================================

#     is_render = os.getenv("RENDER") == "true"            # Renderサーバー
#     is_github_actions = os.getenv("GITHUB_ACTIONS") == "true"  # GitHub Actions

#     _connect_args = {
#         "client_encoding": "utf8",
#         "options": "-c client_encoding=UTF8"
#     }

#     if is_github_actions:
#         # GitHub Actions: NullPool（接続プールなし）
#         # 短命バッチスクリプト向け最適設定
#         from sqlalchemy.pool import NullPool
#         engine = create_engine(
#             DATABASE_URL,
#             poolclass=NullPool,
#             connect_args=_connect_args,
#         )
#         print("[DB] NullPool mode (GitHub Actions)")

#     elif is_render:
#         # Render本番: 小さいプール、定期的な再接続
#         engine = create_engine(
#             DATABASE_URL,
#             connect_args=_connect_args,
#             pool_pre_ping=True,      # Neonスリープ後の接続エラーを自動検出
#             pool_recycle=1800,       # 30分で接続を再確立（Neonのアイドルタイムアウト対策）
#             pool_size=3,             # 同時接続数を最小限に
#             max_overflow=2,          # バースト時の追加接続（計5接続まで）
#             pool_timeout=30,
#         )
#         print("[DB] Small pool mode (Render)")

#     else:
#         # ローカル開発
#         engine = create_engine(
#             DATABASE_URL,
#             connect_args=_connect_args,
#             pool_pre_ping=True,
#             pool_recycle=3600,
#             pool_size=5,
#             max_overflow=10,
#             pool_timeout=30,
#         )
#         print("[DB] Standard pool mode (Local)")

# else:
#     # ローカルSQLite
#     os.makedirs("data", exist_ok=True)
#     engine = create_engine(
#         DATABASE_URL,
#         connect_args={"check_same_thread": False}
#     )


# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# class Base(DeclarativeBase):
#     pass


# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

if DATABASE_URL.startswith("postgres"):

    # ==============================================================================
    # 実行環境の判定と接続プール戦略
    #
    # 旧コードは os.getenv("RENDER") == "true" で環境を判定していたが、
    # 2026年3月のアーキテクチャ移行により API は Google Cloud Run へ移行済み。
    # Cloud Run には RENDER 環境変数が存在しないため判定が機能していなかった。
    #
    # 現在の3環境を正しく判定する:
    #
    # ① GitHub Actions（GITHUB_ACTIONS=true … GitHub が自動付与）
    #    - 短命バッチプロセス（スクレイピング・予測生成・SNS投稿）
    #    - NullPool: 接続プールを持たず、クエリ後即切断
    #    - 理由: 長寿命プールは Actions 終了後も Neon への接続を保持し続ける。
    #            NullPool なら使用分だけ接続 → Neon の Network transfer を最小化。
    #
    # ② Google Cloud Run（K_SERVICE … Google が自動付与）
    #    - 長寿命 API サーバー。ゼロスケール運用のためコールドスタートあり。
    #    - pool_pre_ping=True で Neon のオートサスペンド後の切断エラーを自動検出。
    #    - pool_recycle=1800: 30分で接続を再確立（Neon のアイドルタイムアウト対策）。
    #    - pool_size=3, max_overflow=2: Cloud Run の最小インスタンス数に合わせた設定。
    #      スケールアウト時は複数インスタンスが起動するため、各インスタンスの
    #      プールサイズを小さく抑えることで Neon の同時接続数上限に達しにくくする。
    #
    # ③ ローカル開発
    #    - 標準的なプール設定。
    # ==============================================================================

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
        # ② Google Cloud Run: 最小プール + コールドスタート対策
        # ★ Neon Free Tier 最適化 (2026-04-11)
        #   - pool_size=2, max_overflow=1: 最大3接続に制限（旧: 5接続）
        #   - pool_recycle=900: 15分で接続リサイクル（旧: 30分）
        #     Neon の接続保持時間を短縮し、Network Transfer を削減。
        #     Cloud Run はリクエストが来ないとスケールダウンするため、
        #     長寿命の接続は不要。
        engine = create_engine(
            DATABASE_URL,
            connect_args=_connect_args,
            pool_pre_ping=True,
            pool_recycle=900,    # 15分（Neon Free Tier Network Transfer 削減）
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