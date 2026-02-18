"""
db.netkeibaからレースIDを取得して、既存のパーサーと互換性があるか詳細検証
"""
import requests
import re
import sys
sys.path.insert(0, '.')
from scripts import parser

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
}

test_date = '20260118'

# db.netkeibaからレースリストを取得
print("=" * 60)
print("Step 1: Fetch race list from db.netkeiba")
print("=" * 60)
url = f'https://db.netkeiba.com/race/list/{test_date}/'
r = requests.get(url, headers=headers, timeout=30)
r.encoding = 'EUC-JP'

print(f"URL: {url}")
print(f"Status: {r.status_code}")
print(f"Length: {len(r.text)} chars\n")

# レースIDを抽出
race_ids = re.findall(r'/race/(\d{12})/', r.text)
unique_ids = list(set(race_ids))
print(f"Unique race IDs found: {len(unique_ids)}")
print(f"All IDs: {sorted(unique_ids)}\n")

# IDの構造を分析
if unique_ids:
    sample_id = unique_ids[0]
    print(f"Sample ID structure: {sample_id}")
    print(f"  Year: {sample_id[:4]}")
    print(f"  Venue: {sample_id[4:6]}")
    print(f"  Kai: {sample_id[6:8]}")
    print(f"  Day: {sample_id[8:10]}")
    print(f"  Race: {sample_id[10:12]}")

# 既存パーサーでテスト
print("\n" + "=" * 60)
print("Step 2: Test with existing parser")
print("=" * 60)

try:
    # parse_race_ids_from_list は race.netkeiba用の可能性が高いので確認
    parsed_ids = parser.parse_race_ids_from_list(r.text)
    print(f"parser.parse_race_ids_from_list result: {len(parsed_ids)} IDs")
    if parsed_ids:
        print(f"Sample: {parsed_ids[:5]}")
except Exception as e:
    print(f"Parser error: {e}")

# 出馬表URL確認
print("\n" + "=" * 60)
print("Step 3: Check if race IDs work with shutuba/result pages")
print("=" * 60)

if unique_ids:
    test_race_id = unique_ids[0]
    
    # 出馬表ページテスト  
    shutuba_url = f'https://race.netkeiba.com/race/shutuba.html?race_id={test_race_id}'
    print(f"\nTesting shutuba page: {shutuba_url}")
    try:
        r_shutuba = requests.get(shutuba_url, headers=headers, timeout=30)
        r_shutuba.encoding = 'EUC-JP'
        
        # 馬情報のマーカーを探す
        markers = ['HorseName', 'Jockey', 'Trainer', 'horse_id=']
        print(f"  Status: {r_shutuba.status_code}")
        print(f"  Length: {len(r_shutuba.text)}")
        for m in markers:
            count = r_shutuba.text.count(m)
            print(f"  '{m}': {count} occurrences")
            
        # 馬IDを抽出
        horse_ids = re.findall(r'horse_id=(\d+)', r_shutuba.text)
        print(f"  Horse IDs found: {len(set(horse_ids))}")
        if horse_ids:
            print(f"  Sample: {list(set(horse_ids))[:5]}")
            
    except Exception as e:
        print(f"  Error: {e}")
    
    # 結果ページテスト
    result_url = f'https://race.netkeiba.com/race/result.html?race_id={test_race_id}'
    print(f"\nTesting result page: {result_url}")
    try:
        r_result = requests.get(result_url, headers=headers, timeout=30)
        r_result.encoding = 'EUC-JP'
        print(f"  Status: {r_result.status_code}")
        print(f"  Length: {len(r_result.text)}")
        
        # 結果データのマーカー
        result_markers = ['Result_Table', 'Payout', 'Odds', 'HorseName']
        for m in result_markers:
            count = r_result.text.count(m)
            print(f"  '{m}': {count} occurrences")
            
    except Exception as e:
        print(f"  Error: {e}")

# NARもテスト
print("\n" + "=" * 60)
print("Step 4: Test NAR races")
print("=" * 60)

nar_url = f'https://nar.netkeiba.com/race/list/{test_date}/'
try:
    r_nar = requests.get(nar_url, headers=headers, timeout=30)
    r_nar.encoding = 'EUC-JP'
    
    nar_race_ids = re.findall(r'/race/(\d{12})/', r_nar.text)
    unique_nar = list(set(nar_race_ids))
    print(f"NAR URL: {nar_url}")
    print(f"Status: {r_nar.status_code}")
    print(f"NAR race IDs found: {len(unique_nar)}")
    if unique_nar:
        print(f"Sample: {sorted(unique_nar)[:5]}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"✅ db.netkeiba.com/race/list/{test_date}/ - Can get {len(unique_ids)} JRA race IDs without Selenium!")
