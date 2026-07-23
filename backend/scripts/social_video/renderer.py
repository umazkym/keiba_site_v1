from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import textwrap
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Sequence

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from .data_loader import (
    HorseVideoData,
    RaceVideoData,
    VenueVideoData,
    build_video_url,
    pick_featured_race,
    top_by_deviation,
)
from .video_package import VideoPackage, build_content_hash, build_rights_manifest_hash
from .visual_assets import (
    AudioAsset,
    CourseAsset,
    VisualAsset,
    asset_credit_lines,
    audio_asset_metadata,
    course_asset_metadata,
    resolve_audio_asset,
    resolve_course_asset,
    resolve_visual_asset,
    visual_asset_metadata,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
FONT_DIR = PROJECT_ROOT / "backend" / "fonts"
BRAND_LOGO_CANDIDATES = (
    PROJECT_ROOT / "frontend" / "public" / "new-logo.png",
    PROJECT_ROOT / "frontend" / "public" / "new-logo.webp",
    FONT_DIR / "new-logo.png",
)

FONT_BLACK = "NotoSansJP-Black"
FONT_BOLD = "NotoSansJP-Bold"
FONT_REGULAR = "NotoSansJP-Regular"
WINDOWS_FONT_DIR = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"

PAPER = (247, 244, 237)
PAPER_DARK = (235, 231, 221)
CHARCOAL = (18, 23, 27)
CHARCOAL_SOFT = (43, 49, 52)
DEEP_GREEN = (14, 90, 67)
GREEN_DARK = (8, 62, 47)
BURGUNDY = (157, 52, 56)
EDITORIAL_GOLD = (200, 155, 60)
EDITORIAL_GOLD_DARK = (145, 105, 35)
INK_DARK = (18, 23, 27)
INK_MUTED = (115, 122, 124)
RULE = (198, 193, 181)
TURF_LIGHT = (221, 232, 210)
TRACK_BEIGE = (210, 190, 153)

# 旧ヘルパーが参照する互換エイリアス。v6の描画では役割別の上記色を直接使う。
BG_CANVAS = PAPER
POP_BLUE = CHARCOAL
POP_BLUE_LIGHT = CHARCOAL_SOFT
POP_PANEL = CHARCOAL
TEXT_DARK_POP = INK_DARK
STEEL = INK_MUTED
CRIMSON = BURGUNDY
CRIMSON_DEEP = (105, 31, 33)
POP_GOLD = EDITORIAL_GOLD
POP_GOLD_DARK = EDITORIAL_GOLD_DARK
TURF = DEEP_GREEN
POP_PINK = BURGUNDY
POP_TEAL = DEEP_GREEN
CARD_BG = (252, 250, 245)
CARD_SOFT = PAPER_DARK
SHADOW_POP = CHARCOAL
BG_BLACK = CHARCOAL
PANEL_BG = CHARCOAL
RED = BURGUNDY
GOLD = EDITORIAL_GOLD
DATA_PURPLE = CHARCOAL_SOFT
WHITE = (255, 253, 247)
TEXT_OUTLINE = (6, 9, 10)
GREEN = DEEP_GREEN
SILVER = (201, 205, 211)
BRONZE = (181, 101, 29)
MUTED_TEXT = (184, 188, 200)
CARD_1ST_BG = (255, 255, 255)
CARD_2ND_BG = (255, 255, 255)
CARD_3RD_BG = (255, 255, 255)
GRAY_BORDER = (92, 96, 108)
RANK_BADGE_GRAY = (132, 139, 150)
SILHOUETTE_GRAY = POP_BLUE_LIGHT

INK = WHITE
MUTED = MUTED_TEXT
TEXT_DARK = TEXT_DARK_POP
BLACK = BG_BLACK
BLUE = (34, 73, 132)
CYAN = GOLD
YELLOW = GOLD
NAVY = POP_BLUE
POSTER_GREEN = GREEN
TABLE_BLUE = PANEL_BG
DEEP = BG_BLACK
DEEP_2 = BG_BLACK
PANEL = PANEL_BG
PANEL_DARK = (20, 40, 47)

SITE_CLAIM = "中央・地方 全レースを毎日無料公開"
SITE_NO_REGISTRATION = "登録不要"
FEATURE_ITEMS = (
    ("AI偏差値", "能力を数値化", "deviation"),
    ("対戦成績", "過去の直接対決", "matchup"),
    ("位置取り予測", "序盤の隊列予測", "position"),
    ("枠順傾向", "全コース別に集計", "waku"),
)
LONG_VENUE_SLIDE_SECONDS = 2.0
LONG_RACE_SLIDE_SECONDS = 4.2
LONG_POSITION_SLIDE_SECONDS = 3.2
LONG_OUTRO_SECONDS = 4.0
SHORT_RACE_SLIDE_SECONDS = 5.0
SHORT_POSITION_SLIDE_SECONDS = 5.5
SHORT_OUTRO_SECONDS = 3.5
VIDEO_FPS = 30
KEN_BURNS_ZOOM_TO = 1.0
CROSSFADE_SECONDS = 0.16
@dataclass
class Slide:
    image_path: Path
    duration_seconds: float


RenderedVideo = VideoPackage


@dataclass(frozen=True)
class RankCardStyle:
    bg: tuple[int, int, int]
    border: tuple[int, int, int]
    border_width: int
    badge_fill: tuple[int, int, int]
    badge_text: tuple[int, int, int]
    score_fill: tuple[int, int, int]
    score_size: int


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    requested = Path(name)
    noto_weight = "Bold" if "Black" in name or "Bold" in name else "Regular"
    candidates = [
        requested if requested.is_absolute() else WINDOWS_FONT_DIR / name,
        FONT_DIR / name,
        WINDOWS_FONT_DIR / "NotoSansJP-VF.ttf",
        WINDOWS_FONT_DIR / "BIZ-UDGothicB.ttc",
        Path(f"/usr/share/fonts/opentype/noto/NotoSansCJK-{noto_weight}.ttc"),
        Path(f"/usr/share/fonts/opentype/noto/NotoSansCJKjp-{noto_weight}.otf"),
        FONT_DIR / "MPLUSRounded1c-Bold.ttf",
        FONT_DIR / "MPLUSRounded1c-Regular.ttf",
    ]
    for path in candidates:
        if path.exists():
            font = ImageFont.truetype(str(path), size=size)
            if path.name == "NotoSansJP-VF.ttf":
                variation = "Black" if "Black" in name else "Bold" if "Bold" in name else "Regular"
                try:
                    font.set_variation_by_name(variation)
                except (AttributeError, OSError):
                    pass
            return font
    return ImageFont.load_default()


def _resolve_brand_logo_path() -> Optional[Path]:
    explicit = os.getenv("SOCIAL_VIDEO_BRAND_LOGO_PATH", "").strip()
    candidates = (Path(explicit), *BRAND_LOGO_CANDIDATES) if explicit else BRAND_LOGO_CANDIDATES
    return next((path.resolve() for path in candidates if path.is_file()), None)


@lru_cache(maxsize=12)
def _load_brand_logo(path_text: str, diameter: int) -> Image.Image:
    with Image.open(path_text) as source:
        logo = source.convert("RGBA")
    side = min(logo.size)
    left = (logo.width - side) // 2
    top = (logo.height - side) // 2
    logo = logo.crop((left, top, left + side, top + side)).resize((diameter, diameter), Image.Resampling.LANCZOS)
    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    logo.putalpha(mask)
    return logo


def _brand_logo_metadata() -> Optional[dict]:
    path = _resolve_brand_logo_path()
    if path is None:
        return None
    try:
        relative = path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        relative = str(path)
    return {"type": "brand_logo", "path": str(path), "asset_id": relative}


def _safe_filename(text: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in text)
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")[:80] or "video"


def _text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _draw_round_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int],
    outline: Optional[tuple[int, int, int]] = None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def _draw_shadow_round_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int],
    outline: Optional[tuple[int, int, int]] = None,
    width: int = 1,
    shadow_offset: tuple[int, int] = (6, 7),
    shadow_fill: tuple[int, int, int] = (18, 22, 31),
) -> None:
    sx, sy = shadow_offset
    shadow_xy = (xy[0] + sx, xy[1] + sy, xy[2] + sx, xy[3] + sy)
    draw.rounded_rectangle(shadow_xy, radius=radius, fill=shadow_fill)
    _draw_round_rect(draw, xy, radius, fill, outline, width)


def _fit_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int, max_lines: int) -> List[str]:
    if not text:
        return []
    raw_lines = text.splitlines()
    lines: List[str] = []
    truncated = False
    for raw_index, raw_line in enumerate(raw_lines):
        current = ""
        for char in raw_line:
            test = current + char
            width, _ = _text_size(draw, test, font)
            if width <= max_width or not current:
                current = test
                continue
            lines.append(current)
            current = char
            if len(lines) >= max_lines:
                truncated = True
                break
        if len(lines) >= max_lines:
            if current and current != raw_line:
                truncated = True
            if raw_index < len(raw_lines) - 1:
                truncated = True
            break
        if current:
            lines.append(current)
        if len(lines) >= max_lines and raw_index < len(raw_lines) - 1:
            truncated = True
            break
    if len(lines) > max_lines:
        truncated = True
        lines = lines[:max_lines]
    if truncated and lines:
        while lines[-1] and _text_size(draw, lines[-1], font)[0] > max_width:
            lines[-1] = lines[-1][:-1]
    return lines


def _fit_text_no_ellipsis(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_name: str,
    max_size: int,
    min_size: int,
    max_width: int,
    max_lines: int = 1,
) -> tuple[ImageFont.ImageFont, List[str]]:
    cleaned = (text or "").replace(chr(46) * 3, "").replace(chr(8230), "").strip()
    expected_text = cleaned.replace("\r", "").replace("\n", "")
    for size in range(max_size, min_size - 1, -2):
        font = _font(font_name, size)
        lines = _fit_text(draw, cleaned, font, max_width, max_lines)
        if not lines:
            return font, []
        line_height = max(_text_size(draw, line, font)[1] for line in lines)
        rendered_text = "".join(lines).replace("\r", "").replace("\n", "")
        if (
            rendered_text == expected_text
            and len(lines) <= max_lines
            and all(_text_size(draw, line, font)[0] <= max_width for line in lines)
            and line_height > 0
        ):
            return font, lines
    font = _font(font_name, min_size)
    lines = _fit_text(draw, cleaned, font, max_width, max_lines)[:max_lines]
    return font, lines


def _draw_fit_text_no_ellipsis(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font_name: str,
    max_size: int,
    min_size: int,
    max_width: int,
    fill: tuple[int, int, int],
    max_lines: int = 1,
    line_gap: int = 8,
    anchor: Optional[str] = None,
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int] = BLACK,
) -> int:
    font, lines = _fit_text_no_ellipsis(draw, text, font_name, max_size, min_size, max_width, max_lines)
    x, y = xy
    for line in lines:
        if stroke_width:
            draw.text((x, y), line, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill, anchor=anchor)
        else:
            draw.text((x, y), line, font=font, fill=fill, anchor=anchor)
        _, line_h = _text_size(draw, line, font)
        y += line_h + line_gap
    return y


def _draw_text_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_gap: int,
    max_lines: int,
) -> int:
    x, y = xy
    for line in _fit_text(draw, text, font, max_width, max_lines):
        draw.text((x, y), line, font=font, fill=fill)
        _, line_height = _text_size(draw, line, font)
        y += line_height + line_gap
    return y


