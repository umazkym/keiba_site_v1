# backend/debug_single_race_pipeline.py
import datetime
import time
import sys
import pprint
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, database_loader, predictor
from database import models
from typing import List, Dict, Any

# --- デバッグ設定 ---
DEFAULT_RACE_ID = "202505030611"

def _fetch_and_load_past_data_for_debug(db: Session, horse_ids: List[str]):
    """デバッグ用に、指定された馬リストの過去成績を取得しDBに保存する"""
    if not horse_ids:
        return
    print(f"\n[STEP 2] Fetching past results for {len(horse_ids)} horses to create predictions...")
    
    for i, horse_id in enumerate(horse_ids):
        print(f"  ({i+1}/{len(horse_ids)}) Fetching data for horse_id: {horse_id}...")
        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)
    print(" -> SUCCESS: Finished fetching and loading past data.")

def main(race_id: str):
    """データ収集からAI予測、DB保存までを一気通貫で実行・検証する"""
    print("=" * 80)
    print("--- Full Pipeline Debug Script for a Single Race ---")
    print(f"Target Race ID: {race_id}")
    print("=" * 80)

    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        is_nar = int(race_id[4:6]) >= 30
        race_type_str = "NAR" if is_nar else "JRA"
        print(f"\nProcessing {race_type_str} race...")
        
        try:
            race_date = datetime.date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
        except ValueError:
            race_date = datetime.date.today()

        # STEP 1: 出馬表の処理
        print("\n[STEP 1] Fetching, parsing, and loading Shutuba (entry) data...")
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if not shutuba_html: raise Exception("Failed to get shutuba HTML.")
        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        if not shutuba_data: raise Exception("Failed to parse shutuba page.")
        database_loader.load_shutuba_data(db, shutuba_data, race_id, race_date, is_nar)
        print(" -> SUCCESS: Loaded shutuba data.")

        # STEP 2: 予測のための過去データ収集
        horse_ids_in_race = [h['horse_id'] for h in shutuba_data.get('horses', []) if h.get('horse_id')]
        _fetch_and_load_past_data_for_debug(db, horse_ids_in_race)

        # STEP 3: AI予測と対戦成績の生成・保存
        print("\n[STEP 3] Creating AI predictions and matchups...")
        predictions = predictor.create_predictions_for_race(db, race_id)
        if predictions:
            database_loader.save_prediction(db, race_id, predictions)
            print(f" -> SUCCESS: Saved {len(predictions)} predictions.")
            predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids_in_race)
            print(" -> SUCCESS: Calculated and saved matchups.")
        else:
            print(" -> WARNING: No predictions were generated.")

        # STEP 4: レース結果の処理（データの最終更新）
        print("\n[STEP 4] Fetching and updating with final Race Result data...")
        result_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True)
        if not result_html: raise Exception("Failed to get race result HTML.")
        race_data = parser.parse_race_result_page(result_html, race_id)
        if not race_data: raise Exception("Failed to parse race result page.")
        database_loader.load_race_result_data(db, race_data, race_id, race_date, is_nar)
        print(" -> SUCCESS: Updated DB with final results.")

        # STEP 5: 最終検証
        print("\n[STEP 5] Verifying all data in the database...")
        db.commit()
        
        # predictionsテーブルの検証
        verify_preds = db.query(models.Prediction).filter(models.Prediction.race_id == race_id).order_by(models.Prediction.deviation_score.desc()).all()
        print("\n--- [A] DB Stored Predictions (Top 3) ---")
        if verify_preds:
            for p in verify_preds[:3]:
                print(f"  - {p.mark} ({p.horse_number}) {p.horse_name} (偏差値: {p.deviation_score:.2f}, スタート指標: {p.start_1c_indicator:.2f})")
        else:
            print("  -> No prediction data found.")
        print("------------------------------------------")

        # matchupsテーブルの検証
        verify_matchup = db.query(models.Matchup).filter(models.Matchup.race_id == race_id).first()
        print("\n--- [B] DB Stored Matchups ---")
        if verify_matchup and verify_matchup.matchup_data:
            pair_count = len(verify_matchup.matchup_data)
            print(f"  -> SUCCESS: Found matchup data for {pair_count} pairs.")
        else:
            print("  -> No matchup data found.")
        print("------------------------------")
        
        # --- 修正: race_returnsテーブルの検証出力を見やすく変更 ---
        print("\n--- [C] DB Stored Returns (race_returns table) ---")
        verify_returns = db.query(models.RaceReturn).filter(models.RaceReturn.race_id == race_id).all()
        if verify_returns:
            print(f"  -> Found {len(verify_returns)} return records.")
            print("    ----------------------------------------------------------")
            print(f"    {'券種':<10s} | {'番号':<15s} | {'払戻金':>12s} | {'人気':>6s}")
            print("    ----------------------------------------------------------")
            
            for r in verify_returns:
                numbers = [n for n in [r.number_1, r.number_2, r.number_3] if n is not None]
                delimiter = ' → ' if r.bet_type in ['umatan', 'sanrentan'] else ' - '
                numbers_str = delimiter.join(map(str, numbers))
                
                pop_str = f"{r.popularity}人気" if r.popularity else "N/A"
                print(f"    - {r.bet_type:<9s} | {numbers_str:<15s} | {str(r.payout) + '円':>12s} | {pop_str:>6s}")
            print("    ----------------------------------------------------------")
        else:
            print("  -> No return data found.")
        print("----------------------------------------------------")
        
    except Exception as e:
        print(f"\n[CRITICAL ERROR] An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if db.is_active:
            db.close()
        print("\n" + "="*80)
        print("--- Debug script finished ---")
        print("="*80)

if __name__ == "__main__":
    target_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RACE_ID
    main(target_id)
