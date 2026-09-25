from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageOps

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.sns_images import _font
from scripts.social_video import brand_scenes, renderer


SHEET_BG = (229, 231, 239)
CELL_BG = (247, 248, 252)
CELL_RULE = (205, 210, 226)
LABEL = (21, 26, 61)
DESIGN_LABEL = "v10 / "
# 文字・数字はこの範囲へ収める（brand_scenes.validate_short_layers と同じ範囲）。
# 右端はYouTubeの操作ボタン、下端は題名・説明欄との重なりを確認するための境界。
SHORTS_SAFE_BOUNDS = brand_scenes.SHORT_SAFE_BOX


def _first(paths: Iterable[Path]) -> Path | None:
    return next(iter(sorted(paths)), None)


def _last(paths: Iterable[Path]) -> Path | None:
    ordered = sorted(paths)
    return ordered[-1] if ordered else None


def _collect_review_images(date_root: Path, prefix: str) -> List[Tuple[str, Path]]:
    items: List[Tuple[str, Path]] = []
    long_root = date_root / "long"
    short_root = date_root / "shorts"
    long_dir = _first(path for path in long_root.glob("*") if path.is_dir()) if long_root.exists() else None
    short_dir = _first(path for path in short_root.glob("*") if path.is_dir()) if short_root.exists() else None

    if long_dir:
        long_thumbnail = long_dir / "thumbnail.jpg"
        if not long_thumbnail.exists():
            long_thumbnail = long_dir / "thumbnail.png"
        candidates = [
            ("長尺サムネイル", long_thumbnail),
            ("長尺導入", long_dir / "000_intro.png"),
            # 章の完成図は「chapter_01_中山.png」。部品（_base・_card など）は除く
            ("長尺競馬場の章", _first(path for path in long_dir.glob("chapter_*.png") if path.stem.count("_") == 2)),
            ("長尺レース", _first(long_dir.glob("*_race.png"))),
            ("長尺締め", long_dir / "999_outro.png"),
        ]
        for label, path in candidates:
            if path and path.exists():
                items.append((f"{prefix}{label}", path))
        motion_frame_dir = long_dir / "motion-frames"
        for path in sorted(motion_frame_dir.glob("race-*.png")):
            label = path.stem.removeprefix("race-").replace("_", ".")
            items.append((f"{prefix}1レース t={label}秒", path))

    if short_dir:
        candidates = [
            ("Shorts表紙", short_dir / "000_intro.png"),
            ("Shorts上位5頭", short_dir / "001_top5.png"),
            ("Shorts位置取り", short_dir / "002_lanes.png"),
            # 締めは最後のレースにだけ付く（2レース目以降は race_NN/ の中）
            ("Shorts締め", _first(path for path in short_dir.rglob("999_outro.png") if "tiktok-clean" not in path.parts)),
            ("TikTok用の締め", _first((short_dir / "tiktok-clean").rglob("999_outro.png")) if (short_dir / "tiktok-clean").exists() else None),
        ]
        for label, path in candidates:
            if path and path.exists():
                items.append((f"{prefix}{label}", path))
    return items


def _extract_long_motion_frames(date_root: Path) -> list[Path]:
    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        return []
    long_root = date_root / "long"
    long_dir = _first(path for path in long_root.glob("*") if path.is_dir()) if long_root.exists() else None
    if long_dir is None:
        return []
    video_path = _first(long_dir.glob("*.mp4"))
    if video_path is None:
        return []
    frame_dir = long_dir / "motion-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []
    for relative_seconds in (0.0, 0.6, 1.5, 3.0, 5.5):
        destination = frame_dir / f"race-{relative_seconds:.1f}".replace(".", "_")
        destination = destination.with_suffix(".png")
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-loglevel",
                "error",
                "-ss",
                f"{renderer.LONG_INTRO_SECONDS + renderer.LONG_CHAPTER_SECONDS + relative_seconds:.3f}",
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                str(destination),
            ],
            check=True,
        )
        created.append(destination)
    return created


def _resolve_date_root(root: Path) -> Path:
    if (root / "summary.json").exists():
        return root
    dated = sorted(path.parent for path in root.glob("*/summary.json"))
    if not dated:
        raise FileNotFoundError(f"summary.jsonが見つかりません: {root}")
    return dated[-1]


def _draw_cell(
    sheet: Image.Image,
    draw: ImageDraw.ImageDraw,
    label: str,
    source_path: Path,
    box: tuple[int, int, int, int],
) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=CELL_BG, outline=CELL_RULE, width=2)
    draw.text((x1 + 18, y1 + 14), label, font=_font("bold", 24), fill=LABEL)
    media_box = (x1 + 18, y1 + 56, x2 - 18, y2 - 18)
    with Image.open(source_path) as source:
        image = ImageOps.contain(source.convert("RGB"), (media_box[2] - media_box[0], media_box[3] - media_box[1]))
    left = media_box[0] + (media_box[2] - media_box[0] - image.width) // 2
    top = media_box[1] + (media_box[3] - media_box[1] - image.height) // 2
    sheet.paste(image, (left, top))


