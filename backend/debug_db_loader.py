# ==============================================================================
# Keiba Data Pipeline - Database Loader Debugging Tool (Rev. 6 - Final)
#
# 目的: 特定のレースIDのデータがデータベースに正しく保存されるか、
#       パイプラインの各ステップを追跡・検証します。
# 使い方:
# 1. このファイルを `backend/debug_db_loader.py` として完全に上書き保存します。
# 2. ターミナルで `backend` ディレクトリに移動します。
# 3. 以下のコマンドを実行します:
#    python debug_db_loader.py
# 4. コンソールに表示される「デバッグログ」をすべてコピーして、私に返信してください。
# ==============================================================================

import os
import sys
import datetime
import time
import random
import shutil

# --- .envファイルを読み込む ---
from dotenv import load_dotenv
load_dotenv()

# --- 必要なモジュールをインポート ---
try:
    from sqlalchemy.orm import Session
    from database.database import SessionLocal, engine
    from database import models
    from scripts import predictor, scraper, parser, database_loader
except ImportError as e:
    print(f"[エラー] 必要なモジュールのインポートに失敗しました: {e}")
    print("このデバッグスクリプトは 'backend' ディレクトリから実行してください。")
    sys.exit(1)

def print_header(title):
    print("\n" + "="*70)
    print(f"=== {title.upper()} ===")
    print("="*70)

def print_subheader(title):
    print("\n" + "-"*50)
    print(f"--- {title} ---")

def verify_db_data(db: Session, race_id: str):
    """データベース内の関連データを検証し、結果を出力する"""
    print_subheader("データベース検証")
    
    # 1. Raceテーブルの検証
    race_record = db.query(models.Race).filter(models.Race.id == race_id).first()
    if race_record:
        print(f"✅ [Raceテーブル] race_id '{race_id}' のレコードが見つかりました。")
        print(f"  - race_name: {race_record.race_name}")
        print(f"  - race_date: {race_record.race_date}")
    else:
        print(f"❌ [Raceテーブル] race_id '{race_id}' のレコードが見つかりません。")

    # 2. 出走馬の検証 (Resultテーブル)
    horses_in_race_count = db.query(models.Result).filter(models.Result.race_id == race_id).count()
    if horses_in_race_count > 0:
        print(f"✅ [Resultテーブル] race_id '{race_id}' に関連する出走馬レコードが {horses_in_race_count} 件見つかりました。")
    else:
        print(f"❌ [Resultテーブル] race_id '{race_id}' に関連する出走馬レコードが見つかりません。")
        
    # 3. Predictionテーブルの検証
    predictions_count = db.query(models.Prediction).filter(models.Prediction.race_id == race_id).count()
    if predictions_count > 0:
        print(f"✅ [Predictionテーブル] race_id '{race_id}' の予測レコードが {predictions_count} 件見つかりました。")
    else:
        print(f"❌ [Predictionテーブル] race_id '{race_id}' の予測レコードが見つかりません。")

    # 4. レース結果情報の検証 (rankがNULLでないかで判断)
    results_with_rank_count = db.query(models.Result).filter(models.Result.race_id == race_id, models.Result.rank != None).count()
    if results_with_rank_count > 0:
        print(f"✅ [Resultテーブル] race_id '{race_id}' の着順付き結果レコードが {results_with_rank_count} 件見つかりました。")
    else:
        print(f"❌ [Resultテーブル] race_id '{race_id}' の着順付き結果レコードが見つかりません。")
    print("-" * 50)


