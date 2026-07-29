#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video.distribution import (  # noqa: E402
    SUPPORTED_PLATFORMS,
    build_variant,
    validate_publication_mode,
)
from scripts.social_video.gcs_staging import GcsMediaStager  # noqa: E402
from scripts.social_video.publishers import get_publisher  # noqa: E402
from scripts.social_video.registry import VideoPostRegistry  # noqa: E402


JST = timezone(timedelta(hours=9))
MUTATION_MODES = {"draft", "public"}


def _append_actions_summary(lines: list[str]) -> None:
    summary_path = (os.getenv("GITHUB_STEP_SUMMARY") or "").strip()
    if not summary_path:
        return
    with Path(summary_path).open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines).rstrip() + "\n")


def _default_target_date() -> str:
    return (datetime.now(JST).date() + timedelta(days=1)).isoformat()


def _resolve_summary_path(args: argparse.Namespace) -> Path:
    if args.summary:
        return Path(args.summary).resolve()
    target_date = args.target_date or _default_target_date()
    return (Path(args.output_root).resolve() / target_date / "summary.json")


def _load_summary(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"YouTube動画生成サマリーが見つかりません: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("videos"), list):
        raise RuntimeError(f"動画生成サマリーの形式が不正です: {path}")
    return payload


def _short_package(summary: dict[str, Any]) -> dict[str, Any]:
    shorts = [
        item
        for item in summary.get("videos") or []
        if isinstance(item, dict) and item.get("video_type") == "short"
    ]
    if not shorts:
        raise RuntimeError("SNS日次配信に使用できるShort成果物がありません。")
    if len(shorts) > 1:
        raise RuntimeError(f"SNS日次配信のShort成果物が複数あります: {len(shorts)}件")
    package = dict(shorts[0])
    package.setdefault("target_date", str(summary.get("target_date") or ""))
    return package


def _mode_for(platform: str, args: argparse.Namespace) -> str:
    if args.force_validate:
        return "validate"
    override = getattr(args, f"{platform}_mode")
    if override:
        return validate_publication_mode(override)
    env_name = f"SOCIAL_VIDEO_{platform.upper()}_MODE"
    return validate_publication_mode(os.getenv(env_name, args.default_mode))


def _generated_age_minutes(summary_path: Path, summary: dict[str, Any]) -> float:
    raw = str(summary.get("generated_at_utc") or "")
    generated_at: datetime
    if raw:
        generated_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if generated_at.tzinfo is None:
            generated_at = generated_at.replace(tzinfo=timezone.utc)
    else:
        generated_at = datetime.fromtimestamp(summary_path.stat().st_mtime, tz=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - generated_at.astimezone(timezone.utc)).total_seconds() / 60)


def _validate_external_readiness(platform: str, stager: GcsMediaStager) -> list[str]:
    warnings: list[str] = []
    publisher = get_publisher(platform)
    try:
        publisher.validate_credentials()
    except Exception as exc:
        warnings.append(str(exc))
    if platform in {"threads", "instagram", "pinterest"}:
        try:
            stager.validate_config()
        except Exception as exc:
            warnings.append(str(exc))
    return warnings


