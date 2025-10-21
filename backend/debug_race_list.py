# ==============================================================================
# Keiba Data Scraper - Debugging Tool
#
# 目的: 指定された期間のレース一覧ページからデータが取得できない問題を調査します。
# 使い方:
# 1. このファイルを `backend/debug_race_list.py` として保存します。
# 2. ターミナルで `backend` ディレクトリに移動します。
# 3. 以下のコマンドを実行します:
#    python debug_race_list.py 2025-10-11 2025-10-12
# 4. コンソールに表示される「デバッグログ」をすべてコピーして、私に返信してください。
# ==============================================================================

import os
import sys
import time
import random
import datetime
from datetime import timedelta
import shutil
import tempfile

# --- 必要なスクリプトから関数を限定的にインポート ---
# scraper.py と parser.py が同じ階層にある scripts/ ディレクトリ内に存在することを想定
try:
    from scripts import scraper, parser
except ImportError:
    print("[エラー] 'scripts'ディレクトリ、または'scraper.py', 'parser.py'が見つかりません。")
    print("このデバッグスクリプトは 'backend' ディレクトリから実行してください。")
    sys.exit(1)

# --- デバッグ設定 ---
DEBUG_HTML_DIR = "debug_html"

def setup_debug_environment():
    """デバッグ用のディレクトリを準備する"""
    if os.path.exists(DEBUG_HTML_DIR):
        # 既存のディレクトリを削除してクリーンな状態から開始
        shutil.rmtree(DEBUG_HTML_DIR)
    os.makedirs(DEBUG_HTML_DIR, exist_ok=True)
    print(f"[*] デバッグ用のHTML保存ディレクトリを作成しました: {os.path.abspath(DEBUG_HTML_DIR)}")

def run_debug_process(start_date: datetime.date, end_date: datetime.date):
    """
    指定された日付範囲のレースデータ取得をデバッグモードで実行する。
    並列処理は行わず、各ステップを詳細にログ出力する。
    """
    print("\n" + "="*50)
    print("=== デバッグ処理を開始します ===")
    print(f"[*] 対象期間: {start_date} から {end_date} まで")
    print("="*50 + "\n")

    dates_to_process = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    
    # WebDriverは一度だけ起動し、使い回す
    driver = None
    try:
        print("[DEBUG] Chrome WebDriverを起動します...")
        driver = scraper._prepare_chrome_driver()
        print("[DEBUG] WebDriverの起動に成功しました。")

        for target_date in dates_to_process:
            date_str = target_date.strftime('%Y%m%d')
            
            # is_nar=False (中央競馬), is_nar=True (地方競馬) の両方をチェック
            for is_nar in [False, True]:
                race_type = "中央競馬(JRA)" if not is_nar else "地方競馬(NAR)"
                print("\n" + "-"*50)
                print(f"--- {target_date} ({race_type}) の処理を開始 ---")
                
                # 1. レース一覧ページのHTMLを取得
                print(f"[1/3] レース一覧ページのHTMLを取得します (日付: {date_str}, is_nar: {is_nar})")
                
                # scraper.get_race_list_html のURLを事前にログ出力
                base_url = scraper.BASE_NAR_URL if is_nar else scraper.BASE_CENTRAL_URL
                target_url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
                print(f"  -> アクセスするURL: {target_url}")

                # force_download=Trueで常に最新の情報を取得
                list_html, was_scraped = scraper.get_race_list_html(date_str, is_nar=is_nar, driver=driver, force_download=True)
                
                if list_html:
                    print("  -> HTMLの取得に成功しました。")
                    # 取得したHTMLをデバッグ用に保存
                    filename = f"race_list_{'NAR' if is_nar else 'JRA'}_{date_str}.html"
                    filepath = os.path.join(DEBUG_HTML_DIR, filename)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(list_html)
                    print(f"  -> HTMLを保存しました: {os.path.abspath(filepath)}")
                    print(f"  -> HTMLコンテンツのサイズ: {len(list_html)} バイト")
                else:
                    print("  -> HTMLの取得に失敗しました。この日付のレースは存在しないか、Webサイトの構造が変わった可能性があります。")
                    print(f"--- {target_date} ({race_type}) の処理をスキップ ---\n")
                    continue

                # 2. 取得したHTMLからレースIDを解析
                print(f"[2/3] HTMLを解析してレースIDを抽出します。")
                try:
                    race_ids = parser.parse_race_ids_from_list(list_html)
                    print(f"  -> 解析が完了しました。")
                except Exception as e:
                    print(f"  -> !!! 解析中にエラーが発生しました: {e}")
                    race_ids = []

                # 3. 結果のログ出力
                print(f"[3/3] 抽出結果の確認")
                if race_ids:
                    print(f"  -> {len(race_ids)}件のレースIDが見つかりました:")
                    # race_idの構造について注釈を追加
                    # race_idの例: 202405010101 (年+開催情報+レース番号)
                    # 先頭4桁が年、5-6が競馬場コード、7-8が開催回、9-10が開催日、11-12がレース番号
                    print(f"     (注: race_idは '2024(年)05(競馬場)01(回)01(日目)01(R)' のような構造であり、日付そのものではありません)")
                    for rid in race_ids:
                        print(f"    - {rid}")
                else:
                    print("  -> レースIDは見つかりませんでした。")
                    print("     考えられる原因:")
                    print("     - この日にはレースが開催されていない。")
                    print("     - WebサイトのHTML構造が変更されたため、IDを抽出できなかった。")
                    print(f"     - (保存されたHTMLファイル {filepath} を手動で開き、レース情報があるか確認してください)")

                print(f"--- {target_date} ({race_type}) の処理が完了 ---")
                
                # サーバーへの負荷を考慮してスリープ
                time.sleep(random.uniform(2.0, 4.0))

    except Exception as e:
        print("\n!!! デバッグ処理中に予期せぬエラーが発生しました !!!")
        import traceback
        print(traceback.format_exc())
    finally:
        if driver:
            print("\n[DEBUG] Chrome WebDriverを終了します...")
            # WebDriver終了時に一時ディレクトリもクリーンアップ
            user_data_dir = getattr(driver, 'user_data_dir', None)
            driver.quit()
            if user_data_dir and os.path.exists(user_data_dir):
                shutil.rmtree(user_data_dir, ignore_errors=True)
            print("[DEBUG] WebDriverを正常に終了しました。")
        
        print("\n" + "="*50)
        print("=== デバッグ処理がすべて完了しました ===")
        print("="*50 + "\n")


if __name__ == "__main__":
    # コマンドライン引数から日付を取得
    if len(sys.argv) != 3:
        print("エラー: 開始日と終了日を 'YYYY-MM-DD' 形式で指定してください。")
        print("例: python debug_race_list.py 2025-10-11 2025-10-12")
        sys.exit(1)
    
    try:
        start_date_obj = datetime.datetime.strptime(sys.argv[1], '%Y-%m-%d').date()
        end_date_obj = datetime.datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
    except ValueError:
        print("エラー: 日付の形式が正しくありません。'YYYY-MM-DD' 形式で入力してください。")
        sys.exit(1)

    if start_date_obj > end_date_obj:
        print("エラー: 開始日は終了日より前の日付にしてください。")
        sys.exit(1)
        
    setup_debug_environment()
    run_debug_process(start_date_obj, end_date_obj)