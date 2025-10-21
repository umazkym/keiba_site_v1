import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import traceback

# プロジェクトルートをパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import scraper, parser

# .envファイルをロード
load_dotenv()

def investigate_race_list_scraping(target_date_str: str):
    """
    指定された日付のJRAおよびNARのレース一覧ページをスクレイピングし、
    URLの抽出が正しく機能しているかを確認する。
    """
    print("=" * 80)
    print(f"--- レースURL収集デバッグツール ({target_date_str}) ---")
    print("=" * 80)

    driver = None
    try:
        print("\n[ステップ1] WebDriverを初期化しています...")
        driver = scraper._prepare_chrome_driver()
        if not driver:
            print("❌ WebDriverの初期化に失敗しました。")
            return
        print("✅ WebDriverの初期化に成功しました。")

        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        date_str_ymd = target_date.strftime('%Y%m%d')

        # --- JRAの調査 ---
        print("\n--- [調査1/2] JRAのレース一覧を調査します ---")
        html_content_jra, _ = scraper.get_race_list_html(date_str_ymd, is_nar=False, driver=driver, force_download=True)
        
        if not html_content_jra:
            print("🚨 問題発見: JRAのレース一覧ページのHTML取得に失敗しました。")
        else:
            print("✅ JRAのレース一覧ページのHTML取得に成功。")
            # 失敗時に分析できるようHTMLを保存
            with open("debug_jra_racelist.html", "w", encoding="utf-8") as f:
                f.write(html_content_jra)
            print("   -> `debug_jra_racelist.html` に取得したHTMLを保存しました。")

            race_ids_jra = parser.parse_race_ids_from_list(html_content_jra)
            if not race_ids_jra:
                print("🚨【重要】JRAのレースURLが1件も抽出できませんでした。パーサーかHTML構造に問題があります。")
            else:
                print(f"✅ {len(race_ids_jra)}件のJRAレースURLを抽出しました。")
                print("   -> 最初の5件:", race_ids_jra[:5])

        # --- NARの調査（比較用） ---
        print("\n--- [調査2/2] NARのレース一覧を調査します（比較用） ---")
        html_content_nar, _ = scraper.get_race_list_html(date_str_ymd, is_nar=True, driver=driver, force_download=True)
        
        if not html_content_nar:
            print("🚨 NARのレース一覧ページのHTML取得に失敗しました。")
        else:
            print("✅ NARのレース一覧ページのHTML取得に成功。")
            race_ids_nar = parser.parse_race_ids_from_list(html_content_nar)
            if not race_ids_nar:
                print("🚨 NARのレースURLが1件も抽出できませんでした。")
            else:
                print(f"✅ {len(race_ids_nar)}件のNARレースURLを抽出しました。")
                print("   -> 最初の5件:", race_ids_nar[:5])

    except Exception as e:
        print(f"\n❌ デバッグ中に予期せぬエラーが発生しました: {e}")
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()
        print("\n" + "="*80)
        print("--- デバッグ完了 ---")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/debug_race_list_scraper.py <日付>")
        print("   例: python backend/debug_race_list_scraper.py 2025-10-12")
        sys.exit(1)
        
    target_date_input = sys.argv[1]
    investigate_race_list_scraping(target_date_input)