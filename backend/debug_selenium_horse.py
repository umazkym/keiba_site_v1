"""
Seleniumで馬ページを取得し、動的ロード後のHTML構造を確認する
"""
import re
from bs4 import BeautifulSoup
from scripts.scraper import get_html, _prepare_chrome_driver, cleanup_chrome_driver
import os

HTML_DIR = os.path.join("data", "html_cache")

def main():
    horse_id = "2021102790"  # カラーオブワンダー
    url = f"https://db.netkeiba.com/horse/{horse_id}"
    dir_path = os.path.join(HTML_DIR, "horse_selenium_test")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{horse_id}.bin")
    
    print(f"Seleniumで馬ページを取得: {url}")
    
    driver = _prepare_chrome_driver()
    try:
        html, was_scraped = get_html(
            url,
            file_path,
            force_download=True,
            use_selenium=True,
            wait_for_class="db_h_race_results",  # まず従来のクラスを試す
            driver=driver
        )
        
        if not html:
            print("HTML取得失敗")
            return
        
        print(f"HTML取得成功: {len(html)} bytes (was_scraped={was_scraped})")
        
        soup = BeautifulSoup(html, 'lxml')
        
        # テーブル一覧
        all_tables = soup.find_all('table')
        print(f"\nテーブル総数: {len(all_tables)}")
        
        for i, table in enumerate(all_tables):
            classes = table.get('class', [])
            class_str = ' '.join(classes) if classes else '(クラスなし)'
            headers = [th.get_text(strip=True) for th in table.find_all('th')][:10]
            rows = table.find_all('tr')
            print(f"\n  テーブル{i+1}: class='{class_str}', 行数: {len(rows)}")
            print(f"    ヘッダー: {', '.join(headers) if headers else '(なし)'}")

        # パーサーと同じ検索
        required_headers = {'日付', 'レース名', '着順', '頭数', '人気', '斤量', '騎手', 'タイム'}
        target_tables = soup.find_all('table', class_=re.compile("db_h_race_results|race_table_01"))
        print(f"\nパーサー対象テーブル (db_h_race_results|race_table_01): {len(target_tables)}件")
        
        for i, table in enumerate(all_tables):
            header_texts = {th.get_text(strip=True) for th in table.select('tr > th')}
            overlap = header_texts.intersection(required_headers)
            if len(overlap) >= 3:
                print(f"\n  成績テーブル候補{i+1}: マッチ={len(overlap)}/{len(required_headers)}")
                print(f"    class='{' '.join(table.get('class', []))}'")
                print(f"    マッチヘッダー: {overlap}")
                print(f"    全ヘッダー: {header_texts}")
                
                # 最初の数行のデータを表示
                data_rows = table.find_all('tr')[1:4]
                for j, row in enumerate(data_rows):
                    cols = [td.get_text(strip=True)[:15] for td in row.find_all('td')]
                    print(f"    データ行{j+1}: {cols[:8]}")
    finally:
        cleanup_chrome_driver(driver)

if __name__ == "__main__":
    main()
