from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageOps

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video import renderer


SHEET_BG = (229, 227, 220)
CELL_BG = (248, 246, 240)
CELL_RULE = (180, 178, 169)
LABEL = (18, 23, 27)
SHORTS_SAFE_BOUNDS = (60, 250, 900, 1480)


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
        candidates = [
            ("長尺サムネイル", long_dir / "thumbnail.png"),
            ("長尺AI偏差値", _first(long_dir.glob("*_ai.png"))),
            ("長尺位置取り", _first(long_dir.glob("*_position.png"))),
            ("長尺アウトロ", long_dir / "999_outro.png"),
        ]
        for label, path in candidates:
            if path and path.exists():
                items.append((f"{prefix}{label}", path))

    if short_dir:
        candidates = [
            ("Shortsサイト紹介", short_dir / "000_site_intro.png"),
            ("Shorts冒頭", _last(short_dir.glob("000_intro_*.png"))),
            ("Shortsランキング", _last(short_dir.glob("001_race_*.png"))),
            ("Shorts位置取り", short_dir / "002_position.png"),
            ("Shortsアウトロ", short_dir / "999_outro.png"),
        ]
        for label, path in candidates:
            if path and path.exists():
                items.append((f"{prefix}{label}", path))
    return items


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
    draw.text((x1 + 18, y1 + 14), label, font=renderer._font(renderer.FONT_BOLD, 24), fill=LABEL)
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
    blocked = (157, 52, 56, 76)
    draw.rectangle((0, 0, width, safe_top), fill=blocked)
    draw.rectangle((0, safe_bottom, width, height), fill=blocked)
    draw.rectangle((safe_right, safe_top, width, safe_bottom), fill=blocked)
    draw.rectangle((0, safe_top, safe_left, safe_bottom), fill=blocked)
    draw.rectangle(SHORTS_SAFE_BOUNDS, outline=(200, 155, 60, 255), width=6)
    draw.text((safe_left + 18, safe_bottom + 18), "重要情報セーフ領域", font=renderer._font(renderer.FONT_BOLD, 25), fill=(255, 253, 247, 255))
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
    items: List[Tuple[str, Path]] = []
    if baseline_root:
        items.extend(_collect_review_images(_resolve_date_root(baseline_root), "旧版 / "))
    current_items = _collect_review_images(current_root, "v6 / ")
    items.extend(current_items)
    short_source = next((path for label, path in current_items if label.endswith("Shortsランキング")), None)
    if short_source is not None:
        overlay_path = _create_shorts_ui_overlay(short_source, destination.with_name("shorts-ui-overlay.png"))
        items.append(("v6 / Shorts UI安全領域", overlay_path))
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
        if label.endswith("長尺サムネイル") and label.startswith("v6"):
            with Image.open(path) as thumbnail:
                thumbnail.convert("RGB").resize((246, 138), Image.Resampling.LANCZOS).save(
                    destination.with_name("thumbnail_246x138.png")
                )
            break
    return destination


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