def _create_shorts_ui_overlay(source_path: Path, destination: Path) -> Path:
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    safe_left, safe_top, safe_right, safe_bottom = SHORTS_SAFE_BOUNDS
    blocked = (200, 54, 74, 76)
    draw.rectangle((0, 0, width, safe_top), fill=blocked)
    draw.rectangle((0, safe_bottom, width, height), fill=blocked)
    draw.rectangle((safe_right, safe_top, width, safe_bottom), fill=blocked)
    draw.rectangle((0, safe_top, safe_left, safe_bottom), fill=blocked)
    draw.rectangle(SHORTS_SAFE_BOUNDS, outline=(242, 165, 22, 255), width=6)
    draw.text((safe_left + 18, safe_bottom + 18), "重要情報セーフ領域", font=_font("bold", 25), fill=(255, 255, 255, 255))
    reviewed = Image.alpha_composite(image, overlay).convert("RGB")
    destination.parent.mkdir(parents=True, exist_ok=True)
    reviewed.save(destination)
    return destination


def create_contact_sheet(
    output_root: Path,
    destination: Path,
    baseline_root: Path | None = None,
) -> Path:
    current_root = _resolve_date_root(output_root)
    _extract_long_motion_frames(current_root)
    items: List[Tuple[str, Path]] = []
    if baseline_root:
        items.extend(_collect_review_images(_resolve_date_root(baseline_root), "旧版 / "))
    current_items = _collect_review_images(current_root, DESIGN_LABEL)
    items.extend(current_items)
    short_source = next((path for label, path in current_items if label.endswith("Shorts上位5頭")), None)
    if short_source is not None:
        overlay_path = _create_shorts_ui_overlay(short_source, destination.with_name("shorts-ui-overlay.png"))
        items.append((f"{DESIGN_LABEL}Shorts UI安全領域", overlay_path))
    if not items:
        raise RuntimeError(f"レビュー対象PNGが見つかりません: {current_root}")

    columns = 3
    cell_w = 760
    cell_h = 520
    gap = 24
    margin = 36
    rows = (len(items) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (margin * 2 + columns * cell_w + (columns - 1) * gap, margin * 2 + rows * cell_h + (rows - 1) * gap),
        SHEET_BG,
    )
    draw = ImageDraw.Draw(sheet)
    for index, (label, path) in enumerate(items):
        column = index % columns
        row = index // columns
        x = margin + column * (cell_w + gap)
        y = margin + row * (cell_h + gap)
        _draw_cell(sheet, draw, label, path, (x, y, x + cell_w, y + cell_h))

    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)

    for label, path in items:
        if label.endswith("長尺サムネイル") and label.startswith(DESIGN_LABEL):
            with Image.open(path) as thumbnail:
                thumbnail.convert("RGB").resize((246, 138), Image.Resampling.LANCZOS).save(
                    destination.with_name("thumbnail_246x138.png")
                )
            break
    return destination


def create_motion_review_videos(output_root: Path) -> list[Path]:
    """手動dry-run向けに、冒頭の短いレビュー動画だけを作る。"""

    date_root = _resolve_date_root(output_root)
    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        return []
    created: list[Path] = []
    long_video = _first((date_root / "long").glob("*/*.mp4")) if (date_root / "long").exists() else None
    short_video = _first((date_root / "shorts").glob("*/*.mp4")) if (date_root / "shorts").exists() else None
    review_dir = date_root / "motion-review"
    review_dir.mkdir(parents=True, exist_ok=True)
    for source, destination, duration, max_width in (
        (long_video, review_dir / "motion-review-long.mp4", 19.0, 960),
        (short_video, review_dir / "motion-review-short.mp4", 15.0, 540),
    ):
        if source is None:
            continue
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(source),
                "-t",
                f"{duration:.1f}",
                "-vf",
                f"scale='min({max_width},iw)':-2",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                str(destination),
            ],
            check=True,
        )
        created.append(destination)
    return created


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREE動画のデザイン確認用コンタクトシートを生成")
    parser.add_argument("output_root", type=Path, help="生成済み動画の日付ディレクトリ、またはその親")
    parser.add_argument("--baseline-root", type=Path, help="比較する旧版の日付ディレクトリ、またはその親")
    parser.add_argument("--destination", type=Path, help="出力PNG。未指定時はoutput_root内のdesign-contact-sheet.png")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    date_root = _resolve_date_root(args.output_root)
    destination = args.destination or date_root / "design-contact-sheet.png"
    created = create_contact_sheet(args.output_root, destination, args.baseline_root)
    print(f"コンタクトシートを生成しました: {created}")


if __name__ == "__main__":
    main()
