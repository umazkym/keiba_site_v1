# C:\Users\tnszk\program\GitHub\backend\main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1.endpoints import races as races_v1
from database.database import engine, Base
from dotenv import load_dotenv

# .envファイルから環境変数を読み込む
load_dotenv()

# データベーステーブルを作成
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Keiba AI API",
    description="競馬AI予測サイトのバックエンドAPI",
    version="1.0.0"
)

# ▼▼▼▼▼ 【ここから修正】 ▼▼▼▼▼
# 許可するオリジンのリスト
# ローカル開発環境、Vercelのプレビュードメイン、本番ドメインをすべて含めます。
allow_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://uma-free.com",
    "https://www.uma-free.com",
    "https://keiba-site-v1-6brvxwn9l-umazkyms-projects.vercel.app", # ログに出ていたVercelのプレビュードメイン
]
# ▲▲▲▲▲ 【修正ここまで】 ▲▲▲▲▲


# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins, # 修正したリストを渡す
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーターをインクルード
app.include_router(races_v1.router, prefix="/api/v1/predictions", tags=["predictions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Keiba AI API"}
