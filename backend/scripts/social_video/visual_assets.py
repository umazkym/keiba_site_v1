from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Sequence

from PIL import Image


ASSET_ROOT = Path(__file__).resolve().parent / "assets"
DEFAULT_MANIFEST_PATH = ASSET_ROOT / "manifest.json"
DEFAULT_CREDITS_PATH = ASSET_ROOT / "credits.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
MAX_ASSET_BYTES = 100 * 1024 * 1024
WARN_ASSET_BYTES = 25 * 1024 * 1024
MAX_VIDEO_LIBRARY_BYTES = 40 * 1024 * 1024
COURSE_VENUE_SLUGS = {
    "東京": "tokyo",
    "中京": "chukyo",
    "福島": "fukushima",
    "函館": "hakodate",
    "阪神": "hanshin",
    "小倉": "kokura",
    "京都": "kyoto",
    "中山": "nakayama",
    "新潟": "niigata",
    "札幌": "sapporo",
}
LOCAL_COURSE_VENUE_SLUGS = {
    "船橋": "funabashi",
    "姫路": "himeji",
    "金沢": "kanazawa",
    "笠松": "kasamatsu",
    "川崎": "kawasaki",
    "高知": "kochi",
    "水沢": "mizusawa",
    "門別": "monbetsu",
    "盛岡": "morioka",
    "名古屋": "nagoya",
    "大井": "ooi",
    "佐賀": "saga",
    "園田": "sonoda",
    "浦和": "urawa",
}
COURSE_SURFACE_SUFFIXES = {"芝": "turf", "ダート": "dirt"}
SFX_CUE_TYPES = ("whoosh", "data_tick", "score_reveal", "transition", "cta")


@dataclass(frozen=True)
class VisualAsset:
    path: Path
    focus: tuple[float, float] = (0.5, 0.5)
    credit: str = ""
    source: str = "default"
    source_url: str = ""
    license: str = ""
    asset_id: str = ""


@dataclass(frozen=True)
class AudioAsset:
    path: Path
    title: str = ""
    credit: str = ""
    source: str = "default"
    source_url: str = ""
    license: str = ""
    volume: float = 0.20
    asset_id: str = ""


@dataclass(frozen=True)
class VideoAsset:
    path: Path
    focus: tuple[float, float] = (0.5, 0.5)
    credit: str = ""
    source: str = "default"
    source_url: str = ""
    license: str = ""
    asset_id: str = ""


@dataclass(frozen=True)
class CourseAsset:
    path: Path
    venue_name: str
    surface: str = ""
    asset_id: str = ""


@dataclass(frozen=True)
class AssetIssue:
    severity: str
    code: str
    message: str
    path: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "path": self.path,
        }


@dataclass
class AssetValidationReport:
    asset_root: Path
    image_count: int = 0
    course_count: int = 0
    audio_count: int = 0
    video_count: int = 0
    video_bytes: int = 0
    checked_count: int = 0
    default_wide_available: bool = False
    default_vertical_available: bool = False
    long_audio_available: bool = False
    shorts_audio_available: bool = False
    default_wide_video_available: bool = False
    default_vertical_video_available: bool = False
    issues: list[AssetIssue] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == "warning")

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_root": str(self.asset_root),
            "image_count": self.image_count,
            "course_count": self.course_count,
            "audio_count": self.audio_count,
            "video_count": self.video_count,
            "video_bytes": self.video_bytes,
            "checked_count": self.checked_count,
            "default_wide_available": self.default_wide_available,
            "default_vertical_available": self.default_vertical_available,
            "long_audio_available": self.long_audio_available,
            "shorts_audio_available": self.shorts_audio_available,
            "default_wide_video_available": self.default_wide_video_available,
            "default_vertical_video_available": self.default_vertical_video_available,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "issues": [issue.to_dict() for issue in self.issues],
        }


def _clamp_focus(value: Any) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        return (0.5, 0.5)
    try:
        x = max(0.0, min(1.0, float(value[0])))
        y = max(0.0, min(1.0, float(value[1])))
    except (TypeError, ValueError):
        return (0.5, 0.5)
    return (x, y)


