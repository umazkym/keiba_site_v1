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
# IP BAN対策: リクエスト間隔を増加（2.5-5.0秒 → 3.0-7.0秒）
MIN_SLEEP_SECONDS = float(os.getenv('MIN_SLEEP_SECONDS', '2.5'))
MAX_SLEEP_SECONDS = float(os.getenv('MAX_SLEEP_SECONDS', '5.0'))
MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
RETRY_DELAY_SECONDS = int(os.getenv('RETRY_DELAY_SECONDS', '15'))

# GitHub Actions 環境ではタイムアウトを独自設定する（アクションの制限時間に収めるため）
if os.getenv('GITHUB_ACTIONS') == 'true':
    SELENIUM_PAGE_LOAD_TIMEOUT = int(os.getenv('SELENIUM_PAGE_LOAD_TIMEOUT', '60'))
    SELENIUM_ELEMENT_WAIT_TIMEOUT = int(os.getenv('SELENIUM_ELEMENT_WAIT_TIMEOUT', '20'))
    SELENIUM_CONNECTION_TIMEOUT = int(os.getenv('SELENIUM_CONNECTION_TIMEOUT', '90'))
else:
    SELENIUM_PAGE_LOAD_TIMEOUT = int(os.getenv('SELENIUM_PAGE_LOAD_TIMEOUT', '120'))
    SELENIUM_ELEMENT_WAIT_TIMEOUT = int(os.getenv('SELENIUM_ELEMENT_WAIT_TIMEOUT', '30'))
    SELENIUM_CONNECTION_TIMEOUT = int(os.getenv('SELENIUM_CONNECTION_TIMEOUT', '180'))

BASE_CENTRAL_URL = "https://race.netkeiba.com"
BASE_NAR_URL = "https://nar.netkeiba.com"
DB_BASE_URL = "https://db.netkeiba.com"
HORSE_HTML_CACHE_MAX_AGE_SECONDS = 24 * 5 * 60 * 60
MOJIBAKE_MARKERS = (
    "\ufffd",
    "縺",
    "繧",
    "譁",
    "蜈",
    "荳",
    "ï¿½",
    "ã",
    "ã",
    "ãƒ",
)

HTML_DIR = os.path.join("data", "html_cache")
os.makedirs(HTML_DIR, exist_ok=True)

def _get_random_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

def _dedupe_encodings(encodings):
    seen = set()
    result = []
    for enc in encodings:
        if not enc:
            continue
        normalized = enc.strip().strip('"').strip("'")
        if not normalized:
            continue
        key = normalized.lower().replace("_", "-")
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result

def _extract_declared_charset(response: requests.Response) -> Optional[str]:
    content_type = response.headers.get("Content-Type", "")
    match = re.search(r"charset\s*=\s*['\"]?([^;'\"]+)", content_type, re.IGNORECASE)
    if match:
        return match.group(1)

    head = response.content[:4096].decode("ascii", errors="ignore")
    match = re.search(r"<meta[^>]+charset\s*=\s*['\"]?([^'\"\s/>]+)", head, re.IGNORECASE)
    if match:
        return match.group(1)

    match = re.search(
        r"<meta[^>]+content\s*=\s*['\"][^'\"]*charset\s*=\s*([^'\";\s/>]+)",
        head,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)

    return None

def _decode_score(text: str) -> int:
    score = text.count("\ufffd") * 1000
    for marker in MOJIBAKE_MARKERS[1:]:
        score += text.count(marker) * 80

    # 日本語ページで日本語文字がほとんど出ないデコードは低品質とみなす。
    japanese_chars = len(re.findall(r"[ぁ-んァ-ヶ一-龥]", text))
    if japanese_chars == 0:
        score += 500
    elif japanese_chars > 30:
        score -= 100

    return score