def run(args: argparse.Namespace) -> int:
    summary_path = _resolve_summary_path(args)
    summary = _load_summary(summary_path)
    package = _short_package(summary)
    selected_platforms = tuple(
        platform
        for platform in SUPPORTED_PLATFORMS
        if not args.platforms or platform in args.platforms
    )
    modes = {platform: _mode_for(platform, args) for platform in selected_platforms}
    has_mutation = any(mode in MUTATION_MODES for mode in modes.values())
    if has_mutation:
        age_minutes = _generated_age_minutes(summary_path, summary)
        if age_minutes > args.max_age_minutes:
            raise RuntimeError(
                "古いレース動画の誤投稿を防ぐため停止しました: "
                f"生成後{age_minutes:.1f}分 / 上限{args.max_age_minutes}分"
            )

    registry = VideoPostRegistry(enabled=True) if has_mutation else None
    if has_mutation and (registry is None or not registry.enabled):
        raise RuntimeError("投稿レジストリDBを利用できないためSNS外部投稿を停止します。")
    stager = GcsMediaStager()
    results: list[dict[str, Any]] = []
    failures: list[str] = []
    try:
        for platform in selected_platforms:
            mode = modes[platform]
            if mode == "disabled":
                results.append(
                    {
                        "platform": platform,
                        "mode": mode,
                        "status": "disabled",
                    }
                )
                continue
            try:
                variant = build_variant(package, platform=platform, mode=mode)
                variant.validate_local()
                if mode == "validate":
                    readiness_warnings = _validate_external_readiness(platform, stager)
                    results.append(
                        {
                            "platform": platform,
                            "mode": mode,
                            "status": "validated_local",
                            "content_key": variant.content_key,
                            "destination_url": variant.destination_url,
                            "credential_ready": not readiness_warnings,
                            "readiness_warnings": readiness_warnings,
                        }
                    )
                    continue

                if registry is None:
                    raise RuntimeError("投稿レジストリが初期化されていません。")
                record = registry.reserve(
                    target_date=variant.target_date,
                    video_type="short",
                    stable_id=variant.stable_id,
                    content_hash=variant.content_hash,
                    metadata=variant.registry_metadata(),
                    platform=platform,
                )
                if record.is_terminal:
                    if record.status == "draft" and mode == "public":
                        raise RuntimeError(
                            "既存の下書き投稿があります。重複防止のため自動公開せず、"
                            "対象SNSで確認・公開してください。"
                        )
                    results.append(
                        {
                            "platform": platform,
                            "mode": mode,
                            "status": "reused",
                            "remote_id": record.remote_video_id or "",
                            "record_status": record.status,
                            "permalink": str(record.metadata.get("permalink") or ""),
                        }
                    )
                    continue
                if record.remote_video_id:
                    raise RuntimeError(
                        "前回試行のリモートIDが残っています。重複投稿を避けるため"
                        "自動再送せず、対象SNSとDB状態を照合してください。"
                    )

                publisher = get_publisher(platform)
                publisher.validate_credentials()

                def checkpoint(
                    remote_id: str,
                    status: str,
                    metadata: dict[str, Any],
                ) -> None:
                    registry.transition(
                        variant.target_date,
                        "short",
                        variant.stable_id,
                        status,
                        remote_video_id=remote_id,
                        metadata=metadata,
                        platform=platform,
                    )

                publish_result = publisher.publish(
                    variant,
                    stager,
                    checkpoint=checkpoint,
                )
                registry.transition(
                    variant.target_date,
                    "short",
                    variant.stable_id,
                    publish_result.status,
                    remote_video_id=publish_result.remote_id or None,
                    metadata={
                        **publish_result.metadata,
                        "permalink": publish_result.permalink,
                    },
                    platform=platform,
                )
                results.append(
                    {
                        "platform": platform,
                        "mode": mode,
                        **asdict(publish_result),
                    }
                )
            except Exception as exc:
                message = str(exc)
                failures.append(f"{platform}: {message}")
                results.append(
                    {
                        "platform": platform,
                        "mode": mode,
                        "status": "failed",
                        "error": message,
                    }
                )
                if mode in MUTATION_MODES and registry is not None and registry.enabled:
                    try:
                        existing = registry.get(
                            str(package.get("target_date") or summary.get("target_date") or ""),
                            "short",
                            str(package.get("stable_id") or ""),
                            platform=platform,
                        )
                        if existing is not None:
                            registry.record_error(
                                existing.target_date,
                                existing.video_type,
                                existing.stable_id,
                                message,
                                platform=platform,
                            )
                    except Exception as registry_exc:
                        failures.append(f"{platform} registry: {registry_exc}")
    finally:
        cleanup_failures = stager.cleanup()
        failures.extend(f"staging cleanup: {failure}" for failure in cleanup_failures)

    output_path = summary_path.with_name("social-distribution-summary.json")
    output_payload = {
        "target_date": str(summary.get("target_date") or ""),
        "source_summary": str(summary_path),
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "results": results,
        "failures": failures,
    }
    output_path.write_text(
        json.dumps(output_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    summary_lines = [
        "",
        f"## SNS動画配信 {output_payload['target_date']}",
        "",
    ]
    for result in results:
        line = f"- {result['platform']}: {result['status']}（mode={result['mode']}）"
        if result.get("permalink"):
            line += f" / {result['permalink']}"
        if result.get("readiness_warnings"):
            line += " / 外部設定待ち"
        if result.get("error"):
            line += f" / {result['error']}"
        summary_lines.append(line)
    summary_lines.append(f"- 配信サマリー: `{output_path}`")
    _append_actions_summary(summary_lines)
    print(json.dumps(output_payload, ensure_ascii=False, indent=2))
    return 1 if failures else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="生成済みShortを公式APIで複数SNSへ日次配信します。"
    )
    parser.add_argument("--summary", default="", help="YouTube生成summary.json")
    parser.add_argument(
        "--output-root",
        default=str(PROJECT_ROOT / "youtube_video_dist"),
        help="動画生成ルート",
    )
    parser.add_argument("--target-date", default="", help="対象日 YYYY-MM-DD")
    parser.add_argument(
        "--platforms",
        nargs="*",
        choices=SUPPORTED_PLATFORMS,
        default=[],
        help="対象SNS。未指定なら全SNS",
    )
    parser.add_argument(
        "--default-mode",
        choices=("disabled", "validate", "draft", "public"),
        default="validate",
    )
    parser.add_argument(
        "--force-validate",
        action="store_true",
        help="すべてのSNSを外部変更なしの検証モードに固定",
    )
    parser.add_argument("--max-age-minutes", type=int, default=240)
    for platform in SUPPORTED_PLATFORMS:
        parser.add_argument(
            f"--{platform}-mode",
            choices=("disabled", "validate", "draft", "public"),
            default="",
        )
    return parser


def main() -> int:
    return run(build_parser().parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
