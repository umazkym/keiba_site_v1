#!/usr/bin/env python3
"""翌日の重賞1レースを、Instagram のカルーセル（最大6枚・1080×1350）にして投稿する。

モードは SOCIAL_VIDEO_INSTAGRAM_CAROUSEL_MODE（未設定なら validate）:
- disabled: 何もしない
- validate: 画像と本文を作り、禁止語・認証設定の有無を確かめるだけ（外部への投稿・DB記録・GCS配置はしない）
- public:   非公開GCSに画像を一時配置し、Instagram Graph API でカルーセルを公開する
Instagram には下書きのAPIが無いため draft は受け付けない。

重複防止は動画と同じ video_publications（platform=instagram, video_type=carousel, stable_id=レースID）。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts import sns_content as SC  # noqa: E402
from scripts import sns_images as SI  # noqa: E402
from scripts.social_video.gcs_staging import GcsMediaStager  # noqa: E402
from scripts.social_video.publishers import (  # noqa: E402
    META_GRAPH_BASE,
    _required_env,
    _response_json,
    _retry_request,
    _wait_meta_container,
)

JST = timezone(timedelta(hours=9))
API_BASE_URL = (
    os.getenv("API_BASE_URL") or os.getenv("NEXT_PUBLIC_API_URL") or "https://keiba-site-v1-761440273070.us-west1.run.app"
).rstrip("/")
MODES = {"disabled", "validate", "public"}
PLATFORM = "instagram"
VIDEO_TYPE = "carousel"
CAPTION_LIMIT = 2200
MIN_SCORED_HORSES = 5


def _log(message: str) -> None:
    print(f"{datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S')} {message}", flush=True)


def _append_actions_summary(lines: list[str]) -> None:
    path = (os.getenv("GITHUB_STEP_SUMMARY") or "").strip()
    if path:
        with Path(path).open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines).rstrip() + "\n")


def resolve_mode(value: Optional[str]) -> str:
    mode = (value or os.getenv("SOCIAL_VIDEO_INSTAGRAM_CAROUSEL_MODE") or "validate").strip().lower()
    if mode not in MODES:
        raise RuntimeError(f"Instagramカルーセルのモードが不正です: {mode}（disabled / validate / public）")
    return mode


def fetch_day(date_str: str, retries: int = 3, delay: int = 15) -> Optional[dict[str, Any]]:
    url = f"{API_BASE_URL}/api/v1/predictions/{date_str}"
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, timeout=90)
            if response.status_code == 200 and isinstance(response.json(), dict):
                return response.json()
            if response.status_code == 404:
                return None
            _log(f"レースデータの取得に失敗しました（{response.status_code}、{attempt}/{retries}）")
        except requests.RequestException as error:
            _log(f"レースデータの取得で接続エラー（{attempt}/{retries}）: {error}")
        if attempt < retries:
            time.sleep(delay)
    return None


def choose_race(day: Optional[dict[str, Any]], date_str: str) -> Optional[SC.RaceCard]:
    """グレードの最も高い重賞。AI偏差値のある馬が5頭未満のレースは外す。"""
    cards = SC.find_grade_races(day, date_str, min_scored=MIN_SCORED_HORSES)
    return cards[0] if cards else None


def validate_caption(caption: str) -> None:
    found = SC.find_prohibited_phrases(caption)
    if found:
        raise RuntimeError(f"本文に使わない言葉が含まれています: {', '.join(found)}")
    if len(caption) > CAPTION_LIMIT:
        raise RuntimeError(f"本文が長すぎます: {len(caption)} / {CAPTION_LIMIT}")


def readiness_warnings() -> list[str]:
    warnings: list[str] = []
    try:
        _required_env(("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"))
    except Exception as error:
        warnings.append(str(error))
    try:
        GcsMediaStager().validate_config()
    except Exception as error:
        warnings.append(str(error))
    return warnings


def publish_carousel(
    image_paths: list[str],
    caption: str,
    *,
    stable_key: str,
    target_date: str,
    checkpoint: Optional[Callable[[str], None]] = None,
) -> dict[str, str]:
    """子のコンテナ（画像）→ カルーセルのコンテナ → 公開。署名URLとトークンはログに出さない。
    checkpoint にはカルーセルのコンテナIDを渡す（公開の直前に記録し、途中で落ちたときの二重投稿を防ぐ）。"""
    credentials = _required_env(("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"))
    user_id, token = credentials["INSTAGRAM_USER_ID"], credentials["INSTAGRAM_ACCESS_TOKEN"]
    stager = GcsMediaStager()
    try:
        children: list[str] = []
        for index, path in enumerate(image_paths, 1):
            staged = stager.stage(Path(path), f"{target_date}/instagram-carousel/{stable_key}-{index:02d}.jpg")
            response = _retry_request(
                "POST",
                f"{META_GRAPH_BASE}/{user_id}/media",
                data={"image_url": staged.signed_url, "is_carousel_item": "true", "access_token": token},
            )
            child = str(_response_json(response, f"Instagramカルーセル画像{index}のコンテナ作成").get("id") or "")
            if not child:
                raise RuntimeError(f"Instagramカルーセル画像{index}のコンテナIDが返されませんでした。")
            _wait_meta_container(child, token, status_field="status_code", attempts=12, delay_seconds=5)
            children.append(child)
        response = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{user_id}/media",
            data={"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption, "access_token": token},
        )
        container = str(_response_json(response, "Instagramカルーセルのコンテナ作成").get("id") or "")
        if not container:
            raise RuntimeError("InstagramカルーセルのコンテナIDが返されませんでした。")
        _wait_meta_container(container, token, status_field="status_code", attempts=12, delay_seconds=5)
        if checkpoint:
            checkpoint(container)
        response = _retry_request(
            "POST",
            f"{META_GRAPH_BASE}/{user_id}/media_publish",
            data={"creation_id": container, "access_token": token},
        )
        remote_id = str(_response_json(response, "Instagramカルーセルの公開").get("id") or "")
        permalink = ""
        if remote_id:
            info = _retry_request("GET", f"{META_GRAPH_BASE}/{remote_id}", params={"fields": "permalink", "access_token": token})
            if info.ok:
                permalink = str(info.json().get("permalink") or "")
        return {"remote_id": remote_id, "permalink": permalink, "container_id": container}
    finally:
        for failure in stager.cleanup():
            _log(f"⚠️ 一時画像を削除できませんでした（2日後に自動で消えます）: {failure[:200]}")


def content_hash_for(card: SC.RaceCard, caption: str) -> str:
    """同じレース・同じ本文なら同じ値（画像は本文と同じ値から描くため含めない）。"""
    return hashlib.sha256(f"{card.race_id}|{card.date}|{caption}".encode("utf-8")).hexdigest()


def run(args: argparse.Namespace, fetch: Callable[[str], Optional[dict[str, Any]]] = fetch_day) -> int:
    mode = resolve_mode(args.mode)
    target_date = args.target_date or (datetime.now(JST).date() + timedelta(days=1)).isoformat()
    result: dict[str, Any] = {"platform": "instagram_carousel", "mode": mode, "target_date": target_date}
    if mode == "disabled":
        result["status"] = "disabled"
        _log("Instagramカルーセルは disabled のため何もしません。")
        return _finish(result, 0)

    card = choose_race(fetch(target_date), target_date)
    if card is None:
        result["status"] = "no_target"
        _log(f"{target_date} はカルーセルにする重賞がありません（AI偏差値のある馬が{MIN_SCORED_HORSES}頭以上の重賞のみ）。")
        return _finish(result, 0)

    output_dir = Path(args.output_root) / target_date
    image_paths = SI.render_carousel(card, output_dir)
    caption = SC.build_carousel_caption(card)
    validate_caption(caption)
    (output_dir / "caption.txt").write_text(caption + "\n", encoding="utf-8")
    stable_id = card.race_id or f"{card.venue}{card.race_number}R"
    result.update({
        "race": f"{card.venue}{card.race_number}R {card.race_name}",
        "grade": card.grade,
        "stable_id": stable_id,
        "images": image_paths,
        "caption": caption,
    })
    _log(f"カルーセルを作成しました: {result['race']}（{len(image_paths)}枚）")

    if mode == "validate":
        warnings = readiness_warnings()
        result.update({"status": "validated_local", "credential_ready": not warnings, "readiness_warnings": warnings})
        return _finish(result, 0)

    from scripts.social_video.registry import VideoPostRegistry

    registry = VideoPostRegistry(enabled=True)
    if not registry.enabled:
        raise RuntimeError("投稿レジストリDBを利用できないため、重複防止のためInstagramへの投稿を止めます。")
    record = registry.reserve(
        target_date=target_date,
        video_type=VIDEO_TYPE,
        stable_id=stable_id,
        content_hash=content_hash_for(card, caption),
        metadata={"race": result["race"], "pages": len(image_paths)},
        platform=PLATFORM,
    )
    if record.is_terminal:
        result.update({"status": "reused", "remote_id": record.remote_video_id or "", "permalink": str(record.metadata.get("permalink") or "")})
        _log("このレースのカルーセルは投稿済みです。")
        return _finish(result, 0)
    if record.remote_video_id:
        raise RuntimeError("前回の試行のリモートIDが残っています。重複を避けるため自動で再送しません。Instagramと投稿レジストリを照合してください。")
    def checkpoint(container_id: str) -> None:
        registry.transition(
            target_date,
            VIDEO_TYPE,
            stable_id,
            "uploading",
            remote_video_id=container_id,
            metadata={"container_id": container_id},
            platform=PLATFORM,
        )

    try:
        published = publish_carousel(
            image_paths,
            caption,
            stable_key=stable_id,
            target_date=target_date,
            checkpoint=checkpoint,
        )
    except Exception as error:
        registry.record_error(target_date, VIDEO_TYPE, stable_id, str(error), platform=PLATFORM)
        raise
    registry.transition(
        target_date,
        VIDEO_TYPE,
        stable_id,
        "published",
        remote_video_id=published["remote_id"] or published["container_id"],
        metadata={"permalink": published["permalink"], "container_id": published["container_id"]},
        platform=PLATFORM,
    )
    result.update({"status": "published", **published})
    return _finish(result, 0)


def _finish(result: dict[str, Any], code: int) -> int:
    lines = ["", f"## Instagramカルーセル {result.get('target_date', '')}", ""]
    line = f"- {result.get('status')}（mode={result.get('mode')}）"
    if result.get("race"):
        line += f" / {result['race']}"
    if result.get("permalink"):
        line += f" / {result['permalink']}"
    if result.get("readiness_warnings"):
        line += " / 外部設定待ち"
    lines.append(line)
    _append_actions_summary(lines)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="翌日の重賞をInstagramのカルーセルにします。")
    parser.add_argument("--target-date", default="", help="対象日 YYYY-MM-DD（省略時は翌日）")
    parser.add_argument("--mode", default="", choices=("", "disabled", "validate", "public"))
    parser.add_argument("--output-root", default=str(PROJECT_ROOT / "sns_images_dist" / "instagram"))
    return parser


def main() -> int:
    try:
        return run(build_parser().parse_args())
    except Exception as error:
        _log(f"❌ Instagramカルーセルの処理に失敗しました: {error}")
        _append_actions_summary(["", "## Instagramカルーセル", "", f"- failed / {error}"])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
