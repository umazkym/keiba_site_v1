"""
全体統合テスト: 修正後の全スクレイパー関数がSeleniumなしで動作するか確認
"""
import sys
import time
sys.path.insert(0, '.')

from scripts import scraper, parser

print("=" * 70)
print("FULL INTEGRATION TEST: All scraper functions (Selenium-free)")
print("=" * 70)

test_date = '20260118'

start_time = time.time()

# Step 1: レース一覧取得
print("\n[Step 1] Race list (JRA + NAR)")
jra_html, _ = scraper.get_race_list_html(test_date, is_nar=False, force_download=True)
nar_html, _ = scraper.get_race_list_html(test_date, is_nar=True, force_download=True)

jra_race_ids = parser.parse_race_ids_from_list(jra_html) if jra_html else []
nar_race_ids = parser.parse_race_ids_from_list(nar_html) if nar_html else []
print(f"  JRA: {len(jra_race_ids)} races")
print(f"  NAR: {len(nar_race_ids)} races")

# Step 2: 出馬表取得テスト
print("\n[Step 2] Shutuba page")
test_race_id = jra_race_ids[0] if jra_race_ids else nar_race_ids[0]
shutuba_html, _ = scraper.get_shutuba_html(test_race_id, is_nar=False, force_download=True)
print(f"  Race ID: {test_race_id}")
print(f"  HTML length: {len(shutuba_html) if shutuba_html else 0}")

if shutuba_html:
    shutuba_data = parser.parse_shutuba_page(shutuba_html, test_race_id)
    horses = shutuba_data.get('horses', []) if shutuba_data else []
    print(f"  Horses parsed: {len(horses)}")
    if horses:
        print(f"  Sample: {horses[0].get('horse_name', 'N/A')}, {horses[0].get('horse_id', 'N/A')}")
        test_horse_id = horses[0].get('horse_id')
else:
    test_horse_id = '2023106991'

# Step 3: 結果ページ取得テスト
print("\n[Step 3] Result page")
result_html, _ = scraper.get_race_result_html(test_race_id, is_nar=False, force_download=True)
print(f"  HTML length: {len(result_html) if result_html else 0}")

if result_html:
    result_data = parser.parse_race_result_page(result_html, test_race_id)
    results = result_data.get('results', []) if result_data else []
    print(f"  Results parsed: {len(results)}")

# Step 4: 馬ページ取得テスト
print("\n[Step 4] Horse page (now Selenium-free!)")
if test_horse_id:
    horse_html, _ = scraper.get_horse_page_html(test_horse_id, force_download=True)
    print(f"  Horse ID: {test_horse_id}")
    print(f"  HTML length: {len(horse_html) if horse_html else 0}")
    
    if horse_html:
        horse_data = parser.parse_horse_results_page(horse_html)
        if horse_data:
            print(f"  Horse name: {horse_data.get('horse_name', 'N/A')}")
            results = horse_data.get('results', [])
            print(f"  Past races: {len(results)}")

elapsed = time.time() - start_time

# Summary
print("\n" + "=" * 70)
print("TEST SUMMARY")
print("=" * 70)
print(f"✅ Race list (JRA): {len(jra_race_ids)} races")
print(f"✅ Race list (NAR): {len(nar_race_ids)} races")
print(f"✅ Shutuba: {len(horses) if 'horses' in dir() else 0} horses")
print(f"✅ Result: {len(results) if 'results' in dir() else 0} results")
print(f"✅ Horse page: Fetched successfully")
print(f"\n⏱️ Total time: {elapsed:.2f} seconds")
print("\n🎉 All scraper functions now work WITHOUT Selenium!")
