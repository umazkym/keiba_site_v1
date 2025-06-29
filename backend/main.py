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

# 環境変数から許可するオリジンを取得
# デフォルトはローカル開発環境と、プレビュー用のURLを含むように設定
# カンマ区切りで複数指定可能 "http://localhost:3000,https://your-frontend.vercel.app"
origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allow_origins = [origin.strip() for origin in origins_str.split(',')]


# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーターをインクルード
app.include_router(races_v1.router, prefix="/api/v1/predictions", tags=["predictions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Keiba AI API"}