import json
import os
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, unquote, urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, Query, Response

from core.rakuten_settings import get_rakuten_api_settings


router = APIRouter()

RAKUTEN_ITEM_SEARCH_ENDPOINT = os.getenv(
    "RAKUTEN_ICHIBA_ITEM_SEARCH_ENDPOINT",
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401",
)
RAKUTEN_AFFILIATE_CACHE_SECONDS = int(os.getenv("RAKUTEN_AFFILIATE_CACHE_SECONDS", "86400"))
RAKUTEN_REQUEST_TIMEOUT_SECONDS = float(os.getenv("RAKUTEN_REQUEST_TIMEOUT_SECONDS", "8"))

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _extract_rakuten_item_code(item_url: str) -> str | None:
    parsed = urlparse(item_url.strip())
    host = parsed.netloc.lower()
    if host not in {"item.rakuten.co.jp", "www.item.rakuten.co.jp"}:
        return None

    path_parts = [unquote(part) for part in parsed.path.split("/") if part]
    if len(path_parts) < 2:
        return None

    shop_code = path_parts[0].strip()
    item_id = path_parts[1].strip()
    if not shop_code or not item_id:
        return None

    return f"{shop_code}:{item_id}"


def _cache_get(cache_key: str) -> dict[str, Any] | None:
    cached = _cache.get(cache_key)
    if not cached:
        return None

    expires_at, payload = cached
    if time.time() >= expires_at:
        _cache.pop(cache_key, None)
        return None

    return payload


def _cache_set(cache_key: str, payload: dict[str, Any]) -> None:
    _cache[cache_key] = (time.time() + RAKUTEN_AFFILIATE_CACHE_SECONDS, payload)


def _extract_item_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    items = payload.get("Items")
    if not isinstance(items, list) or not items:
        return None

    first = items[0]
    if not isinstance(first, dict):
        return None

    item = first.get("Item", first)
    if not isinstance(item, dict):
        return None

    return item


def _first_image_url(item: dict[str, Any]) -> str | None:
    for field_name in ("mediumImageUrls", "smallImageUrls"):
        image_urls = item.get(field_name)
        if not isinstance(image_urls, list) or not image_urls:
            continue

        first = image_urls[0]
        if isinstance(first, dict):
            value = first.get("imageUrl")
            if isinstance(value, str) and value:
                return value
        if isinstance(first, str) and first:
            return first
    return None


def _fallback_payload(source_url: str, item_code: str | None, reason: str) -> dict[str, Any]:
    return {
        "sourceUrl": source_url,
        "affiliateUrl": source_url,
        "itemCode": item_code,
        "resolved": False,
        "reason": reason,
    }


@router.get("/rakuten/resolve")
def resolve_rakuten_affiliate_url(
    response: Response,
    url: str = Query(..., min_length=8, max_length=2048, description="楽天市場の商品URL"),
):
    source_url = url.strip()
    item_code = _extract_rakuten_item_code(source_url)
    if not item_code:
        response.headers["Cache-Control"] = "public, max-age=3600"
        return _fallback_payload(source_url, None, "unsupported_url")

    cache_key = f"rakuten:item:{item_code}"
    cached = _cache_get(cache_key)
    if cached:
        response.headers["Cache-Control"] = (
            f"public, max-age={RAKUTEN_AFFILIATE_CACHE_SECONDS}, stale-while-revalidate=604800"
        )
        return cached

    settings = get_rakuten_api_settings()
    if not all([settings.application_id, settings.access_key, settings.affiliate_id]):
        response.headers["Cache-Control"] = "public, max-age=300"
        return _fallback_payload(source_url, item_code, "not_configured")

    params = {
        "applicationId": settings.application_id,
        "affiliateId": settings.affiliate_id,
        "itemCode": item_code,
        "hits": "1",
        "format": "json",
        "elements": "itemCode,itemName,itemUrl,affiliateUrl,itemPrice,mediumImageUrls,smallImageUrls",
    }
    request_url = f"{RAKUTEN_ITEM_SEARCH_ENDPOINT}?{urlencode(params)}"
    request = Request(
        request_url,
        headers={
            "Accept": "application/json",
            "User-Agent": "UMA-FREE/1.0",
            "accessKey": settings.access_key,
        },
    )

    try:
        with urlopen(request, timeout=RAKUTEN_REQUEST_TIMEOUT_SECONDS) as api_response:
            raw_body = api_response.read().decode("utf-8")
        payload = json.loads(raw_body)
        item = _extract_item_payload(payload)
        if not item:
            response.headers["Cache-Control"] = "public, max-age=3600"
            return _fallback_payload(source_url, item_code, "item_not_found")

        affiliate_url = item.get("affiliateUrl") or item.get("itemUrl") or source_url
        result = {
            "sourceUrl": source_url,
            "affiliateUrl": affiliate_url,
            "itemCode": item.get("itemCode") or item_code,
            "itemName": item.get("itemName"),
            "itemPrice": item.get("itemPrice"),
            "imageUrl": _first_image_url(item),
            "resolved": bool(affiliate_url and affiliate_url != source_url),
            "reason": None,
        }
        _cache_set(cache_key, result)
        response.headers["Cache-Control"] = (
            f"public, max-age={RAKUTEN_AFFILIATE_CACHE_SECONDS}, stale-while-revalidate=604800"
        )
        return result
    except HTTPError as error:
        print(f"[rakuten_affiliate] Rakuten API HTTP error for {item_code}: {error.code}")
    except (URLError, TimeoutError) as error:
        print(f"[rakuten_affiliate] Rakuten API network error for {item_code}: {error}")
    except json.JSONDecodeError as error:
        print(f"[rakuten_affiliate] Rakuten API JSON error for {item_code}: {error}")

    response.headers["Cache-Control"] = "public, max-age=600"
    return _fallback_payload(source_url, item_code, "api_error")
