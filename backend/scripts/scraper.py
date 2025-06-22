# C:\Users\tnszk\program\GitHub\backend\scripts\scraper.py

import requests
import time
import random
import os
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from tqdm import tqdm

# webdriver_managerの存在確認
try:
    from webdriver_manager.chrome import ChromeDriverManager
    _WDM_AVAILABLE = True
except ImportError:
    _WDM_AVAILABLE = False

# --- 定数 ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]
BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"

# ★★★ キャッシュ有効期限（秒）を追加 ★★★
# 馬の成績ページは鮮度が重要なので、1日（86400秒）でキャッシュ切れとする
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

# --- HTML保存先ディレクトリ ---
HTML_DIR = os.path.join("data", "html_cache")
RACELIST_DIR = os.path.join(HTML_DIR, "racelist")
RACE_RESULT_DIR = os.path.join(HTML_DIR, "race_results")
SHUTUBA_DIR = os.path.join(HTML_DIR, "shutuba")
HORSE_DIR = os.path.join(HTML_DIR, "horse")

for d in [RACELIST_DIR, RACE_RESULT_DIR, SHUTUBA_DIR, HORSE_DIR]:
    os.makedirs(d, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _prepare_chrome_driver():
    ua = random.choice(USER_AGENTS)
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument(f"--user-agent={ua}")
    try:
        driver = webdriver.Chrome(options=options)
    except OSError:
        if _WDM_AVAILABLE:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        else:
            raise Exception("ChromeDriver setup failed. Please install webdriver-manager or ensure chromedriver is in your PATH.")
    return driver

# ★★★ get_html関数にキャッシュ有効期限(max_age_seconds)のチェック機能を追加 ★★★
def get_html(url: str, file_path: str, force_download: bool = False, use_selenium: bool = False, max_age_seconds: int = None) -> str | None:
    if not force_download and os.path.exists(file_path):
        is_stale = False
        # max_age_secondsが指定されている場合のみ、ファイルの鮮度をチェック
        if max_age_seconds is not None:
            file_age = time.time() - os.path.getmtime(file_path)
            if file_age > max_age_seconds:
                is_stale = True
                print(f"Cache for {os.path.basename(file_path)} is stale. Re-downloading...")
        
        # キャッシュが古くなければ、ローカルファイルを返す
        if not is_stale:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

    # ここに到達した場合＝ファイルが存在しない or キャッシュが古い or 強制ダウンロード
    print(f"Downloading: {url}")
    html_content = None
    try:
        if use_selenium:
            driver = _prepare_chrome_driver()
            driver.get(url)
            time.sleep(random.uniform(2.5, 4.0))
            html_content = driver.page_source
            driver.quit()
        else:
            response = requests.get(url, headers=_get_random_headers(), timeout=20)
            response.raise_for_status()
            response.encoding = response.apparent_encoding
            html_content = response.text
            time.sleep(random.uniform(1.5, 3.0))

        if html_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
        return html_content
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def get_race_list_html(date_str: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
    file_path = os.path.join(RACELIST_DIR, f"{'nar' if is_nar else 'jra'}_{date_str}.html")
    return get_html(url, file_path, force_download, use_selenium=True)

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    # レース結果は不変なので、キャッシュ有効期限は設定しない
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/result.html?race_id={race_id}"
    file_path = os.path.join(RACE_RESULT_DIR, f"{race_id}.html")
    return get_html(url, file_path, force_download)

def get_shutuba_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    # 出走表もレース直前まで変更の可能性があるため、キャッシュ有効期限を短めに設定しても良いが、
    # 実行タイミングが1日前なので、今回は都度取得(force_download)を前提とする
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/shutuba.html?race_id={race_id}"
    file_path = os.path.join(SHUTUBA_DIR, f"{race_id}.html")
    return get_html(url, file_path, force_download)

# ★★★ get_horse_page_htmlでキャッシュ有効期限を指定するよう変更 ★★★
def get_horse_page_html(horse_id: str, force_download: bool = False) -> str | None:
    url = f"{DB_BASE_URL}/horse/{horse_id}"
    file_path = os.path.join(HORSE_DIR, f"{horse_id}.html")
    # 汎用関数にキャッシュ有効期限を渡す
    return get_html(url, file_path, force_download, max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS)