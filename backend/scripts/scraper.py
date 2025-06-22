# C:\Users\tnszk\program\keiba-ai-site\backend\scripts\scraper.py
import requests
import time
import random
import os

# ユーザーエージェントリストは #コード から流用
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    # ... 他も追加
]

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"

# --- HTML保存先ディレクトリ ---
HTML_DIR = os.path.join("data", "html_cache")
CENTRAL_RACELIST_DIR = os.path.join(HTML_DIR, "central_racelist")
NAR_RACELIST_DIR = os.path.join(HTML_DIR, "nar_racelist")
RACE_RESULT_DIR = os.path.join(HTML_DIR, "race_results")

# ディレクトリ作成
os.makedirs(CENTRAL_RACELIST_DIR, exist_ok=True)
os.makedirs(NAR_RACELIST_DIR, exist_ok=True)
os.makedirs(RACE_RESULT_DIR, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def get_html(url: str, file_path: str, force_download: bool = False) -> str | None:
    """
    指定されたURLからHTMLを取得する。
    ファイルパスにキャッシュがあればそれを使用する。
    force_download=Trueで強制的に再ダウンロード。
    """
    if not force_download and os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    
    try:
        print(f"Downloading: {url}")
        response = requests.get(url, headers=_get_random_headers(), timeout=20)
        response.raise_for_status()
        response.encoding = response.apparent_encoding # 文字化け対策
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        time.sleep(random.uniform(1.5, 3.0)) # サーバー負荷軽減
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def get_race_list_html_central(date_str: str, force_download: bool = False) -> str | None:
    """ JRAのレースリストページのHTMLを取得 """
    # netkeibaの仕様変更に対応したURL
    url = f"{BASE_CENTRAL_URL}/top/race_list.html?kaisai_date={date_str}"
    file_path = os.path.join(CENTRAL_RACELIST_DIR, f"{date_str}.html")
    return get_html(url, file_path, force_download)

def get_race_list_html_nar(date_str: str, force_download: bool = False) -> str | None:
    """ NARのレースリストページのHTMLを取得 """
    url = f"{BASE_NAR_URL}/top/race_list.html?kaisai_date={date_str}"
    file_path = os.path.join(NAR_RACELIST_DIR, f"{date_str}.html")
    return get_html(url, file_path, force_download)
    
def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    """ レース結果ページのHTMLを取得 """
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/result.html?race_id={race_id}"
    file_path = os.path.join(RACE_RESULT_DIR, f"{race_id}.html")
    return get_html(url, file_path, force_download)

# 他にSeleniumが必要な動的ページがあれば、ここに関数を追加する