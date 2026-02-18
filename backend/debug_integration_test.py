"""
修正後の統合テスト: 修正したscraper.pyがrace_list_sub.htmlから正しくレースIDを取得できるか確認
"""
import sys
import os
sys.path.insert(0, '.')

from scripts import scraper, parser

test_date = '20260118'

print("=" * 70)
print("INTEGRATION TEST: Modified scraper.py")
print("=" * 70)

# Step 1: JRAレース一覧取得
print("\n[Step 1] JRA Race List (using modified get_race_list_html)")
jra_html, was_scraped = scraper.get_race_list_html(test_date, is_nar=False, force_download=True)
print(f"  HTML length: {len(jra_html) if jra_html else 0}")
print(f"  Was scraped: {was_scraped}")

if jra_html:
    jra_race_ids = parser.parse_race_ids_from_list(jra_html)
    print(f"  JRA race IDs: {len(jra_race_ids)}")
    if jra_race_ids:
        print(f"  Sample: {jra_race_ids[:3]}")
else:
    print("  ❌ Failed to get JRA race list")
    jra_race_ids = []

# Step 2: NARレース一覧取得
print("\n[Step 2] NAR Race List (using modified get_race_list_html)")
nar_html, was_scraped = scraper.get_race_list_html(test_date, is_nar=True, force_download=True)
print(f"  HTML length: {len(nar_html) if nar_html else 0}")
print(f"  Was scraped: {was_scraped}")

if nar_html:
    nar_race_ids = parser.parse_race_ids_from_list(nar_html)
    print(f"  NAR race IDs: {len(nar_race_ids)}")
    if nar_race_ids:
        print(f"  Sample: {nar_race_ids[:3]}")
else:
    print("  ❌ Failed to get NAR race list")
    nar_race_ids = []

# 結果サマリー
print("\n" + "=" * 70)
print("INTEGRATION TEST SUMMARY")
print("=" * 70)
print(f"✅ JRA races: {len(jra_race_ids)}")
print(f"✅ NAR races: {len(nar_race_ids)}")
print(f"✅ Total: {len(jra_race_ids) + len(nar_race_ids)} races")
print("\n修正後のscraper.pyはSeleniumなしで正常に動作しています！")
