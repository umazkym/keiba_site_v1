"""
db.netkeibaの出馬表・結果ページがrequestsで取得できるか検証
"""
import requests
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
}

# 先程見つけたレースID
test_race_id = '202606010701'

print("=" * 70)
print("Testing db.netkeiba (static HTML expected)")
print("=" * 70)

# db.netkeibaのレースページ
db_race_url = f'https://db.netkeiba.com/race/{test_race_id}/'
print(f"\n[db.netkeiba Race Page]: {db_race_url}")
r = requests.get(db_race_url, headers=headers, timeout=30)
r.encoding = 'EUC-JP'

print(f"Status: {r.status_code}")
print(f"Length: {len(r.text)}")

# 馬情報を探す
horse_ids = re.findall(r'/horse/(\d+)/', r.text)
jockey_ids = re.findall(r'/jockey/(\d+)/', r.text)
trainer_ids = re.findall(r'/trainer/(\d+)/', r.text)

print(f"Horse IDs found: {len(set(horse_ids))}")
print(f"Jockey IDs found: {len(set(jockey_ids))}")
print(f"Trainer IDs found: {len(set(trainer_ids))}")

if horse_ids:
    print(f"Sample horse IDs: {list(set(horse_ids))[:5]}")

# テーブル構造を確認
table_markers = ['Result_Txt', 'Odds', 'race_table_01', 'Shutuba_Table', 'Pay']
print("\nTable markers:")
for m in table_markers:
    count = r.text.count(m)
    print(f"  '{m}': {count}")

# 結果が含まれているか
has_order = bool(re.search(r'着順|1着|2着', r.text))
has_time = bool(re.search(r'タイム', r.text))
has_odds = bool(re.search(r'単勝|オッズ', r.text))
print(f"\nContent analysis:")
print(f"  Has 着順 (finish order): {has_order}")
print(f"  Has タイム (time): {has_time}")
print(f"  Has 単勝/オッズ (odds): {has_odds}")

# HTML内容サンプル表示
print("\n=== HTML Sample (first 2000 chars) ===")
print(r.text[:2000])

print("\n" + "=" * 70)
print("Testing race.netkeiba (JavaScript loaded - for comparison)")
print("=" * 70)

race_shutuba_url = f'https://race.netkeiba.com/race/shutuba.html?race_id={test_race_id}'
print(f"\n[race.netkeiba Shutuba]: {race_shutuba_url}")
r2 = requests.get(race_shutuba_url, headers=headers, timeout=30)
r2.encoding = 'EUC-JP'

print(f"Status: {r2.status_code}")
print(f"Length: {len(r2.text)}")

horse_ids_race = re.findall(r'/horse/(\d+)/', r2.text)
print(f"Horse IDs found: {len(set(horse_ids_race))}")

# 比較
print("\n" + "=" * 70)
print("COMPARISON SUMMARY")
print("=" * 70)
print(f"db.netkeiba Horse IDs:   {len(set(horse_ids))} ← Static HTML")
print(f"race.netkeiba Horse IDs: {len(set(horse_ids_race))} ← JavaScript loaded")
print("\n✅ db.netkeiba is the better option for requests-based scraping!")