def _clamp_volume(value: Any, default: float = 0.20) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _asset_root() -> Path:
    configured = os.getenv("SOCIAL_VIDEO_ASSET_ROOT", "").strip()
    return Path(configured).expanduser().resolve() if configured else ASSET_ROOT.resolve()


def _manifest_path() -> Path:
    configured = os.getenv("SOCIAL_VIDEO_ASSET_MANIFEST", "").strip()
    return Path(configured).expanduser() if configured else DEFAULT_MANIFEST_PATH


def _credits_path(root: Path) -> Path:
    configured = os.getenv("SOCIAL_VIDEO_CREDITS_PATH", "").strip()
    return Path(configured).expanduser().resolve() if configured else root / "credits.json"


def load_visual_asset_manifest(path: Optional[Path] = None) -> tuple[Path, dict[str, Any]]:
    manifest_path = (path or _manifest_path()).resolve()
    if not manifest_path.exists():
        return manifest_path, {}
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"動画素材manifestを読み込めません: {manifest_path} ({exc})") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"動画素材manifestのルートはobjectである必要があります: {manifest_path}")
    return manifest_path, payload


def load_asset_credits(root: Optional[Path] = None) -> tuple[Path, dict[str, dict[str, Any]]]:
    resolved_root = (root or _asset_root()).resolve()
    path = _credits_path(resolved_root)
    if not path.exists():
        return path, {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"素材権利メタデータを読み込めません: {path} ({exc})") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"素材権利メタデータのルートはobjectである必要があります: {path}")
    normalized: dict[str, dict[str, Any]] = {}
    for raw_key, value in payload.items():
        if isinstance(raw_key, str) and isinstance(value, dict):
            normalized[raw_key.replace("\\", "/").lstrip("./")] = value
    return path, normalized


def _relative_asset_id(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(path.resolve()).replace("\\", "/")


def _metadata_for(path: Path, root: Path, credits: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return credits.get(_relative_asset_id(path, root), {})


def _is_size_usable(path: Path) -> bool:
    try:
        return path.stat().st_size < MAX_ASSET_BYTES
    except OSError:
        return False


def _is_image_readable(path: Path) -> bool:
    if not _is_size_usable(path):
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, ValueError):
        return False


def _ffprobe_binary() -> Optional[str]:
    configured = os.getenv("FFPROBE_BINARY", "").strip()
    return configured or shutil.which("ffprobe")


def _probe_audio(path: Path) -> tuple[bool, Optional[float], str]:
    if not _is_size_usable(path):
        return False, None, "ファイルサイズが100MB以上です"
    ffprobe = _ffprobe_binary()
    if not ffprobe:
        return True, None, "ffprobeがないため音声デコード確認を省略しました"
    command = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name:format=duration",
        "-of",
        "json",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=20)
        payload = json.loads(result.stdout or "{}")
        streams = payload.get("streams") or []
        duration_raw = (payload.get("format") or {}).get("duration")
        duration = float(duration_raw) if duration_raw not in {None, ""} else None
        if not streams:
            return False, duration, "音声ストリームが見つかりません"
        if duration is not None and duration <= 0:
            return False, duration, "音声の長さが0秒です"
        return True, duration, ""
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError, TypeError, ValueError) as exc:
        return False, None, f"ffprobeで音声を読み込めません: {exc}"