def _decode_html_response(
    response: requests.Response,
    url: str,
    preferred_encodings: Optional[list] = None,
) -> str:
    """
    netkeiba 系HTMLを、実際のレスポンスに合わせて安全にデコードする。

    race.netkeiba.com / nar.netkeiba.com はUTF-8、db.netkeiba.com はEUC-JPの
    ページが混在するため、単一の固定エンコードにすると当日データの馬名が
    U+FFFD混じりでDBへ保存される。宣言charsetと候補デコードを比較し、
    文字化け指標が最も少ない結果を採用する。
    """
    raw = response.content
    declared = _extract_declared_charset(response)

    site_defaults = ["utf-8", "EUC-JP", "cp932"]
    if "db.netkeiba.com" in url:
        site_defaults = ["EUC-JP", "cp932", "utf-8"]

    candidates = _dedupe_encodings(
        (preferred_encodings or [])
        + [declared, response.encoding, response.apparent_encoding]
        + site_defaults
    )

    decoded_candidates = []
    for encoding in candidates:
        try:
            text = raw.decode(encoding, errors="replace")
        except LookupError:
            continue
        decoded_candidates.append((_decode_score(text), encoding, text))

    if not decoded_candidates:
        return raw.decode("utf-8", errors="replace")

    decoded_candidates.sort(key=lambda item: item[0])
    best_score, best_encoding, best_text = decoded_candidates[0]

    if "\ufffd" in best_text:
        print(
            f"[Warning] Decoded HTML still contains replacement characters "
            f"(url={url}, encoding={best_encoding}, score={best_score})"
        )

    return best_text

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
    is_github_actions = os.getenv("GITHUB_ACTIONS") == "true"

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
    if is_github_actions:
        # --- GitHub Actions 環境設定 ---
        print(" -> GitHub Actions 環境を検出。CI向けの安定化設定を適用します。")
        options.add_argument('--disable-images')
        options.add_experimental_option("prefs", {"profile.managed_default_content_settings.images": 2})
        options.add_argument('--blink-settings=imagesEnabled=false')

        # さらに省メモリ設定を追加
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-plugins')
        options.add_argument('--disable-background-networking')
        options.add_argument('--disable-default-apps')
        options.add_argument('--disable-sync')
        options.add_argument('--disable-translate')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-web-security')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-popup-blocking')
        options.add_argument('--single-process')  # シングルプロセスモード（メモリ節約）
        options.add_argument('--disable-software-rasterizer')

        # 追加のメモリ削減オプション（2024年版）
        options.add_argument('--disable-features=VizDisplayCompositor')
        options.add_argument('--disable-features=NetworkService')
        options.add_argument('--disable-features=site-per-process')
        options.add_argument('--disable-canvas-aa')
        options.add_argument('--disable-2d-canvas-clip-aa')
        options.add_argument('--disable-gl-drawing-for-tests')
        options.add_argument('--disable-accelerated-2d-canvas')
        options.add_argument('--disable-accelerated-jpeg-decoding')
        options.add_argument('--disable-accelerated-mjpeg-decode')
        options.add_argument('--disable-accelerated-video-decode')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-renderer-backgrounding')
        options.add_argument('--disable-breakpad')
        options.add_argument('--disable-component-extensions-with-background-pages')
        options.add_argument('--disable-features=TranslateUI,BlinkGenPropertyTrees')
        options.add_argument('--disable-ipc-flooding-protection')
        options.add_argument('--disable-hang-monitor')
        options.add_argument('--disable-prompt-on-repost')
        options.add_argument('--disable-domain-reliability')
        options.add_argument('--disable-component-update')
        options.add_argument('--no-first-run')
        options.add_argument('--no-default-browser-check')
        options.add_argument('--autoplay-policy=user-gesture-required')
        options.add_argument('--disable-remote-fonts')

        # メモリ制限を明示的に設定（Chrome用）- GitHub Actionsでは余裕があるが安定化のため設定
        options.add_argument('--js-flags=--max-old-space-size=512')
        options.add_argument('--disk-cache-size=1')
        options.add_argument('--media-cache-size=1')
        options.add_argument('--aggressive-cache-discard')
        options.add_argument('--disable-application-cache')

        # ユーザーデータディレクトリが競合しないように一意の一時ディレクトリを使用
        temp_user_data_dir = tempfile.mkdtemp(prefix=f"chrome_{uuid.uuid4().hex[:8]}_")
        options.add_argument(f"--user-data-dir={temp_user_data_dir}")
    # ▲▲▲ 修正ここまで ▲▲▲

    driver = None
    try:
        if _WDM_AVAILABLE and not is_github_actions:
            # ローカル環境 (Windows/Mac)
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            # GitHub Actions 環境またはwebdriver-managerがない場合
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
                html_content = _decode_html_response(response, url)

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
    """
    レース一覧HTMLを取得する。
    
    race_list_sub.html エンドポイントを使用することで、Selenium不要で高速に取得可能。
    既存の race_list.html (Selenium必要) はフォールバックとして残す。
    """
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    
    # 高速版: race_list_sub.html (Selenium不要)
    sub_url = f"{base_url}/top/race_list_sub.html?kaisai_date={date_str}"
    dir_path = os.path.join(HTML_DIR, "nar_racelist" if is_nar else "racelist")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{date_str}.bin")
    
    # キャッシュ確認
    target_date = datetime.strptime(date_str, '%Y%m%d').date()
    today_jst = (datetime.utcnow() + timedelta(hours=9)).date()
    yesterday_jst = today_jst - timedelta(days=1)
    should_force = force_download or target_date >= yesterday_jst
    
    if not should_force and os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read(), False
    
    # リクエストで取得（Selenium不要）
    try:
        sleep_time = random.uniform(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
        time.sleep(sleep_time)
        
        response = requests.get(sub_url, headers=_get_random_headers(), timeout=60)
        html_content = _decode_html_response(response, sub_url, preferred_encodings=['utf-8'])
        
        # 取得成功をチェック（レースIDが含まれているか）
        if html_content and 'race_id=' in html_content:
            # キャッシュに保存
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            return html_content, True
        else:
            print(f"[Warning] race_list_sub.html returned no race data for {date_str}")
            # 当日・未来日: データがまだ公開されていない可能性があるため、
            # 既存の有効なキャッシュを空で上書きしない
            # 過去日: 開催なし確定として空キャッシュで上書き
            if target_date < today_jst:
                try:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write('')
                    print(f"[Info] Cache cleared for {date_str} (past date, no races confirmed)")
                except Exception as write_err:
                    print(f"[Warning] Failed to clear cache for {date_str}: {write_err}")
            else:
                print(f"[Info] Skipping cache clear for {date_str} (today/future - data may not yet be published)")
                # 既存の有効なキャッシュ（race_id=を含む）があればそれを返す
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        existing_content = f.read()
                    if existing_content and 'race_id=' in existing_content:
                        print(f"[Info] Returning existing valid cache for {date_str}")
                        return existing_content, False
            
    except Exception as e:
        print(f"[Warning] Failed to fetch race_list_sub.html: {e}")
    
    # フォールバック: 従来のSelenium版（必要な場合のみ）
    if os.getenv('USE_SELENIUM_FALLBACK', 'false').lower() == 'true':
        print(f"[Fallback] Using Selenium for {date_str}")
        url = f"{base_url}/top/race_list.html?kaisai_date={date_str}"
        return get_html(url, file_path, force_download, use_selenium=True, wait_for_class="RaceList_Box", target_date=target_date, driver=driver)
    
    return None, False

def get_shutuba_html(race_id: str, is_nar: bool, force_download: bool = False, target_date: Optional[date] = None) -> Tuple[Optional[str], bool]:
    base_url = BASE_NAR_URL if is_nar else BASE_CENTRAL_URL
    url = f"{base_url}/race/shutuba.html?race_id={race_id}"
    dir_path = os.path.join(HTML_DIR, "shutuba")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{race_id}.bin")

    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="Shutuba_HorseList", target_date=target_date)