def _draw_tag(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: tuple[int, int, int], text_fill: tuple[int, int, int], font_size: int) -> tuple[int, int]:
    x, y = xy
    font = _font(FONT_BOLD, font_size)
    text_width, text_height = _text_size(draw, text, font)
    pad_x = max(18, font_size // 2)
    pad_y = max(8, font_size // 4)
    rect = (x, y, x + text_width + pad_x * 2, y + text_height + pad_y * 2)
    _draw_round_rect(draw, rect, max(10, font_size // 2), fill)
    draw.text((x + pad_x, y + pad_y - 1), text, font=font, fill=text_fill)
    return rect[2], rect[3]


def _display_date(date_text: str) -> str:
    parts = date_text.split("-")
    if len(parts) == 3:
        try:
            return f"{int(parts[0])}.{int(parts[1])}.{int(parts[2])}"
        except ValueError:
            return date_text
    return date_text


def _display_short_date(date_text: str) -> str:
    parts = date_text.split("-")
    if len(parts) != 3:
        return _display_date(date_text)
    try:
        year, month, day = (int(part) for part in parts)
        weekday = "月火水木金土日"[date(year, month, day).weekday()]
        return f"{month}/{day}({weekday})"
    except ValueError:
        return _display_date(date_text)


def _draw_stroke_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    stroke_fill: tuple[int, int, int] = TEXT_OUTLINE,
    stroke_width: int = 5,
    anchor: Optional[str] = None,
) -> None:
    draw.text(xy, text, font=font, fill=fill, stroke_fill=stroke_fill, stroke_width=stroke_width, anchor=anchor)


def _draw_shadow_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] = WHITE,
    stroke_width: int = 5,
    shadow_offset: tuple[int, int] = (5, 6),
    anchor: Optional[str] = None,
) -> None:
    x, y = xy
    draw.text(
        (x + shadow_offset[0], y + shadow_offset[1]),
        text,
        font=font,
        fill=(0, 0, 0),
        stroke_width=0,
        stroke_fill=(0, 0, 0),
        anchor=anchor,
    )
    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=TEXT_OUTLINE,
        anchor=anchor,
    )


def _fit_font_for_width(draw: ImageDraw.ImageDraw, text: str, font_name: str, start_size: int, min_size: int, max_width: int) -> ImageFont.ImageFont:
    for size in range(start_size, min_size - 1, -2):
        font = _font(font_name, size)
        if _text_size(draw, text, font)[0] <= max_width:
            return font
    return _font(font_name, min_size)


def _draw_fit_stroke_line(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font_name: str,
    start_size: int,
    min_size: int,
    max_width: int,
    fill: tuple[int, int, int],
    stroke_fill: tuple[int, int, int] = TEXT_OUTLINE,
    stroke_width: int = 5,
    anchor: Optional[str] = None,
) -> int:
    font = _fit_font_for_width(draw, text, font_name, start_size, min_size, max_width)
    _draw_stroke_text(draw, xy, text, font, fill, stroke_fill, stroke_width, anchor=anchor)
    return _text_size(draw, text, font)[1]


def _draw_fit_shadow_line(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font_name: str,
    start_size: int,
    min_size: int,
    max_width: int,
    fill: tuple[int, int, int] = WHITE,
    stroke_width: int = 7,
    anchor: Optional[str] = None,
) -> int:
    font = _fit_font_for_width(draw, text, font_name, start_size, min_size, max_width)
    _draw_shadow_text(draw, xy, text, font, fill=fill, stroke_width=stroke_width, anchor=anchor)
    return _text_size(draw, text, font)[1]


def _draw_stroke_text_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_gap: int,
    max_lines: int,
    stroke_fill: tuple[int, int, int] = BLACK,
    stroke_width: int = 4,
) -> int:
    x, y = xy
    for line in _fit_text(draw, text, font, max_width, max_lines):
        _draw_stroke_text(draw, (x, y), line, font, fill, stroke_fill, stroke_width)
        _, line_height = _text_size(draw, line, font)
        y += line_height + line_gap
    return y


def _score_text(score: Optional[float]) -> str:
    return "--" if score is None else f"{score:.1f}"


def _grade_line(venue: VenueVideoData) -> str:
    grade_names = " / ".join(race.display_name for race in venue.grade_races[:2])
    return grade_names or f"{venue.race_type}競馬"


def _best_horse_for_race(race: RaceVideoData) -> Optional[HorseVideoData]:
    horses = top_by_deviation(race, 1)
    return horses[0] if horses else None


def _best_horse_for_venue(venue: VenueVideoData) -> tuple[Optional[RaceVideoData], Optional[HorseVideoData]]:
    featured_race = pick_featured_race(venue)
    return featured_race, _best_horse_for_race(featured_race) if featured_race else None


def _hero_score_text(horse: Optional[HorseVideoData]) -> str:
    return _score_text(horse.deviation_score) if horse else "--"


def _hero_horse_label(horse: Optional[HorseVideoData]) -> str:
    if not horse:
        return "データ集計中"
    return f"{horse.horse_number}番 {horse.horse_name}"


def _waku_color(waku_number: Optional[int]) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    palette = {
        1: ((255, 255, 255), (17, 24, 39)),
        2: ((17, 24, 39), (255, 255, 255)),
        3: ((220, 38, 38), (255, 255, 255)),
        4: ((37, 99, 235), (255, 255, 255)),
        5: ((234, 179, 8), (17, 24, 39)),
        6: ((22, 163, 74), (255, 255, 255)),
        7: ((234, 88, 12), (255, 255, 255)),
        8: ((236, 72, 153), (255, 255, 255)),
    }
    if waku_number in palette:
        return palette[waku_number]
    return (229, 231, 235), (17, 24, 39)


def _draw_horse_number_badge(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    horse: Optional[HorseVideoData],
    diameter: int,
    stroke_width: int = 6,
) -> None:
    number = horse.horse_number if horse else 0
    frame_fill, text_fill = _waku_color(horse.waku_number if horse else None)
    cx, cy = center
    radius = diameter / 2
    box = (round(cx - radius), round(cy - radius), round(cx + radius), round(cy + radius))
    if horse and horse.waku_number == 1:
        draw.ellipse(box, fill=frame_fill, outline=(203, 213, 225), width=max(1, min(2, stroke_width)))
    else:
        draw.ellipse(box, fill=frame_fill)
    font = _font("Inter-Black.ttf", max(18, round(diameter * 0.46)))
    draw.text((cx, cy), str(number or "-"), font=font, fill=text_fill, anchor="mm")


