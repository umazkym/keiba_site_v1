import sys
import io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    races = db.execute(text("SELECT COUNT(*) as cnt FROM races WHERE race_date = '2025-10-11'")).fetchone()
    print(f"Races for 2025-10-11: {races[0] if races else 0}")

    predictions = db.execute(text("SELECT COUNT(*) as cnt FROM predictions WHERE race_date = '2025-10-11'")).fetchone()
    print(f"Predictions for 2025-10-11: {predictions[0] if predictions else 0}")
finally:
    db.close()
