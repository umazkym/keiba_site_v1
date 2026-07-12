from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


DEFAULT_MANIFEST_PATH = Path(__file__).resolve().parent / "assets" / "manifest.json"


@dataclass(frozen=True)
class VisualAsset:
    path: Path
    focus: tuple[float, float] = (0.5, 0.5)
    credit: str = ""
    source: str = "default"


def _clamp_focus(value: Any) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        return (0.5, 0.5)
    try:
        x = max(0.0, min(1.0, float(value[0])))
        y = max(0.0, min(1.0, float(value[1])))
    except (TypeError, ValueError):
        return (0.5, 0.5)
    return (x, y)


def _manifest_path() -> Path:
    configured = os.getenv("SOCIAL_VIDEO_ASSET_MANIFEST", "").strip()
    return Path(configured).expanduser() if configured else DEFAULT_MANIFEST_PATH


def load_visual_asset_manifest(path: Optional[Path] = None) -> tuple[Path, dict[str, Any]]:
    manifest_path = (path or _manifest_path()).resolve()
    if not manifest_path.exists():
        return manifest_path, {}
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"動画素材manifestを読み込めません: {manifest_path} ({exc})") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"動画素材manifestのルートはobjectである必要があります: {manifest_path}")
    return manifest_path, payload


def _asset_from_entry(
    entry: Any,
    orientation: str,
    manifest_path: Path,
    source: str,
) -> Optional[VisualAsset]:
    if not isinstance(entry, dict):
        return None
    raw_path = entry.get(orientation)
    if not isinstance(raw_path, str) or not raw_path.strip():
        return None
    if "://" in raw_path:
        raise RuntimeError(f"外部URLは動画素材manifestで使用できません: {raw_path}")
    path = Path(raw_path)
    if not path.is_absolute():
        path = manifest_path.parent / path
    path = path.resolve()
    if not path.exists() or not path.is_file():
        return None

    focus_value = entry.get(f"focus_{orientation}", entry.get("focus"))
    return VisualAsset(
        path=path,
        focus=_clamp_focus(focus_value),
        credit=str(entry.get("credit") or "").strip(),
        source=source,
    )


def resolve_visual_asset(
    target_date: str,
    venue_name: str,
    race_number: Optional[int],
    orientation: str,
    manifest_path: Optional[Path] = None,
) -> Optional[VisualAsset]:
    if orientation not in {"wide", "vertical"}:
        raise ValueError(f"orientationはwideまたはverticalを指定してください: {orientation}")

    resolved_manifest_path, manifest = load_visual_asset_manifest(manifest_path)
    race_key = f"{target_date}:{venue_name}:{race_number}" if race_number else ""
    candidates: list[tuple[Any, str]] = []
    if race_key:
        candidates.append(((manifest.get("races") or {}).get(race_key), f"race:{race_key}"))
    candidates.append(((manifest.get("venues") or {}).get(venue_name), f"venue:{venue_name}"))
    candidates.append((manifest.get("defaults"), "default"))

    for entry, source in candidates:
        asset = _asset_from_entry(entry, orientation, resolved_manifest_path, source)
        if asset is not None:
            return asset
    return None
