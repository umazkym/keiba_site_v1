# C:\Users\tnszk\program\GitHub\backend\debug_scraper.py
import sys
import pprint
from scripts import scraper, parser

def investigate_url(url: str):
    """
    指定された単一のURLに対して、スクレイピングとパーシングを試み、
    結果をコンソールに表示するデバッグ用関数。
    """
    print("=" * 50)
    print(f"調査対象URL: {url}")
    print("=" * 50)

    # URLの種類を判定
    is_nar = "nar.netkeiba.com" in url
    
    # ページの種類を判定
    if "result.html" in url:
        print(">>> レース結果ページの調査を開始します...")
        # ★★★★★ 修正箇所 ★★★★★
        # race_idを scraper の関数を呼び出す前に定義する
        race_id = url.split("race_id=")[-1]
        html_content = scraper.get_race_result_html(race_id, is_nar, force_download=True)
        
        if html_content:
            print(">>> HTMLの取得に成功しました。パーシング（情報抽出）を試みます...")
            parsed_data = parser.parse_race_result_page(html_content, race_id)
            
            if parsed_data:
                print(">>> パーシング成功！抽出されたデータを確認してください：")
                pprint.pprint(parsed_data)
            else:
                print("[エラー] パーシングに失敗しました。HTMLの内容が想定と違う可能性があります。")
        else:
            print("[エラー] HTMLの取得に失敗しました。")

    elif "shutuba.html" in url:
        print(">>> 出馬表ページの調査を開始します...")
        race_id = url.split("race_id=")[-1]
        html_content = scraper.get_shutuba_html(race_id, is_nar, force_download=True)
        if html_content:
            print(">>> HTMLの取得に成功しました。パーシング（情報抽出）を試みます...")
            parsed_data = parser.parse_shutuba_page(html_content, race_id, is_nar)
            if parsed_data:
                print(">>> パーシング成功！抽出されたデータを確認してください：")
                pprint.pprint(parsed_data)
            else:
                print("[エラー] パーシングに失敗しました。HTMLの内容が想定と違う可能性があります。")
        else:
            print("[エラー] HTMLの取得に失敗しました。")

    else:
        print("[エラー] 調査対象外のURL形式です。'result.html'または'shutuba.html'のURLを指定してください。")


if __name__ == '__main__':
    # コマンドラインからURLを受け取る
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        investigate_url(target_url)
    else:
        print("調査したいnetkeibaのURLをコマンドの引数として指定してください。")
        print("例: python backend/debug_scraper.py https://race.netkeiba.com/race/result.html?race_id=202405020101")