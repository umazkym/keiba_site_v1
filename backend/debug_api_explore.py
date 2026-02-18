"""
netkeibaのAjax APIエンドポイントを探索するスクリプト
JavaScriptが使用するAPIを直接叩けないか検証
"""
import requests
import json
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    'X-Requested-With': 'XMLHttpRequest',  # Ajax request header
    'Referer': 'https://race.netkeiba.com/top/race_list.html?kaisai_date=20260118',
}

test_date = '20260118'

# 試すべき可能性のあるAPIエンドポイント
potential_endpoints = [
    # 通常のレース一覧ページ（参考用）
    f'https://race.netkeiba.com/top/race_list.html?kaisai_date={test_date}',
    
    # Ajax APIの可能性があるURL
    f'https://race.netkeiba.com/api/schedule/?date={test_date}',
    f'https://race.netkeiba.com/race/schedule.json?date={test_date}',
    f'https://race.netkeiba.com/top/race_list_ajax.html?kaisai_date={test_date}',
    f'https://race.netkeiba.com/top/race_list_ajax/?kaisai_date={test_date}',
    
    # db.netkeibaのURL
    f'https://db.netkeiba.com/race/list/{test_date}/',
    
    # 開催日一覧を取得
    f'https://race.netkeiba.com/top/calendar.html?year=2026&month=1',
]

print("=== Exploring potential API endpoints ===\n")

for url in potential_endpoints:
    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.encoding = 'EUC-JP'
        
        # レースIDの存在チェック
        has_race_id = bool(re.search(r'race_id[=\/:"\']?\d{12}', r.text))
        race_link_count = len(re.findall(r'/race/\d{12}', r.text))
        
        print(f"URL: {url}")
        print(f"  Status: {r.status_code}")
        print(f"  Length: {len(r.text)}")
        print(f"  Has race_id pattern: {has_race_id}")
        print(f"  Race link patterns found: {race_link_count}")
        
        # コンテンツの一部を表示
        if has_race_id or race_link_count > 0:
            print(f"  ✅ PROMISING!")
            # レースIDを抽出
            race_ids = re.findall(r'/race/(\d{12})', r.text)
            if race_ids:
                unique_ids = list(set(race_ids))
                print(f"  Sample race IDs: {unique_ids[:5]}")
            print(f"  Sample content: {r.text[:500]}")
        print()
        
    except Exception as e:
        print(f"URL: {url}")
        print(f"  Error: {e}")
        print()

# db.netkeibaは異なる構造を使っているか確認
print("\n=== Testing db.netkeiba directly ===\n")
db_url = f'https://db.netkeiba.com/?pid=race_top&date={test_date}'
try:
    r = requests.get(db_url, headers=headers, timeout=10)
    r.encoding = 'EUC-JP'
    race_ids = re.findall(r'/race/(\d{12})/', r.text)
    print(f"URL: {db_url}")
    print(f"Status: {r.status_code}")
    print(f"Length: {len(r.text)}")
    print(f"Unique race IDs: {len(set(race_ids))}")
    if race_ids:
        print(f"Sample IDs: {list(set(race_ids))[:10]}")
except Exception as e:
    print(f"Error: {e}")