def get_race_result_html(race_id: str, is_nar: bool, force_download: bool = False, target_date: Optional[date] = None) -> Tuple[Optional[str], bool]:
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

    return get_html(url, file_path, force_download, use_selenium=False, wait_for_class="RaceTable01", target_date=target_date)

def get_horse_page_html(
    horse_id: str,
    force_download: bool = False,
    driver: Optional[webdriver.Chrome] = None
) -> Tuple[Optional[str], bool]:
    """
    馬の戦績ページHTMLを取得する。
    
    netkeibaの構造変更により、過去成績テーブルは /horse/result/{id}/ に移動。
    静的HTMLなので、requestsで高速に取得可能。Seleniumは不要。
    """
    url = f"{DB_BASE_URL}/horse/result/{horse_id}/"
    dir_path = os.path.join(HTML_DIR, "horse")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    
    # Seleniumなしで取得（db.netkeibaは静的HTML）
    return get_html(
        url,
        file_path,
        force_download,
        use_selenium=False,  # Selenium不要に変更
        max_age_seconds=HORSE_HTML_CACHE_MAX_AGE_SECONDS,
        wait_for_class=None,  # requestsでは待機不要
        driver=None
    )

def get_ped_page_html(horse_id: str, force_download: bool = False) -> Tuple[Optional[str], bool]:
    url = f"{DB_BASE_URL}/horse/ped/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "ped")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    return get_html(url, file_path, force_download)

def get_shutuba_html_content(race_id: str, is_nar: bool, force_download: bool = False, target_date: Optional[date] = None) -> Optional[str]:
    content, _ = get_shutuba_html(race_id, is_nar, force_download, target_date)
    return content

def get_race_result_html_content(race_id: str, is_nar: bool, force_download: bool = False, target_date: Optional[date] = None) -> Optional[str]:
    content, _ = get_race_result_html(race_id, is_nar, force_download, target_date)
    return content
