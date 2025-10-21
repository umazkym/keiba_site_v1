"""
デバッグ用テストスクリプト
2025-10-11の日付でpipelineが走ったようにシミュレートする
"""
import os
import sys
import io
import datetime
from dotenv import load_dotenv

# Windows環境でのエンコーディング問題対応
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

# 環境変数を上書き（Renderモード無効化＆ログ出力有効化）
os.environ.pop("RENDER", None)
os.environ["PIPELINE_MODE"] = "PRODUCTION"

# バックエンドのインポート
from database.database import SessionLocal
from scripts import scraper, parser, database_loader
from db_handler import update_race_results, insert_new_predictions

def debug_test():
    """
    2025-10-11の日付でテスト実行
    - 翌日（2025-10-11）の予測データ取得をシミュレート
    - 前日（2025-10-09）の結果取得もシミュレート
    """
    print("=" * 80)
    print("🔧 DEBUG TEST: 2025-10-11のパイプライン処理をシミュレート")
    print("=" * 80)

    # テスト対象日時を固定
    # 実際には2025-10-10(金)のシステム時刻時点での処理を再現
    test_datetime = datetime.datetime(2025, 10, 10, 5, 30, 0)  # JST

    print(f"\n📅 テスト実行日時: {test_datetime}")
    print(f"   -> 翌日（予測）: {(test_datetime + datetime.timedelta(days=1)).date()}")
    print(f"   -> 前日（結果）: {(test_datetime - datetime.timedelta(days=1)).date()}")

    # 前日と翌日を計算
    target_date_results = (test_datetime - datetime.timedelta(days=1)).date()  # 2025-10-09
    target_date_predictions = (test_datetime + datetime.timedelta(days=1)).date()  # 2025-10-11

    db = SessionLocal()

    try:
        print("\n" + "=" * 80)
        print(f"✅ [STEP 1/2] 前日（{target_date_results}）の結果を取得")
        print("=" * 80)

        # キャッシュから取得（実際のスクレイピングは行わない）
        print(f"\n  -> {target_date_results.strftime('%Y%m%d')} のレース結果をDBに保存...")
        try:
            update_race_results(db, target_date_results)
            print(f"  ✅ 結果更新完了")
        except Exception as e:
            print(f"  ⚠️  結果更新中にエラー: {e}")
            import traceback
            traceback.print_exc()

        print("\n" + "=" * 80)
        print(f"✅ [STEP 2/2] 翌日（{target_date_predictions}）の予測を生成")
        print("=" * 80)

        # 翌日のレース一覧がキャッシュにあるか確認
        race_cache_dir = os.path.join("data", "html_cache", "racelist")
        nar_cache_dir = os.path.join("data", "html_cache", "nar_racelist")

        date_str = target_date_predictions.strftime('%Y%m%d')
        central_cache = os.path.join(race_cache_dir, f"{date_str}.bin")
        nar_cache = os.path.join(nar_cache_dir, f"{date_str}.bin")

        print(f"\n  📁 キャッシュ確認:")
        print(f"     中央競馬: {central_cache}")
        print(f"     └─ {'✅ 存在' if os.path.exists(central_cache) else '❌ なし'}")
        print(f"     地方競馬: {nar_cache}")
        print(f"     └─ {'✅ 存在' if os.path.exists(nar_cache) else '❌ なし'}")

        print(f"\n  -> {target_date_predictions.strftime('%Y%m%d')} の予測データを生成...")
        try:
            insert_new_predictions(db, target_date_predictions)
            print(f"  ✅ 予測生成完了")
        except Exception as e:
            print(f"  ⚠️  予測生成中にエラー: {e}")
            import traceback
            traceback.print_exc()

        print("\n" + "=" * 80)
        print("✅ テスト完了！")
        print("=" * 80)

        # 結果を確認
        print("\n📊 確認項目:")
        print("  1. 上記のエラーがないか確認")
        print("  2. DBに予測データが保存されたか確認:")
        print(f"     -> SELECT * FROM predictions WHERE race_date = '{target_date_predictions}';")
        print("  3. キャッシュが正常に読み込まれたか確認")

    finally:
        db.close()

def debug_test_scraping_only():
    """
    実際のスクレイピングをテストする場合用
    （ネットワーク負荷とBAN回避のため、本当に必要な時だけ実行）
    """
    print("\n" + "=" * 80)
    print("🔧 DEBUG TEST: スクレイピングのみテスト（2025-10-11）")
    print("=" * 80)

    target_date = datetime.date(2025, 10, 11)
    date_str = target_date.strftime('%Y%m%d')

    print(f"\n📅 テスト対象日: {target_date.strftime('%Y-%m-%d')}")
    print("\n⚠️  NOTE: 実際のスクレイピングが走ります（BAN回避のため、短時間だけです）")

    print(f"\n  -> 中央競馬（JRA）レース一覧を取得...")
    central_html, was_scraped = scraper.get_race_list_html(date_str, is_nar=False, force_download=True)
    if central_html:
        print(f"     ✅ 取得成功 (キャッシュ {'新規作成' if was_scraped else '既存使用'})")
        race_ids = parser.parse_race_ids_from_list(central_html)
        print(f"     📌 検出レース数: {len(race_ids) if race_ids else 0}件")
    else:
        print(f"     ❌ 取得失敗")

    print(f"\n  -> 地方競馬（NAR）レース一覧を取得...")
    nar_html, was_scraped = scraper.get_race_list_html(date_str, is_nar=True, force_download=True)
    if nar_html:
        print(f"     ✅ 取得成功 (キャッシュ {'新規作成' if was_scraped else '既存使用'})")
        race_ids = parser.parse_race_ids_from_list(nar_html)
        print(f"     📌 検出レース数: {len(race_ids) if race_ids else 0}件")
    else:
        print(f"     ❌ 取得失敗")

if __name__ == "__main__":
    import argparse

    parser_args = argparse.ArgumentParser(description="デバッグテストスクリプト")
    parser_args.add_argument(
        "--scraping",
        action="store_true",
        help="実際のスクレイピングをテストする（BAN回避のため短時間のみ）"
    )

    args = parser_args.parse_args()

    if args.scraping:
        debug_test_scraping_only()
    else:
        debug_test()
