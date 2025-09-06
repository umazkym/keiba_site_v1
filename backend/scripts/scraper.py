# backend/scripts/scraper.py
import requests
import time
import random
import os
import re
from datetime import date, timedelta, datetime
from typing import Optional, Union, Tuple
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException

try:
    from webdriver_manager.chrome import ChromeDriverManager
    _WDM_AVAILABLE = True
except ImportError:
    _WDM_AVAILABLE = False

# --- BAN対策設定 (安全マージンを広めに設定) ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]
MIN_SLEEP_SECONDS = 2.5
MAX_SLEEP_SECONDS = 5.0
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 10

# Seleniumのページ読み込みタイムアウトを60秒に設定
SELENIUM_PAGE_LOAD_TIMEOUT = 60

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 5 * 60 * 60  # 中4日

# --- キャッシュディレクトリの定義 ---
HTML_DIR = os.path.join("data", "html_cache")
os.makedirs(HTML_DIR, exist_ok=True)


def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _prepare_chrome_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage') # メモリ不足対策
    # GPU関連のエラーメッセージを抑制するためのオプションを追加
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
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

# ==============================================================================
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
def get_html(
    url: str,
    file_path: str,
    force_download: bool = False,
    use_selenium: bool = False,
    max_age_seconds: int = None,
    wait_for_class: str = None,
    target_date: Optional[date] = None,
    driver: Optional[webdriver.Chrome] = None
) -> Tuple[Optional[str], bool]:
    should_force_download = force_download
    if not should_force_download and target_date:
        today_jst = (datetime.utcnow() + timedelta(hours=9)).date()
        yesterday_jst = today_jst - timedelta(days=1)
        if target_date >= yesterday_jst:
            should_force_download = True

    file_path_bin = os.path.splitext(file_path)[0] + ".bin"
    if not should_force_download and os.path.exists(file_path_bin):
        is_stale = False
        if max_age_seconds is not None:
            file_age = time.time() - os.path.getmtime(file_path_bin)
            if file_age > max_age_seconds:
                is_stale = True
        if not is_stale:
            with open(file_path_bin, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                return content, False # キャッシュヒット時はスクレイピングフラグをFalseに

    # --- ここから下はWebアクセスが発生する場合のロジック ---
    for attempt in range(MAX_RETRIES):
        try:
            # Webアクセス直前に待機
            sleep_time = random.uniform(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
            time.sleep(sleep_time)
            
            html_content = None
            if use_selenium:
                # ★★★ 修正箇所1: 呼び出し元から渡されたdriverを優先して使う ★★★
                selenium_driver = driver
                own_driver = False
                if selenium_driver is None:
                    selenium_driver = _prepare_chrome_driver()
                    own_driver = True

                try:
                    selenium_driver.set_page_load_timeout(SELENIUM_PAGE_LOAD_TIMEOUT)
                    selenium_driver.get(url)
                    if wait_for_class:
                        try:
                            WebDriverWait(selenium_driver, 10).until(
                                EC.presence_of_element_located((By.CLASS_NAME, wait_for_class))
                            )
                            html_content = selenium_driver.page_source
                        except TimeoutException:
                            # ★★★ 修正箇所2: Infoログを出力せず、Noneを返して静かに終了 ★★★
                            return None, False
                    else:
                        html_content = selenium_driver.page_source
                finally:
                    # ★★★ 修正箇所3: この関数内で作成したdriverのみ終了する ★★★
                    if own_driver and selenium_driver:
                        selenium_driver.quit()
            else:
                response = requests.get(url, headers=_get_random_headers(), timeout=20)
                response.raise_for_status()
                response.encoding = response.apparent_encoding
                html_content = response.text

            if html_content:
                temp_file_path = file_path_bin + f".tmp.{os.getpid()}"
                try:
                    with open(temp_file_path, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    os.replace(temp_file_path, file_path_bin)
                finally:
                    if os.path.exists(temp_file_path):
                        os.remove(temp_file_path)
                return html_content, True # Webアクセス成功時はスクレイピングフラグをTrueに

        except (requests.RequestException, WebDriverException) as e:
            print(f"[Request Error] Attempt {attempt + 1}/{MAX_RETRIES} for {url} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
    
    print(f"[Request Failed] Could not retrieve URL after {MAX_RETRIES} attempts: {url}")
    return None, False

def get_race_list_html(date_str: str, is_nar: bool, force_download: bool = False, driver: Optional[webdriver.Chrome] = None) -> Tuple[Optional[str], bool]:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
    dir_path = os.path.join(HTML_DIR, "nar_racelist" if is_nar else "racelist")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{date_str}.bin")
    
    target_date = datetime.strptime(date_str, '%Y%m%d').date()
    return get_html(url, file_path, force_download, use_selenium=True, wait_for_class="RaceList_Box", target_date=target_date, driver=driver)

def get_shutuba_html(race_id: str, is_nar: bool, force_download: bool = False) -> Tuple[Optional[str], bool]:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/shutuba.html?race_id={race_id}"
    dir_path = os.path.join(HTML_DIR, "shutuba")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    try:
        target_date = date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
    except ValueError:
        target_date = date.today() # fallback
    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="Shutuba_HorseList", target_date=target_date)

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> Tuple[Optional[str], bool]:
    if is_nar:
        base_url = BASE_NAR_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "nar_race")
    else: # JRA
        base_url = BASE_CENTRAL_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "race_results")

    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    try:
        target_date = date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
    except ValueError:
        target_date = date.today() # fallback
    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="RaceTable01", target_date=target_date)

def get_horse_page_html(
    horse_id: str,
    force_download: bool = False,
    driver: Optional[webdriver.Chrome] = None
) -> Tuple[Optional[str], bool]:
    """馬の過去成績ページ。キャッシュの有効期限(5日)で管理。日付ベースの強制ダウンロードは適用しない。"""
    url = f"{DB_BASE_URL}/horse/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "horse")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(
        url,
        file_path,
        force_download,
        use_selenium=True,
        # この行をコメントアウトすることで、キャッシュの有効期限を無効化する
        # max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS,
        wait_for_class='db_main_race',
        driver=driver
    )

def get_ped_page_html(horse_id: str, force_download: bool = False) -> Tuple[Optional[str], bool]:
    """血統ページ。日付による強制ダウンロードは不要。"""
    url = f"{DB_BASE_URL}/horse/ped/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "ped")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(url, file_path, force_download)

# 以下の関数は `run_pipeline.py` から直接は呼ばれず、
# `db_handler.py` などから呼ばれることを想定しています。
# そのため、返り値の型を `get_html` とは異なり、HTMLコンテンツのみを返すように調整します。
# これにより、他のファイルへの影響を最小限に抑えます。
def get_shutuba_html_content(race_id: str, is_nar: bool, force_download: bool = False) -> Optional[str]:
    content, _ = get_shutuba_html(race_id, is_nar, force_download)
    return content

def get_race_result_html_content(race_id: str, is_nar: bool, force_download: bool = False) -> Optional[str]:
    content, _ = get_race_result_html(race_id, is_nar, force_download)
    return content

# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
# ==============================================================================