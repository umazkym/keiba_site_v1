# C:\Users\tnszk\program\GitHub\backend\database\database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/keiba.db")

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