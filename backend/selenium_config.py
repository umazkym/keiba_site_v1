# backend/selenium_config.py
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def get_chrome_driver():
    """
    Render無料プラン(512MiB)でも動くように最適化したChromeDriver設定
    """
    options = Options()
    
    # ヘッドレスモード（旧方式の方が軽量な場合がある）
    options.add_argument('--headless=old')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
    options.add_argument('--disable-background-timer-throttling')
    options.add_argument('--disable-renderer-backgrounding')
    options.add_argument('--disable-features=TranslateUI')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-logging')
    options.add_argument('--disable-default-apps')
    options.add_argument('--disable-background-networking')
    options.add_argument('--window-size=1280,720')

    # 省メモリ設定
    options.add_argument('--single-process')
    options.add_argument('--no-zygote')

    # User-Agent（軽量ブラウザに偽装してサーバー負荷を軽減）
    options.add_argument(
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    # CI/CD環境かどうか判定
    is_github_actions = os.getenv('GITHUB_ACTIONS') == 'true'

    if is_github_actions:
        options.binary_location = os.getenv('CHROME_BIN', '/usr/bin/chromium')
        service = Service(os.getenv('CHROME_DRIVER', '/usr/bin/chromedriver'))
        driver = webdriver.Chrome(service=service, options=options)
    else:
        # ローカル環境は webdriver-manager を利用
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

    # タイムアウト設定
    driver.implicitly_wait(10)
    driver.set_page_load_timeout(30)

    return driver


def safe_scraping_example(url):
    """
    簡易スクレイピングの例（Render無料枠対応）
    """
    driver = None
    try:
        driver = get_chrome_driver()
        print(f"Accessing URL: {url}")
        driver.get(url)

        # ページ読み込み待ち
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        title = driver.title
        print(f"Page title: {title}")

        return {"success": True, "title": title}

    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "error": str(e)}

    finally:
        if driver:
            driver.quit()
            print("Driver closed successfully")


if __name__ == "__main__":
    result = safe_scraping_example("https://www.example.com")
    print(result)
