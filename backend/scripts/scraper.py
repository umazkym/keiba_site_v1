import requests
import time
import random
import os
import re
import uuid
import tempfile
import shutil
from datetime import date, timedelta, datetime
from typing import Optional, Union, Tuple
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

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
SELENIUM_PAGE_LOAD_TIMEOUT = 120
SELENIUM_ELEMENT_WAIT_TIMEOUT = 30
SELENIUM_CONNECTION_TIMEOUT = 180

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 5 * 60 * 60

HTML_DIR = os.path.join("data", "html_cache")
os.makedirs(HTML_DIR, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def cleanup_chrome_driver(driver):
    """
    Chromeドライバーをクリーンアップし、一時ディレクトリも削除する
    """
    if not driver:
        return
    try:
        driver.quit()
    except Exception:
        pass
    # 一時ディレクトリをクリーンアップ
    if hasattr(driver, '_temp_user_data_dir'):
        temp_dir = driver._temp_user_data_dir
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

def _prepare_chrome_driver():
    """
    Render環境とローカル環境で設定を切り替えるWebDriver準備関数

    Render環境では、ユーザーデータディレクトリが競合しないように一意の一時ディレクトリを使用する
    """
    options = Options()
    is_render = os.getenv("RENDER") == "true"

    # --- 共通設定 ---
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1280x800')
    options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_experimental_option('excludeSwitches', ['enable-logging'])

    # ▼▼▼ 環境に応じた設定切り替え ▼▼▼
    temp_user_data_dir = None
    if is_render:
        # --- Render環境用の超省メモリ設定 ---
        print(" -> Render環境を検出。省メモリ設定を適用します。")
        options.add_argument('--disable-images')
        options.add_experimental_option("prefs", {"profile.managed_default_content_settings.images": 2})
        options.add_argument('--blink-settings=imagesEnabled=false')

        # ユーザーデータディレクトリが競合しないように一意の一時ディレクトリを使用
        temp_user_data_dir = tempfile.mkdtemp(prefix=f"chrome_{uuid.uuid4().hex[:8]}_")
        options.add_argument(f"--user-data-dir={temp_user_data_dir}")
    # ▲▲▲ 修正ここまで ▲▲▲

    driver = None
    try:
        if _WDM_AVAILABLE and not is_render:
            # ローカル環境 (Windows/Mac)
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            # Render環境またはwebdriver-managerがない場合
            driver = webdriver.Chrome(options=options)

        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        # 一時ディレクトリ情報をdriverに付与（クリーンアップ時に使用）
        if temp_user_data_dir:
            driver._temp_user_data_dir = temp_user_data_dir
    except Exception as e:
        print(f"[ERROR] ChromeDriverのセットアップに失敗しました: {e}")
        # エラー時は作成した一時ディレクトリをクリーンアップ
        if temp_user_data_dir and os.path.exists(temp_user_data_dir):
            try:
                shutil.rmtree(temp_user_data_dir, ignore_errors=True)
            except Exception:
                pass
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
                    selenium_driver.set_script_timeout(SELENIUM_CONNECTION_TIMEOUT)
                    selenium_driver.get(url)
                    if wait_for_class:
                        try:
                            WebDriverWait(selenium_driver, SELENIUM_ELEMENT_WAIT_TIMEOUT).until(
                                EC.presence_of_element_located((By.CLASS_NAME, wait_for_class))
                            )
                            html_content = selenium_driver.page_source
                        except TimeoutException:
                            print(f"[Selenium Timeout] 要素 '{wait_for_class}' が見つかりませんでした。ページソースを取得します。")
                            html_content = selenium_driver.page_source
                            if not html_content:
                                return None, False
                    else:
                        html_content = selenium_driver.page_source
                finally:
                    if own_driver and selenium_driver:
                        try:
                            selenium_driver.quit()
                        except Exception:
                            pass
                        # 一時ディレクトリをクリーンアップ
                        if hasattr(selenium_driver, '_temp_user_data_dir'):
                            temp_dir = selenium_driver._temp_user_data_dir
                            if temp_dir and os.path.exists(temp_dir):
                                try:
                                    shutil.rmtree(temp_dir, ignore_errors=True)
                                except Exception:
                                    pass
            else:
                response = requests.get(url, headers=_get_random_headers(), timeout=60)
                response.raise_for_status()
                # ==============================================================================
                # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
                # netkeibaの文字コードはEUC-JPで固定
                response.encoding = 'EUC-JP'
                # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                # ==============================================================================
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
            if e.response.status_code == 429:
                print(f"[HTTP Error 429] Too Many Requests for {url}. 待機してリトライします。")
                retry_after = e.response.headers.get("Retry-After")
                wait_time = int(retry_after) if retry_after else RETRY_DELAY_SECONDS * (attempt + 1)
                time.sleep(wait_time)
                continue
            elif 400 <= e.response.status_code < 500:
                print(f"[HTTP Error {e.response.status_code}] for {url}. BANされた可能性があるためリトライを停止します。")
                return None, False
            print(f"[Request Error] Attempt {attempt + 1}/{MAX_RETRIES} for {url} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
        except TimeoutException as e:
            print(f"[Selenium Timeout] Attempt {attempt + 1}/{MAX_RETRIES}: Seleniumタイムアウト {url}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
            else:
                print(f"[Selenium Timeout] すべてのリトライが失敗しました: {url}")
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
        max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS,
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