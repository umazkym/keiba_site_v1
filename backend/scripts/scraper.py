# C:\Users\tnszk\program\GitHub\backend\scripts\scraper.py
import requests
import time
import random
import os
import re
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

# --- 変更点: BAN対策設定 ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
]
MIN_SLEEP_SECONDS = 2.5
MAX_SLEEP_SECONDS = 5.0
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 10
# --- 変更点ここまで ---

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

# --- キャッシュディレクトリの定義 ---
HTML_DIR = os.path.join("data", "html_cache")
RACELIST_DIR = os.path.join(HTML_DIR, "racelist")
RACE_RESULT_DIR = os.path.join(HTML_DIR, "race_results")
SHUTUBA_DIR = os.path.join(HTML_DIR, "shutuba")
HORSE_DIR = os.path.join(HTML_DIR, "horse")
PED_DIR = os.path.join(HTML_DIR, "ped")
NAR_RACELIST_DIR = os.path.join(HTML_DIR, "nar_racelist")
NAR_RACE_DIR = os.path.join(HTML_DIR, "nar_race")
DATELIST_DIR = os.path.join(HTML_DIR, "datelist")
NAR_DATELIST_DIR = os.path.join(HTML_DIR, "nar_datelist")

for d in [RACELIST_DIR, RACE_RESULT_DIR, SHUTUBA_DIR, HORSE_DIR, PED_DIR, NAR_RACELIST_DIR, NAR_RACE_DIR, DATELIST_DIR, NAR_DATELIST_DIR]:
    os.makedirs(d, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _prepare_chrome_driver():
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
        print("webdriver-managerがインストールされているか確認してください: pip install webdriver-manager")
        raise
        
    return driver

def get_html(url: str, file_path: str, force_download: bool = False, use_selenium: bool = False, max_age_seconds: int = None, wait_for_class: str = None) -> str | None:
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

    print(f"Downloading: {url}")
    html_content = None
    
    # --- 変更点: リトライ処理の導入 ---
    for attempt in range(MAX_RETRIES):
        try:
            # リクエスト前にランダムな待機時間を挿入
            sleep_time = random.uniform(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
            print(f"  ... Waiting for {sleep_time:.2f} seconds before request (Attempt {attempt + 1}/{MAX_RETRIES})")
            time.sleep(sleep_time)

            if use_selenium:
                driver = None
                try:
                    driver = _prepare_chrome_driver()
                    driver.get(url)
                    if wait_for_class:
                        try:
                            WebDriverWait(driver, 10).until(
                                EC.presence_of_element_located((By.CLASS_NAME, wait_for_class))
                            )
                            time.sleep(random.uniform(1, 2)) # 要素表示後の待機
                        except TimeoutException:
                            print(f"[Warning] Selenium timed out waiting for class '{wait_for_class}' at {url}")
                    else:
                        time.sleep(random.uniform(3, 5))
                    html_content = driver.page_source
                finally:
                    if driver:
                        driver.quit()
            else:
                response = requests.get(url, headers=_get_random_headers(), timeout=20)
                response.raise_for_status()
                response.encoding = response.apparent_encoding
                html_content = response.text
            
            if "ただいま大変混み合っております。" in html_content or "混み合っているため、しばらく時間をおいてから再度アクセスしてください。" in html_content:
                print(f"  -> Congestion page detected. Retrying...")
                html_content = None # コンテンツをクリアしてリトライさせる
                raise requests.exceptions.HTTPError(f"Congestion page detected at {url}")

            if html_content:
                with open(file_path_bin, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                return html_content

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else 500
            print(f"[Request Error] HTTP {status_code} for {url}. Retrying...")
            if status_code in [403, 429] or "Congestion page" in str(e):
                print(f"  -> Status {status_code} is critical. Waiting longer before retry...")
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1) * 2) # 待機時間をさらに増やす
            elif status_code == 404:
                print("  -> Page not found (404). No more retries for this URL.")
                return None # 404ならリトライしない
        except requests.RequestException as e:
            print(f"[Request Error] Failed to get page {url} on attempt {attempt + 1}: {e}")
        except Exception as e:
             print(f"[Unexpected Error] in get_html for {url}: {e}")

        if attempt < MAX_RETRIES - 1:
            wait_time = RETRY_DELAY_SECONDS * (attempt + 1)
            print(f"  ... Waiting for {wait_time} seconds before next attempt...")
            time.sleep(wait_time)
            
    print(f"[Request Failed] Could not retrieve URL after {MAX_RETRIES} attempts: {url}")
    return None
    # --- 変更点ここまで ---

def get_race_list_html(date_str: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
    dir_path = NAR_RACELIST_DIR if is_nar else RACELIST_DIR
    file_path = os.path.join(dir_path, f"{date_str}.bin")
    return get_html(url, file_path, force_download, use_selenium=True, wait_for_class="RaceList_Box")

def get_shutuba_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/shutuba.html?race_id={race_id}"
    file_path = os.path.join(SHUTUBA_DIR, f"{race_id}.bin")
    return get_html(url, file_path, force_download, wait_for_class="Shutuba_HorseList")

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> str | None:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    # 新しいdb.netkeiba.comのURL形式に対応
    if not is_nar and (race_id.startswith("20") and len(race_id) == 12):
        url = f"{DB_BASE_URL}/race/{race_id}"
    else:
        url = f"{base_url}/race/result.html?race_id={race_id}"
    dir_path = NAR_RACE_DIR if is_nar else RACE_RESULT_DIR
    file_path = os.path.join(dir_path, f"{race_id}.bin")
    return get_html(url, file_path, force_download, wait_for_class="RaceTable01")

def get_horse_page_html(horse_id: str, force_download: bool = False) -> str | None:
    """馬の過去成績ページを取得。JavaScriptで描画されるためSeleniumを使用する。"""
    url = f"{DB_BASE_URL}/horse/{horse_id}"
    file_path = os.path.join(HORSE_DIR, f"{horse_id}.bin")
    # 'db_main_race' はJSで過去成績テーブルが読み込まれるコンテナのクラス名
    return get_html(url, file_path, force_download, use_selenium=True, max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS, wait_for_class='db_main_race')

def get_ped_page_html(horse_id: str, force_download: bool = False) -> str | None:
    url = f"{DB_BASE_URL}/horse/ped/{horse_id}"
    file_path = os.path.join(PED_DIR, f"{horse_id}.bin")
    return get_html(url, file_path, force_download)