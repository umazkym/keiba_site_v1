"""
パーサー障害の原因特定: 取得したHTMLの実際のテーブル構造を調査する
"""
import re
from bs4 import BeautifulSoup
from scripts import scraper

def main():
    test_id = "2021102790"  # カラーオブワンダー
    print(f"馬ID: {test_id} のHTMLを取得中...")
    
    html, _ = scraper.get_horse_page_html(test_id, force_download=True)
    if not html:
        print("HTML取得失敗")
        return
    
    print(f"HTML取得成功: {len(html)} bytes")
    
    soup = BeautifulSoup(html, 'lxml')
    
    # ==== 調査1: 全テーブルのclass属性を一覧 ====
    print("\n" + "=" * 70)
    print("【調査1】HTML内の全テーブルのclass属性")
    print("=" * 70)
    
    all_tables = soup.find_all('table')
    print(f"テーブル総数: {len(all_tables)}")
    
    for i, table in enumerate(all_tables):
        classes = table.get('class', [])
        class_str = ' '.join(classes) if classes else '(クラスなし)'
        
        # ヘッダー行の内容
        headers = [th.get_text(strip=True) for th in table.find_all('th')][:10]
        header_str = ', '.join(headers) if headers else '(ヘッダーなし)'
        
        # 行数
        rows = table.find_all('tr')
        
        print(f"\n  テーブル{i+1}: class='{class_str}'")
        print(f"    行数: {len(rows)}")
        print(f"    ヘッダー: {header_str}")
    
    # ==== 調査2: パーサーが期待するテーブルの検索 ====
    print("\n" + "=" * 70)
    print("【調査2】パーサーが期待するテーブルの検索")
    print("=" * 70)
    
    # パーサーと同じ検索条件
    target_tables = soup.find_all('table', class_=re.compile("db_h_race_results|race_table_01"))
    print(f"'db_h_race_results' または 'race_table_01' クラスのテーブル: {len(target_tables)}件")
    
    # 代替パターンも探す
    for pattern in ['nk_tb_common', 'result', 'race', 'horse_race', 'performance']:
        found = soup.find_all('table', class_=re.compile(pattern))
        if found:
            print(f"パターン '{pattern}' に一致するテーブル: {len(found)}件")
            for t in found:
                headers = [th.get_text(strip=True) for th in t.find_all('th')][:10]
                print(f"  class='{' '.join(t.get('class', []))}', ヘッダー: {', '.join(headers)}")
    
    # ==== 調査3: horse_titleの確認 ====
    print("\n" + "=" * 70)
    print("【調査3】horse_title divの確認")
    print("=" * 70)
    
    horse_title_div = soup.find('div', class_='horse_title')
    if horse_title_div:
        h1 = horse_title_div.find('h1')
        print(f"horse_title div: あり")
        print(f"h1: {h1.get_text(strip=True) if h1 else 'なし'}")
    else:
        print("horse_title div: なし")
        # 代替の馬名取得方法を探す
        h1_tags = soup.find_all('h1')
        print(f"ページ内のh1タグ数: {len(h1_tags)}")
        for h1 in h1_tags:
            print(f"  h1: '{h1.get_text(strip=True)}'")
    
    # ==== 調査4: HTMLの冒頭部分を表示 ====
    print("\n" + "=" * 70)
    print("【調査4】HTML冒頭500文字")
    print("=" * 70)
    print(html[:500])
    
    # ==== 調査5: 成績テーブルっぽいものを探す ====
    print("\n" + "=" * 70)
    print("【調査5】成績テーブルの候補（'日付'と'レース名'を含むテーブル）")
    print("=" * 70)
    
    required_headers = {'日付', 'レース名', '着順', '頭数', '人気', '斤量', '騎手', 'タイム'}
    for i, table in enumerate(all_tables):
        header_texts = {th.get_text(strip=True) for th in table.select('tr > th')}
        overlap = header_texts.intersection(required_headers)
        if len(overlap) >= 3:
            print(f"\n  テーブル{i+1}: マッチ数={len(overlap)}/{len(required_headers)}")
            print(f"    class='{' '.join(table.get('class', []))}'")
            print(f"    マッチしたヘッダー: {overlap}")
            print(f"    全ヘッダー: {header_texts}")

if __name__ == "__main__":
    main()
