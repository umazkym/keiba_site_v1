# C:\Users\tnszk\program\GitHub\backend\scripts\scraper.py
import requests
import time
import random
import os
import re
from datetime import date, timedelta, datetime
from typing import Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException

try:
    from webdriver_manager.chrome import ChromeDriverManager
    _WDM_AVAILABLE = True
except ImportError:
    _WDM_AVAILABLE = False

# --- BAN対策設定 ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]
MIN_SLEEP_SECONDS = 2.5
MAX_SLEEP_SECONDS = 5.0
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 10

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

# --- キャッシュディレクトリの定義 ---
HTML_DIR = os.path.join("data", "html_cache")
os.makedirs(HTML_DIR, exist_ok=True)
# ... (各ディレクトリの作成処理は省略) ...

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _prepare_chrome_driver():
    # ... (既存のコード)
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    options.add_argument('--log-level=3')
    options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    
    try:
        if _WDM_AVAILABLE:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"[ERROR] ChromeDriverのセットアップに失敗しました: {e}")
        raise
        
    return driver

def get_html(url: str, file_path: str, force_download: bool = False, use_selenium: bool = False, max_age_seconds: int = None, wait_for_class: str = None, target_date: Optional[date] = None) -> str | None:
    # 【案3】新キャッシュ戦略の適用
    # force_download=False(または指定なし)の場合、日付をチェック
    if not force_download and target_date:
        today_jst = (datetime.utcnow() + timedelta(hours=9)).date()
        # 昨日、今日、未来の日付なら強制ダウンロード
        if target_date >= (today_jst - timedelta(days=1)):
            print(f"  -> Cache policy: Target date {target_date} is recent. Forcing download.")
            force_download = True

    file_path_bin = os.path.splitext(file_path)[0] + ".bin"
    if not force_download and os.path.exists(file_path_bin):
        is_stale = False
        if max_age_seconds is not None:
            file_age = time.time() - os.path.getmtime(file_path_bin)
            if file_age > max_age_seconds:
                is_stale = True
        if not is_stale:
            with open(file_path_bin, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

    # ... (リトライ処理を含む既存のダウンロードロジックは変更なし) ...
    for attempt in range(MAX_RETRIES):
        try:
            sleep_time = random.uniform(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
            time.sleep(sleep_time)
            
            # ... (selenium or requestsでの取得処理) ...

            if use_selenium:
                driver = None
                try:
                    driver = _prepare_chrome_driver()
                    driver.get(url)
                    # ... (wait処理) ...
                    html_content = driver.page_source
                finally:
                    if driver:
                        driver.quit()
            else:
                response = requests.get(url, headers=_get_random_headers(), timeout=20)
                response.raise_for_status()
                response.encoding = response.apparent_encoding
                html_content = response.text

            if html_content:
                with open(file_path_bin, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                return html_content

        except Exception as e:
            print(f"[Request Error] Attempt {attempt + 1}/{MAX_RETRIES} for {url} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
    
    print(f"[Request Failed] Could not retrieve URL after {MAX_RETRIES} attempts: {url}")
    return None

def get_race_list_html(date_str: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
    dir_path = os.path.join(HTML_DIR, "nar_racelist" if is_nar else "racelist")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{date_str}.bin")
    
    # 【案3】日付を特定してget_htmlに渡す
    target_date = datetime.strptime(date_str, '%Y%m%d').date()
    return get_html(url, file_path, force_download, use_selenium=True, wait_for_class="RaceList_Box", target_date=target_date)

def get_shutuba_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/shutuba.html?race_id={race_id}"
    dir_path = os.path.join(HTML_DIR, "shutuba")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    # 【案3】race_idから日付を特定してget_htmlに渡す
    try:
        target_date = date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
    except ValueError:
        target_date = date.today() # fallback
    return get_html(url, file_path, force_download, wait_for_class="Shutuba_HorseList", target_date=target_date)

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    # ★★★ ここから修正 ★★★
    # JRAの場合でも、払い戻し情報が確実に解析できる `race.netkeiba.com` を使用するようにURLを統一します。
    if is_nar:
        base_url = BASE_NAR_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "nar_race")
    else: # JRA
        base_url = BASE_CENTRAL_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "race_results")
    # ★★★ ここまで修正 ★★★

    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    try:
        target_date = date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
    except ValueError:
        target_date = date.today() # fallback
    return get_html(url, file_path, force_download, wait_for_class="RaceTable01", target_date=target_date)

def get_horse_page_html(horse_id: str, force_download: bool = False) -> str | None:
    """馬の過去成績ページ。キャッシュの有効期限を設定。日付による強制ダウンロードは不要。"""
    url = f"{DB_BASE_URL}/horse/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "horse")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    # target_dateは指定せず、キャッシュの有効期限(max_age_seconds)で管理
    return get_html(url, file_path, force_download, use_selenium=True, max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS, wait_for_class='db_main_race')

def get_ped_page_html(horse_id: str, force_download: bool = False) -> str | None:
    """血統ページ。日付による強制ダウンロードは不要。"""
    url = f"{DB_BASE_URL}/horse/ped/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "ped")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(url, file_path, force_download)