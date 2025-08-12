# backend/debug_result_loader.py
import datetime
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, database_loader

# --- デバッグ設定 ---
# 確認したいレースIDを指定してください (JRAでもNARでも可)
# JRA例: "202406050811" (宝塚記念)
# NAR例: "202444060511" (東京ダービー)
TARGET_RACE_ID = "202554080202" 
# ---

def main():
    """
    指定された単一レースの結果を取得し、resultsテーブルに
    jockey_idとtrainer_idが正しくロードされるか検証するデバッグ用スクリプト
    """
    print("=" * 80)
    print("--- レース結果ローダー デバッグスクリプト開始 ---")
    print(f"ターゲットレースID: {TARGET_RACE_ID}")
    print("=" * 80)

    # 1. データベースの初期化
    print("\n[ステップ1] データベーステーブルを初期化しています...")
    try:
        Base.metadata.create_all(bind=engine)
        print(" -> テーブル初期化完了。")
    except Exception as e:
        print(f"[エラー] テーブル初期化中にエラーが発生しました: {e}")
        return

    db: Session = SessionLocal()
    try:
        # 2. レース情報の特定
        is_nar = int(TARGET_RACE_ID[4:6]) >= 30
        race_type_str = "地方(NAR)" if is_nar else "中央(JRA)"
        print(f"\n[ステップ2] {race_type_str}レースの結果HTMLを取得します...")

        # 3. HTMLの取得
        result_html = scraper.get_race_result_html(TARGET_RACE_ID, is_nar=is_nar, force_download=True)
        if not result_html:
            print("[エラー] レース結果HTMLの取得に失敗しました。処理を中断します。")
            return
        print(" -> HTML取得成功。")

        # 4. HTMLの解析
        print("\n[ステップ3] HTMLを解析してレース結果を抽出します...")
        race_data = parser.parse_race_result_page(result_html, TARGET_RACE_ID)
        if not race_data or not race_data.get('results'):
            print("[エラー] レース結果の解析に失敗しました。処理を中断します。")
            return
        
        print(f" -> {len(race_data['results'])}頭のレース結果を抽出しました。")
        print(" --- 抽出データ（最初の3頭）のプレビュー ---")
        for i, result in enumerate(race_data['results'][:3]):
            print(f"  - 馬名: {result.get('horse_name', 'N/A')}, "
                  f"騎手ID: {result.get('jockey_id', 'N/A')}, "
                  f"調教師ID: {result.get('trainer_id', 'N/A')}")
        print(" -----------------------------------------")


        # 5. データベースへのロード
        print("\n[ステップ4] 抽出したデータをデータベースにロードします...")
        # 実際のレース日付を使うが、なければ今日の日付をフォールバック
        race_date = race_data.get('race_info', {}).get('race_date', datetime.date.today())
        database_loader.load_race_result_data(db, race_data, TARGET_RACE_ID, race_date, is_nar)
        print(" -> ロード処理が完了しました。")
        
        # 6. データベースからロード結果を検証
        print("\n[ステップ5] データベースからロード結果を検証します...")
        from database.models import Result, Jockey, Trainer, Horse # 遅延インポート
        
        loaded_results = db.query(Result).filter(Result.race_id == TARGET_RACE_ID).all()
        
        if not loaded_results:
            print("[エラー] データベースから結果を読み込めませんでした。")
            return

        print(f"\n--- {TARGET_RACE_ID} のDB保存結果 ---")
        print("{:<4} {:<18} {:<15} {:<15}".format("馬番", "馬名", "騎手ID", "調教師ID"))
        print("-" * 60)
        
        all_ids_loaded = True
        for result in sorted(loaded_results, key=lambda r: r.horse_number):
            horse = db.query(Horse).filter(Horse.id == result.horse_id).first()
            horse_name = horse.name if horse else "N/A"
            
            if not result.jockey_id or not result.trainer_id:
                all_ids_loaded = False

            print("{:<4} {:<18} {:<15} {:<15}".format(
                result.horse_number,
                horse_name,
                str(result.jockey_id),
                str(result.trainer_id)
            ))

        print("-" * 60)
        if all_ids_loaded:
            print("\n[成功] 全ての馬の騎手IDと調教師IDが正常に保存されていることを確認しました。")
        else:
            print("\n[失敗] 一部または全ての騎手ID/調教師IDが保存されていません (NULLになっています)。")


    except Exception as e:
        import traceback
        print(f"\n[致命的エラー] 処理中に予期せぬエラーが発生しました: {e}")
        traceback.print_exc()
    finally:
        if db.is_active:
            db.close()
        print("\n" + "=" * 80)
        print("--- デバッグスクリプト終了 ---")
        print("=" * 80)


if __name__ == "__main__":
    main()