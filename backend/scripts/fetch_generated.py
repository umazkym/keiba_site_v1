import sys
import os
import time
import json
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models

def fetch_completed():
    db = SessionLocal()
    try:
        races = db.query(models.Race)\
                 .filter(models.Race.race_date == "2026-02-21")\
                 .filter(models.Race.ai_analysis_text.isnot(None))\
                 .order_by(models.Race.id)\
                 .all()
                 
        with open("fetched.txt", "w", encoding="utf-8") as f:
            for r in races:
                f.write(f"▼ {r.venue_name}{r.race_number}R {r.race_name}\n")
                f.write(r.ai_analysis_text + "\n")
                f.write("="*60 + "\n\n")
            
            f.write(f"Total generated texts mapped: {len(races)}\n")
    finally:
        db.close()

if __name__ == "__main__":
    fetch_completed()
