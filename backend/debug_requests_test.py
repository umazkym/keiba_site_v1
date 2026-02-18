"""
requestsでnetkeibaのレース一覧ページを取得し、
パーサーで処理できるかを詳細に検証するスクリプト
"""
import requests
import sys
sys.path.insert(0, '.')
from scripts import parser

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    'Connection': 'keep-alive',
    'Referer': 'https://race.netkeiba.com/',
}

# テスト対象の日付
test_date = '20260118'
url = f'https://race.netkeiba.com/top/race_list.html?kaisai_date={test_date}'

print(f"=== Testing URL: {url} ===\n")

try:
    r = requests.get(url, headers=headers, timeout=30)
    r.encoding = 'EUC-JP'
    
    print(f"Status Code: {r.status_code}")
    print(f"Response Length: {len(r.text)} characters")
    print(f"Content-Type: {r.headers.get('Content-Type', 'N/A')}")
    print()
    
    # 重要なマーカーの確認
    markers = ['RaceList_Box', 'RaceList_DataList', 'RaceList_Item', 'race_id=', 'RaceData']
    print("=== Marker Check ===")
    for marker in markers:
        found = marker in r.text
        count = r.text.count(marker) if found else 0
        print(f"  {marker}: {'✅ Found' if found else '❌ Not Found'} ({count} occurrences)")
    print()
    
    # HTMLの最初の部分を表示
    print("=== HTML Preview (first 3000 chars) ===")
    print(r.text[:3000])
    print()
    
    # パーサーでレースIDを抽出してみる
    if len(r.text) > 100:
        print("=== Parser Test ===")
        try:
            race_ids = parser.parse_race_ids_from_list(r.text)
            print(f"Extracted race IDs: {len(race_ids)} races found")
            if race_ids:
                print(f"Sample IDs: {race_ids[:5]}")
            else:
                print("No race IDs extracted!")
        except Exception as e:
            print(f"Parser error: {e}")
    else:
        print("Response too short to parse")
        
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
