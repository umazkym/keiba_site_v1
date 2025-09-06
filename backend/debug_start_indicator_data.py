# backend/debug_start_indicator_data.py
import sys
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from database import models
from scripts import predictor
from datetime import date

# データベースのテーブルが存在しない場合に作成
Base.metadata.create_all(bind=engine)

def verify_start_indicator_data(db: Session, race_id: str):
    """
    指定されたrace_idの全出走馬について、スタート位置予測の計算根拠となる
    過去のコーナー通過順位データをDBから取得し、表示する。
    """
    print("\n" + "="*80)
    print(f"--- スタート位置予測 データ検証 (Race ID: {race_id}) ---")
    print("="*80)

    # 1. 対象レースの出走馬リストを取得
    horses_in_race = db.query(
        models.Result.horse_id,
        models.Horse.name,
        models.Result.horse_number
    ).join(models.Horse, models.Result.horse_id == models.Horse.id)\
     .filter(models.Result.race_id == race_id)\
     .order_by(models.Result.horse_number).all()

    if not horses_in_race:
        print(f"❌ エラー: Race ID '{race_id}' の出走馬データが見つかりません。")
        return

    print(f"\n✅ {len(horses_in_race)}頭の出走馬を検出しました。1頭ずつ過去の成績を検証します。")

    # 2. 各馬の過去成績を検証
    for horse in horses_in_race:
        print("\n" + "-"*60)
        print(f"🐴 検証対象: ({horse.horse_number}) {horse.name} (ID: {horse.horse_id})")
        print("-" * 60)

        past_results = db.query(
            models.Race.race_date,
            models.Race.race_name,
            models.Race.total_horses,
            models.Result.corner_positions
        ).join(models.Race, models.Result.race_id == models.Race.id)\
         .filter(models.Result.horse_id == horse.horse_id)\
         .filter(models.Race.race_date < date.today()) \
         .order_by(models.Race.race_date.desc()).all()

        if not past_results:
            print("  -> 過去のレースデータがDBに存在しませんでした。")
            continue

        print(f"  -> DB内で {len(past_results)} 件の過去レースデータを発見。")
        valid_corner_data_count = 0
        for res in past_results:
            corner_pos = res.corner_positions
            
            # コーナーデータが有効かどうかの判定
            is_valid = corner_pos and isinstance(corner_pos, list) and len(corner_pos) > 0

            if is_valid:
                valid_corner_data_count += 1
                print(f"  ✅ [有効] {res.race_date} {res.race_name} ({res.total_horses}頭立) -> コーナー順位: {corner_pos}")
            else:
                print(f"  ❌ [無効] {res.race_date} {res.race_name} ({res.total_horses}頭立) -> コーナー順位: {corner_pos}")

        print("\n  --- [検証結果] ---")
        if valid_corner_data_count > 0:
            print(f"  ✅ {valid_corner_data_count}件の有効なコーナー通過データが見つかりました。この馬のスタート位置予測は計算可能です。")
            # 実際に計算してみる
            indicator_result = predictor._calculate_1c_indicator(db, horse.horse_id, date.today(), debug=True)
            z_score = indicator_result.get('z_score')
            if z_score is not None:
                print(f"     -> 計算されたZスコア: {z_score:.4f}")
            else:
                 print("     -> Zスコアの計算に失敗しました。")
        else:
            print(f"  ❌ 有効なコーナー通過データが1件も見つかりませんでした。")
            print("     -> このため、この馬のスタート位置予測は計算できず、nullになります。")
    
    print("\n" + "="*80)
    print("--- 検証完了 ---")
    print("="*80)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/debug_start_indicator_data.py <race_id>")
        print("\n   例: python backend/debug_start_indicator_data.py 202409030811")
        sys.exit(1)
        
    target_race_id = sys.argv[1]
    
    db_session: Session = SessionLocal()
    try:
        verify_start_indicator_data(db_session, target_race_id)
    except Exception as e:
        print(f"検証中にエラーが発生しました: {e}")
    finally:
        db_session.close()