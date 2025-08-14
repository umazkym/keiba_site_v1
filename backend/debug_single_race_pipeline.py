# backend/debug_single_race_pipeline.py

import datetime
import time
import sys
import pprint
from sqlalchemy.orm import Session, joinedload
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


def verify_database_state(db: Session, race_id: str):
    """DBの状態を詳細に検証して出力する"""
    print("\n" + "="*80)
    print(f"--- データベース最終状態検証 (Race ID: {race_id}) ---")
    
    # 1. trainers テーブルの検証
    print("\n[検証1] trainers テーブル (name列)")
    trainers_in_race = db.query(models.Trainer).join(models.Result, models.Trainer.id == models.Result.trainer_id).filter(models.Result.race_id == race_id).distinct().all()
    if not trainers_in_race:
        print(" -> エラー: レースに関連する調教師が見つかりません。")
    else:
        missing_names = [t for t in trainers_in_race if not t.name]
        if missing_names:
            print(f" -> 失敗: {len(missing_names)}件の調教師データで名前が欠損しています。 (ID: {[t.id for t in missing_names]})")
        else:
            print(f" -> 成功: {len(trainers_in_race)}件すべての調教師データに名前が正しく格納されています。")
            if trainers_in_race:
                print(f"    (例: ID={trainers_in_race[0].id}, Name='{trainers_in_race[0].name}')")

    # 2. races テーブルの検証
    print("\n[検証2] races テーブル (詳細情報列)")
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        print(" -> エラー: races テーブルに該当レースが見つかりません。")
    else:
        missing_cols = []
        cols_to_check = ['course_type', 'distance', 'weather', 'ground_condition', 'total_horses']
        for col in cols_to_check:
            if not getattr(race, col):
                missing_cols.append(col)
        if missing_cols:
            print(f" -> 失敗: 以下の列のデータが欠損しています: {missing_cols}")
        else:
            print(" -> 成功: 必要なレース詳細情報がすべて格納されています。")
            print(f"    - Course: {race.course_type}{race.distance}m")
            # ★★★ ここから修正 ★★★
            print(f"    - Condition: 天候={race.weather}, 馬場={race.ground_condition}")
            # ★★★ 修正ここまで ★★★
            print(f"    - Total Horses: {race.total_horses}")

    # 3. horse_number_advantages テーブルの検証（注意喚起付き）
    print("\n[検証3] horse_number_advantages テーブル")
    if race:
        advantages = db.query(models.HorseNumberAdvantage).filter(
            models.HorseNumberAdvantage.venue_name == race.venue_name,
            models.HorseNumberAdvantage.course_type == race.course_type,
            models.HorseNumberAdvantage.distance == race.distance
        ).all()
        if not advantages:
            print(" -> INFO: 該当レース条件の馬番有利不利データはまだ生成されていません。")
            print("    (注: このデータは run_pipeline.py の HISTORY モード実行完了後に一括で生成されます)")
        else:
            print(f" -> 成功: {len(advantages)}件の馬番有利不利データが格納されています。")
    else:
        print(" -> スキップ: racesテーブルにデータがないため検証できません。")

    print("="*80)


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
        verify_database_state(db, race_id)
        
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