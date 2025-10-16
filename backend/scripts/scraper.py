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
RETRY_DELAY_SECONDS = 15
SELENIUM_PAGE_LOAD_TIMEOUT = 60  # 90秒→60秒に短縮（タイムアウトが長すぎるとメモリ圧迫）
SELENIUM_IMPLICIT_WAIT = 8  # 暗黙的待機を短縮（netkeiba.comの高速化に対応）
SELENIUM_WAIT_ELEMENT_TIMEOUT = 8  # 要素待機タイムアウト短縮

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 5 * 60 * 60

HTML_DIR = os.path.join("data", "html_cache")
os.makedirs(HTML_DIR, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _prepare_chrome_driver():
    """
    Render環境とローカル環境の両方で動作するように修正されたWebDriver準備関数
    """
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920x1080')
    # ▼▼▼ 修正 ▼▼▼
    options.add_argument('--disable-software-rasterizer') # GPU関連エラーの抑制
    options.add_argument('--log-level=3') # 不要なログ出力を抑制
    options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
    options.add_argument("--disable-blink-features=AutomationControlled") 
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    # ▲▲▲ 修正 ▲▲▲
    options.add_experimental_option('excludeSwitches', ['enable-logging'])
    
    try:
        if _WDM_AVAILABLE and not os.environ.get("RENDER"):
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            driver = webdriver.Chrome(options=options)
        # ▼▼▼ 修正 ▼▼▼
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        # ▲▲▲ 修正 ▲▲▲
    except Exception as e:
        print(f"[ERROR] ChromeDriverのセットアップに失敗しました: {e}")
        raise
        
    return driver

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
                return content, False

    for attempt in range(MAX_RETRIES):
        try:
            sleep_time = random.uniform(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
            time.sleep(sleep_time)
            
            html_content = None
            if use_selenium:
                selenium_driver = driver
                own_driver = False
                if selenium_driver is None:
                    selenium_driver = _prepare_chrome_driver()
                    own_driver = True

                try:
                    selenium_driver.set_page_load_timeout(SELENIUM_PAGE_LOAD_TIMEOUT)
                    selenium_driver.implicitly_wait(SELENIUM_IMPLICIT_WAIT)
                    selenium_driver.get(url)
                    if wait_for_class:
                        try:
                            WebDriverWait(selenium_driver, SELENIUM_WAIT_ELEMENT_TIMEOUT).until(
                                EC.presence_of_element_located((By.CLASS_NAME, wait_for_class))
                            )
                            html_content = selenium_driver.page_source
                        except TimeoutException:
                            return None, False
                    else:
                        html_content = selenium_driver.page_source
                finally:
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
                return html_content, True
        except requests.exceptions.HTTPError as e:
            if 400 <= e.response.status_code < 500:
                print(f"[HTTP Error {e.response.status_code}] for {url}. BANされた可能性があるためリトライを停止します。")
                return None, False
            print(f"[Request Error] Attempt {attempt + 1}/{MAX_RETRIES} for {url} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
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

    # NAR（地方競馬）用に長めのタイムアウトを使用（サーバー応答が遅い傾向）
    if is_nar and driver is None:
        # NARレース一覧はキャッシュがなければ単独処理で新しいドライバーを使用
        nar_driver = _prepare_chrome_driver()
        try:
            # NARは読み込みが遅いため、タイムアウトを90秒に拡張
            result = get_html(url, file_path, force_download, use_selenium=True, wait_for_class="RaceList_Box", target_date=target_date, driver=nar_driver)
            return result
        finally:
            if nar_driver:
                nar_driver.quit()

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
        target_date = date.today()
    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="Shutuba_HorseList", target_date=target_date)

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False) -> Tuple[Optional[str], bool]:
    if is_nar:
        base_url = BASE_NAR_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "nar_race")
    else:
        base_url = BASE_CENTRAL_URL
        url = f"{base_url}/race/result.html?race_id={race_id}"
        dir_path = os.path.join(HTML_DIR, "race_results")

    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    try:
        target_date = date(int(race_id[:4]), int(race_id[6:8]), int(race_id[8:10]))
    except ValueError:
        target_date = date.today()
    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="RaceTable01", target_date=target_date)

def get_horse_page_html(
    horse_id: str,
    force_download: bool = False,
    driver: Optional[webdriver.Chrome] = None
) -> Tuple[Optional[str], bool]:
    url = f"{DB_BASE_URL}/horse/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "horse")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(
        url,
        file_path,
        force_download,
        use_selenium=True,
        wait_for_class='db_main_race',
        driver=driver
    )

def get_ped_page_html(horse_id: str, force_download: bool = False) -> Tuple[Optional[str], bool]:
    url = f"{DB_BASE_URL}/horse/ped/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "ped")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(url, file_path, force_download)

def get_shutuba_html_content(race_id: str, is_nar: bool, force_download: bool = False) -> Optional[str]:
    content, _ = get_shutuba_html(race_id, is_nar, force_download)
    return content

def get_race_result_html_content(race_id: str, is_nar: bool, force_download: bool = False) -> Optional[str]:
    content, _ = get_race_result_html(race_id, is_nar, force_download)
    return content