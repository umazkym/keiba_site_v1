"""
NAR（地方競馬）のdb.netkeiba対応を検証
"""
import requests
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

test_date = '20260118'

print("=" * 70)
print("NAR Race List Testing")
print("=" * 70)

# 試すべきURL
urls_to_test = [
    f'https://db.netkeiba.com/race/list/{test_date}/',         # JRA - 既に成功
    f'https://nar.netkeiba.com/race/list/{test_date}/',         # NAR variant 1
    f'https://db.netkeiba.com/?pid=race_list&kaisai_date={test_date}',  # Alternate format
]

for url in urls_to_test:
    print(f"\n[Testing]: {url}")
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.encoding = 'EUC-JP'
        
        race_ids = re.findall(r'/race/(\d{12})/', r.text)
        unique_ids = list(set(race_ids))
        
        print(f"  Status: {r.status_code}")
        print(f"  Length: {len(r.text)}")
        print(f"  Race IDs: {len(unique_ids)}")
        
        if unique_ids:
            # JRAとNARを区別（場所コードで判断）
            jra_ids = [rid for rid in unique_ids if rid[4:6] in ['01','02','03','04','05','06','07','08','09','10']]
            nar_ids = [rid for rid in unique_ids if rid not in jra_ids]
            print(f"  JRA IDs: {len(jra_ids)}")
            print(f"  NAR IDs: {len(nar_ids)}")
            if nar_ids[:5]:
                print(f"  Sample NAR: {nar_ids[:5]}")
    except Exception as e:
        print(f"  Error: {e}")

# nar.netkeibaのレースページを直接テスト
print("\n" + "=" * 70)
print("NAR Race Page Direct Test")
print("=" * 70)

# db.netkeiba.comにNARレースIDでアクセス（NARのレースIDを仮定）
# 場所コードが30以上はNAR
nar_race_id_sample = '202643011801'  # 仮のNARレースID
print(f"\n[Testing NAR race page]: https://db.netkeiba.com/race/{nar_race_id_sample}/")
try:
    r = requests.get(f'https://db.netkeiba.com/race/{nar_race_id_sample}/', headers=headers, timeout=30)
    r.encoding = 'EUC-JP'
    print(f"  Status: {r.status_code}")
    print(f"  Length: {len(r.text)}")
    
    horse_ids = re.findall(r'/horse/(\d+)/', r.text)
    print(f"  Horse IDs: {len(set(horse_ids))}")
except Exception as e:
    print(f"  Error: {e}")

# nar.netkeibaからレースリスト
print("\n" + "=" * 70)
print("Trying nar.netkeiba with various URL patterns")
print("=" * 70)

nar_urls = [
    f'https://nar.netkeiba.com/top/race_list.html?kaisai_date={test_date}',
    f'https://nar.netkeiba.com/?pid=race_list&kaisai_date={test_date}',
]

for url in nar_urls:
    print(f"\n[Testing]: {url}")
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.encoding = 'EUC-JP'
        
        race_ids = re.findall(r'/race/(\d{12})', r.text)
        race_ids2 = re.findall(r'race_id=(\d{12})', r.text)
        
        print(f"  Status: {r.status_code}")
        print(f"  Length: {len(r.text)}")
        print(f"  Race IDs (path): {len(set(race_ids))}")
        print(f"  Race IDs (param): {len(set(race_ids2))}")
        
        # HTMLを少し見る
        if len(r.text) > 100:
            print(f"  Preview: {r.text[:300]}")
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "=" * 70)
print("Summary")  
print("=" * 70)
print("db.netkeiba.com/race/list/{DATE}/ contains both JRA and NAR races!")
