import datetime
import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict
import winsound

from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, predictor, database_loader
from database import models # ★ modelsをインポート

print("Initializing database tables if they don't exist...")
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"[ERROR] Failed to initialize database tables: {e}")

TARGET_RACE_IDS = [
    "202408030611",  # JRAのレース例 (2024年 札幌記念)
    "202444060511",  # NARのレース例 (2024年 東京ダービー)
]

def _fetch_and_load_past_data_for_debug(db: Session, horses_in_race: List[Dict]):
    """デバッグ対象の馬リストの過去成績を取得し DB に保存する"""
    horse_ids = [h.get('horse_id') for h in horses_in_race if h.get('horse_id')]
    print(f"  -> AIスタート位置予測には過去のレースデータが必要です。{len(horse_ids)}頭のデータを取得・更新します...")
    
    for horse_info in horses_in_race:
        horse_id = horse_info.get('horse_id')
        if not horse_id:
            continue
            
        # ★★★ 追加: 先に馬自身の情報をDBに保存する ★★★
        # これによりForeignKeyViolationエラーを防ぐ
        horse_record = {
            'id': horse_id,
            'name': horse_info.get('horse_name')
        }
        database_loader._bulk_upsert(db, models.Horse, [horse_record], ['id'])
        db.commit()
        # ★★★ 追加ここまで ★★★

        html = scraper.get_horse_page_html(horse_id, force_download=False)
        if html:
            results = parser.parse_horse_results_page(html)
            if results:
                database_loader.load_past_results(db, results, horse_id)

def debug_race(race_id: str):
    print(f"\n{'='*25} レースID: {race_id} の検証を開始 {'='*25}")
    
    db: Session = SessionLocal()
    try:
        is_nar = int(race_id[4:6]) >= 30
        race_type = "地方(NAR)" if is_nar else "中央(JRA)"
        print(f"レース種別: {race_type}")

        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if not shutuba_html:
            print(f"[エラー] 出馬表HTMLの取得に失敗しました。")
            db.close()
            return

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        if not shutuba_data or not shutuba_data.get('horses'):
            print(f"[エラー] 出馬表の解析に失敗しました。")
            db.close()
            return
            
        horses = shutuba_data['horses']
        print(f"{len(horses)}頭の出走馬情報を取得しました。")

        if horses:
            # ★★★ 修正: horse_idだけでなく馬名なども渡す ★★★
            _fetch_and_load_past_data_for_debug(db, horses)

        print("各馬の過去成績を分析し、1Cスタート指標を計算中...")
        results = []
        race_date = datetime.date.today() 

        for horse in horses:
            horse_id = horse.get('horse_id')
            if not horse_id:
                continue

            indicator_result = predictor._calculate_1c_indicator(db, horse_id, race_date, debug=True)
            z_score = indicator_result['z_score']
            
            results.append({
                'horse_number': horse.get('horse_number'),
                'horse_name': horse.get('horse_name'),
                'z_score': z_score,
                'past_races_found': indicator_result.get('past_races_found', 0),
                'valid_corner_races': indicator_result.get('valid_corner_races', 0),
            })
            print(f"  -> {horse.get('horse_name', '不明'):<15}: Z-score = {f'{z_score:.3f}' if z_score is not None else 'N/A':<7} "
                  f"(DB内の過去レース: {indicator_result.get('past_races_found', 0):>2}件, "
                  f"うちコーナーデータ有効: {indicator_result.get('valid_corner_races', 0):>2}件)")

        df = pd.DataFrame(results)
        valid_scores = df['z_score'].dropna()

        if len(valid_scores) > 1:
            min_val, max_val = valid_scores.min(), valid_scores.max()
            if abs(max_val - min_val) < 1e-9:
                df['indicator'] = 50.0
            else:
                df['indicator'] = df['z_score'].apply(
                    lambda z: 1.0 + (z - min_val) * 99 / (max_val - min_val) if pd.notna(z) else None
                )
        else:
            df['indicator'] = None

        print("\n" + "-"*30 + " 計算結果 " + "-"*30)
        df_sorted = df.sort_values(by='horse_number')
        for _, row in df_sorted.iterrows():
            indicator_str = f"{row['indicator']:.2f}" if pd.notna(row['indicator']) else "計算不可"
            print(f"  馬番 {str(row['horse_number']):>2}: {row['horse_name']:<15} -> AIスタート位置予測: {indicator_str:<10} "
                  f"(有効データ: {row.get('valid_corner_races', 0)}/{row.get('past_races_found', 0)}件)")
        print("-" * 72)

    except Exception as e:
        import traceback
        print(f"[致命的エラー] 処理中に予期せぬエラーが発生しました: {e}")
        traceback.print_exc()
    finally:
        if db.is_active:
            db.close()
        print(f"{'='*65}")

if __name__ == '__main__':
    print("--- AIスタート位置予測 デバッグスクリプト開始 ---")
    for r_id in TARGET_RACE_IDS:
        debug_race(r_id)
    print("\n--- 全ての処理が完了しました ---")
    try:
        winsound.Beep(880, 500)
    except Exception as e:
        print(f"(Could not play sound: {e})")