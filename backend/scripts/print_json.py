import sys
import os
from dotenv import load_dotenv
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()
from database.database import SessionLocal
from database import models

db = SessionLocal()
races = db.query(models.Race).filter(models.Race.race_date == '2026-02-21').filter(models.Race.ai_analysis_text.isnot(None)).all()

for item in races[:4]:
    print(f"▼ {item.race_name}")
    print(item.ai_analysis_text[:250] + "...\n(中略)\n" + item.ai_analysis_text[-150:])
    print("-" * 60)
db.close()
