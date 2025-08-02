import requests
import sys
import random

# netkeiba.comへのアクセスに使用するヘッダー情報
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

def _get_random_headers():
    """ランダムなUser-Agentを返す"""
    return {"User-Agent": random.choice(USER_AGENTS)}

def save_html_for_debug(url: str, output_filename: str):
    """指定されたURLからHTMLをダウンロードし、ファイルに保存する"""
    print(f"\n--- デバッグ用のHTMLを取得します ---")
    print(f"URL: {url}")
    print(f"出力ファイル: {output_filename}")
    
    try:
        # ページにアクセスしてHTMLを取得
        response = requests.get(url, headers=_get_random_headers(), timeout=20)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        html_content = response.text

        # 取得したHTMLをファイルに書き出す
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print("\n[成功] HTMLをファイルに保存しました。")
        print(f"次の手順: '{output_filename}' をテキストエディタで開き、その内容をすべてコピーして、私に返信してください。")

    except requests.RequestException as e:
        print(f"\n[エラー] ページのダウンロードに失敗しました: {e}")
    except IOError as e:
        print(f"\n[エラー] ファイルの保存に失敗しました: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("\n使い方: python backend/debug_save_html.py <URL> <出力ファイル名.html>")
        print("\n例1 (馬の過去成績ページ):")
        print("python backend/debug_save_html.py https://db.netkeiba.com/horse/2017100583 horse_page.html")
        print("\n例2 (地方競馬の出走表ページ):")
        print("python backend/debug_save_html.py https://nar.netkeiba.com/race/shutuba.html?race_id=202444061211 nar_shutuba_page.html")
        sys.exit(1)
        
    target_url = sys.argv[1]
    output_file = sys.argv[2]
    
    save_html_for_debug(target_url, output_file)