def _draw_score_ring(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    score: Optional[float],
) -> None:
    x1, y1, x2, y2 = box
    width = max(18, (x2 - x1) // 13)
    draw.ellipse(box, outline=(73, 112, 169), width=width)
    if score is None:
        return
    ratio = max(0.0, min(1.0, (score - 45.0) / 35.0))
    draw.arc(box, start=-90, end=-90 + int(360 * ratio), fill=GOLD, width=width)


def _draw_course_lines(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    lane = (43, 49, 65)
    rail = (68, 72, 86)
    start_x = int(width * 0.42)
    for idx in range(7):
        y = int(height * (0.22 + idx * 0.095))
        draw.line((start_x, y + 64, width + 80, y - 34), fill=lane, width=4)
    draw.line((start_x - 22, int(height * 0.78), width + 80, int(height * 0.58)), fill=rail, width=7)
    draw.line((start_x - 22, int(height * 0.84), width + 80, int(height * 0.66)), fill=(35, 41, 58), width=5)

    shoe_w = int(width * 0.18)
    shoe_h = int(height * 0.34)
    cx = int(width * 0.73)
    cy = int(height * 0.46)
    shoe_box = (cx - shoe_w // 2, cy - shoe_h // 2, cx + shoe_w // 2, cy + shoe_h // 2)
    draw.arc(shoe_box, 205, 515, fill=(44, 47, 61), width=max(8, width // 155))
    nail_r = max(5, width // 210)
    for nx, ny in [
        (cx - int(shoe_w * 0.32), cy - int(shoe_h * 0.10)),
        (cx - int(shoe_w * 0.22), cy + int(shoe_h * 0.18)),
        (cx + int(shoe_w * 0.22), cy + int(shoe_h * 0.18)),
        (cx + int(shoe_w * 0.32), cy - int(shoe_h * 0.10)),
    ]:
        draw.ellipse((nx - nail_r, ny - nail_r, nx + nail_r, ny + nail_r), fill=(54, 58, 74))


def _draw_speed_lines(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: tuple[int, int, int], count: int = 7) -> None:
    x1, y1, x2, y2 = box
    width = x2 - x1
    height = y2 - y1
    line_w = max(6, width // 80)
    for idx in range(count):
        y = y1 + int(height * (0.22 + idx * 0.09))
        start = x1 + int(width * (0.02 + (idx % 3) * 0.04))
        end = x1 + int(width * (0.48 + (idx % 2) * 0.12))
        draw.line((start, y, end, y - int(height * 0.08)), fill=color, width=line_w)


def _draw_horse_silhouette(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int] = BLACK,
    accent: tuple[int, int, int] = RED,
) -> None:
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    if w <= 0 or h <= 0:
        return

    _draw_speed_lines(draw, (x1, y1, x2, y2), accent, count=6)

    body = (x1 + int(w * 0.26), y1 + int(h * 0.40), x1 + int(w * 0.76), y1 + int(h * 0.62))
    draw.ellipse(body, fill=fill)
    draw.polygon(
        [
            (x1 + int(w * 0.67), y1 + int(h * 0.42)),
            (x1 + int(w * 0.82), y1 + int(h * 0.23)),
            (x1 + int(w * 0.88), y1 + int(h * 0.31)),
            (x1 + int(w * 0.74), y1 + int(h * 0.48)),
        ],
        fill=fill,
    )
    draw.ellipse(
        (
            x1 + int(w * 0.82),
            y1 + int(h * 0.20),
            x1 + int(w * 0.96),
            y1 + int(h * 0.34),
        ),
        fill=fill,
    )
    draw.polygon(
        [
            (x1 + int(w * 0.84), y1 + int(h * 0.20)),
            (x1 + int(w * 0.87), y1 + int(h * 0.10)),
            (x1 + int(w * 0.89), y1 + int(h * 0.22)),
        ],
        fill=fill,
    )
    draw.polygon(
        [
            (x1 + int(w * 0.29), y1 + int(h * 0.43)),
            (x1 + int(w * 0.06), y1 + int(h * 0.35)),
            (x1 + int(w * 0.18), y1 + int(h * 0.50)),
        ],
        fill=fill,
    )

    leg_w = max(9, w // 48)
    legs = [
        ((0.34, 0.59), (0.27, 0.82), (0.16, 0.95)),
        ((0.45, 0.60), (0.50, 0.82), (0.64, 0.90)),
        ((0.58, 0.59), (0.52, 0.84), (0.42, 0.97)),
        ((0.69, 0.56), (0.75, 0.76), (0.91, 0.88)),
    ]
    for p1, p2, p3 in legs:
        draw.line(
            (
                x1 + int(w * p1[0]),
                y1 + int(h * p1[1]),
                x1 + int(w * p2[0]),
                y1 + int(h * p2[1]),
                x1 + int(w * p3[0]),
                y1 + int(h * p3[1]),
            ),
            fill=fill,
            width=leg_w,
            joint="curve",
        )

    draw.ellipse(
        (
            x1 + int(w * 0.44),
            y1 + int(h * 0.20),
            x1 + int(w * 0.52),
            y1 + int(h * 0.30),
        ),
        fill=fill,
    )
    draw.line(
        (
            x1 + int(w * 0.49),
            y1 + int(h * 0.29),
            x1 + int(w * 0.54),
            y1 + int(h * 0.43),
            x1 + int(w * 0.62),
            y1 + int(h * 0.51),
        ),
        fill=fill,
        width=max(7, w // 65),
        joint="curve",
    )


def _draw_horse_watermark(
    image: Image.Image,
    box: tuple[int, int, int, int],
    opacity: float = 0.15,
) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    alpha = max(0, min(255, int(255 * opacity)))
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    _draw_horse_silhouette(
        overlay_draw,
        box,
        fill=(*SILHOUETTE_GRAY, alpha),
        accent=(*RED, max(18, alpha // 2)),
    )
    composed = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    return composed, ImageDraw.Draw(composed)


def _save_slide(image: Image.Image, path: Path, expected_size: tuple[int, int]) -> None:
    if image.size != expected_size:
        raise RuntimeError(f"画像サイズが不正です: {path} expected={expected_size} actual={image.size}")
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        image.save(path, format="JPEG", quality=90, optimize=True, progressive=True)
    else:
        image.save(path)


def _cover_crop(source: Image.Image, size: tuple[int, int], focus: tuple[float, float]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    resized = source.resize(
        (max(target_w, round(source.width * scale)), max(target_h, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    focus_x = max(0.0, min(1.0, focus[0])) * resized.width
    focus_y = max(0.0, min(1.0, focus[1])) * resized.height
    left = max(0, min(resized.width - target_w, round(focus_x - target_w / 2)))
    top = max(0, min(resized.height - target_h, round(focus_y - target_h / 2)))
    return resized.crop((left, top, left + target_w, top + target_h))


def _draw_fallback_race_visual(size: tuple[int, int], compact: bool) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, CHARCOAL)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, height), fill=(14, 20, 23))

    if compact:
        track_box = (-360, 320, width + 500, 1600)
        finish_x = width - 170
        finish_top = 470
        finish_bottom = 1350
    else:
        track_box = (width // 3, -260, width + 520, height + 300)
        finish_x = width - 210
        finish_top = 140
        finish_bottom = height - 120

    draw.ellipse(track_box, fill=(16, 34, 29), outline=(115, 104, 78), width=max(18, width // 55))
    lane_gap = max(34, width // 35)
    for lane in range(1, 6):
        inset = lane * lane_gap
        draw.ellipse(
            (track_box[0] + inset, track_box[1] + inset, track_box[2] - inset, track_box[3] - inset),
            outline=(65 + lane * 7, 70 + lane * 5, 61),
            width=max(4, width // 260),
        )

    square = max(18, width // 70)
    for row, y in enumerate(range(finish_top, finish_bottom, square)):
        for column in range(2):
            fill = PAPER if (row + column) % 2 == 0 else CHARCOAL
            draw.rectangle((finish_x + column * square, y, finish_x + (column + 1) * square, y + square), fill=fill)

    trail_start_x = int(width * (0.50 if not compact else 0.15))
    trail_end_x = int(width * 0.88)
    center_y = int(height * (0.58 if not compact else 0.52))
    for idx in range(5):
        y = center_y + (idx - 2) * max(48, height // 15)
        draw.line((trail_start_x + idx * 22, y + 36, trail_end_x, y - 10), fill=(116, 91, 41), width=max(5, width // 220))
        dot_r = max(10, width // 95)
        draw.ellipse((trail_end_x - dot_r, y - 10 - dot_r, trail_end_x + dot_r, y - 10 + dot_r), fill=EDITORIAL_GOLD)
    return image


def _hero_background(
    size: tuple[int, int],
    target_date: str,
    venue_name: str,
    race_number: Optional[int],
    asset_override: Optional[VisualAsset] = None,
) -> tuple[Image.Image, Optional[VisualAsset]]:
    compact = size[1] > size[0]
    orientation = "vertical" if compact else "wide"
    asset = asset_override or resolve_visual_asset(target_date, venue_name, race_number, orientation)
    if asset is None:
        return _draw_fallback_race_visual(size, compact), None

    try:
        with Image.open(asset.path) as source:
            source = source.convert("RGB")
            image = _cover_crop(source, size, asset.focus)
    except OSError as exc:
        raise RuntimeError(f"動画用写真を読み込めません: {asset.path} ({exc})") from exc

    image = ImageEnhance.Color(image).enhance(0.92)
    image = ImageEnhance.Contrast(image).enhance(1.04)
    return image, asset


def _apply_photo_scrim(image: Image.Image, compact: bool) -> Image.Image:
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    if compact:
        start_y = int(height * 0.34)
        end_y = int(height * 0.72)
        draw.rectangle((0, 0, width, start_y), fill=(8, 13, 15, 142))
        for y in range(start_y, end_y + 1):
            ratio = (y - start_y) / max(end_y - start_y, 1)
            alpha = round(142 + (16 - 142) * ratio)
            draw.line((0, y, width, y), fill=(8, 13, 15, alpha))
        draw.rectangle((0, end_y + 1, width, height), fill=(8, 13, 15, 10))
    else:
        start_x = int(width * 0.40)
        end_x = int(width * 0.66)
        draw.rectangle((0, 0, start_x, height), fill=(8, 13, 15, 170))
        for x in range(start_x, end_x + 1):
            ratio = (x - start_x) / max(end_x - start_x, 1)
            alpha = round(170 + (8 - 170) * ratio)
            draw.line((x, 0, x, height), fill=(8, 13, 15, alpha))
        draw.rectangle((end_x + 1, 0, width, height), fill=(8, 13, 15, 8))
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def _draw_brand_lockup(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    compact: bool = False,
    light: bool = True,
    logo_size: Optional[int] = None,
) -> None:
    diameter = logo_size or (48 if compact else 56)
    fill = WHITE if light else INK_DARK
    logo_path = _resolve_brand_logo_path()
    if logo_path is not None:
        logo = _load_brand_logo(str(logo_path), diameter)
        image.paste(logo, (x, y), logo)
    else:
        draw.ellipse((x, y, x + diameter, y + diameter), fill=WHITE, outline=EDITORIAL_GOLD, width=3)
        draw.text((x + diameter // 2, y + 5), "U", font=_font("Inter-Black.ttf", int(diameter * 0.58)), fill=EDITORIAL_GOLD, anchor="ma")
    text_x = x + diameter + 14
    draw.text((text_x, y + (8 if compact else 10)), "UMA-FREE", font=_font("Inter-Bold.ttf", 25 if compact else 28), fill=fill)


def _draw_editorial_header(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    size: tuple[int, int],
    race: RaceVideoData,
    section: str,
) -> None:
    width, height = size
    compact = height > width
    left = 60
    right = width - (180 if compact else 60)
    top = 72 if compact else 26
    _draw_brand_lockup(image, draw, left, top, compact=compact, light=False)
    if compact:
        draw.text((right, top + 2), f"RACE {race.race_number:02d} / 12", font=_font("Inter-Bold.ttf", 23), fill=INK_MUTED, anchor="ra")
        draw.line((left, 158, right, 158), fill=RULE, width=2)
        draw.text((left, 188), f"{race.venue_name}{race.race_number}R  {race.course_label}", font=_font(FONT_BOLD, 28), fill=DEEP_GREEN)
        _draw_fit_text_no_ellipsis(draw, race.display_name, (left, 252), FONT_BLACK, 53, 32, right - left, INK_DARK, max_lines=2, line_gap=5)
        section_font = _font(FONT_BOLD, 25)
        draw.text((left, 390), section, font=section_font, fill=INK_MUTED)
        section_width, _ = _text_size(draw, section, section_font)
        draw.line((left + section_width + 24, 409, right, 409), fill=EDITORIAL_GOLD, width=4)
    else:
        draw.text((330, top + 1), f"{race.venue_name}{race.race_number}R  {race.course_label}", font=_font(FONT_BOLD, 27), fill=DEEP_GREEN)
        _draw_fit_text_no_ellipsis(draw, race.display_name, (620, top - 5), FONT_BLACK, 40, 27, 820, INK_DARK, max_lines=1)
        draw.text((right, top + 3), f"{section}  {race.race_number:02d}/12", font=_font(FONT_BOLD, 25), fill=INK_MUTED, anchor="ra")
        draw.line((left, 92, right, 92), fill=RULE, width=2)
        progress = round((right - left) * min(12, max(1, race.race_number)) / 12)
        draw.line((left, 92, left + progress, 92), fill=EDITORIAL_GOLD, width=5)


def _draw_score_bar_v5(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    score: Optional[float],
    fill: tuple[int, int, int] = EDITORIAL_GOLD,
) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=(214, 211, 202))
    if score is None:
        return
    ratio = max(0.04, min(1.0, (score - 45.0) / 30.0))
    draw.rectangle((x1, y1, x1 + round((x2 - x1) * ratio), y2), fill=fill)


def _draw_feature_graphic(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    graphic_type: str,
) -> None:
    x1, y1, x2, y2 = box
    width = max(1, x2 - x1)
    height = max(1, y2 - y1)
    blue = (37, 99, 235)
    emerald = (16, 185, 129)
    amber = (245, 158, 11)
    slate = (148, 163, 184)
    rose = (225, 29, 72)

    if graphic_type == "deviation":
        bar_h = max(4, height // 7)
        for index, (ratio, color) in enumerate(((0.88, blue), (0.64, amber), (0.72, slate))):
            top = y1 + index * (bar_h + max(4, bar_h // 2))
            draw.rectangle((x1, top, x2, top + bar_h), fill=(226, 232, 240))
            draw.rectangle((x1, top, x1 + round(width * ratio), top + bar_h), fill=color)
        return

    if graphic_type == "matchup":
        gap = max(3, width // 40)
        cell_w = (width - gap * 2) // 3
        cell_h = (height - gap) // 2
        values = (("+2", (236, 253, 245), (4, 120, 87)), ("0", (241, 245, 249), (100, 116, 139)), ("-1", (255, 241, 242), (190, 18, 60)), ("0", (241, 245, 249), (100, 116, 139)), ("+1", (236, 253, 245), (4, 120, 87)), ("0", (241, 245, 249), (100, 116, 139)))
        font = _font("Inter-Bold.ttf", max(10, round(min(cell_w, cell_h) * 0.44)))
        for index, (value, fill, text_fill) in enumerate(values):
            column = index % 3
            row = index // 3
            left = x1 + column * (cell_w + gap)
            top = y1 + row * (cell_h + gap)
            draw.rectangle((left, top, left + cell_w, top + cell_h), fill=fill)
            draw.text((left + cell_w // 2, top + cell_h // 2), value, font=font, fill=text_fill, anchor="mm")
        return

    values = (0.54, 0.76, 0.38, 0.64) if graphic_type == "position" else (0.82, 0.42, 0.66, 0.36)
    color = emerald if graphic_type == "position" else blue
    gap = max(5, width // 20)
    bar_w = (width - gap * 3) // 4
    for index, ratio in enumerate(values):
        left = x1 + index * (bar_w + gap)
        bar_height = max(5, round(height * ratio))
        draw.rectangle((left, y2 - bar_height, left + bar_w, y2), fill=color)


def _draw_feature_grid(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    columns: int,
    compact: bool,
    show_descriptions: bool,
) -> None:
    x1, y1, x2, y2 = box
    rows = math.ceil(len(FEATURE_ITEMS) / columns)
    gap = 10 if compact else 14
    tile_w = (x2 - x1 - gap * (columns - 1)) // columns
    tile_h = (y2 - y1 - gap * (rows - 1)) // rows
    for index, (title, description, graphic_type) in enumerate(FEATURE_ITEMS):
        column = index % columns
        row = index // columns
        left = x1 + column * (tile_w + gap)
        top = y1 + row * (tile_h + gap)
        right = left + tile_w
        bottom = top + tile_h
        draw.rectangle((left, top, right, bottom), fill=(252, 250, 245), outline=(203, 213, 225), width=1)
        graphic_w = min(round(tile_w * 0.34), 126 if not compact else 108)
        graphic_box = (left + 14, top + 18, left + 14 + graphic_w, bottom - 18)
        _draw_feature_graphic(draw, graphic_box, graphic_type)
        text_x = graphic_box[2] + 16
        title_size = 24 if not compact else 23
        draw.text((text_x, top + 16), title, font=_font(FONT_BOLD, title_size), fill=INK_DARK)
        if show_descriptions:
            _draw_fit_text_no_ellipsis(
                draw,
                description,
                (text_x, top + 52),
                FONT_REGULAR,
                18 if not compact else 17,
                14,
                max(60, right - text_x - 12),
                INK_MUTED,
                max_lines=1,
            )


def _draw_site_claim_line(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    max_width: int,
    compact: bool,
) -> None:
    claim_size = 27 if not compact else 25
    claim_font = _fit_font_for_width(draw, SITE_CLAIM, FONT_BOLD, claim_size, 20, max_width - 150)
    draw.text((x, y), SITE_CLAIM, font=claim_font, fill=WHITE)
    claim_width, claim_height = _text_size(draw, SITE_CLAIM, claim_font)
    badge_w = 126 if not compact else 118
    badge_h = max(34, claim_height + 8)
    badge_x = min(x + max_width - badge_w, x + claim_width + 18)
    draw.rectangle((badge_x, y - 3, badge_x + badge_w, y - 3 + badge_h), fill=EDITORIAL_GOLD)
    draw.text(
        (badge_x + badge_w // 2, y - 3 + badge_h // 2),
        SITE_NO_REGISTRATION,
        font=_font(FONT_BOLD, 18 if not compact else 17),
        fill=INK_DARK,
        anchor="mm",
    )


def _draw_photo_score_module(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    horse: Optional[HorseVideoData],
    compact: bool,
    score_override: Optional[float] = None,
    show_score: bool = True,
) -> None:
    x1, y1, x2, y2 = box
    score = score_override if score_override is not None else (horse.deviation_score if horse else None)
    draw.rectangle(box, fill=(15, 21, 25))
    draw.rectangle((x1, y1, x1 + 8, y2), fill=EDITORIAL_GOLD)
    badge_d = 86 if compact else 82
    _draw_horse_number_badge(draw, (x1 + 70, y1 + (y2 - y1) // 2), horse, badge_d, stroke_width=3)
    name_x = x1 + 140
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name if horse else "データ集計中",
        (name_x, y1 + 26),
        FONT_BLACK,
        42 if compact else 38,
        25,
        (x2 - x1) - 430,
        WHITE,
        max_lines=1,
        stroke_width=2,
        stroke_fill=TEXT_OUTLINE,
    )
    position_label = horse.position_label if horse and horse.position_label in {"先行", "中団", "後方"} else "未確定"
    draw.text((name_x, y1 + 84), f"位置取り  {position_label}", font=_font(FONT_REGULAR, 21 if not compact else 23), fill=(214, 215, 210))
    score_x = x2 - 34
    if show_score and score is not None:
        draw.text((score_x, y1 + 12), _score_text(score), font=_font("Inter-Black.ttf", 104 if compact else 96), fill=EDITORIAL_GOLD, anchor="ra")
        draw.text((score_x, y1 + 114), "AI偏差値", font=_font(FONT_REGULAR, 20), fill=WHITE, anchor="ra")
    elif show_score:
        draw.text((score_x, y1 + 50), "集計中", font=_font(FONT_BLACK, 34), fill=EDITORIAL_GOLD, anchor="ra")
        draw.text((score_x, y1 + 114), "AI偏差値", font=_font(FONT_REGULAR, 20), fill=WHITE, anchor="ra")


def _draw_intro_slide(
    path: Path,
    target_date: str,
    headline: str,
    size: tuple[int, int],
    hero_horse: Optional[HorseVideoData] = None,
    race_label: str = "",
    score_override: Optional[float] = None,
    venue_name: str = "",
    race_number: Optional[int] = None,
    visual_asset: Optional[VisualAsset] = None,
    show_score: bool = True,
) -> None:
    width, height = size
    compact = height > width
    image, _ = _hero_background(size, target_date, venue_name, race_number, visual_asset)
    image = _apply_photo_scrim(image, compact)
    draw = ImageDraw.Draw(image)
    margin = 68 if not compact else 60
    date_text = _display_short_date(target_date)

    if not compact:
        _draw_brand_lockup(image, draw, margin, 42, compact=False, light=True)
        _draw_site_claim_line(draw, 330, 58, 570, compact=False)
        draw.line((margin, 112, 880, 112), fill=EDITORIAL_GOLD, width=4)
        draw.text(
            (margin, 132),
            "  ".join(part for part in (date_text, race_label or venue_name) if part),
            font=_font(FONT_BOLD, 30),
            fill=(236, 235, 229),
        )
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 208),
            FONT_BLACK,
            144,
            72,
            900,
            WHITE,
            max_lines=2,
            line_gap=2,
            stroke_width=3,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.text(
            (margin, 574),
            "1Rから順に AI偏差値・位置取りを確認",
            font=_font(FONT_BOLD, 29),
            fill=(236, 235, 229),
        )
        draw.line((margin, 626, 900, 626), fill=(236, 235, 229), width=2)
        _draw_photo_score_module(
            draw,
            (margin, 666, 900, 958),
            hero_horse,
            compact=False,
            score_override=score_override,
            show_score=show_score,
        )
    else:
        _draw_brand_lockup(image, draw, margin, 80, compact=True, light=True)
        draw.text((width - margin, 84), date_text, font=_font(FONT_BOLD, 27), fill=WHITE, anchor="ra")
        draw.line((margin, 168, width - 180, 168), fill=EDITORIAL_GOLD, width=4)
        draw.text((margin, 194), race_label or venue_name, font=_font(FONT_BOLD, 30), fill=(236, 235, 229))
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 270),
            FONT_BLACK,
            82,
            48,
            840,
            WHITE,
            max_lines=2,
            line_gap=5,
            stroke_width=3,
            stroke_fill=TEXT_OUTLINE,
        )
        _draw_photo_score_module(
            draw,
            (margin, 650, 920, 864),
            hero_horse,
            compact=True,
            score_override=score_override,
            show_score=show_score,
        )
    _save_slide(image, path, size)


def _draw_short_site_intro_slide(
    path: Path,
    target_date: str,
    size: tuple[int, int],
    venue_name: str,
    race_number: Optional[int],
    visual_asset: Optional[VisualAsset],
) -> None:
    width, height = size
    image, _ = _hero_background(size, target_date, venue_name, race_number, visual_asset)
    image = ImageEnhance.Color(image).enhance(0.72)
    overlay = Image.new("RGBA", size, (10, 15, 18, 142))
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(image)
    left = 60
    right = 900
    _draw_brand_lockup(image, draw, left, 80, compact=True, light=True)
    draw.text((right, 84), _display_short_date(target_date), font=_font(FONT_BOLD, 27), fill=WHITE, anchor="ra")
    draw.line((left, 168, right, 168), fill=EDITORIAL_GOLD, width=4)
    draw.multiline_text(
        (left, 250),
        "中央・地方 全レースを\n毎日無料公開",
        font=_font(FONT_BLACK, 58),
        fill=WHITE,
        spacing=4,
        stroke_width=2,
        stroke_fill=TEXT_OUTLINE,
    )
    draw.rectangle((left, 430, left + 150, 480), fill=EDITORIAL_GOLD)
    draw.text((left + 75, 455), SITE_NO_REGISTRATION, font=_font(FONT_BOLD, 22), fill=INK_DARK, anchor="mm")
    _draw_feature_grid(draw, (left, 520, right, 1110), columns=2, compact=True, show_descriptions=True)
    _save_slide(image, path, size)


def _draw_venue_title_slide(path: Path, venue: VenueVideoData, target_date: str, size: tuple[int, int]) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 60
    grade_line = _grade_line(venue)
    if not compact:
        _draw_brand_lockup(image, draw, margin, 28, compact=False, light=False)
        draw.text((width - margin, 32), f"{_display_short_date(target_date)}  {venue.race_type}競馬", font=_font(FONT_BOLD, 25), fill=INK_MUTED, anchor="ra")
        draw.line((margin, 94, width - margin, 94), fill=RULE, width=2)
        draw.text((margin, 130), venue.venue_name, font=_font(FONT_BLACK, 76), fill=INK_DARK)
        race_heading = "AI偏差値対象レース（新馬戦除く）" if venue.excluded_races else "本日のレース"
        draw.text((margin + 310, 160), race_heading, font=_font(FONT_BOLD, 27), fill=EDITORIAL_GOLD_DARK)
        draw.text((width - margin, 154), grade_line, font=_font(FONT_BOLD, 27), fill=DEEP_GREEN, anchor="ra")
        races = venue.races[:12]
        column_count = 2 if len(races) > 6 else 1
        rows_per_column = math.ceil(len(races) / column_count) if races else 1
        gap = 46
        column_w = (width - margin * 2 - gap * (column_count - 1)) // column_count
        table_y = 252
        row_h = min(118, max(86, (height - table_y - 74) // rows_per_column))
        for idx, race in enumerate(races):
            column = idx // rows_per_column
            row = idx % rows_per_column
            x = margin + column * (column_w + gap)
            y = table_y + row * row_h
            horse = (top_by_deviation(race, 1) or [None])[0]
            draw.line((x, y + row_h - 10, x + column_w, y + row_h - 10), fill=RULE, width=2)
            draw.text((x, y + 8), f"{race.race_number:02d}", font=_font("Inter-Black.ttf", 43), fill=EDITORIAL_GOLD)
            draw.text((x + 60, y + 24), "R", font=_font("Inter-Bold.ttf", 20), fill=INK_MUTED)
            if race.grade:
                draw.rectangle((x + 100, y + 12, x + 112, y + row_h - 22), fill=EDITORIAL_GOLD)
            _draw_fit_text_no_ellipsis(draw, race.display_name, (x + 132, y + 10), FONT_BLACK, 29, 20, column_w - 410, INK_DARK, max_lines=1)
            draw.text((x + 132, y + 55), race.course_label, font=_font(FONT_REGULAR, 20), fill=INK_MUTED)
            if horse:
                _draw_horse_number_badge(draw, (x + column_w - 178, y + 45), horse, 48, stroke_width=2)
                draw.text((x + column_w - 18, y + 10), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", 38), fill=EDITORIAL_GOLD_DARK, anchor="ra")
                draw.text((x + column_w - 18, y + 58), "AI偏差値", font=_font(FONT_BOLD, 16), fill=INK_MUTED, anchor="ra")
        draw.text((width - margin, height - 38), "1R〜12R  AI偏差値・位置取り", font=_font(FONT_REGULAR, 21), fill=INK_MUTED, anchor="ra")
    else:
        _draw_brand_lockup(image, draw, margin, 76, compact=True, light=False)
        draw.line((margin, 154, width - 180, 154), fill=RULE, width=2)
        draw.text((margin, 198), venue.venue_name, font=_font(FONT_BLACK, 64), fill=INK_DARK)
        draw.text((margin, 286), f"{_display_date(target_date)} / {grade_line}", font=_font(FONT_BOLD, 25), fill=DEEP_GREEN)
        y = 360
        for race in venue.races[:9]:
            horse = (top_by_deviation(race, 1) or [None])[0]
            draw.line((margin, y + 108, width - 180, y + 108), fill=RULE, width=2)
            draw.text((margin, y + 8), f"{race.race_number:02d}", font=_font("Inter-Black.ttf", 42), fill=EDITORIAL_GOLD)
            _draw_fit_text_no_ellipsis(draw, race.display_name, (margin + 92, y + 10), FONT_BLACK, 29, 20, 520, INK_DARK, max_lines=1)
            if horse:
                draw.text((width - 180, y + 12), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", 36), fill=EDITORIAL_GOLD_DARK, anchor="ra")
            y += 120
    _save_slide(image, path, size)


def _draw_score_meter(draw: ImageDraw.ImageDraw, xy: tuple[int, int], width: int, score: Optional[float]) -> None:
    x, y = xy
    _draw_round_rect(draw, (x, y, x + width, y + 12), 6, (211, 218, 226))
    if score is None:
        return
    normalized = max(0.0, min(1.0, (score - 45.0) / 25.0))
    fill_w = max(14, int(width * normalized))
    _draw_round_rect(draw, (x, y, x + fill_w, y + 12), 6, BLUE if score < 62 else GOLD)


def _rank_card_style(rank: int, compact: bool = False) -> RankCardStyle:
    if rank == 1:
        return RankCardStyle(
            bg=(244, 237, 219),
            border=EDITORIAL_GOLD,
            border_width=4,
            badge_fill=EDITORIAL_GOLD,
            badge_text=INK_DARK,
            score_fill=EDITORIAL_GOLD_DARK,
            score_size=70 if not compact else 72,
        )
    if rank == 2:
        return RankCardStyle(
            bg=CARD_BG,
            border=RULE,
            border_width=2,
            badge_fill=SILVER,
            badge_text=INK_DARK,
            score_fill=INK_DARK,
            score_size=52 if not compact else 56,
        )
    return RankCardStyle(
        bg=CARD_BG,
        border=RULE,
        border_width=2,
        badge_fill=BRONZE,
        badge_text=WHITE,
        score_fill=INK_DARK,
        score_size=52 if not compact else 56,
    )


def _draw_horse_card(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    rank: int,
    horse_name: str,
    horse_number: int,
    score: Optional[float],
    position_label: str,
    compact: bool,
) -> None:
    x1, y1, x2, y2 = xy
    accent = GOLD if rank == 1 else BLUE if rank == 2 else GREEN
    _draw_round_rect(draw, xy, 24 if not compact else 22, PANEL, (226, 232, 240), 2)
    draw.rectangle((x1, y1, x1 + (12 if not compact else 10), y2), fill=accent)
    draw.text((x1 + 30, y1 + 22), f"{rank}", font=_font(FONT_BLACK, 46 if not compact else 40), fill=accent)
    name_font = _font(FONT_BLACK, 33 if not compact else 30)
    info_font = _font(FONT_BOLD, 24 if not compact else 23)
    _draw_text_block(draw, f"{horse_number}番 {horse_name}", (x1 + 92, y1 + 24), name_font, TEXT_DARK, x2 - x1 - 210, 6, 1)
    draw.text((x2 - 34, y1 + 26), _score_text(score), font=_font(FONT_BLACK, 38 if not compact else 34), fill=TEXT_DARK, anchor="ra")
    meter_y = y1 + (82 if not compact else 78)
    _draw_score_meter(draw, (x1 + 92, meter_y), x2 - x1 - 230, score)
    _draw_tag(draw, (x2 - 156, meter_y - 12), position_label or "-", (15, 70, 78), INK, 21 if not compact else 20)
    draw.text((x1 + 92, y2 - 34), "AI偏差値 / 位置取り", font=info_font, fill=(71, 85, 105))


def _draw_rank_card(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    rank: int,
    horse: HorseVideoData,
    compact: bool = False,
) -> None:
    x1, y1, x2, y2 = xy
    style = _rank_card_style(rank, compact)
    draw.rectangle(xy, fill=style.bg, outline=style.border, width=style.border_width)
    accent_w = 10 if rank == 1 else 5
    draw.rectangle((x1, y1, x1 + accent_w, y2), fill=style.badge_fill)
    card_h = y2 - y1
    badge_d = 54 if compact else 50
    badge_x = x1 + 28
    badge_y = y1 + 26
    draw.text((badge_x, badge_y + 7), f"{rank}位", font=_font(FONT_BLACK, 28), fill=EDITORIAL_GOLD_DARK)

    horse_badge_d = 66 if rank == 1 else 56
    horse_x = badge_x + badge_d + 42
    _draw_horse_number_badge(draw, (horse_x + horse_badge_d // 2, y1 + 54), horse, horse_badge_d, stroke_width=3)
    name_x = horse_x + horse_badge_d + 20
    score_reserved = 230 if rank == 1 else 170
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (name_x, y1 + 22),
        FONT_BLACK,
        38 if rank == 1 else 30,
        20,
        max(150, x2 - name_x - score_reserved),
        INK_DARK,
        max_lines=1,
    )
    position = horse.position_label if horse.position_label in {"先行", "中団", "後方"} else "未確定"
    draw.text((name_x, y1 + 76), f"位置取り  {position}", font=_font(FONT_REGULAR, 21), fill=INK_MUTED)

    score_size = 118 if rank == 1 and card_h > 200 else style.score_size
    score_y = y1 + (70 if rank == 1 and card_h > 200 else 12)
    draw.text((x2 - 30, score_y), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", score_size), fill=style.score_fill, anchor="ra")
    label_y = y1 + 40 if rank == 1 and card_h > 200 else y1 + 84
    draw.text((x2 - 32, label_y), "AI偏差値", font=_font(FONT_REGULAR, 18 if not compact else 20), fill=INK_MUTED, anchor="ra")
    if rank == 1 and card_h > 200:
        bar_y = y2 - 30
        _draw_score_bar_v5(draw, (name_x, bar_y, x2 - 30, bar_y + 12), horse.deviation_score)
    else:
        _draw_score_bar_v5(
            draw,
            (name_x, y2 - 22, x2 - 30, y2 - 12),
            horse.deviation_score,
            fill=style.badge_fill,
        )


def _position_badge_colors(label: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if label == "先行":
        return DEEP_GREEN, WHITE
    if label == "後方":
        return INK_DARK, WHITE
    if label == "中団":
        return PAPER_DARK, INK_DARK
    return (224, 222, 215), INK_MUTED


def _draw_ranking_row(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    rank: int,
    horse: HorseVideoData,
    compact: bool,
    alternate: bool,
) -> None:
    x1, y1, x2, y2 = xy
    row_fill = PAPER_DARK if alternate else CARD_BG
    draw.rectangle(xy, fill=row_fill, outline=RULE, width=1)
    rank_w = 76 if compact else 92
    badge_w = 88 if compact else 110
    score_w = 190 if compact else 230
    position_w = 150 if compact else 220
    draw.text((x1 + 16, y1 + 19), f"{rank}位", font=_font(FONT_BOLD, 25 if compact else 26), fill=INK_MUTED)
    badge_d = 52 if compact else 54
    badge_x = x1 + rank_w + badge_w // 2
    _draw_horse_number_badge(draw, (badge_x, (y1 + y2) // 2), horse, badge_d, stroke_width=2)
    name_x = x1 + rank_w + badge_w
    right_name = x2 - score_w - position_w
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (name_x, y1 + (19 if compact else 18)),
        FONT_BOLD,
        27 if compact else 27,
        17,
        max(120, right_name - name_x - 18),
        INK_DARK,
        max_lines=1,
    )
    position = horse.position_label if horse.position_label in {"先行", "中団", "後方"} else "未確定"
    badge_fill, badge_text = _position_badge_colors(position)
    pos_x1 = x2 - score_w - position_w + 18
    pos_x2 = x2 - score_w - 18
    badge_h = 52 if compact else max(42, y2 - y1 - 32)
    pos_y1 = (y1 + y2 - badge_h) // 2
    pos_y2 = pos_y1 + badge_h
    draw.rectangle((pos_x1, pos_y1, pos_x2, pos_y2), fill=badge_fill)
    draw.text(((pos_x1 + pos_x2) // 2, pos_y1 + 12), position, font=_font(FONT_BOLD, 19 if compact else 19), fill=badge_text, anchor="ma")
    draw.text((x2 - 28, y1 + 7), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", 52 if compact else 48), fill=EDITORIAL_GOLD_DARK, anchor="ra")


def _draw_race_slide(
    path: Path,
    race: RaceVideoData,
    target_date: str,
    size: tuple[int, int],
    utm_content: str,
    visible_rank_count: Optional[int] = None,
) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 60
    rank_limit = 5 if not compact else max(1, min(3, visible_rank_count or 3))
    top_horses = top_by_deviation(race, rank_limit)

    if not compact:
        _draw_editorial_header(image, draw, size, race, "AI偏差値")
        card_y = 122
        if top_horses:
            _draw_rank_card(draw, (margin, card_y, width - margin, card_y + 250), 1, top_horses[0], compact=False)
        if not top_horses:
            draw.rectangle((margin, card_y, width - margin, card_y + 250), fill=CARD_BG, outline=RULE, width=2)
            draw.text((width // 2, card_y + 90), "出走馬データを集計中", font=_font(FONT_BOLD, 38), fill=INK_DARK, anchor="ma")
        row_y = 392
        row_h = 142
        for offset, horse in enumerate(top_horses[1:5], start=2):
            _draw_ranking_row(
                draw,
                (margin, row_y, width - margin, row_y + row_h),
                offset,
                horse,
                compact=False,
                alternate=offset % 2 == 1,
            )
            row_y += row_h
        draw.line((margin, height - 34, width - margin, height - 34), fill=RULE, width=2)
    else:
        safe_left = 60
        safe_right = 900
        _draw_editorial_header(image, draw, size, race, "AI偏差値 上位3頭")
        y = 444
        if top_horses:
            _draw_rank_card(draw, (safe_left, y, safe_right, y + 290), 1, top_horses[0], compact=True)
            y += 310
        for idx, horse in enumerate(top_horses[1:3], start=2):
            _draw_ranking_row(
                draw,
                (safe_left, y, safe_right, y + 150),
                idx,
                horse,
                compact=True,
                alternate=idx % 2 == 1,
            )
            y += 162
        if not top_horses:
            draw.rectangle((safe_left, y, safe_right, y + 220), fill=CARD_BG, outline=RULE, width=2)
            draw.text((width // 2, y + 82), "出走馬データを集計中", font=_font(FONT_BOLD, 33), fill=INK_DARK, anchor="ma")
        draw.line((safe_left, 1450, safe_right, 1450), fill=RULE, width=2)
    _save_slide(image, path, size)


def _position_groups(race: RaceVideoData) -> dict[str, List[HorseVideoData]]:
    groups: dict[str, List[HorseVideoData]] = {"先行": [], "中団": [], "後方": [], "-": []}
    for horse in sorted(race.predictions, key=lambda item: item.horse_number):
        label = horse.position_label if horse.position_label in {"先行", "中団", "後方"} else "-"
        groups[label].append(horse)
    return groups


def _draw_position_token(
    draw: ImageDraw.ImageDraw,
    horse: HorseVideoData,
    xy: tuple[int, int],
    max_width: int,
    compact: bool,
    row_height: int,
) -> None:
    x, y = xy
    token_h = max(34, row_height - 4)
    badge = max(28, min(48, token_h - 8))
    center_y = y + token_h // 2
    draw.rectangle((x, y, x + max_width, y + token_h), fill=(252, 250, 245), outline=RULE, width=1)
    _draw_horse_number_badge(draw, (x + 12 + badge // 2, center_y), horse, badge, stroke_width=1)
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (x + badge + 26, center_y - (14 if compact else 13)),
        FONT_BOLD,
        min(23 if compact else 22, max(16, round(row_height * 0.38))),
        14,
        max_width - badge - 34,
        INK_DARK,
        max_lines=1,
    )


def _overlay_course_asset(
    image: Image.Image,
    asset: Optional[CourseAsset],
    bounds: tuple[int, int, int, int],
    opacity: float = 0.62,
) -> Image.Image:
    if asset is None:
        return image
    try:
        with Image.open(asset.path) as source:
            course = source.convert("RGBA")
    except OSError:
        return image
    alpha = course.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    course = course.crop(bbox)
    original_alpha = course.getchannel("A")
    muted = ImageEnhance.Color(course.convert("RGB")).enhance(0.24)
    muted = ImageEnhance.Contrast(muted).enhance(0.84)
    muted = ImageEnhance.Brightness(muted).enhance(1.08)
    muted = Image.blend(muted, Image.new("RGB", muted.size, PAPER), 0.22)
    course = muted.convert("RGBA")
    course.putalpha(original_alpha)
    box_width = max(1, bounds[2] - bounds[0])
    box_height = max(1, bounds[3] - bounds[1])
    scale = min(box_width / course.width, box_height / course.height)
    resized = course.resize(
        (max(1, round(course.width * scale)), max(1, round(course.height * scale))),
        Image.Resampling.LANCZOS,
    )
    alpha = resized.getchannel("A").point(lambda value: round(value * max(0.0, min(1.0, opacity))))
    resized.putalpha(alpha)
    left = bounds[0] + (box_width - resized.width) // 2
    top = bounds[1] + (box_height - resized.height) // 2
    base = image.convert("RGBA")
    outline_alpha = alpha.filter(ImageFilter.MaxFilter(11)).point(lambda value: min(120, value))
    outline = Image.new("RGBA", resized.size, (47, 67, 59, 0))
    outline.putalpha(outline_alpha)
    base.alpha_composite(outline, (left, top))
    base.alpha_composite(resized, (left, top))
    return base.convert("RGB")


def _lane_label_fill(label: str) -> tuple[int, int, int]:
    if label == "先行":
        return DEEP_GREEN
    if label == "後方":
        return INK_DARK
    if label == "中団":
        return CHARCOAL_SOFT
    return INK_MUTED


def _draw_position_lane(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    label: str,
    horses: Sequence[HorseVideoData],
    compact: bool,
    row_step_override: Optional[int] = None,
) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=(250, 248, 242), outline=RULE, width=2)
    header_h = 52 if compact else 56
    draw.rectangle((x1, y1, x2, y1 + header_h), fill=_lane_label_fill(label))
    draw.text((x1 + 20, y1 + (10 if compact else 11)), label, font=_font(FONT_BLACK, 23 if compact else 24), fill=WHITE)
    draw.text((x2 - 18, y1 + (13 if compact else 14)), f"{len(horses)}頭", font=_font(FONT_BOLD, 18), fill=(231, 232, 227), anchor="ra")
    inner_margin = 12 if compact else 14
    token_width = max(150, x2 - x1 - inner_margin * 2)
    row_step = row_step_override or (62 if compact else 70)
    start_y = y1 + header_h + 8
    for index, horse in enumerate(horses):
        token_x = x1 + inner_margin
        token_y = start_y + index * row_step
        _draw_position_token(draw, horse, (token_x, token_y), token_width, compact=compact, row_height=row_step)


def _draw_position_slide(path: Path, race: RaceVideoData, target_date: str, size: tuple[int, int]) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(image)
    groups = _position_groups(race)
    course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
    lane_groups: List[tuple[str, List[HorseVideoData]]] = [
        ("先行", groups["先行"]),
        ("中団", groups["中団"]),
        ("後方", groups["後方"]),
    ]
    unknown_horses = groups["-"]
    if not compact:
        margin = 60
        _draw_editorial_header(image, draw, size, race, "位置取り")
        course_box = (margin + 110, 120, width - margin - 110, height - 30)
        if course_asset is not None:
            image = _overlay_course_asset(image, course_asset, course_box, opacity=0.10)
            draw = ImageDraw.Draw(image)
        lane_top = 126
        available_bottom = 970
        max_rows = max((len(horses) for _, horses in lane_groups), default=0)
        fixed_height = 64 + (80 if unknown_horses else 0)
        row_units = max_rows + len(unknown_horses)
        row_step = max(34, min(62, (available_bottom - lane_top - fixed_height) // max(1, row_units)))
        lane_bottom = lane_top + 64 + max_rows * row_step
        gap = 20
        lane_width = (width - margin * 2 - gap * (len(lane_groups) - 1)) // len(lane_groups)
        for index, (label, horses) in enumerate(lane_groups):
            x1 = margin + index * (lane_width + gap)
            _draw_position_lane(
                draw,
                (x1, lane_top, x1 + lane_width, lane_bottom),
                label,
                horses,
                compact=False,
                row_step_override=row_step,
            )
        if unknown_horses:
            unknown_top = lane_bottom + 16
            unknown_bottom = unknown_top + 64 + len(unknown_horses) * row_step
            _draw_position_lane(
                draw,
                (margin, unknown_top, width - margin, unknown_bottom),
                "位置未確定",
                unknown_horses,
                compact=False,
                row_step_override=row_step,
            )
        if course_asset is not None:
            draw.text((width - margin, height - 34), f"{race.venue_name} コース形状", font=_font(FONT_BOLD, 17), fill=INK_MUTED, anchor="ra")
    else:
        safe_left = 60
        safe_right = 900
        _draw_editorial_header(image, draw, size, race, "位置取り")
        draw.text((safe_left, 440), "先行  →  中団  →  後方", font=_font(FONT_BOLD, 22), fill=INK_MUTED)

        course_box = (safe_left + 80, 450, safe_right - 80, 1450)
        if course_asset is not None:
            image = _overlay_course_asset(image, course_asset, course_box, opacity=0.11)
            draw = ImageDraw.Draw(image)
        y = 486
        gap = 10
        compact_groups = [*lane_groups]
        if unknown_horses:
            compact_groups.append(("位置未確定", unknown_horses))
        total_rows = sum(len(horses) for _, horses in compact_groups)
        fixed_height = len(compact_groups) * 60 + max(0, len(compact_groups) - 1) * gap
        available_for_rows = max(0, 1450 - y - fixed_height)
        compact_row_step = max(34, min(52, available_for_rows // max(1, total_rows)))
        for label, horses in compact_groups:
            lane_h = 60 + len(horses) * compact_row_step
            _draw_position_lane(
                draw,
                (safe_left, y, safe_right, y + lane_h),
                label,
                horses,
                compact=True,
                row_step_override=compact_row_step,
            )
            y += lane_h + gap
        draw.line((safe_left, 1460, safe_right, 1460), fill=RULE, width=2)
    _save_slide(image, path, size)


def _draw_outro_slide(
    path: Path,
    target_date: str,
    size: tuple[int, int],
    utm_content: str,
    venue_name: str = "",
    race_number: Optional[int] = None,
    visual_asset: Optional[VisualAsset] = None,
) -> None:
    width, height = size
    compact = height > width
    image, _ = _hero_background(size, target_date, venue_name, race_number, visual_asset)
    image = ImageEnhance.Color(image).enhance(0.42)
    image = ImageEnhance.Brightness(image).enhance(0.72)
    overlay = Image.new("RGBA", size, (10, 15, 18, 118 if compact else 96))
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(image)
    margin = 68 if not compact else 60

    if not compact:
        _draw_brand_lockup(image, draw, margin, 48, compact=False, light=True)
        draw.text((width - margin, 50), _display_short_date(target_date), font=_font(FONT_BOLD, 27), fill=WHITE, anchor="ra")
        draw.line((margin, 122, width - margin, 122), fill=EDITORIAL_GOLD, width=4)
        draw.multiline_text(
            (margin, 168),
            "中央・地方の全レース分析データを\n毎日無料で公開",
            font=_font(FONT_BLACK, 54),
            fill=WHITE,
            spacing=2,
            stroke_width=2,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.rectangle((margin, 302, margin + 146, 348), fill=EDITORIAL_GOLD)
        draw.text((margin + 73, 325), SITE_NO_REGISTRATION, font=_font(FONT_BOLD, 21), fill=INK_DARK, anchor="mm")
        _draw_feature_grid(draw, (margin, 380, width - margin, 620), columns=4, compact=False, show_descriptions=True)
        cta_y = 664
        cta_right = 1470
        draw.rectangle((margin, cta_y, cta_right, cta_y + 214), fill=(15, 21, 25))
        draw.rectangle((margin, cta_y, margin + 8, cta_y + 214), fill=BURGUNDY)
        draw.text((margin + 42, cta_y + 34), "概要欄のリンクからUMA-FREEへ", font=_font(FONT_BOLD, 39), fill=WHITE)
        draw.text((margin + 42, cta_y + 100), "または「UMA-FREE」で検索", font=_font(FONT_REGULAR, 28), fill=(232, 230, 219))
        draw.text((cta_right - 36, cta_y + 154), "uma-free.com", font=_font("Inter-Bold.ttf", 31), fill=EDITORIAL_GOLD, anchor="ra")
    else:
        _draw_brand_lockup(image, draw, margin, 82, compact=True, light=True)
        draw.line((margin, 168, 900, 168), fill=EDITORIAL_GOLD, width=4)
        draw.multiline_text(
            (margin, 240),
            "中央・地方 全レースを\n毎日無料公開",
            font=_font(FONT_BLACK, 56),
            fill=WHITE,
            spacing=4,
            stroke_width=2,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.rectangle((margin, 408, margin + 142, 454), fill=EDITORIAL_GOLD)
        draw.text((margin + 71, 431), SITE_NO_REGISTRATION, font=_font(FONT_BOLD, 20), fill=INK_DARK, anchor="mm")
        _draw_feature_grid(draw, (margin, 500, 900, 1080), columns=2, compact=True, show_descriptions=True)
        cta_y = 1130
        draw.rectangle((margin, cta_y, 900, cta_y + 276), fill=(15, 21, 25))
        draw.rectangle((margin, cta_y, margin + 8, cta_y + 276), fill=BURGUNDY)
        profile_cta = "プロフィールのリンクから全頭データを確認"
        draw.text((margin + 38, cta_y + 34), profile_cta, font=_fit_font_for_width(draw, profile_cta, FONT_BOLD, 36, 25, 760), fill=WHITE)
        draw.text((margin + 38, cta_y + 100), "または「UMA-FREE」で検索", font=_font(FONT_REGULAR, 25), fill=(232, 230, 219))
        draw.text((margin + 38, cta_y + 190), "uma-free.com", font=_font("Inter-Bold.ttf", 30), fill=EDITORIAL_GOLD)

    _save_slide(image, path, size)


def _draw_thumbnail(
    path: Path,
    title: str,
    subtitle: str,
    target_date: str,
    size: tuple[int, int],
    hero_horse: Optional[HorseVideoData] = None,
    venue_name: str = "",
    race_number: Optional[int] = None,
    grade: str = "",
    visual_asset: Optional[VisualAsset] = None,
) -> None:
    width, height = size
    compact = height > width
    image, _ = _hero_background(size, target_date, venue_name, race_number, visual_asset)
    image = _apply_photo_scrim(image, compact)
    draw = ImageDraw.Draw(image)
    margin = 68 if not compact else 56
    date_text = _display_short_date(target_date)
    headline = title.strip() or "全レース"

    if not compact:
        _draw_brand_lockup(image, draw, margin, 44, compact=False, light=True, logo_size=64)
        _draw_site_claim_line(draw, 330, 60, 570, compact=False)
        draw.line((margin, 114, 900, 114), fill=EDITORIAL_GOLD, width=4)
        chip_text = "  ".join(part for part in (date_text, venue_name, grade) if part)
        draw.text((margin, 136), chip_text, font=_font(FONT_BOLD, 30), fill=(236, 235, 229))
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 212),
            FONT_BLACK,
            154,
            76,
            920,
            WHITE,
            max_lines=2,
            line_gap=0,
            stroke_width=3,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.text(
            (margin, 570),
            subtitle or "全レース AI偏差値・位置取り",
            font=_font(FONT_BOLD, 31),
            fill=(236, 235, 229),
        )
        draw.line((margin, 624, 900, 624), fill=(236, 235, 229), width=2)
        _draw_photo_score_module(draw, (margin, 660, 900, 964), hero_horse, compact=False)
    else:
        _draw_brand_lockup(image, draw, margin, 82, compact=True, light=True)
        draw.text((width - margin, 84), date_text, font=_font(FONT_BOLD, 27), fill=WHITE, anchor="ra")
        draw.line((margin, 168, 900, 168), fill=EDITORIAL_GOLD, width=4)
        _draw_fit_text_no_ellipsis(draw, headline, (margin, 264), FONT_BLACK, 82, 48, 840, WHITE, max_lines=2, line_gap=5, stroke_width=3, stroke_fill=TEXT_OUTLINE)
        _draw_photo_score_module(draw, (margin, 650, 920, 864), hero_horse, compact=True)
    _save_slide(image, path, size)


def _write_concat_manifest(slides: Sequence[Slide], path: Path) -> None:
    lines: List[str] = []
    for slide in slides:
        slide_path = str(slide.image_path.resolve()).replace("\\", "/").replace("'", "'\\''")
        lines.append(f"file '{slide_path}'")
        lines.append(f"duration {slide.duration_seconds:.2f}")
    if slides:
        last_path = str(slides[-1].image_path.resolve()).replace("\\", "/").replace("'", "'\\''")
        lines.append(f"file '{last_path}'")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _render_static_clip(
    ffmpeg: str,
    slide: Slide,
    clip_path: Path,
    width: int,
    height: int,
    fps: int,
) -> None:
    frames = max(2, int(round(slide.duration_seconds * fps)))
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
        f"fps={fps},"
        "format=yuv420p"
    )
    command = [
        ffmpeg,
        "-y",
        "-loop",
        "1",
        "-i",
        str(slide.image_path),
        "-vf",
        vf,
        "-t",
        f"{slide.duration_seconds:.3f}",
        "-frames:v",
        str(frames),
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(clip_path),
    ]
    subprocess.run(command, check=True)


def _concat_motion_clips(
    ffmpeg: str,
    clip_paths: Sequence[Path],
    durations: Sequence[float],
    output_path: Path,
    fps: int,
) -> None:
    if not clip_paths:
        raise ValueError("動画化するスライドがありません。")
    if len(clip_paths) == 1:
        shutil.copyfile(clip_paths[0], output_path)
        return

    fade = min(CROSSFADE_SECONDS, max(0.04, min(durations) * 0.45))
    inputs: List[str] = []
    for clip in clip_paths:
        inputs.extend(["-i", str(clip)])

    filter_parts: List[str] = []
    for idx in range(len(clip_paths)):
        filter_parts.append(
            f"[{idx}:v]fps={fps},format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v{idx}]"
        )

    previous = "[v0]"
    offset = max(0.0, durations[0] - fade)
    for idx in range(1, len(clip_paths)):
        out_label = f"[x{idx}]"
        filter_parts.append(
            f"{previous}[v{idx}]xfade=transition=fade:duration={fade:.3f}:offset={offset:.3f}{out_label}"
        )
        previous = out_label
        if idx < len(clip_paths) - 1:
            offset += max(0.0, durations[idx] - fade)

    command = [
        ffmpeg,
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        previous,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(fps),
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def _add_bgm(
    ffmpeg: str,
    video_path: Path,
    output_path: Path,
    audio_asset: AudioAsset,
    duration_seconds: float,
) -> None:
    fade_in = min(0.6, max(0.1, duration_seconds * 0.1))
    fade_out = min(0.8, max(0.1, duration_seconds * 0.15))
    fade_out_start = max(fade_in, duration_seconds - fade_out)
    audio_filter = (
        "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11,"
        "aresample=48000,"
        f"volume={audio_asset.volume:.4f},"
        f"afade=t=in:st=0:d={fade_in:.3f},"
        f"afade=t=out:st={fade_out_start:.3f}:d={fade_out:.3f},"
        f"atrim=0:{duration_seconds:.3f},asetpts=N/SR/TB[bgm]"
    )
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(audio_asset.path),
        "-filter_complex",
        audio_filter,
        "-map",
        "0:v",
        "-map",
        "[bgm]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        f"{duration_seconds:.3f}",
        "-shortest",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def _timeline_duration(slides: Sequence[Slide], use_crossfade: bool) -> float:
    duration = sum(max(0.0, slide.duration_seconds) for slide in slides)
    if use_crossfade and len(slides) > 1:
        fade = min(CROSSFADE_SECONDS, max(0.04, min(slide.duration_seconds for slide in slides) * 0.45))
        duration -= fade * (len(slides) - 1)
    return max(0.1, duration)


def render_mp4(
    slides: Sequence[Slide],
    output_path: Path,
    width: int,
    height: int,
    audio_asset: Optional[AudioAsset] = None,
) -> None:
    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpegが見つかりません。ローカル検証では --skip-video を使うか、ffmpegをインストールしてください。")
    if audio_asset is None and os.getenv("SOCIAL_VIDEO_BGM_PATH"):
        audio_asset = resolve_audio_asset("", "short" if height > width else "venue_long", output_path.stem)
    disable_motion = os.getenv("SOCIAL_VIDEO_DISABLE_MOTION") == "1"
    duration_seconds = _timeline_duration(slides, use_crossfade=not disable_motion)
    if disable_motion:
        manifest = output_path.with_suffix(".concat.txt")
        _write_concat_manifest(slides, manifest)
        video_without_audio = output_path.with_suffix(".video.mp4") if audio_asset else output_path
        command = [
            ffmpeg,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(manifest),
            "-vf",
            f"fps={VIDEO_FPS},format=yuv420p,scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-movflags",
            "+faststart",
            str(video_without_audio),
        ]
        subprocess.run(command, check=True)
        if audio_asset:
            _add_bgm(ffmpeg, video_without_audio, output_path, audio_asset, duration_seconds)
            try:
                video_without_audio.unlink()
            except OSError:
                pass
        return

    motion_dir = output_path.parent / f".{output_path.stem}_motion"
    if motion_dir.exists():
        shutil.rmtree(motion_dir)
    motion_dir.mkdir(parents=True, exist_ok=True)
    try:
        clip_paths: List[Path] = []
        durations: List[float] = []
        for idx, slide in enumerate(slides):
            clip_path = motion_dir / f"clip_{idx:03d}.mp4"
            _render_static_clip(ffmpeg, slide, clip_path, width, height, VIDEO_FPS)
            clip_paths.append(clip_path)
            durations.append(slide.duration_seconds)

        video_without_audio = output_path.with_suffix(".video.mp4") if audio_asset else output_path
        _concat_motion_clips(ffmpeg, clip_paths, durations, video_without_audio, VIDEO_FPS)
        if audio_asset:
            _add_bgm(ffmpeg, video_without_audio, output_path, audio_asset, duration_seconds)
            try:
                video_without_audio.unlink()
            except OSError:
                pass
    finally:
        shutil.rmtree(motion_dir, ignore_errors=True)


def _write_metadata(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _draw_intro_sequence(
    video_dir: Path,
    target_date: str,
    headline: str,
    size: tuple[int, int],
    hero_horse: Optional[HorseVideoData],
    race_label: str,
    venue_name: str,
    race_number: Optional[int] = None,
    visual_asset: Optional[VisualAsset] = None,
) -> List[Slide]:
    target_score = hero_horse.deviation_score if hero_horse and hero_horse.deviation_score is not None else None
    compact = size[1] > size[0]
    slides: List[Slide] = []
    if target_score is None:
        intro = video_dir / "000_intro.png"
        _draw_intro_slide(
            intro,
            target_date,
            headline,
            size,
            hero_horse=hero_horse,
            race_label=race_label,
            venue_name=venue_name,
            race_number=race_number,
            visual_asset=visual_asset,
        )
        slides.append(Slide(intro, 1.85 if compact else 2.0))
        return slides

    frame_count = 7
    for frame in range(frame_count):
        show_score = frame > 0
        ratio = max(0.0, (frame - 1) / max(frame_count - 2, 1))
        eased = 1 - (1 - ratio) * (1 - ratio)
        start_score = min(50.0, target_score)
        score_value = start_score + (target_score - start_score) * eased
        path = video_dir / f"000_intro_{frame:02d}.png"
        _draw_intro_slide(
            path,
            target_date,
            headline,
            size,
            hero_horse=hero_horse,
            race_label=race_label,
            score_override=score_value,
            venue_name=venue_name,
            race_number=race_number,
            visual_asset=visual_asset,
            show_score=show_score,
        )
        duration = 0.10 if frame < frame_count - 1 else 1.25
        slides.append(Slide(path, duration))
    return slides


def _long_title(venue: VenueVideoData, target_date: str) -> str:
    grade_names = "・".join(race.display_name for race in venue.grade_races[:2])
    scope = "新馬戦を除く対象レース" if venue.excluded_races else "全レース"
    if grade_names:
        return f"【{grade_names}】{venue.venue_name} {scope} AI偏差値・位置取り｜{target_date}"
    return f"【{venue.venue_name}】{scope} AI偏差値・位置取り｜{target_date}"


def _description(
    title: str,
    target_date: str,
    url: str,
    venue_name: Optional[str] = None,
    credit_lines: Sequence[str] = (),
    is_short: bool = False,
    excluded_race_labels: Sequence[str] = (),
) -> str:
    venue_line = f"{venue_name}の" if venue_name else ""
    entry_line = (
        "全頭データはチャンネルプロフィールのUMA-FREEから確認できます。"
        if is_short
        else f"全頭データを見る: {url}"
    )
    description = textwrap.dedent(
        f"""\
        {entry_line}

        {title}

        UMA-FREEでは、中央・地方競馬の全レース分析データを毎日無料で掲載しています。登録は不要です。
        {venue_line}AI偏差値、過去対戦成績、位置取り予測、枠順傾向をレース順に掲載しています。
        データ基準日: {target_date}

        ※本動画は過去データをもとにした参考情報です。結果を保証するものではありません。

        #競馬 #競馬データ #UMA_FREE
        """
    ).strip()
    if excluded_race_labels:
        description += (
            "\n\n※AI偏差値の算出対象外となる新馬戦は収録していません: "
            + "、".join(excluded_race_labels)
        )
    unique_credits = list(dict.fromkeys(line.strip() for line in credit_lines if line.strip()))
    if unique_credits:
        description += "\n\n素材クレジット\n" + "\n".join(f"- {line}" for line in unique_credits)
    return description


def render_long_video(venue: VenueVideoData, target_date: str, output_dir: Path, skip_video: bool = False) -> RenderedVideo:
    stable_id = f"venue_{_safe_filename(venue.venue_name)}"
    video_dir = output_dir / "long" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    size = (1920, 1080)
    utm_content = f"venue_long_{_safe_filename(venue.venue_name)}"
    title = _long_title(venue, target_date)
    slides: List[Slide] = []
    hero_race, hero_horse = _best_horse_for_venue(venue)
    hero_race_number = hero_race.race_number if hero_race else None
    visual_asset = resolve_visual_asset(
        target_date,
        venue.venue_name,
        hero_race_number,
        "wide",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "venue_long", stable_id)
    publish_block_reasons: List[str] = []
    if visual_asset is None:
        publish_block_reasons.append("長尺用の横写真が見つかりません")
    if audio_asset is None:
        publish_block_reasons.append("長尺用BGMが見つかりません")
    publishable = not publish_block_reasons
    grade_names = " / ".join(race.display_name for race in venue.grade_races[:2])
    thumb_title = grade_names or (
        f"{venue.venue_name} 対象{len(venue.races)}R"
        if venue.excluded_races
        else f"{venue.venue_name} 全{len(venue.races)}R"
    )
    hero_label = f"{venue.venue_name}{hero_race.race_number}R" if hero_race else venue.venue_name

    slides.extend(
        _draw_intro_sequence(
            video_dir,
            target_date,
            thumb_title,
            size,
            hero_horse=hero_horse,
            race_label=hero_label,
            venue_name=venue.venue_name,
            race_number=hero_race_number,
            visual_asset=visual_asset,
        )
    )

    venue_title = video_dir / "001_venue.png"
    _draw_venue_title_slide(venue_title, venue, target_date, size)
    slides.append(Slide(venue_title, LONG_VENUE_SLIDE_SECONDS))

    slide_index = 2
    for race in venue.races:
        ranking_path = video_dir / f"{slide_index:03d}_{race.race_number:02d}r_ai.png"
        _draw_race_slide(ranking_path, race, target_date, size, utm_content)
        slides.append(Slide(ranking_path, LONG_RACE_SLIDE_SECONDS))
        slide_index += 1
        position_path = video_dir / f"{slide_index:03d}_{race.race_number:02d}r_position.png"
        _draw_position_slide(position_path, race, target_date, size)
        slides.append(Slide(position_path, LONG_POSITION_SLIDE_SECONDS))
        slide_index += 1

    outro = video_dir / "999_outro.png"
    _draw_outro_slide(
        outro,
        target_date,
        size,
        utm_content,
        venue_name=venue.venue_name,
        race_number=hero_race_number,
        visual_asset=visual_asset,
    )
    slides.append(Slide(outro, LONG_OUTRO_SECONDS))

    thumbnail = video_dir / "thumbnail.jpg"
    subtitle = (
        f"対象{len(venue.races)}R（新馬戦除く） AI偏差値・位置取り"
        if venue.excluded_races
        else f"全{len(venue.races)}R  AI偏差値・位置取り"
    )
    hero_grade = hero_race.grade if hero_race and hero_race.grade else ""
    _draw_thumbnail(
        thumbnail,
        thumb_title,
        subtitle,
        target_date,
        size,
        hero_horse=hero_horse,
        venue_name=venue.venue_name,
        race_number=hero_race_number,
        grade=hero_grade,
        visual_asset=visual_asset,
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_mp4(slides, video_path, *size, audio_asset=audio_asset)

    if hero_race_number is None:
        raise RuntimeError(f"代表レースを選定できません: {venue.venue_name}")
    url = build_video_url(target_date, utm_content, venue.venue_name, hero_race_number)
    course_assets: dict[str, CourseAsset] = {}
    for race in venue.races:
        course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
        if course_asset is not None:
            course_assets[course_asset.asset_id] = course_asset
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "thumbnail_image": visual_asset_metadata(visual_asset),
        "bgm": audio_asset_metadata(audio_asset),
        "courses": [course_asset_metadata(asset) for asset in course_assets.values()],
    }
    credits = asset_credit_lines(visual_asset, audio_asset)
    excluded_race_labels = [
        f"{race.race_number}R {race.display_name}"
        for race in venue.excluded_races
    ]
    description = _description(
        title,
        target_date,
        url,
        venue.venue_name,
        credits,
        excluded_race_labels=excluded_race_labels,
    )
    tags = ["競馬", "AI偏差値", "UMA-FREE", venue.venue_name, *(race.display_name for race in venue.grade_races[:2])]
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "venue_long",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "race_ids": [race.id for race in venue.races],
            "excluded_race_ids": [race.id for race in venue.excluded_races],
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
        }
    )
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "venue_long",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": venue.venue_name,
        "race_ids": [race.id for race in venue.races],
        "excluded_races": [
            {
                "race_id": race.id,
                "race_number": race.race_number,
                "race_name": race.display_name,
                "reason": "新馬戦のためAI偏差値算出対象外",
            }
            for race in venue.excluded_races
        ],
        "aspect_ratio": "16:9",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "utm_content": utm_content,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": True,
        "publishable": publishable,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": publish_block_reasons,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo(
        video_type="venue_long",
        stable_id=stable_id,
        title=title,
        description=description,
        tags=tags,
        video_path=video_path,
        thumbnail_path=thumbnail,
        metadata_path=metadata_path,
        publish_offset_minutes=0,
        publishable=publishable,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name=venue.venue_name,
        race_ids=[race.id for race in venue.races],
        aspect_ratio="16:9",
        destination_url=url,
        utm_content=utm_content,
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=True,
    )


def _short_title(race: RaceVideoData, target_date: str) -> str:
    if race.grade:
        return f"【{race.display_name}】AI偏差値上位3頭・位置取り｜{target_date} #Shorts"
    return f"【{race.venue_name}{race.race_number}R】AI偏差値上位3頭・位置取り｜{target_date} #Shorts"


def _draw_short_position_slide(path: Path, race: RaceVideoData, target_date: str, size: tuple[int, int], utm_content: str) -> None:
    _draw_position_slide(path, race, target_date, size)


def render_short_video(race: RaceVideoData, target_date: str, output_dir: Path, index: int, skip_video: bool = False) -> RenderedVideo:
    stable_id = f"short_{_safe_filename(race.id)}"
    video_dir = output_dir / "shorts" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    size = (1080, 1920)
    utm_content = f"short_{_safe_filename(race.id)}"
    title = _short_title(race, target_date)
    slides: List[Slide] = []
    hero_horse = _best_horse_for_race(race)
    visual_asset = resolve_visual_asset(
        target_date,
        race.venue_name,
        race.race_number,
        "vertical",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "short", stable_id)
    publish_block_reasons: List[str] = []
    if visual_asset is None:
        publish_block_reasons.append("Shorts用の縦写真が見つかりません")
    if audio_asset is None:
        publish_block_reasons.append("Shorts用BGMが見つかりません")
    publishable = not publish_block_reasons

    slides.extend(
        _draw_intro_sequence(
            video_dir,
            target_date,
            race.display_name,
            size,
            hero_horse=hero_horse,
            race_label=f"{race.venue_name}{race.race_number}R",
            venue_name=race.venue_name,
            race_number=race.race_number,
            visual_asset=visual_asset,
        )
    )

    reveal_steps = [(1, 0.15), (2, 0.15), (3, SHORT_RACE_SLIDE_SECONDS - 0.30)]
    for visible_count, duration in reveal_steps:
        race_slide = video_dir / f"001_race_{visible_count:02d}.png"
        _draw_race_slide(
            race_slide,
            race,
            target_date,
            size,
            utm_content,
            visible_rank_count=visible_count,
        )
        slides.append(Slide(race_slide, duration))

    position_slide = video_dir / "002_position.png"
    _draw_short_position_slide(position_slide, race, target_date, size, utm_content)
    slides.append(Slide(position_slide, SHORT_POSITION_SLIDE_SECONDS))

    outro = video_dir / "999_outro.png"
    _draw_outro_slide(
        outro,
        target_date,
        size,
        utm_content,
        venue_name=race.venue_name,
        race_number=race.race_number,
        visual_asset=visual_asset,
    )
    slides.append(Slide(outro, SHORT_OUTRO_SECONDS))

    thumbnail = video_dir / "thumbnail.jpg"
    _draw_thumbnail(
        thumbnail,
        race.display_name,
        "AI偏差値",
        target_date,
        (1920, 1080),
        hero_horse=hero_horse,
        venue_name=race.venue_name,
        race_number=race.race_number,
        grade=race.grade or "",
        visual_asset=visual_asset,
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_mp4(slides, video_path, *size, audio_asset=audio_asset)

    url = build_video_url(target_date, utm_content, race.venue_name, race.race_number)
    course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "cover_frame_image": visual_asset_metadata(visual_asset),
        "bgm": audio_asset_metadata(audio_asset),
        "course": course_asset_metadata(course_asset),
    }
    credits = asset_credit_lines(visual_asset, audio_asset)
    description = _description(title, target_date, url, race.venue_name, credits, is_short=True)
    tags = ["競馬", "AI偏差値", "UMA-FREE", "Shorts", race.venue_name, race.display_name]
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "short",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "race_ids": [race.id],
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
        }
    )
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "short",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": race.venue_name,
        "race_ids": [race.id],
        "aspect_ratio": "9:16",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "utm_content": utm_content,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": False,
        "publish_order": index,
        "publishable": publishable,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": publish_block_reasons,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo(
        video_type="short",
        stable_id=stable_id,
        title=title,
        description=description,
        tags=tags,
        video_path=video_path,
        thumbnail_path=thumbnail,
        metadata_path=metadata_path,
        publish_offset_minutes=-20,
        publishable=publishable,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name=race.venue_name,
        race_ids=[race.id],
        aspect_ratio="9:16",
        destination_url=url,
        utm_content=utm_content,
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=False,
    )
