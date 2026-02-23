import sys
import os
import time
import json
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models
from scripts import llm_generator

def run_batch_generation():
    db = SessionLocal()
    try:
        # 新馬戦を除外
        races = db.query(models.Race)\
                 .filter(models.Race.race_date == "2026-02-21")\
                 .filter(~models.Race.race_name.like("%新馬%"))\
                 .order_by(models.Race.id)\
                 .all()
                 
        print(f"Targeting {len(races)} races on 2026-02-21 (excluding new-comer races).")
        results = []
        
        for idx, race in enumerate(races):
            # 予測データの確認
            predictions = db.query(models.Prediction).filter(models.Prediction.race_id == race.id).all()
            if not predictions:
                continue
            valid_predictions = [p for p in predictions if p.deviation_score is not None]
            if not valid_predictions:
                continue
                
            print(f"Generating for {race.id} ({race.venue_name}{race.race_number}R)... ({idx+1}/{len(races)})")
            # 強制再生成
            race.ai_analysis_text = None
            db.commit()
            
            success = llm_generator.generate_and_save_race_analysis(db, race.id)
            if success:
                db.refresh(race)
                results.append({
                    "race_id": race.id,
                    "race_name": f"{race.venue_name}{race.race_number}R {race.race_name}",
                    "text": race.ai_analysis_text
                })
            else:
                print(f"Failed for {race.id}")
                
        # 全文をまとめてJSONまたはテキストに出力
        with open("batch_output_20260221.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        # テキストファイルにも出力
        with open("batch_output_20260221.txt", "w", encoding="utf-8") as f:
            for r in results:
                f.write(f"▼ {r['race_name']}\n")
                f.write(r['text'] + "\n")
                f.write("="*60 + "\n\n")
            
        print(f"Done. Successfully generated {len(results)} texts.")
    finally:
        db.close()

if __name__ == "__main__":
    run_batch_generation()
