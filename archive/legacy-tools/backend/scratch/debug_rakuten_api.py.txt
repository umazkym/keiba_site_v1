import os
import sys
import urllib.parse
import urllib.request
import json
from dotenv import load_dotenv

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# .envの読み込み
load_dotenv()

# 楽天APIの設定を取得
app_id = os.getenv("RAKUTEN_API_APPLICATION_ID")
access_key = os.getenv("RAKUTEN_API_ACCESS_KEY")
affiliate_id = os.getenv("RAKUTEN_AFFILIATE_ID")

# 一時的な検証用フォールバック
has_real_keys = all([app_id, access_key, affiliate_id])
if not has_real_keys:
    print("[Notice] Using fallback credentials for demonstration.")
    app_id = app_id or "1019223303826581394"
    access_key = access_key or "demo_access_key"
    affiliate_id = affiliate_id or "15be434f.5413c69c.15be4350.aa424a87"

print("--- Rakuten New API (openapi.rakuten.co.jp) Connection Test ---")
print(f"Application ID: {app_id[:5]}...{app_id[-5:] if len(app_id) > 5 else ''}")
print(f"Access Key: {access_key[:5]}...{access_key[-5:] if len(access_key) > 5 else ''}")
print(f"Affiliate ID: {affiliate_id[:5]}...{affiliate_id[-5:] if len(affiliate_id) > 5 else ''}")

# テスト用URL（楽天市場の商品URL: 書籍の例）
TEST_URL = "https://item.rakuten.co.jp/book/17855018/"

# 2026年最新の新アフィリエイトAPIエンドポイント
ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401"

def extract_item_code(url):
    parsed = urllib.parse.urlparse(url.strip())
    path_parts = [urllib.parse.unquote(part) for part in parsed.path.split("/") if part]
    if len(path_parts) < 2:
        return None
    return f"{path_parts[0]}:{path_parts[1]}"

item_code = extract_item_code(TEST_URL)
print(f"Item Code: {item_code}")

if not item_code:
    print("Failed to extract item code.")
    sys.exit(1)

params = {
    "applicationId": app_id,
    "affiliateId": affiliate_id,
    "itemCode": item_code,
    "hits": "1",
    "format": "json",
    "elements": "itemCode,itemName,itemUrl,affiliateUrl,itemPrice,mediumImageUrls,smallImageUrls",
}

request_url = f"{ENDPOINT}?{urllib.parse.urlencode(params)}"
print(f"Request URL: {request_url}")

req = urllib.request.Request(
    request_url,
    headers={
        "Accept": "application/json",
        "User-Agent": "UMA-FREE-Test/1.0",
        "accessKey": access_key,
        "Origin": "https://uma-free.com" # 楽天コンソールに登録するドメイン
    }
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        body = response.read().decode("utf-8")
        data = json.loads(body)
        print("\n=== Success Response ===")
        items = data.get("Items", [])
        if items:
            item = items[0].get("Item", items[0])
            print(f"Item Name: {item.get('itemName')}")
            print(f"Affiliate URL: {item.get('affiliateUrl')}")
            print(f"Price: {item.get('itemPrice')}")
            print("Check complete. Normal response structure confirmed.")
        else:
            print("No items found.")
except urllib.error.HTTPError as e:
    error_body = e.read().decode("utf-8")
    print(f"\n[HTTP Error {e.code}]: {e.reason}")
    print(f"Response Body: {error_body}")
except Exception as e:
    print(f"\n[Error]: {e}")
