# backend/debug_single_race_pipeline.py
import datetime
import time
import sys
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, database_loader, predictor
from database import models
from typing import List, Dict, Any

# --- デバッグ設定 ---
# コマンドライン引数で受け取るか、デフォルト値を使用
DEFAULT_RACE_ID = "202408030611" # JRAのレース例 (札幌記念)

def fetch_and_load_past_data_for_debug(db: Session, horses_in_race: List[Dict[str, Any]]):
    """デバッグ対象の馬リストの過去成績を取得し DB に保存する"""
    horse_ids_to_fetch = [h.get('horse_id') for h in horses_in_race if h.get('horse_id')]
    if not horse_ids_to_fetch:
        print("  -> No valid horse IDs found in the race.")
        return
        
    print(f"  -> Fetching past race data for {len(horse_ids_to_fetch)} horses...")
    
    # 先に出走馬の基本情報をDBに保存（ForeignKey制約エラーを防ぐため）
    horse_records = [{'id': h['horse_id'], 'name': h['horse_name'], 'sex': h.get('sex'), 'age': h.get('age')} for h in horses_in_race if h.get('horse_id')]
    if horse_records:
        database_loader._bulk_upsert_horses(db, horse_records)
        db.commit()

    for horse_id in horse_ids_to_fetch:
        print(f"    - Processing horse: {horse_id}")
        # force_download=Falseでキャッシュを優先利用
        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)
        else:
            print(f"      [Warning] Could not fetch past results for horse {horse_id}.")
        time.sleep(0.5) # 念のため短いスリープ

def main(race_id: str):
    """指定された単一レースIDのデータ取得から予測保存までを実行する"""
    print("=" * 80)
    print("--- Single Race Pipeline Debug Script ---")
    print(f"Target Race ID: {race_id}")
    print("=" * 80)

    # データベーステーブルがなければ作成
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        is_nar = int(race_id[4:6]) >= 30
        race_type_str = "NAR" if is_nar else "JRA"
        print(f"\n[1] Processing {race_type_str} race...")

        # 1. 出馬表の処理
        print("\n[2] Fetching, parsing, and loading shutuba data...")
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if not shutuba_html:
            print("  -> ERROR: Failed to get shutuba HTML. Aborting.")
            return

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        if not shutuba_data or not shutuba_data.get('horses'):
            print("  -> ERROR: Failed to parse shutuba data. Aborting.")
            return

        # レース開催日をrace_idから生成
        try:
            race_date = datetime.date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
        except ValueError:
            print(f"  -> ERROR: Invalid date in race_id '{race_id}'. Using today's date as fallback.")
            race_date = datetime.date.today()
            
        database_loader.load_shutuba_data(db, shutuba_data, race_id, race_date, is_nar)
        print(f"  -> SUCCESS: Loaded shutuba data for {len(shutuba_data['horses'])} horses.")

        # 2. 出走馬の過去成績の処理
        print("\n[3] Fetching, parsing, and loading past results for each horse...")
        fetch_and_load_past_data_for_debug(db, shutuba_data['horses'])
        print("  -> SUCCESS: Finished processing past results.")

        # 3. レース結果の処理
        print("\n[4] Fetching, parsing, and loading race result data...")
        result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True)
        if not result_html:
            print("  -> WARNING: Failed to get race result HTML. Skipping result-based steps.")
        else:
            race_data = parser.parse_race_result_page(result_html, race_id)
            if not race_data or not race_data.get('results'):
                print("  -> WARNING: Failed to parse race result. Skipping result-based steps.")
            else:
                database_loader.load_race_result_data(db, race_data, race_id, race_date, is_nar)
                print(f"  -> SUCCESS: Loaded race result data for {len(race_data['results'])} horses.")

        # 4. 予測の生成と保存
        print("\n[5] Creating and saving predictions...")
        predictions = predictor.create_predictions_for_race(db, race_id)
        if not predictions:
            print("  -> ERROR: Failed to create predictions.")
        else:
            database_loader.save_prediction(db, race_id, predictions)
            print(f"  -> SUCCESS: Saved {len(predictions)} predictions.")

            # 5. 対戦成績の計算と保存
            print("\n[6] Calculating and saving matchups...")
            horse_ids_in_race = [p["horse_id"] for p in predictions if p.get("horse_id")]
            if horse_ids_in_race:
                predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
                print("  -> SUCCESS: Matchup data calculated and saved.")
            else:
                print("  -> No horse IDs found in predictions to calculate matchups.")

    except Exception as e:
        print(f"\n[CRITICAL ERROR] An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.is_active:
            db.close()
        print("\n" + "="*80)
        print("--- Debug script finished ---")
        print(f"To verify the data in the database, run: python backend/verify_db_data.py {race_id}")
        print("=" * 80)

if __name__ == "__main__":
    target_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RACE_ID
    main(target_id)