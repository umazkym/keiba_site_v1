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
    Render環境とローカル環境の両方で動作するChromeDriverの設定
    """
    options = Options()
    
    # 基本的なヘッドレス設定
    options.add_argument('--headless=new')  # 新しいヘッドレスモード
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-web-security')
    options.add_argument('--disable-features=VizDisplayCompositor')
    options.add_argument('--window-size=1920,1080')
    
    # メモリ最適化
    options.add_argument('--memory-pressure-off')
    options.add_argument('--disable-background-timer-throttling')
    options.add_argument('--disable-renderer-backgrounding')
    options.add_argument('--disable-features=TranslateUI')
    options.add_argument('--disable-ipc-flooding-protection')
    
    # パフォーマンス向上
    options.add_argument('--disable-logging')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-default-apps')
    options.add_argument('--disable-background-networking')
    
    # User-Agentの設定（必要に応じて）
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # Render環境の判定
    is_render = os.getenv('RENDER') is not None
    
    if is_render:
        # Render環境の場合
        options.binary_location = '/usr/bin/google-chrome'
        service = Service('/usr/local/bin/chromedriver')
        driver = webdriver.Chrome(service=service, options=options)
    else:
        # ローカル環境の場合（webdriver-managerを使用）
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
    
    # タイムアウト設定
    driver.implicitly_wait(10)
    driver.set_page_load_timeout(30)
    
    return driver

def safe_scraping_example(url):
    """
    エラーハンドリングを含むスクレイピングの例
    """
    driver = None
    try:
        driver = get_chrome_driver()
        print(f"Accessing URL: {url}")
        driver.get(url)
        
        # ページの読み込み待機
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # スクレイピング処理
        page_title = driver.title
        print(f"Page title: {page_title}")
        
        # ここに実際のスクレイピング処理を記述
        
        return {"success": True, "title": page_title}
        
    except Exception as e:
        print(f"Error during scraping: {str(e)}")
        return {"success": False, "error": str(e)}
        
    finally:
        if driver:
            driver.quit()
            print("Driver closed successfully")

if __name__ == "__main__":
    # テスト実行
    result = safe_scraping_example("https://www.example.com")
    print(result)