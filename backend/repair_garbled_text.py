# backend/repair_garbled_text.py
import os
import sys
import time
import random
import re
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

try:
    from webdriver_manager.chrome import ChromeDriverManager
    _WDM_AVAILABLE = True
except ImportError:
    print("初回実行時、webdriver_managerのインストールが必要な場合があります。 pip install webdriver-manager")
    _WDM_AVAILABLE = False

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

GARBLED_DATA_IDS = {
    "horses": [],
    "jockeys": [
        '01034', '01115', '01124', '01157', '01171', '01178', '01197', 
        '01212', '05212', '05625', '01077', '00666', '01102', '01162', 
        '01208', '01204', '01203', '01209', '01214', '01202', '01190', 
        '01213', '01216', '00689', '01170', '01140', '01186', '01009', 
        '01179', '05386', '05339', '05626'
    ],
    "trainers": [
        '01145', '01110', '01131', '01026', '01143', '01114', '01119', 
        '01169', '01035'
    ]
}

def _prepare_chrome_driver():
    """Selenium WebDriverのインスタンスを準備する"""
    options = Options()
    # ==============================================================================
    # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    # --- 自動化検知を回避するためのオプションを追加 ---
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--log-level=3')
    options.add_argument(f'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    options.add_argument("--disable-blink-features=AutomationControlled") # ★重要: これが自動化を隠す
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    # ==============================================================================
    
    try:
        if _WDM_AVAILABLE:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            driver = webdriver.Chrome(options=options)
        # --- 自動化検知を回避するためのスクリプトを実行 ---
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        print(f"❌ ChromeDriverのセットアップに失敗しました: {e}", file=sys.stderr)
        return None

def get_name_with_selenium(driver, entity_type: str, entity_id: str) -> str | None:
    """Seleniumを使ってポップアップを処理し、netkeiba.comから正しい名前を取得する"""
    try:
        url_map = {
            "jockey": f"https://db.netkeiba.com/jockey/{entity_id}",
            "trainer": f"https://db.netkeiba.com/trainer/profile/{entity_id}"
        }
        url = url_map.get(entity_type)
        if not url: return None

        driver.get(url)

        # ==============================================================================
        # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        # --- 読み込み待機ロジックを根本的に変更 ---
        # 1. まずポップアップがあれば閉じる (タイムアウトしてもエラーにしない)
        try:
            close_button = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.ID, "gn_interstitial_close_icon"))
            )
            close_button.click()
            time.sleep(0.5)
        except TimeoutException:
            pass # ポップアップがなければOK

        # 2. 本体の重要要素（名前が表示されるヘッダー）が表示されるまで最大10秒待つ
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div.db_head_name h1"))
        )
        
        # 3. 待機完了後にHTMLを取得
        html_content = driver.page_source
        # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        # ==============================================================================
        
        soup = BeautifulSoup(html_content, 'lxml')
        
        if "Cannot find block '__global__'" in soup.text or "ページが見つかりません" in soup.text:
            print(f"     [情報] ID {entity_id} のプロフィールページは存在しません。引退の可能性があります。")
            return "(引退・情報なし)"
        
        title_tag = soup.select_one('div.db_head_name h1')
        if title_tag:
            name_text = title_tag.text.strip()
            return re.split(r'[(\s、]', name_text)[0].strip()

        print(f"    [解析エラー] ID {entity_id} のページで名前のHTML要素が見つかりませんでした。")
        return "(情報取得失敗)"

    except TimeoutException: # ページの重要要素が表示されなかった場合
        print(f"     [タイムアウト] ID {entity_id} のページ読み込みに失敗しました。")
        return "(情報取得失敗)"
    except Exception as e:
        print(f"    [予期せぬエラー] ID {entity_id} の処理中にエラー: {e}", file=sys.stderr)
        return None

def repair_database_names_selenium():
    if not DATABASE_URL:
        print("\n❌ エラー: .envファイルにDATABASE_URLが設定されていません。")
        return

    print("\n✅ Selenium (Chrome Driver) を起動しています...")
    driver = _prepare_chrome_driver()
    if not driver: return
        
    print("✅ データベースに接続しています...")
    try:
        engine = create_engine(DATABASE_URL)
        Session = sessionmaker(bind=engine)
        session = Session()
        print("✅ 接続成功。データの修復を開始します。")

        with session.begin():
            if GARBLED_DATA_IDS["jockeys"]:
                print("\n--- [騎手 (jockeys) テーブルの修復] ---")
                for jockey_id in GARBLED_DATA_IDS["jockeys"]:
                    print(f"  -> ID: {jockey_id} を処理中...")
                    correct_name = get_name_with_selenium(driver, "jockey", jockey_id)
                    if correct_name:
                        session.execute(text("UPDATE jockeys SET name = :name WHERE id = :id"), {"name": correct_name, "id": jockey_id})
                        print(f"     ✅ 修正完了: '{correct_name}'")
                    else:
                        print(f"     ❌ 更新スキップ: 正しい名前を取得できませんでした。")

            if GARBLED_DATA_IDS["trainers"]:
                print("\n--- [調教師 (trainers) テーブルの修復] ---")
                for trainer_id in GARBLED_DATA_IDS["trainers"]:
                    print(f"  -> ID: {trainer_id} を処理中...")
                    correct_name = get_name_with_selenium(driver, "trainer", trainer_id)
                    if correct_name:
                        session.execute(text("UPDATE trainers SET name = :name WHERE id = :id"), {"name": correct_name, "id": trainer_id})
                        print(f"     ✅ 修正完了: '{correct_name}'")
                    else:
                        print(f"     ❌ 更新スキップ: 正しい名前を取得できませんでした。")

        print("\n" + "="*80)
        print("🎉 全ての修復処理が完了し、データベースにコミットされました。")
        print("="*80)

    except Exception as e:
        print(f"\n❌ 修復処理中にエラーが発生しました。変更はロールバックされました。: {e}", file=sys.stderr)
    finally:
        if 'session' in locals() and session.is_active:
            session.close()
        if driver:
            driver.quit()
            print("✅ ブラウザドライバを終了しました。")

if __name__ == '__main__':
    repair_database_names_selenium()