"""
race_list_sub.html エンドポイントの検証
Keiba_AI_v2で使われているAPIを確認
"""
import requests
import re
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

test_date = '20260118'

print("=" * 70)
print("Testing race_list_sub.html endpoints (used by Keiba_AI_v2)")
print("=" * 70)

# NAR用
print("\n[NAR race_list_sub.html]")
nar_url = f'https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date={test_date}'
try:
    r = requests.get(nar_url, headers=headers, timeout=15)
    r.encoding = 'utf-8'
    print(f"URL: {nar_url}")
    print(f"Status: {r.status_code}")
    print(f"Length: {len(r.text)}")
    
    soup = BeautifulSoup(r.content, 'html.parser')
    race_links = soup.select('a[href*="result.html?race_id="]')
    race_ids = []
    for link in race_links:
        href = link.get('href', '')
        match = re.search(r'race_id=(\d+)', href)
        if match:
            race_ids.append(match.group(1))
    
    unique_ids = list(set(race_ids))
    print(f"Race IDs found: {len(unique_ids)}")
    if unique_ids:
        print(f"Sample: {unique_ids[:5]}")
except Exception as e:
    print(f"Error: {e}")

# JRA用
print("\n[JRA race_list_sub.html]")
jra_url = f'https://race.netkeiba.com/top/race_list_sub.html?kaisai_date={test_date}'
try:
    r = requests.get(jra_url, headers=headers, timeout=15)
    r.encoding = 'utf-8'
    print(f"URL: {jra_url}")
    print(f"Status: {r.status_code}")
    print(f"Length: {len(r.text)}")
    
    soup = BeautifulSoup(r.content, 'html.parser')
    
    # 複数のパターンを試す
    patterns = [
        'a[href*="result.html?race_id="]',
        'a[href*="shutuba.html?race_id="]', 
        'a[href*="/race/"]',
    ]
    
    for pattern in patterns:
        links = soup.select(pattern)
        if links:
            print(f"  Pattern '{pattern}': {len(links)} matches")
            sample_href = links[0].get('href', '')[:80]
            print(f"  Sample href: {sample_href}")
    
    # race_idを正規表現で抽出
    race_ids = re.findall(r'race_id[=:]?(\d{12})', r.text)
    unique_ids = list(set(race_ids))
    print(f"Race IDs found: {len(unique_ids)}")
    if unique_ids:
        print(f"Sample: {unique_ids[:5]}")
        
    # HTMLの一部を表示
    if len(r.text) > 100:
        print(f"\nHTML preview:\n{r.text[:1000]}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 70)
print("Summary")
print("=" * 70)
