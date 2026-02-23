import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models
from scripts import llm_generator

db = SessionLocal()

# 新馬戦を除外して、対象レースを全件取得（limit解除）
races = db.query(models.Race)\
         .filter(models.Race.race_date == "2026-02-21")\
         .filter(~models.Race.race_name.like("%新馬%"))\
         .order_by(models.Race.id)\
         .all()

race_ids = [r.id for r in races]
print(f"Testing with {len(race_ids)} races: {race_ids}")

# 前回のテキストを完全にクリア
for r in races:
    r.ai_analysis_text = None
db.commit()

llm_generator.generate_analyses_in_batches(db, race_ids)

db.close()
