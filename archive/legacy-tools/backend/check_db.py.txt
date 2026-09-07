import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from sqlalchemy import create_engine, text
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) FROM predictions JOIN races ON predictions.race_id = races.id WHERE races.race_date = '2026-03-21'"))
    print(f"Predictions for 2026-03-21: {result.scalar()}")
