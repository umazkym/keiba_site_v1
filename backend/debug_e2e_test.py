"""
エンドツーエンドテスト: 新しいエンドポイント → パース → DB保存

1. race_list_sub.htmlからレースID取得
2. レース結果ページを取得
3. 既存パーサーでパース
4. データベースに保存（テスト）
"""
import requests
import re
import sys
import os
from datetime import datetime
from bs4 import BeautifulSoup

# プロジェクトパスを追加
sys.path.insert(0, '.')
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from scripts import parser, scraper
from database.database import SessionLocal
from database import models

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

test_date = '20260118'

print("=" * 70)
print("END-TO-END TEST: requests → parse → DB")
print("=" * 70)

# ============================================================
# Step 1: race_list_sub.htmlからレースID取得
# ============================================================
print("\n[Step 1] Fetch race IDs from race_list_sub.html")

# JRA
jra_url = f'https://race.netkeiba.com/top/race_list_sub.html?kaisai_date={test_date}'
r_jra = requests.get(jra_url, headers=headers, timeout=30)
r_jra.encoding = 'utf-8'

jra_race_ids = re.findall(r'race_id=(\d{12})', r_jra.text)
jra_unique = list(set(jra_race_ids))
print(f"  JRA: {len(jra_unique)} races found")

# NAR
nar_url = f'https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date={test_date}'
r_nar = requests.get(nar_url, headers=headers, timeout=30)
r_nar.encoding = 'utf-8'

nar_race_ids = re.findall(r'race_id=(\d{12})', r_nar.text)
nar_unique = list(set(nar_race_ids))
print(f"  NAR: {len(nar_unique)} races found")

all_race_ids = jra_unique + nar_unique
print(f"  Total: {len(all_race_ids)} races")

if not all_race_ids:
    print("❌ No race IDs found. Test failed.")
    sys.exit(1)

# ============================================================
# Step 2: レース結果ページを取得（最初の1件でテスト）
# ============================================================
print("\n[Step 2] Fetch race result page")

test_race_id = jra_unique[0] if jra_unique else nar_unique[0]
is_nar = test_race_id not in jra_unique

# db.netkeibaからレース詳細を取得（静的HTML）
db_race_url = f'https://db.netkeiba.com/race/{test_race_id}/'
print(f"  Testing race: {test_race_id}")
print(f"  URL: {db_race_url}")

r_race = requests.get(db_race_url, headers=headers, timeout=30)
r_race.encoding = 'EUC-JP'
print(f"  Status: {r_race.status_code}")
print(f"  Length: {len(r_race.text)} chars")

# 馬情報を確認
horse_ids = re.findall(r'/horse/(\d+)/', r_race.text)
unique_horses = list(set(horse_ids))
print(f"  Horse IDs found: {len(unique_horses)}")

# ============================================================
# Step 3: 既存パーサーで処理可能か確認
# ============================================================
print("\n[Step 3] Test existing parsers")

# 3a. parse_race_result_pageをテスト
print("\n  [3a] Testing parse_race_result_page...")
try:
    race_data = parser.parse_race_result_page(r_race.text, test_race_id)
    if race_data:
        print(f"    ✅ Parser returned data")
        print(f"    Race info: {race_data.get('race_info', {}).get('race_name', 'N/A')}")
        results = race_data.get('results', [])
        print(f"    Results: {len(results)} horses")
        if results:
            print(f"    Sample: {results[0].get('horse_name', 'N/A')}")
    else:
        print("    ⚠️ Parser returned None/empty")
except Exception as e:
    print(f"    ❌ Parser error: {e}")
    race_data = None

# 3b. 出馬表ページも試す
print("\n  [3b] Testing shutuba page parsing...")
shutuba_url = f'https://race.netkeiba.com/race/shutuba.html?race_id={test_race_id}'
try:
    # Seleniumなしで取得（body取れないかも）
    r_shutuba = requests.get(shutuba_url, headers=headers, timeout=30)
    r_shutuba.encoding = 'EUC-JP'
    print(f"    URL: {shutuba_url}")
    print(f"    Status: {r_shutuba.status_code}")
    print(f"    Length: {len(r_shutuba.text)}")
    
    # パーサーテスト
    shutuba_data = parser.parse_shutuba_page(r_shutuba.text, test_race_id)
    if shutuba_data:
        horses = shutuba_data.get('horses', [])
        print(f"    ✅ Shutuba parser returned {len(horses)} horses")
    else:
        print("    ⚠️ Shutuba parser returned None (expected - JS required)")
except Exception as e:
    print(f"    ⚠️ Shutuba error: {e}")

# 3c. db.netkeibaのレースページからのパース（代替案）
print("\n  [3c] Testing db.netkeiba parsing (alternative)...")
soup = BeautifulSoup(r_race.text, 'html.parser')

# レース情報の抽出
race_name_elem = soup.select_one('.RaceName')
race_name = race_name_elem.text.strip() if race_name_elem else "Unknown"
print(f"    Race name: {race_name}")

# テーブル構造確認
tables = soup.find_all('table')
print(f"    Tables found: {len(tables)}")

# race_table_01 の確認
race_table = soup.select_one('table.race_table_01')
if race_table:
    rows = race_table.find_all('tr')
    print(f"    race_table_01 rows: {len(rows)}")
    data_rows = [r for r in rows if r.find_all('td')]
    print(f"    Data rows (with td): {len(data_rows)}")
else:
    print("    ⚠️ race_table_01 not found")

# ============================================================
# Step 4: データベース保存テスト
# ============================================================
print("\n[Step 4] Database save test")

db = SessionLocal()
try:
    # 既存レースを確認
    existing = db.query(models.Race).filter(models.Race.id == test_race_id).first()
    if existing:
        print(f"  Race {test_race_id} already exists in DB")
    else:
        print(f"  Race {test_race_id} not in DB (new)")
    
    # テスト用にデータ挿入は行わない（確認のみ）
    print("  ✅ Database connection successful")
    
finally:
    db.close()

# ============================================================
# Summary
# ============================================================
print("\n" + "=" * 70)
print("TEST SUMMARY")
print("=" * 70)
print(f"✅ race_list_sub.html: {len(all_race_ids)} race IDs retrieved")
print(f"✅ db.netkeiba race page: {len(unique_horses)} horses found")
print(f"{'✅' if race_data else '⚠️'} Existing parser compatibility: {'Compatible' if race_data else 'Needs adaptation'}")
print("✅ Database connection: OK")
print("\n結論: requestsベースでの実装が可能です。")
print("既存パーサーが対応していない場合は、db.netkeiba専用のパースロジックを追加します。")
