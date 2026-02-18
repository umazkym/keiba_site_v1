"""
db.netkeibaから馬ページをrequestsで取得できるか検証
現在Seleniumを使っている馬ページ取得を高速化するため
"""
import requests
import re
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

# テスト用の馬ID（先程のデバッグで見つけたもの）
test_horse_ids = ['2023106991', '2023100290', '2023101910']

print("=" * 70)
print("Testing horse page fetching from db.netkeiba")
print("=" * 70)

for horse_id in test_horse_ids[:1]:  # まず1頭でテスト
    print(f"\n[Testing horse ID: {horse_id}]")
    
    # db.netkeibaの馬ページ
    db_url = f'https://db.netkeiba.com/horse/{horse_id}/'
    print(f"URL: {db_url}")
    
    try:
        r = requests.get(db_url, headers=headers, timeout=30)
        r.encoding = 'EUC-JP'
        
        print(f"Status: {r.status_code}")
        print(f"Length: {len(r.text)}")
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # 馬名
        horse_title = soup.select_one('.horse_title h1')
        horse_name = horse_title.get_text(strip=True) if horse_title else "Unknown"
        print(f"Horse name: {horse_name}")
        
        # 過去成績テーブル
        results_table = soup.select_one('table.db_h_race_results')
        if results_table:
            rows = results_table.find_all('tr')
            print(f"Results table rows: {len(rows)}")
        else:
            print("Results table: Not found (might be dynamically loaded)")
            
        # 血統情報
        pedigree_table = soup.select_one('table.blood_table')
        if pedigree_table:
            print("Pedigree table: Found")
        else:
            print("Pedigree table: Not found")
            
        # プロファイル情報
        profile_table = soup.select_one('table.db_prof_table')
        if profile_table:
            print("Profile table: Found")
            # 調教師情報
            trainer_link = profile_table.select_one('a[href*="/trainer/"]')
            if trainer_link:
                print(f"Trainer: {trainer_link.get_text(strip=True)}")
        else:
            print("Profile table: Not found")
            
        # AJAX APIで過去成績を取得できるか確認
        print("\n[Testing AJAX API for performance data]")
        perf_url = f'https://db.netkeiba.com/horse/result/{horse_id}/'
        r_perf = requests.get(perf_url, headers=headers, timeout=30)
        r_perf.encoding = 'EUC-JP'
        print(f"Performance API URL: {perf_url}")
        print(f"Status: {r_perf.status_code}")
        print(f"Length: {len(r_perf.text)}")
        
        # レース結果数を確認
        race_links = re.findall(r'/race/(\d{12})/', r_perf.text)
        print(f"Race links found: {len(set(race_links))}")
        
    except Exception as e:
        print(f"Error: {e}")

# keiba_site_v1で使っているフィールドを確認するため、現在のスクレイパーを見る
print("\n" + "=" * 70)
print("Testing what data we need from horse page")
print("=" * 70)

# 必要なデータは何か？
# keiba_site_v1のrun_pipeline.pyでの使用を確認
# - horse_id
# - 過去成績（必要？）
# - 調教師

# 実際、バックフィル処理で馬ページを取得している理由を確認する必要がある
print("Need to check run_pipeline.py to understand WHY horse pages are needed")
