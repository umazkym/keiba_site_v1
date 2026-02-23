import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models
from scripts import llm_generator

def test_single_race_generation():
    db = SessionLocal()
    try:
        # 予測データが存在し、まだ分析テキストがない、あるいはあるレースを1件取得
        # ここではG1や重賞などの目立つレース、もしくは何でも良いので1件拾う
        race = db.query(models.Race)\
                 .join(models.Prediction, models.Race.id == models.Prediction.race_id)\
                 .filter(models.Race.race_date == "2026-02-21")\
                 .filter(models.Prediction.deviation_score.isnot(None))\
                 .first()
                 
        if not race:
            print("2026-02-21のレースが見つかりませんでした。別の日のレースを探します...")
            race = db.query(models.Race).join(models.Prediction).first()
            if not race:
                 print("適当なレースが見つかりませんでした。")
                 return
                 
        print(f"▼ 対象レース: {race.race_date} {race.venue_name} {race.race_number}R {race.race_name}")
        
        # 強制的に一回クリアして再生成をテストする
        race.ai_analysis_text = None
        db.commit()

        print("▼ Gemma 3 27B によるテキスト生成を開始...")
        success = llm_generator.generate_and_save_race_analysis(db, race.id)
        
        if success:
            db.refresh(race)
            with open("script_output.txt", "w", encoding="utf-8") as f:
                f.write(race.ai_analysis_text)
            print("Successfully wrote output to script_output.txt")
        else:
            print("テキスト生成に失敗しました。")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_single_race_generation()
