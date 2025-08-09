# backend/debug_horse_loader.py
import datetime
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine, Base
from scripts import scraper, parser, database_loader

# --- デバッグ設定 ---
# 確認したいレースIDを指定してください (JRAでもNARでも可)
TARGET_RACE_ID = "202444060511" 
# ---

def main():
    """
    指定された単一レースの出馬表を取得し、馬情報をDBにロードするデバッグ用スクリプト
    """
    print("=" * 80)
    print("--- 馬情報ローダー デバッグスクリプト開始 ---")
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
        print(f"\n[ステップ2] {race_type_str}レースの出馬表HTMLを取得します...")

        # 3. HTMLの取得
        shutuba_html = scraper.get_shutuba_html(TARGET_RACE_ID, is_nar=is_nar, force_download=True)
        if not shutuba_html:
            print("[エラー] 出馬表HTMLの取得に失敗しました。処理を中断します。")
            return
        print(" -> HTML取得成功。")

        # 4. HTMLの解析
        print("\n[ステップ3] HTMLを解析して馬情報を抽出します...")
        shutuba_data = parser.parse_shutuba_page(shutuba_html, TARGET_RACE_ID)
        if not shutuba_data or not shutuba_data.get('horses'):
            print("[エラー] 出馬表の解析に失敗しました。処理を中断します。")
            return
        
        print(f" -> {len(shutuba_data['horses'])}頭の馬情報を抽出しました。")
        print(" --- 抽出データ（最初の3頭）のプレビュー ---")
        for i, horse in enumerate(shutuba_data['horses'][:3]):
            print(f"   - 馬名: {horse.get('horse_name', 'N/A')}, 性別: {horse.get('sex')}, 年齢: {horse.get('age')}")
        print(" -----------------------------------------")


        # 5. データベースへのロード
        print("\n[ステップ4] 抽出したデータをデータベースにロードします...")
        # run_pipeline.pyと同様に、ダミーの日付を使用
        dummy_date = datetime.date.today()
        database_loader.load_shutuba_data(db, shutuba_data, TARGET_RACE_ID, dummy_date, is_nar)
        print(" -> ロード処理が完了しました。")

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
