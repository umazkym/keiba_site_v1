import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))
from sqlalchemy import create_engine, text
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, venue_name, race_number FROM races WHERE race_date = '2026-03-21'")).fetchall()
    print(f"Races for 2026-03-21: {len(res)}")
    res2 = conn.execute(text("SELECT COUNT(*) FROM horses")).scalar()
    print(f"Total Horses in DB: {res2}")
    res3 = conn.execute(text("SELECT COUNT(*) FROM results")).scalar()
    print(f"Total Results in DB: {res3}")