def _probe_video(path: Path) -> tuple[bool, Optional[float], Optional[tuple[int, int]], str]:
    if not _is_size_usable(path):
        return False, None, None, "ファイルサイズが100MB以上です"
    ffprobe = _ffprobe_binary()
    if not ffprobe:
        return True, None, None, "ffprobeがないため動画デコード確認を省略しました"
    command = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,r_frame_rate:format=duration",
        "-of",
        "json",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=30)
        payload = json.loads(result.stdout or "{}")
        streams = payload.get("streams") or []
        if not streams:
            return False, None, None, "映像ストリームが見つかりません"
        stream = streams[0]
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
        duration_raw = (payload.get("format") or {}).get("duration")
        duration = float(duration_raw) if duration_raw not in {None, ""} else None
        codec = str(stream.get("codec_name") or "")
        if codec not in {"h264", "hevc", "vp9", "av1"}:
            return False, duration, (width, height), f"非対応の動画コーデックです: {codec or '不明'}"
        if width <= 0 or height <= 0 or (duration is not None and duration <= 0):
            return False, duration, (width, height), "動画の解像度または長さが不正です"
        return True, duration, (width, height), ""
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError, TypeError, ValueError) as exc:
        return False, None, None, f"ffprobeで動画を読み込めません: {exc}"


def _candidate_files(folder: Path, extensions: set[str], readable_check: Any) -> list[Path]:
    if not folder.exists() or not folder.is_dir():
        return []
    return [
        path
        for path in sorted(folder.iterdir(), key=lambda item: item.name.casefold())
        if path.is_file() and path.suffix.lower() in extensions and readable_check(path)
    ]


def _stable_pick(paths: Sequence[Path], key: str) -> Optional[Path]:
    if not paths:
        return None
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    index = int.from_bytes(digest[:8], "big") % len(paths)
    return paths[index]


def _visual_from_path(
    path: Path,
    root: Path,
    credits: dict[str, dict[str, Any]],
    source: str,
    entry: Optional[dict[str, Any]] = None,
    orientation: str = "wide",
) -> VisualAsset:
    metadata = dict(_metadata_for(path, root, credits))
    if entry:
        metadata.update(entry)
    focus_value = metadata.get(f"focus_{orientation}", metadata.get("focus"))
    return VisualAsset(
        path=path.resolve(),
        focus=_clamp_focus(focus_value),
        credit=str(metadata.get("credit") or "").strip(),
        source=source,
        source_url=str(metadata.get("source") or "").strip(),
        license=str(metadata.get("license") or "").strip(),
        asset_id=_relative_asset_id(path, root),
    )


