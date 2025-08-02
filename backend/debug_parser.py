import requests
import re
from scripts.parser import parse_race_result_page
import pandas as pd
import os
import traceback

# --- 確認したいレースのURLリスト ---
TARGET_URLS = [
    # [要修正] db.netkeiba.com, 新レイアウト -> 成功するはず
    "https://db.netkeiba.com/race/202408030611/",
    # [成功済] race.netkeiba.com, 旧レイアウト, コーナー情報あり
    "https://race.netkeiba.com/race/result.html?race_id=202405020211",
    # [要修正] nar.netkeiba.com, コーナー情報あり -> 成功するはず
    "https://nar.netkeiba.com/race/result.html?race_id=202439060511",
    # [成功済] nar.netkeiba.com, コーナー情報なし
    "https://nar.netkeiba.com/race/result.html?race_id=202448072409",
    # [要修正] db.netkeiba.com, 新レイアウト -> 成功するはず
    "https://db.netkeiba.com/race/202405030211"
]

# ブラウザからのアクセスを偽装するためのヘッダー
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
}

def save_failed_html(race_id: str, html_content: str):
    """解析失敗時にHTMLをファイルに保存する"""
    if not os.path.exists('debug_logs'):
        os.makedirs('debug_logs')
    filename = f"debug_logs/failed_page_{race_id}.html"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"[情報] 解析に失敗したため、HTMLを {filename} に保存しました。")
    except IOError as e:
        print(f"[エラー] HTMLファイルの保存中にエラーが発生しました: {e}")

def main():
    """指定されたURLのレース結果を解析し、整形して表示する"""
    print("--- デバッグ実行開始 ---")
    for i, url in enumerate(TARGET_URLS):
        print("\n" + "="*80)
        print(f"[{i+1}/{len(TARGET_URLS)}] URL処理中: {url}")
        print("="*80)
        html_content = ""
        race_id = ""
        try:
            match = re.search(r'race_id=([a-zA-Z0-9_]+)|race/([a-zA-Z0-9_]+)', url)
            if not match:
                print(f"[エラー] URLからrace_idを抽出できません。")
                continue
            race_id = next((g for g in match.groups() if g is not None), None).replace('/', '')

            response = requests.get(url, headers=HEADERS, timeout=10)
            response.raise_for_status()
            response.encoding = response.apparent_encoding
            html_content = response.text
            
            parsed_data = parse_race_result_page(html_content, race_id)

            if not parsed_data or 'results' not in parsed_data or not parsed_data['results']:
                print("[警告] 解析データが見つかりませんでした。")
                save_failed_html(race_id, html_content)
                continue

            race_info = parsed_data.get('race_info', {})
            results_df = pd.DataFrame(parsed_data['results'])
            
            race_title = race_info.get('race_name', 'N/A')
            course_info = f"{race_info.get('course_type', '')}{race_info.get('distance', '')}m"
            print(f"【レース情報】: {race_title} ({course_info})")
            print("【解析結果】")

            display_columns = ['rank', 'horse_number', 'horse_name', 'corner_positions', 'start_1c_indicator']
            existing_columns = [col for col in display_columns if col in results_df.columns]
            
            pd.set_option('display.max_rows', 50)
            pd.set_option('display.width', 120)
            pd.set_option('display.unicode.east_asian_width', True)

            print(results_df[existing_columns].to_string(index=False))
        except requests.RequestException as e:
            print(f"[致命的エラー] URLへのアクセス中にエラーが発生: {e}")
        except Exception:
            print(f"[致命的エラー] 解析中に予期せぬエラーが発生しました。")
            traceback.print_exc()
            if race_id and html_content:
                save_failed_html(race_id, html_content)
    print("\n--- デバッグ実行終了 ---")

if __name__ == '__main__':
    main()
