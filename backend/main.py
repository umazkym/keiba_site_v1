# C:\Users\tnszk\program\GitHub\backend\main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1.endpoints import races as races_v1  # <- 修正箇所
from database.database import engine, Base      # <- 修正箇所

# データベーステーブルを作成
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Keiba AI API",
    description="競馬AI予測サイトのバックエンドAPI",
    version="1.0.0"
)

# CORS設定 (ローカルのNext.jsからのアクセスを許可)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーターをインクルード
app.include_router(races_v1.router, prefix="/api/v1/predictions", tags=["predictions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Keiba AI API"}