def _asset_from_manifest_entry(
    entry: Any,
    orientation: str,
    manifest_path: Path,
    root: Path,
    credits: dict[str, dict[str, Any]],
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
    if path.suffix.lower() not in IMAGE_EXTENSIONS or not _is_image_readable(path):
        return None
    return _visual_from_path(path, root, credits, f"manifest:{source}", entry, orientation)


def resolve_visual_asset(
    target_date: str,
    venue_name: str,
    race_number: Optional[int],
    orientation: str,
    manifest_path: Optional[Path] = None,
    selection_key: str = "",
) -> Optional[VisualAsset]:
    if orientation not in {"wide", "vertical"}:
        raise ValueError(f"orientationはwideまたはverticalを指定してください: {orientation}")

    root = _asset_root()
    _, credits = load_asset_credits(root)
    resolved_manifest_path, manifest = load_visual_asset_manifest(manifest_path)
    race_key = f"{target_date}:{venue_name}:{race_number}" if race_number else ""
    manifest_candidates: list[tuple[Any, str]] = []
    if race_key:
        manifest_candidates.append(((manifest.get("races") or {}).get(race_key), f"race:{race_key}"))
    manifest_candidates.append(((manifest.get("venues") or {}).get(venue_name), f"venue:{venue_name}"))
    manifest_candidates.append((manifest.get("defaults"), "default"))
    for entry, source in manifest_candidates:
        asset = _asset_from_manifest_entry(
            entry,
            orientation,
            resolved_manifest_path,
            root,
            credits,
            source,
        )
        if asset is not None:
            return asset

    folders: list[tuple[Path, str]] = []
    if race_number:
        folders.append((root / "images" / "races" / target_date / venue_name / str(race_number) / orientation, "folder:race"))
    folders.append((root / "images" / "venues" / venue_name / orientation, "folder:venue"))
    folders.append((root / "images" / "default" / orientation, "folder:default"))
    stable_key = selection_key or f"{target_date}:{venue_name}:{race_number}:{orientation}"
    for folder, source in folders:
        path = _stable_pick(_candidate_files(folder, IMAGE_EXTENSIONS, _is_image_readable), f"{stable_key}:{source}")
        if path is not None:
            return _visual_from_path(path, root, credits, source, orientation=orientation)
    return None


def resolve_audio_asset(
    target_date: str,
    video_type: str,
    stable_id: str,
    root: Optional[Path] = None,
) -> Optional[AudioAsset]:
    resolved_root = (root or _asset_root()).resolve()
    _, credits = load_asset_credits(resolved_root)
    explicit = os.getenv("SOCIAL_VIDEO_BGM_PATH", "").strip()
    if explicit:
        path = Path(explicit).expanduser().resolve()
        if path.suffix.lower() not in AUDIO_EXTENSIONS or not path.exists() or not path.is_file():
            raise RuntimeError(f"SOCIAL_VIDEO_BGM_PATH が見つからないか非対応形式です: {path}")
        usable, _, reason = _probe_audio(path)
        if not usable:
            raise RuntimeError(f"SOCIAL_VIDEO_BGM_PATH を読み込めません: {path} ({reason})")
        source = "environment"
    else:
        target_folder = "shorts" if video_type == "short" else "long"
        path = None
        source = ""
        for folder_name in (target_folder, "common"):
            folder = resolved_root / "audio" / folder_name
            candidates = _candidate_files(folder, AUDIO_EXTENSIONS, lambda candidate: _probe_audio(candidate)[0])
            path = _stable_pick(candidates, f"{target_date}:{video_type}:{stable_id}:{folder_name}")
            if path is not None:
                source = f"folder:{folder_name}"
                break
        if path is None:
            return None

    metadata = _metadata_for(path, resolved_root, credits)
    global_volume = os.getenv("SOCIAL_VIDEO_BGM_VOLUME", "").strip()
    volume = _clamp_volume(global_volume if global_volume else metadata.get("volume"), 0.20)
    return AudioAsset(
        path=path,
        title=str(metadata.get("title") or path.stem).strip(),
        credit=str(metadata.get("credit") or "").strip(),
        source=source,
        source_url=str(metadata.get("source") or "").strip(),
        license=str(metadata.get("license") or "").strip(),
        volume=volume,
        asset_id=_relative_asset_id(path, resolved_root),
    )


def resolve_sfx_assets(
    target_date: str,
    video_type: str,
    stable_id: str,
    root: Optional[Path] = None,
) -> dict[str, AudioAsset]:
    resolved_root = (root or _asset_root()).resolve()
    _, credits = load_asset_credits(resolved_root)
    resolved: dict[str, AudioAsset] = {}
    for cue_type in SFX_CUE_TYPES:
        folder = resolved_root / "audio" / "sfx" / cue_type
        candidates = _candidate_files(
            folder,
            AUDIO_EXTENSIONS,
            lambda candidate: _probe_audio(candidate)[0],
        )
        path = _stable_pick(
            candidates,
            f"{target_date}:{video_type}:{stable_id}:{cue_type}",
        )
        if path is None:
            continue
        metadata = _metadata_for(path, resolved_root, credits)
        resolved[cue_type] = AudioAsset(
            path=path,
            title=str(metadata.get("title") or path.stem).strip(),
            credit=str(metadata.get("credit") or "").strip(),
            source=f"folder:sfx/{cue_type}",
            source_url=str(metadata.get("source") or "").strip(),
            license=str(metadata.get("license") or "").strip(),
            volume=_clamp_volume(metadata.get("volume"), 0.16),
            asset_id=_relative_asset_id(path, resolved_root),
        )
    return resolved


def resolve_video_asset(
    target_date: str,
    venue_name: str,
    race_number: Optional[int],
    orientation: str,
    selection_key: str = "",
) -> Optional[VideoAsset]:
    if orientation not in {"wide", "vertical"}:
        raise ValueError(f"orientationはwideまたはverticalを指定してください: {orientation}")
    root = _asset_root()
    _, credits = load_asset_credits(root)
    folders: list[tuple[Path, str]] = []
    if race_number:
        folders.append(
            (
                root / "video" / "races" / target_date / venue_name / str(race_number) / orientation,
                "folder:race",
            )
        )
    folders.append((root / "video" / "venues" / venue_name / orientation, "folder:venue"))
    folders.append((root / "video" / "default" / orientation, "folder:default"))
    stable_key = selection_key or f"{target_date}:{venue_name}:{race_number}:{orientation}:video"
    for folder, source in folders:
        candidates = _candidate_files(
            folder,
            VIDEO_EXTENSIONS,
            lambda candidate: _probe_video(candidate)[0],
        )
        path = _stable_pick(candidates, f"{stable_key}:{source}")
        if path is None:
            continue
        metadata = _metadata_for(path, root, credits)
        return VideoAsset(
            path=path.resolve(),
            focus=_clamp_focus(metadata.get(f"focus_{orientation}", metadata.get("focus"))),
            credit=str(metadata.get("credit") or "").strip(),
            source=source,
            source_url=str(metadata.get("source") or "").strip(),
            license=str(metadata.get("license") or "").strip(),
            asset_id=_relative_asset_id(path, root),
        )
    return None


def resolve_course_asset(
    venue_name: str,
    course_type: str = "",
    root: Optional[Path] = None,
) -> Optional[CourseAsset]:
    """開催会場と馬場種別に対応する透過コースPNGを返す。"""
    resolved_root = (root or _asset_root()).resolve()
    slug = COURSE_VENUE_SLUGS.get(venue_name)
    candidates: list[Path] = []
    if slug:
        suffix = COURSE_SURFACE_SUFFIXES.get(course_type, "")
        if suffix:
            candidates.append(resolved_root / "courses" / "central" / f"{slug}_{suffix}.png")
        candidates.append(resolved_root / "courses" / "central" / f"{slug}.png")
    else:
        local_slug = LOCAL_COURSE_VENUE_SLUGS.get(venue_name)
        if not local_slug:
            return None
        candidates.append(resolved_root / "courses" / "local" / f"{local_slug}_course_texture.png")
    for path in candidates:
        if path.suffix.lower() in IMAGE_EXTENSIONS and _is_image_readable(path):
            return CourseAsset(
                path=path.resolve(),
                venue_name=venue_name,
                surface=course_type,
                asset_id=_relative_asset_id(path, resolved_root),
            )
    return None


def visual_asset_metadata(asset: Optional[VisualAsset]) -> Optional[dict[str, Any]]:
    if asset is None:
        return None
    return {
        "type": "image",
        "asset_id": asset.asset_id,
        "path": str(asset.path),
        "selection_source": asset.source,
        "focus": list(asset.focus),
        "credit": asset.credit,
        "source": asset.source_url,
        "license": asset.license,
    }


def audio_asset_metadata(asset: Optional[AudioAsset]) -> Optional[dict[str, Any]]:
    if asset is None:
        return None
    return {
        "type": "audio",
        "asset_id": asset.asset_id,
        "path": str(asset.path),
        "selection_source": asset.source,
        "title": asset.title,
        "credit": asset.credit,
        "source": asset.source_url,
        "license": asset.license,
        "volume": asset.volume,
    }


def video_asset_metadata(asset: Optional[VideoAsset]) -> Optional[dict[str, Any]]:
    if asset is None:
        return None
    return {
        "type": "video",
        "asset_id": asset.asset_id,
        "path": str(asset.path),
        "selection_source": asset.source,
        "focus": list(asset.focus),
        "credit": asset.credit,
        "source": asset.source_url,
        "license": asset.license,
    }


def course_asset_metadata(asset: Optional[CourseAsset]) -> Optional[dict[str, Any]]:
    if asset is None:
        return None
    return {
        "type": "course",
        "asset_id": asset.asset_id,
        "path": str(asset.path),
        "venue_name": asset.venue_name,
        "surface": asset.surface,
    }


def asset_credit_lines(
    visual: Optional[VisualAsset],
    audio: Optional[AudioAsset],
    video: Optional[VideoAsset] = None,
    sfx_assets: Sequence[AudioAsset] = (),
) -> list[str]:
    lines: list[str] = []
    if visual and visual.credit:
        line = f"写真: {visual.credit}"
        if visual.source_url:
            line += f" {visual.source_url}"
        lines.append(line)
    if audio and (audio.credit or audio.source_url):
        label = " / ".join(value for value in (audio.title, audio.credit) if value)
        line = f"BGM: {label}"
        if audio.source_url:
            line += f" {audio.source_url}"
        lines.append(line)
    if video and video.credit:
        line = f"映像: {video.credit}"
        if video.source_url:
            line += f" {video.source_url}"
        lines.append(line)
    for sfx in sfx_assets:
        if not (sfx.credit or sfx.source_url):
            continue
        label = " / ".join(value for value in (sfx.title, sfx.credit) if value)
        line = f"効果音: {label}"
        if sfx.source_url:
            line += f" {sfx.source_url}"
        lines.append(line)
    return lines


def _iter_asset_files(root: Path, category: str) -> list[Path]:
    folder = root / category
    if not folder.exists():
        return []
    return sorted((path for path in folder.rglob("*") if path.is_file() and path.name != ".gitkeep"), key=lambda item: str(item).casefold())


def validate_asset_library(root: Optional[Path] = None) -> AssetValidationReport:
    resolved_root = (root or _asset_root()).resolve()
    report = AssetValidationReport(asset_root=resolved_root)
    try:
        credits_path, credits = load_asset_credits(resolved_root)
    except RuntimeError as exc:
        report.issues.append(AssetIssue("error", "credits_invalid", str(exc), str(_credits_path(resolved_root))))
        credits_path, credits = _credits_path(resolved_root), {}

    recognized_ids: set[str] = set()
    valid_images: set[Path] = set()
    valid_audio: set[Path] = set()
    valid_videos: set[Path] = set()
    for path in _iter_asset_files(resolved_root, "images"):
        report.checked_count += 1
        relative = _relative_asset_id(path, resolved_root)
        recognized_ids.add(relative)
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            report.issues.append(AssetIssue("warning", "unsupported_image", "非対応の画像形式です", relative))
            continue
        try:
            size = path.stat().st_size
        except OSError as exc:
            report.issues.append(AssetIssue("error", "image_stat_failed", str(exc), relative))
            continue
        if size >= MAX_ASSET_BYTES:
            report.issues.append(AssetIssue("error", "asset_too_large", "100MB以上の素材は使用できません", relative))
            continue
        if size > WARN_ASSET_BYTES:
            report.issues.append(AssetIssue("warning", "asset_large", "25MBを超えています。リポジトリ容量のため圧縮を推奨します", relative))
        metadata = credits.get(relative, {})
        if not str(metadata.get("license") or "").strip() or not str(metadata.get("credit") or "").strip():
            report.issues.append(
                AssetIssue(
                    "error",
                    "image_rights_metadata_missing",
                    "写真素材にはcredits.jsonでcreditとlicenseの登録が必要です",
                    relative,
                )
            )
        try:
            with Image.open(path) as image:
                image.load()
                width, height = image.size
        except (OSError, ValueError) as exc:
            report.issues.append(AssetIssue("error", "image_invalid", f"画像を読み込めません: {exc}", relative))
            continue
        if "/wide/" in f"/{relative}" and (width < 1920 or height < 1080):
            report.issues.append(AssetIssue("warning", "wide_resolution_low", f"横画像の推奨解像度1920x1080未満です: {width}x{height}", relative))
        if "/wide/" in f"/{relative}" and width <= height:
            report.issues.append(AssetIssue("warning", "wide_orientation_mismatch", f"横画像フォルダですが横長ではありません: {width}x{height}", relative))
        if "/vertical/" in f"/{relative}" and (width < 1080 or height < 1920):
            report.issues.append(AssetIssue("warning", "vertical_resolution_low", f"縦画像の推奨解像度1080x1920未満です: {width}x{height}", relative))
        if "/vertical/" in f"/{relative}" and height <= width:
            report.issues.append(AssetIssue("warning", "vertical_orientation_mismatch", f"縦画像フォルダですが縦長ではありません: {width}x{height}", relative))
        valid_images.add(path.resolve())
        report.image_count += 1

    for path in _iter_asset_files(resolved_root, "courses"):
        report.checked_count += 1
        relative = _relative_asset_id(path, resolved_root)
        recognized_ids.add(relative)
        if path.suffix.lower() != ".png":
            report.issues.append(AssetIssue("warning", "unsupported_course", "コース形状は背景透過PNGを使用してください", relative))
            continue
        try:
            with Image.open(path) as image:
                image.load()
                has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
                alpha_bbox = image.getchannel("A").getbbox() if image.mode == "RGBA" else image.getbbox()
        except (OSError, ValueError) as exc:
            report.issues.append(AssetIssue("error", "course_invalid", f"コース画像を読み込めません: {exc}", relative))
            continue
        if not has_alpha:
            report.issues.append(AssetIssue("warning", "course_alpha_missing", "コース形状に透過チャンネルがありません", relative))
        if alpha_bbox is None:
            report.issues.append(AssetIssue("error", "course_empty", "コース形状が完全に透明です", relative))
            continue
        report.course_count += 1

    ffprobe_missing_reported = False
    for path in _iter_asset_files(resolved_root, "audio"):
        report.checked_count += 1
        relative = _relative_asset_id(path, resolved_root)
        recognized_ids.add(relative)
        if path.suffix.lower() not in AUDIO_EXTENSIONS:
            report.issues.append(AssetIssue("warning", "unsupported_audio", "非対応の音声形式です", relative))
            continue
        try:
            size = path.stat().st_size
        except OSError as exc:
            report.issues.append(AssetIssue("error", "audio_stat_failed", str(exc), relative))
            continue
        if size >= MAX_ASSET_BYTES:
            report.issues.append(AssetIssue("error", "asset_too_large", "100MB以上の素材は使用できません", relative))
            continue
        if size > WARN_ASSET_BYTES:
            report.issues.append(AssetIssue("warning", "asset_large", "25MBを超えています。リポジトリ容量のため圧縮を推奨します", relative))
        metadata = credits.get(relative, {})
        if not str(metadata.get("license") or "").strip() or not str(metadata.get("credit") or "").strip():
            report.issues.append(
                AssetIssue(
                    "error",
                    "audio_rights_metadata_missing",
                    "音声素材にはcredits.jsonでcreditとlicenseの登録が必要です",
                    relative,
                )
            )
        usable, duration, reason = _probe_audio(path)
        if reason.startswith("ffprobeがない") and not ffprobe_missing_reported:
            report.issues.append(AssetIssue("warning", "ffprobe_missing", reason, relative))
            ffprobe_missing_reported = True
        if not usable:
            report.issues.append(AssetIssue("error", "audio_invalid", reason, relative))
            continue
        if duration is not None and duration < 5 and "/sfx/" not in f"/{relative}":
            report.issues.append(AssetIssue("warning", "audio_too_short", f"音声が5秒未満です: {duration:.2f}秒", relative))
        valid_audio.add(path.resolve())
        report.audio_count += 1

    video_probe_missing_reported = False
    for path in _iter_asset_files(resolved_root, "video"):
        report.checked_count += 1
        relative = _relative_asset_id(path, resolved_root)
        recognized_ids.add(relative)
        if path.suffix.lower() not in VIDEO_EXTENSIONS:
            report.issues.append(AssetIssue("warning", "unsupported_video", "非対応の動画形式です", relative))
            continue
        try:
            size = path.stat().st_size
        except OSError as exc:
            report.issues.append(AssetIssue("error", "video_stat_failed", str(exc), relative))
            continue
        report.video_bytes += size
        if size >= MAX_ASSET_BYTES:
            report.issues.append(AssetIssue("error", "asset_too_large", "100MB以上の素材は使用できません", relative))
            continue
        metadata = credits.get(relative, {})
        if not str(metadata.get("license") or "").strip() or not str(metadata.get("credit") or "").strip():
            report.issues.append(
                AssetIssue(
                    "error",
                    "video_rights_metadata_missing",
                    "動画素材にはcredits.jsonでcreditとlicenseの登録が必要です",
                    relative,
                )
            )
        usable, duration, dimensions, reason = _probe_video(path)
        if reason.startswith("ffprobeがない") and not video_probe_missing_reported:
            report.issues.append(AssetIssue("warning", "ffprobe_missing", reason, relative))
            video_probe_missing_reported = True
        if not usable:
            report.issues.append(AssetIssue("error", "video_invalid", reason, relative))
            continue
        if duration is not None and not 6 <= duration <= 30:
            report.issues.append(
                AssetIssue(
                    "warning",
                    "video_duration_outside_recommended",
                    f"動画素材の推奨尺6〜30秒外です: {duration:.2f}秒",
                    relative,
                )
            )
        if dimensions is not None:
            width, height = dimensions
            if "/wide/" in f"/{relative}" and (width < 1920 or height < 1080 or width <= height):
                report.issues.append(
                    AssetIssue("warning", "wide_video_resolution_low", f"横動画の推奨仕様外です: {width}x{height}", relative)
                )
            if "/vertical/" in f"/{relative}" and (width < 1080 or height < 1920 or height <= width):
                report.issues.append(
                    AssetIssue("warning", "vertical_video_resolution_low", f"縦動画の推奨仕様外です: {width}x{height}", relative)
                )
        valid_videos.add(path.resolve())
        report.video_count += 1

    if report.video_bytes > MAX_VIDEO_LIBRARY_BYTES:
        report.issues.append(
            AssetIssue(
                "error",
                "video_library_too_large",
                f"動画派生素材の合計が40MBを超えています: {report.video_bytes / 1024 / 1024:.1f}MB",
                "video",
            )
        )

    for credit_key in credits:
        if credit_key not in recognized_ids and not (resolved_root / credit_key).exists():
            report.issues.append(AssetIssue("warning", "credit_path_missing", f"credits.jsonの対象素材が見つかりません: {credits_path}", credit_key))

    default_wide = resolved_root / "images" / "default" / "wide"
    default_vertical = resolved_root / "images" / "default" / "vertical"
    report.default_wide_available = any(path.parent == default_wide.resolve() for path in valid_images)
    report.default_vertical_available = any(path.parent == default_vertical.resolve() for path in valid_images)
    common_audio = (resolved_root / "audio" / "common").resolve()
    long_audio = (resolved_root / "audio" / "long").resolve()
    shorts_audio = (resolved_root / "audio" / "shorts").resolve()
    report.long_audio_available = any(path.parent in {common_audio, long_audio} for path in valid_audio)
    report.shorts_audio_available = any(path.parent in {common_audio, shorts_audio} for path in valid_audio)
    default_wide_video = (resolved_root / "video" / "default" / "wide").resolve()
    default_vertical_video = (resolved_root / "video" / "default" / "vertical").resolve()
    report.default_wide_video_available = any(path.parent == default_wide_video for path in valid_videos)
    report.default_vertical_video_available = any(path.parent == default_vertical_video for path in valid_videos)

    if not report.default_wide_available:
        report.issues.append(AssetIssue("warning", "default_wide_missing", "共通横長写真が未配置です", "images/default/wide"))
    if not report.default_vertical_available:
        report.issues.append(AssetIssue("warning", "default_vertical_missing", "共通縦長写真が未配置です", "images/default/vertical"))
    if not report.long_audio_available:
        report.issues.append(AssetIssue("warning", "long_audio_missing", "長尺用BGMが未配置です", "audio/long または audio/common"))
    if not report.shorts_audio_available:
        report.issues.append(AssetIssue("warning", "shorts_audio_missing", "Shorts用BGMが未配置です", "audio/shorts または audio/common"))
    return report