def run_single_race_debug(race_id: str, is_nar: bool):
    """
    単一のレースIDに対して、データ取得からDB保存までの一連の処理をデバッグ実行する
    """
    race_type = "地方競馬(NAR)" if is_nar else "中央競馬(JRA)"
    print_header(f"単一レースデバッグ: {race_id} ({race_type})")

    db = SessionLocal()
    driver = None
    
    try:
        print("[*] 既存の関連データをクリアします...")
        db.query(models.Prediction).filter(models.Prediction.race_id == race_id).delete(synchronize_session=False)
        db.query(models.Matchup).filter(models.Matchup.race_id == race_id).delete(synchronize_session=False)
        db.query(models.RaceReturn).filter(models.RaceReturn.race_id == race_id).delete(synchronize_session=False)
        db.query(models.Result).filter(models.Result.race_id == race_id).delete(synchronize_session=False)
        db.commit()
        
        db.query(models.Race).filter(models.Race.id == race_id).delete(synchronize_session=False)
        db.commit()
        print("[*] クリア完了。クリーンな状態でテストを開始します。")

        print("[初期状態] 処理開始前のデータベースの状態を確認します。")
        verify_db_data(db, race_id)

        print_subheader("STEP 1: 出馬表データの取得と保存")
        print(f"[*] scraper.get_shutuba_html を呼び出します (race_id: {race_id})")
        shutuba_html, _ = scraper.get_shutuba_html(race_id, is_nar=is_nar)
        
        if not shutuba_html:
            print("❌ 出馬表HTMLの取得に失敗しました。処理を中断します。")
            return
        
        print(f"✅ 出馬表HTMLを正常に取得しました (サイズ: {len(shutuba_html)} バイト)。")
        print("[*] parser.parse_shutuba_page を呼び出します。")
        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)

        if not shutuba_data or not shutuba_data.get('horses'):
            print("❌ 出馬表データの解析に失敗、または馬情報が含まれていません。処理を中断します。")
            return

        print(f"✅ 出馬表データを正常に解析しました ({len(shutuba_data.get('horses', []))} 頭の馬情報)。")
        
        # --- [修正箇所] パーサーが返す日付オブジェクトに対応 ---
        race_date_obj = shutuba_data.get('race_info', {}).get('race_date')
        if isinstance(race_date_obj, datetime.date):
            race_date = race_date_obj
        elif isinstance(race_date_obj, str):
            try:
                race_date = datetime.datetime.strptime(race_date_obj, '%Y年%m月%d日').date()
            except ValueError:
                print(f"⚠️ 日付文字列の解析に失敗しました: {race_date_obj}")
                race_date = datetime.date(int(race_id[:4]), 1, 1)
        else:
            print("⚠️ レース情報から日付を取得できませんでした。race_idから推測します。")
            race_date = datetime.date(int(race_id[:4]), 1, 1)
        # --- 修正ここまで ---
        
        print(f"[*] レース開催日として認識された日付: {race_date}")
        
        print("[*] database_loader.load_shutuba_data を呼び出してDBに保存します...")
        database_loader.load_shutuba_data(db, shutuba_data, race_id, race_date, is_nar)
        print("✅ database_loader.load_shutuba_data の処理が完了しました。")

        verify_db_data(db, race_id)

        print_subheader("STEP 2: 各馬の過去成績データの取得と保存")
        horse_ids_in_race = {h['horse_id'] for h in shutuba_data['horses'] if h.get('horse_id')}
        print(f"[*] 対象となる馬は {len(horse_ids_in_race)} 頭です。")
        
        if not horse_ids_in_race:
            print("過去成績を取得する馬がいません。STEP 2をスキップします。")
        else:
            driver = scraper._prepare_chrome_driver()
            for horse_id in horse_ids_in_race:
                print(f"\n  -- 馬ID: {horse_id} の処理 --")
                print(f"  [*] scraper.get_horse_page_html を呼び出します。")
                html, was_scraped = scraper.get_horse_page_html(horse_id, force_download=False, driver=driver)
                if not html:
                    print(f"  ❌ 馬ページHTMLの取得に失敗しました (horse_id: {horse_id})。")
                    continue
                print(f"  ✅ 馬ページHTMLを正常に取得しました。")
                parsed_data = parser.parse_horse_results_page(html)
                if not parsed_data or not parsed_data.get('results'):
                    print(f"  ❌ 馬の過去成績データの解析に失敗しました。")
                    continue
                horse_name = parsed_data.get('horse_name')
                results = parsed_data.get('results')
                print(f"  ✅ {horse_name} の過去成績を {len(results)} 件解析しました。")
                print(f"  [*] database_loader.load_past_results を呼び出してDBに保存します...")
                database_loader.load_past_results(db, horse_name, results, horse_id)
                print(f"  ✅ DB保存処理が完了しました。")
                if was_scraped: time.sleep(random.uniform(2.0, 3.0))

        print_subheader("STEP 3: 予測データの生成と保存")
        print("[*] predictor.create_predictions_for_race を呼び出します。")
        predictions = predictor.create_predictions_for_race(race_id, db)
        if not predictions:
            print("❌ 予測データの生成に失敗しました。")
        else:
            print(f"✅ 予測データを {len(predictions)} 件生成しました。")
            print("[*] database_loader.save_prediction を呼び出してDBに保存します...")
            database_loader.save_prediction(db, race_id, predictions)
            print("✅ DB保存処理が完了しました。")

        verify_db_data(db, race_id)
        
        print_subheader("STEP 4: レース結果データの取得と保存")
        print(f"[*] scraper.get_race_result_html を呼び出します (race_id: {race_id})")
        result_html, _ = scraper.get_race_result_html(race_id, is_nar=is_nar)
        
        if not result_html:
            print("⚠️ レース結果HTMLの取得に失敗しました。未来のレースの場合、これは正常な動作です。")
        else:
            print("✅ レース結果HTMLを正常に取得しました。")
            print("[*] parser.parse_race_result_page を呼び出します。")
            race_data = parser.parse_race_result_page(result_html, race_id)
            if not race_data or not race_data.get('results'):
                print("❌ レース結果データの解析に失敗しました。")
            else:
                print(f"✅ レース結果を {len(race_data.get('results', []))} 件解析しました。")
                print("[*] database_loader.load_race_result_data を呼び出してDBに保存します...")
                database_loader.load_race_result_data(db, race_data, race_id, race_date, is_nar)
                print("✅ DB保存処理が完了しました。")

    except Exception as e:
        import traceback
        print("\n" + "!"*70)
        print("!!! デバッグ処理中に予期せぬエラーが発生しました !!!")
        print(traceback.format_exc())
        print("!"*70)
        db.rollback()
    finally:
        if driver:
            user_data_dir = getattr(driver, 'user_data_dir', None)
            driver.quit()
            if user_data_dir and os.path.exists(user_data_dir):
                shutil.rmtree(user_data_dir, ignore_errors=True)
                
        print_header("最終的なデータベースの状態")
        verify_db_data(db, race_id)
        
        db.close()
        print("\n[*] データベースセッションをクローズしました。")
        print_header("デバッグ処理完了")


if __name__ == "__main__":
    target_race_id = "202505040302" # 2025-10-11 東京1R
    target_is_nar = False
    
    if len(sys.argv) == 3:
        target_race_id = sys.argv[1]
        target_is_nar = sys.argv[2].lower() == 'true'
    
    run_single_race_debug(target_race_id, target_is_nar)