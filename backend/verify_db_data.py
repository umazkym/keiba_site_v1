# backend/verify_db_data.py
import sys
from sqlalchemy.orm import Session, joinedload
# 修正点: engine と Base をインポート
from database.database import SessionLocal, engine, Base
from database import models
import json

# --- 修正点: スクリプト実行時にテーブルが存在することを確認・作成する ---
# この行を追加することで、テーブルが存在しない場合に自動的に作成します。
Base.metadata.create_all(bind=engine)

def verify_race_data(db: Session, race_id: str):
    """指定されたrace_idのデータがDBに正しく格納されているか検証し、結果を出力する"""
    print("\n" + "="*80)
    print(f"--- データベース検証開始 (Race ID: {race_id}) ---")
    print("="*80)

    # --- 1. レース情報の検証 ---
    print("\n[1. レース情報 (races table)]")
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        print(f"  -> エラー: Race ID '{race_id}' が見つかりません。")
        print("--- 検証終了 ---")
        return
    
    print(f"  - レース名: {race.race_name}")
    print(f"  - 開催日: {race.race_date}")
    print(f"  - 競馬場: {race.venue_name} ({race.race_type})")
    print(f"  - コース: {race.course_type}{race.distance}m")
    print(f"  - 出走頭数: {race.total_horses}頭")

    # --- 2. レース結果の検証 ---
    print("\n[2. レース結果 (results table)]")
    results = db.query(models.Result)\
        .options(joinedload(models.Result.horse))\
        .filter(models.Result.race_id == race_id)\
        .order_by(models.Result.horse_number)\
        .all()
    
    if not results:
        print("  -> エラー: このレースの結果データが見つかりません。")
    else:
        print(f"  -> {len(results)}件の結果データが見つかりました。")
        missing_jockey_trainer = 0
        for r in results:
            if not r.jockey_id or not r.trainer_id:
                missing_jockey_trainer += 1
        
        if missing_jockey_trainer > 0:
            print(f"  -> 警告: {missing_jockey_trainer}件のデータで騎手IDまたは調教師IDが欠損しています。")
        else:
            print("  -> OK: 全てのデータで騎手IDと調教師IDが設定されています。")

        print("\n  --- サンプルデータ (上位3頭) ---")
        for r in sorted([res for res in results if res.rank is not None], key=lambda x: x.rank)[:3]:
             print(f"    - {r.rank}着 ({r.horse_number}) {r.horse.name if r.horse else 'N/A'}")

    # --- 3. AI予測の検証 ---
    print("\n[3. AI予測 (predictions table)]")
    predictions = db.query(models.Prediction).filter(models.Prediction.race_id == race_id).all()

    if not predictions:
        print("  -> エラー: このレースのAI予測データが見つかりません。")
    else:
        print(f"  -> {len(predictions)}件の予測データが見つかりました。")
        if len(predictions) == len(results):
            print("  -> OK: 結果の頭数と予測の頭数が一致しています。")
        else:
            print(f"  -> 警告: 結果({len(results)}件)と予測({len(predictions)}件)の頭数が一致しません。")
        
        print("\n  --- サンプルデータ (上位3件) ---")
        for p in sorted([pred for pred in predictions if pred.deviation_score is not None], key=lambda x: x.deviation_score, reverse=True)[:3]:
            print(f"    - {p.mark} ({p.horse_number}) {p.horse_name} (偏差値: {p.deviation_score:.2f})")

    # --- 4. 対戦成績の検証 ---
    print("\n[4. 対戦成績 (matchups table)]")
    matchup = db.query(models.Matchup).filter(models.Matchup.race_id == race_id).first()

    if not matchup:
        print("  -> エラー: このレースの対戦成績データが見つかりません。")
    else:
        print("  -> OK: 対戦成績データが見つかりました。")
        # --- ★★★ ここから修正 ★★★
        try:
            # matchup.matchup_data は既にPythonの辞書オブジェクトなので、型をチェック
            if isinstance(matchup.matchup_data, dict):
                print(f"  -> OK: {len(matchup.matchup_data)}件の対戦ペアデータが格納されています。")
            else:
                # この分岐に入ることは稀だが、念のため
                print(f"  -> 警告: matchup_dataが予期せぬ型です (型: {type(matchup.matchup_data)})。")
        except Exception as e:
            print(f"  -> エラー: 対戦成績データの検証中にエラーが発生しました: {e}")
        # --- 修正ここまで ---

    print("\n" + "="*80)
    print("--- 検証終了 ---")
    print("="*80)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n使い方: python backend/verify_db_data.py <race_id>")
        print("\n例: python backend/verify_db_data.py 202506050811")
        sys.exit(1)
        
    target_race_id = sys.argv[1]
    
    db: Session = SessionLocal()
    try:
        verify_race_data(db, target_race_id)
    except Exception as e:
        print(f"検証中にエラーが発生しました: {e}")
    finally:
        db.close()