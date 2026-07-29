from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlencode


SITE_BASE_URL = "https://uma-free.com"
CAMPAIGN_NAME = "daily_race_video"
SUPPORTED_PLATFORMS = (
    "threads",
    "instagram",
    "facebook",
    "tiktok",
    "pinterest",
    "bluesky",
)
SUPPORTED_MODES = {"disabled", "validate", "draft", "public"}
PROFILE_DESTINATION_PLATFORMS = {"instagram", "tiktok"}
PLATFORM_CAPTION_LIMITS = {
    "threads": 500,
    "instagram": 2200,
    "facebook": 5000,
    "tiktok": 2200,
    "pinterest": 500,
    "bluesky": 300,
}
PROHIBITED_SOCIAL_PHRASES = ("投資", "必勝", "絶対", "圧倒的", "最強", "消去対象")


def validate_publication_mode(value: str) -> str:
    normalized = str(value or "disabled").strip().lower()
    if normalized not in SUPPORTED_MODES:
        raise ValueError(
            f"SNS動画投稿モードが不正です: {value}。"
            f" {', '.join(sorted(SUPPORTED_MODES))} から指定してください。"
        )
    return normalized


def _compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _iter_rights_assets(value: Any):
    if isinstance(value, dict):
        if value.get("type") in {"image", "audio", "video"} and value.get("asset_id"):
            yield value
        for nested in value.values():
            yield from _iter_rights_assets(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _iter_rights_assets(nested)


def _validate_platform_rights(package: Mapping[str, Any], platform: str) -> None:
    assets = list(_iter_rights_assets(package.get("selected_assets") or {}))
    if not assets:
        raise ValueError("SNS投稿用素材の権利明細がありません。")
    for asset in assets:
        allowed_platforms = {
            str(item).strip().lower()
            for item in asset.get("allowed_platforms") or []
            if str(item).strip()
        }
        asset_id = str(asset.get("asset_id") or "unknown")
        if not allowed_platforms:
            raise ValueError(f"素材の投稿先許諾が未登録です: {asset_id}")
        if platform not in allowed_platforms:
            raise ValueError(f"{platform}での利用許諾がない素材です: {asset_id}")


def _safe_content_part(value: str) -> str:
    compact = re.sub(r"[^0-9A-Za-z_-]+", "-", str(value or "").strip().lower())
    return compact.strip("-_") or "unknown"


def build_content_key(
    target_date: str,
    destination_path: str,
    race_number: int,
) -> str:
    path_parts = [part for part in destination_path.split("/") if part]
    venue_slug = path_parts[2] if len(path_parts) >= 4 else "unknown"
    return (
        f"{target_date.replace('-', '')}_"
        f"{_safe_content_part(venue_slug)}_{max(0, int(race_number))}r_daily1"
    )


def build_destination_url(
    platform: str,
    destination_path: str,
    content_key: str,
) -> str:
    if platform in PROFILE_DESTINATION_PLATFORMS:
        query = urlencode(
            {
                "utm_source": platform,
                "utm_medium": "organic_social",
                "utm_campaign": "profile",
            }
        )
        return f"{SITE_BASE_URL}/?{query}"
    query = urlencode(
        {
            "utm_source": platform,
            "utm_medium": "organic_social",
            "utm_campaign": CAMPAIGN_NAME,
            "utm_content": content_key,
        }
    )
    normalized_path = destination_path if destination_path.startswith("/") else f"/{destination_path}"
    return f"{SITE_BASE_URL}{normalized_path}?{query}"


def _caption_for(
    platform: str,
    target_date: str,
    venue_name: str,
    race_number: int,
    race_name: str,
    destination_url: str,
) -> str:
    race_label = f"{venue_name}{race_number}R"
    if race_name:
        race_label += f"「{race_name}」"
    lead = f"{target_date} {race_label}のAI偏差値上位3頭と位置取り予測をまとめました。"
    note = "過去データをもとにした参考情報です。"
    tags = "#競馬 #AI予想 #競馬予想"
    if platform in PROFILE_DESTINATION_PLATFORMS:
        cta = "全頭データ・対戦成績・枠順傾向はプロフィールのリンクから確認できます。"
        return "\n\n".join((lead, note, cta, tags))
    cta = f"続きの分析はこちら\n{destination_url}"
    return "\n\n".join((lead, note, cta, tags))


def _title_for(venue_name: str, race_number: int, race_name: str) -> str:
    suffix = f" {race_name}" if race_name else ""
    return f"{venue_name}{race_number}R AI偏差値TOP3{suffix}"


def _build_variant_hash(payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SocialVideoVariant:
    platform: str
    mode: str
    stable_id: str
    target_date: str
    venue_name: str
    race_number: int
    race_name: str
    title: str
    caption: str
    alt_text: str
    destination_url: str
    content_key: str
    content_hash: str
    rights_manifest_hash: str
    video_path: Path
    cover_path: Path
    source_content_hash: str
    is_clean_variant: bool

    def validate_local(self) -> None:
        validate_publication_mode(self.mode)
        if self.platform not in SUPPORTED_PLATFORMS:
            raise ValueError(f"未対応のSNSです: {self.platform}")
        if not self.video_path.is_file():
            raise FileNotFoundError(f"投稿動画が見つかりません: {self.video_path}")
        if not self.cover_path.is_file():
            raise FileNotFoundError(f"縦型カバー画像が見つかりません: {self.cover_path}")
        if self.video_path.stat().st_size <= 0:
            raise ValueError(f"投稿動画が空です: {self.video_path}")
        if self.platform == "bluesky" and self.video_path.stat().st_size > 50 * 1024 * 1024:
            raise ValueError("Bluesky動画は50MB以下である必要があります。")
        limit = PLATFORM_CAPTION_LIMITS[self.platform]
        if len(self.caption) > limit:
            raise ValueError(
                f"{self.platform}の本文が上限を超えています: {len(self.caption)}/{limit}"
            )
        if any(phrase in self.caption or phrase in self.title for phrase in PROHIBITED_SOCIAL_PHRASES):
            raise ValueError(f"{self.platform}の投稿文に禁止表現が含まれています。")
        if not self.rights_manifest_hash:
            raise ValueError("素材権利マニフェストのハッシュがありません。")
        if self.platform == "tiktok" and not self.is_clean_variant:
            raise ValueError("TikTokにはロゴ・URL・誘導文を除いた専用動画が必要です。")

    def registry_metadata(self) -> dict[str, Any]:
        return {
            "source": "daily_social_video",
            "platform": self.platform,
            "mode": self.mode,
            "target_date": self.target_date,
            "venue_name": self.venue_name,
            "race_number": self.race_number,
            "race_name": self.race_name,
            "destination_url": self.destination_url,
            "content_key": self.content_key,
            "rights_manifest_hash": self.rights_manifest_hash,
            "source_content_hash": self.source_content_hash,
            "is_clean_variant": self.is_clean_variant,
        }


def build_variant(
    package: Mapping[str, Any],
    *,
    platform: str,
    mode: str,
) -> SocialVideoVariant:
    normalized_platform = str(platform).strip().lower()
    normalized_mode = validate_publication_mode(mode)
    if normalized_platform not in SUPPORTED_PLATFORMS:
        raise ValueError(f"未対応のSNSです: {platform}")
    if str(package.get("video_type") or "") != "short":
        raise ValueError("SNS日次配信にはShort成果物だけを使用します。")
    if not bool(package.get("publishable")):
        reasons = " / ".join(str(reason) for reason in package.get("publish_block_reasons") or [])
        raise ValueError(f"公開品質ゲートを通過していない動画です: {reasons or '理由未記録'}")
    _validate_platform_rights(package, normalized_platform)

    target_date = str(package.get("target_date") or "")
    venue_name = _compact_text(str(package.get("venue_name") or ""))
    race_number = int(package.get("race_number") or 0)
    race_name = _compact_text(str(package.get("race_name") or ""))
    destination_path = str(package.get("destination_path") or "")
    if not target_date or not venue_name or race_number <= 0 or not destination_path:
        raise ValueError("SNS投稿に必要な対象日・会場・レース番号・遷移先が不足しています。")

    content_key = build_content_key(target_date, destination_path, race_number)
    destination_url = build_destination_url(normalized_platform, destination_path, content_key)
    title = _title_for(venue_name, race_number, race_name)
    caption = _caption_for(
        normalized_platform,
        target_date,
        venue_name,
        race_number,
        race_name,
        destination_url,
    )
    alt_text = (
        f"{target_date} {venue_name}{race_number}R"
        f"{f' {race_name}' if race_name else ''}のAI偏差値上位3頭と位置取り予測"
    )
    variant_paths = dict(package.get("variant_video_paths") or {})
    is_clean_variant = normalized_platform == "tiktok"
    video_key = "tiktok_clean" if is_clean_variant else "standard"
    video_path_value = variant_paths.get(video_key) or (
        package.get("video_path") if not is_clean_variant else None
    )
    if not video_path_value:
        raise ValueError(f"{normalized_platform}用の動画成果物がありません: {video_key}")
    cover_path_value = package.get("vertical_cover_path") or package.get("thumbnail_path")
    if not cover_path_value:
        raise ValueError("SNS用カバー画像がありません。")

    source_content_hash = str(package.get("content_hash") or "")
    rights_manifest_hash = str(package.get("rights_manifest_hash") or "")
    content_hash = _build_variant_hash(
        {
            "platform": normalized_platform,
            "mode_contract": "social_video_distribution_v1",
            "source_content_hash": source_content_hash,
            "title": title,
            "caption": caption,
            "alt_text": alt_text,
            "destination_url": destination_url,
            "content_key": content_key,
            "rights_manifest_hash": rights_manifest_hash,
            "is_clean_variant": is_clean_variant,
        }
    )
    return SocialVideoVariant(
        platform=normalized_platform,
        mode=normalized_mode,
        stable_id=str(package.get("stable_id") or ""),
        target_date=target_date,
        venue_name=venue_name,
        race_number=race_number,
        race_name=race_name,
        title=title,
        caption=caption,
        alt_text=alt_text,
        destination_url=destination_url,
        content_key=content_key,
        content_hash=content_hash,
        rights_manifest_hash=rights_manifest_hash,
        video_path=Path(str(video_path_value)),
        cover_path=Path(str(cover_path_value)),
        source_content_hash=source_content_hash,
        is_clean_variant=is_clean_variant,
    )
