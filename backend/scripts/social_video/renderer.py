from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import textwrap
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import List, Optional, Sequence

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

from .data_loader import HorseVideoData, RaceVideoData, VenueVideoData, build_video_url, top_by_deviation, top_by_position
from .visual_assets import VisualAsset, resolve_visual_asset


PROJECT_ROOT = Path(__file__).resolve().parents[3]
FONT_DIR = PROJECT_ROOT / "backend" / "fonts"
LOGO_PATH = FONT_DIR / "new-logo.png"

FONT_BLACK = "NotoSansJP-Black"
FONT_BOLD = "NotoSansJP-Bold"
FONT_REGULAR = "NotoSansJP-Regular"
WINDOWS_FONT_DIR = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"

PAPER = (246, 243, 235)
PAPER_DARK = (231, 225, 212)
CHARCOAL = (18, 24, 28)
CHARCOAL_SOFT = (36, 43, 47)
DEEP_GREEN = (10, 82, 62)
GREEN_DARK = (7, 58, 46)
BURGUNDY = (139, 45, 46)
EDITORIAL_GOLD = (190, 149, 63)
EDITORIAL_GOLD_DARK = (135, 95, 28)
INK_DARK = (25, 29, 30)
INK_MUTED = (92, 99, 99)
RULE = (191, 185, 172)
TURF_LIGHT = (221, 232, 210)
TRACK_BEIGE = (210, 190, 153)

# 旧ヘルパーが参照する互換エイリアス。v4の描画では役割別の上記色を直接使う。
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
CARD_BG = (255, 254, 250)
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

FULL_CTA = "全頭データは概要欄のUMA-FREEで確認"
SHORT_CTA = "全頭データは概要欄のUMA-FREEで確認"
LONG_VENUE_SLIDE_SECONDS = 3.5
LONG_RACE_SLIDE_SECONDS = 4.2
LONG_POSITION_SLIDE_SECONDS = 3.2
LONG_OUTRO_SECONDS = 4.0
SHORT_RACE_SLIDE_SECONDS = 5.5
SHORT_POSITION_SLIDE_SECONDS = 6.0
SHORT_OUTRO_SECONDS = 3.0
VIDEO_FPS = 30
KEN_BURNS_ZOOM_TO = 1.0
CROSSFADE_SECONDS = 0.16
@dataclass
class Slide:
    image_path: Path
    duration_seconds: float


@dataclass
class RenderedVideo:
    video_type: str
    stable_id: str
    title: str
    description: str
    tags: List[str]
    video_path: Optional[Path]
    thumbnail_path: Path
    metadata_path: Path
    publish_offset_minutes: int


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
    candidates = [
        requested if requested.is_absolute() else WINDOWS_FONT_DIR / name,
        FONT_DIR / name,
        WINDOWS_FONT_DIR / "NotoSansJP-VF.ttf",
        WINDOWS_FONT_DIR / "BIZ-UDGothicB.ttc",
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
    for size in range(max_size, min_size - 1, -2):
        font = _font(font_name, size)
        lines = _fit_text(draw, cleaned, font, max_width, max_lines)
        if not lines:
            return font, []
        line_height = max(_text_size(draw, line, font)[1] for line in lines)
        if len(lines) <= max_lines and all(_text_size(draw, line, font)[0] <= max_width for line in lines) and line_height > 0:
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
    best_race: Optional[RaceVideoData] = None
    best_horse: Optional[HorseVideoData] = None
    best_score = -999.0
    for race in venue.races:
        horse = _best_horse_for_race(race)
        if horse is None or horse.deviation_score is None:
            continue
        if horse.deviation_score > best_score:
            best_score = horse.deviation_score
            best_race = race
            best_horse = horse
    return best_race, best_horse


def _hero_score_text(horse: Optional[HorseVideoData]) -> str:
    return _score_text(horse.deviation_score) if horse else "--"


def _hero_horse_label(horse: Optional[HorseVideoData]) -> str:
    if not horse:
        return "上位評価を確認"
    return f"{horse.horse_number}番 {horse.horse_name}"


def _waku_color(waku_number: Optional[int]) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    palette = {
        1: ((255, 255, 255), (26, 26, 26)),
        2: ((26, 26, 26), (255, 255, 255)),
        3: ((228, 0, 43), (255, 255, 255)),
        4: ((0, 102, 179), (255, 255, 255)),
        5: ((255, 212, 0), (26, 26, 26)),
        6: ((0, 153, 68), (255, 255, 255)),
        7: ((243, 152, 0), (26, 26, 26)),
        8: ((236, 109, 171), (58, 12, 34)),
    }
    if waku_number in palette:
        return palette[waku_number]
    return (POP_GOLD, TEXT_OUTLINE)


def _draw_horse_number_badge(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    horse: Optional[HorseVideoData],
    diameter: int,
    stroke_width: int = 6,
) -> None:
    number = horse.horse_number if horse else 0
    fill, text_fill = _waku_color(horse.waku_number if horse else None)
    cx, cy = center
    box = (cx - diameter // 2, cy - diameter // 2, cx + diameter // 2, cy + diameter // 2)
    draw.ellipse((box[0] + 9, box[1] + 11, box[2] + 9, box[3] + 11), fill=(0, 0, 0))
    draw.ellipse(box, fill=fill, outline=TEXT_OUTLINE, width=stroke_width)
    font = _font(FONT_BLACK, int(diameter * 0.47))
    draw.text((cx, cy - int(diameter * 0.22)), str(number or "-"), font=font, fill=text_fill, anchor="ma")


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
) -> tuple[Image.Image, Optional[VisualAsset]]:
    compact = size[1] > size[0]
    orientation = "vertical" if compact else "wide"
    asset = resolve_visual_asset(target_date, venue_name, race_number, orientation)
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
    draw.rectangle((0, 0, width, height), fill=(8, 13, 15, 54))
    if compact:
        draw.rectangle((0, 0, width, int(height * 0.64)), fill=(8, 13, 15, 118))
        steps = 18
        start_y = int(height * 0.50)
        end_y = int(height * 0.82)
        for idx in range(steps):
            ratio = idx / max(steps - 1, 1)
            alpha = round(118 * (1 - ratio))
            y1 = round(start_y + (end_y - start_y) * ratio)
            y2 = round(start_y + (end_y - start_y) * (idx + 1) / steps)
            draw.rectangle((0, y1, width, y2), fill=(8, 13, 15, alpha))
    else:
        draw.rectangle((0, 0, int(width * 0.52), height), fill=(8, 13, 15, 174))
        steps = 24
        start_x = int(width * 0.42)
        end_x = int(width * 0.72)
        for idx in range(steps):
            ratio = idx / max(steps - 1, 1)
            alpha = round(174 * (1 - ratio))
            x1 = round(start_x + (end_x - start_x) * ratio)
            x2 = round(start_x + (end_x - start_x) * (idx + 1) / steps)
            draw.rectangle((x1, 0, x2, height), fill=(8, 13, 15, alpha))
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def _draw_v4_brand(draw: ImageDraw.ImageDraw, x: int, y: int, compact: bool = False, light: bool = True) -> None:
    mark = 48 if compact else 54
    fill = WHITE if light else DEEP_GREEN
    draw.rounded_rectangle((x, y, x + mark, y + mark), radius=8, fill=DEEP_GREEN if light else CHARCOAL)
    draw.text((x + mark // 2, y + 5), "U", font=_font("Inter-Black.ttf", 30 if compact else 34), fill=WHITE, anchor="ma")
    draw.text((x + mark + 18, y + 4), "UMA-FREE", font=_font(FONT_BLACK, 28 if compact else 31), fill=fill)


def _draw_asset_credit(draw: ImageDraw.ImageDraw, asset: Optional[VisualAsset], width: int, height: int) -> None:
    if asset is None or not asset.credit:
        return
    draw.text((width - 24, height - 28), f"素材: {asset.credit}", font=_font(FONT_REGULAR, 15), fill=(224, 224, 216), anchor="ra")


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
) -> None:
    width, height = size
    compact = height > width
    image, asset = _hero_background(size, target_date, venue_name, race_number)
    image = _apply_photo_scrim(image, compact)
    draw = ImageDraw.Draw(image)
    margin = 72 if not compact else 60
    date_text = _display_short_date(target_date)
    score_text = f"{score_override:.1f}" if score_override is not None else _hero_score_text(hero_horse)
    horse_label = hero_horse.horse_name if hero_horse else "上位評価"

    if not compact:
        _draw_v4_brand(draw, margin, 48, compact=False, light=True)
        draw.rounded_rectangle((margin, 134, margin + 360, 192), radius=8, fill=DEEP_GREEN)
        draw.text((margin + 22, 145), f"{date_text}  {race_label or venue_name}", font=_font(FONT_BOLD, 28), fill=WHITE)
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 250),
            FONT_BLACK,
            88,
            54,
            840,
            WHITE,
            max_lines=2,
            line_gap=8,
            stroke_width=5,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.text((margin, 545), "AI偏差値", font=_font(FONT_BOLD, 34), fill=(232, 221, 192))
        draw.text((margin, 586), score_text, font=_font("Inter-Black.ttf", 142), fill=EDITORIAL_GOLD, stroke_width=3, stroke_fill=TEXT_OUTLINE)
        _draw_horse_number_badge(draw, (margin + 78, 846), hero_horse, 92, stroke_width=4)
        _draw_fit_text_no_ellipsis(draw, horse_label, (margin + 148, 808), FONT_BLACK, 48, 30, 620, WHITE, max_lines=1, stroke_width=4, stroke_fill=TEXT_OUTLINE)
        draw.text((margin + 148, 870), "注目スコア上位", font=_font(FONT_BOLD, 25), fill=(222, 220, 208))
    else:
        _draw_v4_brand(draw, margin, 92, compact=True, light=True)
        draw.text((width - margin, 104), date_text, font=_font(FONT_BOLD, 28), fill=WHITE, anchor="ra")
        draw.rounded_rectangle((margin, 238, width - margin, 302), radius=8, fill=DEEP_GREEN)
        draw.text((margin + 24, 250), race_label or venue_name, font=_font(FONT_BOLD, 31), fill=WHITE)
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 360),
            FONT_BLACK,
            72,
            43,
            width - margin * 2,
            WHITE,
            max_lines=2,
            line_gap=10,
            stroke_width=5,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.text((margin, 650), "AI偏差値", font=_font(FONT_BOLD, 34), fill=(232, 221, 192))
        draw.text((margin, 700), score_text, font=_font("Inter-Black.ttf", 176), fill=EDITORIAL_GOLD, stroke_width=4, stroke_fill=TEXT_OUTLINE)
        _draw_horse_number_badge(draw, (margin + 66, 1032), hero_horse, 94, stroke_width=4)
        _draw_fit_text_no_ellipsis(draw, horse_label, (margin + 138, 992), FONT_BLACK, 48, 30, width - margin * 2 - 138, WHITE, max_lines=1, stroke_width=4, stroke_fill=TEXT_OUTLINE)
        draw.text((margin + 138, 1056), "注目スコア上位", font=_font(FONT_BOLD, 27), fill=(226, 224, 213))
    _draw_asset_credit(draw, asset, width, height)
    _save_slide(image, path, size)


def _draw_venue_title_slide(path: Path, venue: VenueVideoData, target_date: str, size: tuple[int, int]) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 64 if not compact else 52
    date_text = _display_date(target_date)
    grade_line = _grade_line(venue)
    if not compact:
        draw.rectangle((0, 0, width, 132), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 39, compact=False, light=True)
        draw.text((width - margin, 42), f"{_display_short_date(target_date)}  {venue.race_type}競馬", font=_font(FONT_BOLD, 29), fill=WHITE, anchor="ra")
        draw.text((margin, 184), f"{venue.venue_name} 全レース一覧", font=_font(FONT_BLACK, 62), fill=INK_DARK)
        draw.text((margin, 264), grade_line, font=_font(FONT_BOLD, 29), fill=DEEP_GREEN)

        races = venue.races[:12]
        column_count = 2 if len(races) > 6 else 1
        rows_per_column = math.ceil(len(races) / column_count) if races else 1
        gap = 34
        column_w = (width - margin * 2 - gap * (column_count - 1)) // column_count
        table_y = 332
        row_h = min(104, max(76, (height - table_y - 90) // rows_per_column))
        for idx, race in enumerate(races):
            column = idx // rows_per_column
            row = idx % rows_per_column
            x = margin + column * (column_w + gap)
            y = table_y + row * row_h
            horse = (top_by_deviation(race, 1) or [None])[0]
            draw.rectangle((x, y, x + column_w, y + row_h - 8), fill=(255, 254, 250), outline=RULE, width=2)
            draw.rectangle((x, y, x + 94, y + row_h - 8), fill=DEEP_GREEN)
            draw.text((x + 47, y + 20), f"{race.race_number}R", font=_font(FONT_BLACK, 30), fill=WHITE, anchor="ma")
            _draw_fit_text_no_ellipsis(draw, race.display_name, (x + 120, y + 12), FONT_BLACK, 29, 20, column_w - 420, INK_DARK, max_lines=1)
            if horse:
                _draw_horse_number_badge(draw, (x + column_w - 238, y + (row_h - 8) // 2), horse, 50, stroke_width=2)
                draw.text((x + column_w - 190, y + 15), "AI偏差値", font=_font(FONT_BOLD, 19), fill=INK_MUTED)
                draw.text((x + column_w - 24, y + 10), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", 36), fill=EDITORIAL_GOLD_DARK, anchor="ra")
        draw.text((width - margin, height - 50), "1Rから順にAI偏差値と位置取りを確認", font=_font(FONT_BOLD, 25), fill=INK_MUTED, anchor="ra")
    else:
        draw.rectangle((0, 0, width, 170), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 70, compact=True, light=True)
        draw.text((margin, 230), f"{venue.venue_name} 全レース", font=_font(FONT_BLACK, 58), fill=INK_DARK)
        draw.text((margin, 310), f"{date_text} / {grade_line}", font=_font(FONT_BOLD, 27), fill=DEEP_GREEN)
        y = 390
        for race in venue.races[:9]:
            horse = (top_by_deviation(race, 1) or [None])[0]
            draw.rectangle((margin, y, width - margin, y + 116), fill=CARD_BG, outline=RULE, width=2)
            draw.rectangle((margin, y, margin + 118, y + 116), fill=DEEP_GREEN)
            draw.text((margin + 59, y + 34), f"{race.race_number}R", font=_font(FONT_BLACK, 34), fill=WHITE, anchor="ma")
            _draw_fit_text_no_ellipsis(draw, race.display_name, (margin + 144, y + 14), FONT_BLACK, 30, 21, width - margin * 2 - 350, INK_DARK, max_lines=1)
            if horse:
                draw.text((width - margin - 24, y + 38), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", 38), fill=EDITORIAL_GOLD_DARK, anchor="ra")
            y += 134
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
    radius = 14 if compact else 10
    draw.rounded_rectangle(xy, radius=radius, fill=style.bg, outline=style.border, width=style.border_width)
    if rank == 1:
        draw.rectangle((x1, y1, x1 + (10 if compact else 12), y2), fill=EDITORIAL_GOLD)

    badge_d = 56 if compact else 52
    badge_x = x1 + 28
    badge_y = y1 + 28
    draw.ellipse((badge_x, badge_y, badge_x + badge_d, badge_y + badge_d), fill=style.badge_fill)
    draw.text((badge_x + badge_d // 2, badge_y + 10), str(rank), font=_font("Inter-Black.ttf", 29), fill=style.badge_text, anchor="ma")

    horse_badge_d = 64 if compact else 58
    horse_badge_x = badge_x + badge_d + 34
    badge_center_y = y1 + 58 if not compact else y1 + 64
    _draw_horse_number_badge(draw, (horse_badge_x + horse_badge_d // 2, badge_center_y), horse, horse_badge_d, stroke_width=3)
    name_x = horse_badge_x + horse_badge_d + 20
    score_area = 190 if compact else 170
    max_name_width = max(170, x2 - name_x - score_area)
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (name_x, y1 + 24),
        FONT_BLACK,
        36 if rank == 1 else 31,
        20,
        max_name_width,
        INK_DARK,
        max_lines=1,
    )
    draw.text((name_x, y1 + 78), f"位置取り  {horse.position_label or '-'}", font=_font(FONT_BOLD, 22 if not compact else 24), fill=INK_MUTED)
    draw.text((x2 - 28, y1 + 14), _score_text(horse.deviation_score), font=_font("Inter-Black.ttf", style.score_size), fill=style.score_fill, anchor="ra")
    draw.text((x2 - 30, y1 + 84), "AI偏差値", font=_font(FONT_BOLD, 18 if not compact else 20), fill=INK_MUTED, anchor="ra")


def _draw_race_slide(path: Path, race: RaceVideoData, target_date: str, size: tuple[int, int], utm_content: str) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 60
    race_label = f"{race.venue_name}{race.race_number}R"
    if race.grade:
        race_label += f" {race.grade}"
    top_horses = top_by_deviation(race, 8 if not compact else 3)

    if not compact:
        draw.rectangle((0, 0, width, 142), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 42, compact=False, light=True)
        draw.text((margin + 310, 44), race_label, font=_font(FONT_BOLD, 29), fill=(226, 235, 228))
        _draw_fit_text_no_ellipsis(draw, race.display_name, (margin + 310, 78), FONT_BLACK, 43, 27, 980, WHITE, max_lines=1)
        draw.text((width - margin, 44), f"AI偏差値  Race {race.race_number}/12", font=_font(FONT_BLACK, 31), fill=WHITE, anchor="ra")

        card_y = 184
        if top_horses:
            _draw_rank_card(draw, (margin, card_y, 1030, card_y + 282), 1, top_horses[0], compact=False)
            if len(top_horses) > 1:
                _draw_rank_card(draw, (1060, card_y, width - margin, card_y + 128), 2, top_horses[1], compact=False)
            if len(top_horses) > 2:
                _draw_rank_card(draw, (1060, card_y + 154, width - margin, card_y + 282), 3, top_horses[2], compact=False)
        if not top_horses:
            draw.rectangle((margin, card_y, width - margin, card_y + 282), fill=CARD_BG, outline=RULE, width=2)
            draw.text((width // 2, card_y + 104), "出走馬データを確認中です", font=_font(FONT_BLACK, 40), fill=INK_DARK, anchor="ma")

        table_y = 522
        table_x = margin
        table_w = width - margin * 2
        col_widths = [110, 130, table_w - 110 - 130 - 230 - 230, 230, 230]
        headers = ["順位", "馬番", "馬名", "AI偏差値", "位置取り"]
        x = table_x
        for header, col_w in zip(headers, col_widths):
            draw.rectangle((x, table_y, x + col_w, table_y + 62), fill=CHARCOAL)
            draw.text((x + col_w // 2, table_y + 15), header, font=_font(FONT_BOLD, 23), fill=WHITE, anchor="ma")
            x += col_w
        rows = top_horses[3:8]
        for offset, horse in enumerate(rows):
            rank = offset + 4
            y = table_y + 62 + offset * 78
            row_fill = CARD_BG if offset % 2 == 0 else PAPER_DARK
            x = table_x
            values = [str(rank), str(horse.horse_number), horse.horse_name, _score_text(horse.deviation_score), horse.position_label or "-"]
            for col_idx, (value, col_w) in enumerate(zip(values, col_widths)):
                draw.rectangle((x, y, x + col_w, y + 78), fill=row_fill, outline=RULE, width=1)
                if col_idx == 1:
                    _draw_horse_number_badge(draw, (x + col_w // 2, y + 39), horse, 50, stroke_width=2)
                elif col_idx == 2:
                    _draw_fit_text_no_ellipsis(draw, value, (x + 20, y + 20), FONT_BOLD, 28, 19, col_w - 40, INK_DARK, max_lines=1)
                else:
                    fill = EDITORIAL_GOLD_DARK if col_idx == 3 else INK_DARK
                    draw.text((x + col_w // 2, y + 20), value, font=_font("Inter-Bold.ttf" if col_idx == 3 else FONT_BOLD, 29), fill=fill, anchor="ma")
                x += col_w
        if not rows:
            draw.rectangle((table_x, table_y + 62, table_x + table_w, table_y + 244), fill=CARD_BG, outline=RULE, width=2)
            draw.text((width // 2, table_y + 122), "続きの出走馬データはサイトで確認できます", font=_font(FONT_BOLD, 31), fill=INK_MUTED, anchor="ma")

        draw.rectangle((0, height - 50, width, height), fill=CHARCOAL)
        progress_width = round((width - margin * 2) * min(12, max(1, race.race_number)) / 12)
        draw.rectangle((margin, height - 18, margin + progress_width, height - 10), fill=EDITORIAL_GOLD)
    else:
        safe_left = 60
        safe_right = 900
        draw.rectangle((0, 0, width, 220), fill=DEEP_GREEN)
        _draw_v4_brand(draw, safe_left, 96, compact=True, light=True)
        draw.text((safe_right, 104), f"Race {race.race_number}/12", font=_font("Inter-Bold.ttf", 27), fill=WHITE, anchor="ra")
        draw.text((safe_left, 274), race_label, font=_font(FONT_BOLD, 31), fill=DEEP_GREEN)
        _draw_fit_text_no_ellipsis(draw, race.display_name, (safe_left, 326), FONT_BLACK, 54, 34, safe_right - safe_left, INK_DARK, max_lines=2, line_gap=5)
        draw.text((safe_left, 448), "AI偏差値 上位3頭", font=_font(FONT_BLACK, 36), fill=INK_DARK)

        y = 520
        heights = [250, 190, 190]
        for idx, horse in enumerate(top_horses[:3], start=1):
            card_h = heights[idx - 1]
            _draw_rank_card(draw, (safe_left, y, safe_right, y + card_h), idx, horse, compact=True)
            y += card_h + 24
        if not top_horses:
            draw.rectangle((safe_left, y, safe_right, y + 220), fill=CARD_BG, outline=RULE, width=2)
            draw.text((width // 2, y + 82), "出走馬データを確認中です", font=_font(FONT_BLACK, 34), fill=INK_DARK, anchor="ma")
        draw.text((safe_left, 1372), "次は位置取り", font=_font(FONT_BOLD, 28), fill=INK_MUTED)
        draw.line((safe_left, 1428, safe_right, 1428), fill=RULE, width=3)
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
) -> None:
    x, y = xy
    badge = 54 if compact else 48
    _draw_horse_number_badge(draw, (x + badge // 2, y + badge // 2), horse, badge, stroke_width=2)
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (x + badge + 12, y + (8 if compact else 7)),
        FONT_BOLD,
        25 if compact else 23,
        17,
        max_width - badge - 14,
        INK_DARK,
        max_lines=1,
    )


def _draw_position_slide(path: Path, race: RaceVideoData, target_date: str, size: tuple[int, int]) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(image)
    groups = _position_groups(race)
    race_label = f"{race.venue_name}{race.race_number}R"
    if race.grade:
        race_label += f" {race.grade}"

    if not compact:
        margin = 60
        draw.rectangle((0, 0, width, 142), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 42, compact=False, light=True)
        draw.text((margin + 310, 44), race_label, font=_font(FONT_BOLD, 29), fill=(226, 235, 228))
        _draw_fit_text_no_ellipsis(draw, race.display_name, (margin + 310, 78), FONT_BLACK, 43, 27, 980, WHITE, max_lines=1)
        draw.text((width - margin, 44), "位置取り", font=_font(FONT_BLACK, 34), fill=WHITE, anchor="ra")

        track = (margin, 210, width - margin, height - 106)
        draw.rounded_rectangle(track, radius=120, fill=TRACK_BEIGE)
        inset = 34
        infield = (track[0] + inset, track[1] + inset, track[2] - inset, track[3] - inset)
        draw.rounded_rectangle(infield, radius=92, fill=TURF_LIGHT)
        labels = ["先行", "中団", "後方"]
        zone_w = (infield[2] - infield[0]) // 3
        for idx, label in enumerate(labels):
            x1 = infield[0] + idx * zone_w
            x2 = infield[2] if idx == 2 else x1 + zone_w
            if idx:
                draw.line((x1, infield[1] + 38, x1, infield[3] - 38), fill=(177, 185, 166), width=3)
            draw.rounded_rectangle((x1 + 24, infield[1] + 24, x1 + 154, infield[1] + 70), radius=8, fill=DEEP_GREEN if idx == 0 else CHARCOAL_SOFT)
            draw.text((x1 + 89, infield[1] + 32), label, font=_font(FONT_BLACK, 23), fill=WHITE, anchor="ma")
            horses = groups[label]
            token_w = zone_w - 64
            for row, horse in enumerate(horses[:7]):
                _draw_position_token(draw, horse, (x1 + 34, infield[1] + 104 + row * 74), token_w, compact=False)
            if len(horses) > 7:
                draw.text((x1 + 36, infield[3] - 48), f"ほか{len(horses) - 7}頭", font=_font(FONT_BOLD, 20), fill=INK_MUTED)
        draw.text((track[0] + 8, track[1] - 42), "スタート", font=_font(FONT_BOLD, 22), fill=DEEP_GREEN)
        draw.text((track[2] - 8, track[1] - 42), "ゴール", font=_font(FONT_BOLD, 22), fill=BURGUNDY, anchor="ra")
        draw.rectangle((0, height - 50, width, height), fill=CHARCOAL)
        progress_width = round((width - margin * 2) * min(12, max(1, race.race_number)) / 12)
        draw.rectangle((margin, height - 18, margin + progress_width, height - 10), fill=EDITORIAL_GOLD)
    else:
        safe_left = 60
        safe_right = 900
        draw.rectangle((0, 0, width, 220), fill=DEEP_GREEN)
        _draw_v4_brand(draw, safe_left, 96, compact=True, light=True)
        draw.text((safe_right, 104), f"Race {race.race_number}/12", font=_font("Inter-Bold.ttf", 27), fill=WHITE, anchor="ra")
        draw.text((safe_left, 274), race_label, font=_font(FONT_BOLD, 31), fill=DEEP_GREEN)
        _draw_fit_text_no_ellipsis(draw, race.display_name, (safe_left, 326), FONT_BLACK, 50, 32, safe_right - safe_left, INK_DARK, max_lines=2, line_gap=5)
        draw.text((safe_left, 448), "位置取り", font=_font(FONT_BLACK, 38), fill=INK_DARK)

        track = (safe_left, 520, safe_right, 1440)
        draw.rounded_rectangle(track, radius=76, fill=TRACK_BEIGE)
        draw.rounded_rectangle((track[0] + 24, track[1] + 24, track[2] - 24, track[3] - 24), radius=58, fill=TURF_LIGHT)
        labels = ["先行", "中団", "後方"]
        zone_h = (track[3] - track[1] - 48) // 3
        for idx, label in enumerate(labels):
            y1 = track[1] + 24 + idx * zone_h
            if idx:
                draw.line((track[0] + 52, y1, track[2] - 52, y1), fill=(177, 185, 166), width=3)
            draw.rounded_rectangle((track[0] + 48, y1 + 26, track[0] + 180, y1 + 76), radius=8, fill=DEEP_GREEN if idx == 0 else CHARCOAL_SOFT)
            draw.text((track[0] + 114, y1 + 36), label, font=_font(FONT_BLACK, 24), fill=WHITE, anchor="ma")
            horses = groups[label][:6]
            for item_idx, horse in enumerate(horses):
                column = item_idx % 2
                row = item_idx // 2
                x = track[0] + 220 + column * 300
                y = y1 + 26 + row * 76
                _draw_position_token(draw, horse, (x, y), 282, compact=True)
        draw.text((safe_left, 1484), "スタートから序盤の隊列イメージ", font=_font(FONT_BOLD, 27), fill=INK_MUTED)
    _save_slide(image, path, size)


def _draw_outro_slide(path: Path, target_date: str, size: tuple[int, int], utm_content: str) -> None:
    width, height = size
    compact = height > width
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)
    margin = 68 if not compact else 60

    if not compact:
        draw.rectangle((0, 0, width, 146), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 44, compact=False, light=True)
        draw.text((width - margin, 49), _display_short_date(target_date), font=_font(FONT_BOLD, 29), fill=WHITE, anchor="ra")
        draw.text((width // 2, 250), "全頭データをまとめて確認", font=_font(FONT_BLACK, 68), fill=INK_DARK, anchor="ma")
        draw.text((width // 2, 338), "AI偏差値・位置取り・枠順傾向", font=_font(FONT_BOLD, 34), fill=DEEP_GREEN, anchor="ma")
        draw.line((margin, 424, width - margin, 424), fill=RULE, width=3)
        items = [("01", "全レース"), ("02", "全頭のAI偏差値"), ("03", "位置取りと枠順傾向")]
        item_w = (width - margin * 2) // 3
        for idx, (number, label) in enumerate(items):
            x = margin + idx * item_w
            draw.text((x + item_w // 2, 486), number, font=_font("Inter-Black.ttf", 58), fill=EDITORIAL_GOLD, anchor="ma")
            draw.text((x + item_w // 2, 574), label, font=_font(FONT_BLACK, 31), fill=INK_DARK, anchor="ma")
        cta_y = 704
        draw.rounded_rectangle((margin, cta_y, width - margin, cta_y + 164), radius=12, fill=BURGUNDY)
        draw.text((width // 2, cta_y + 37), FULL_CTA, font=_fit_font_for_width(draw, FULL_CTA, FONT_BLACK, 43, 30, width - margin * 2 - 100), fill=WHITE, anchor="ma")
        draw.text((width // 2, cta_y + 100), "uma-free.com", font=_font("Inter-Bold.ttf", 34), fill=(244, 224, 201), anchor="ma")
    else:
        draw.rectangle((0, 0, width, 220), fill=DEEP_GREEN)
        _draw_v4_brand(draw, margin, 96, compact=True, light=True)
        draw.text((margin, 330), "全頭データを\nまとめて確認", font=_font(FONT_BLACK, 64), fill=INK_DARK, spacing=12)
        draw.text((margin, 520), "AI偏差値・位置取り・枠順傾向", font=_font(FONT_BOLD, 30), fill=DEEP_GREEN)
        draw.line((margin, 590, width - margin, 590), fill=RULE, width=3)
        y = 670
        for number, label in [("01", "全レース"), ("02", "全頭のAI偏差値"), ("03", "位置取りと枠順傾向")]:
            draw.text((margin, y), number, font=_font("Inter-Black.ttf", 50), fill=EDITORIAL_GOLD)
            draw.text((margin + 118, y + 10), label, font=_font(FONT_BLACK, 34), fill=INK_DARK)
            y += 146
        cta_y = 1160
        draw.rounded_rectangle((margin, cta_y, width - margin, cta_y + 230), radius=18, fill=BURGUNDY)
        _draw_fit_text_no_ellipsis(draw, SHORT_CTA, (width // 2, cta_y + 44), FONT_BLACK, 42, 29, width - margin * 2 - 80, WHITE, max_lines=2, line_gap=8, anchor="ma")
        draw.text((width // 2, cta_y + 164), "uma-free.com", font=_font("Inter-Bold.ttf", 34), fill=(244, 224, 201), anchor="ma")

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
) -> None:
    width, height = size
    compact = height > width
    image, asset = _hero_background(size, target_date, venue_name, race_number)
    image = _apply_photo_scrim(image, compact)
    draw = ImageDraw.Draw(image)
    margin = 68 if not compact else 56
    date_text = _display_short_date(target_date)
    headline = title.strip() or "全レース"
    score_text = _hero_score_text(hero_horse)
    horse_name = hero_horse.horse_name if hero_horse else "上位評価"

    if not compact:
        _draw_v4_brand(draw, margin, 52, compact=False, light=True)
        chip_text = "  ".join(part for part in (date_text, venue_name, grade) if part)
        chip_w = min(680, max(340, 42 + len(chip_text) * 32))
        draw.rounded_rectangle((margin, 144, margin + chip_w, 208), radius=8, fill=DEEP_GREEN)
        draw.text((margin + 24, 154), chip_text, font=_font(FONT_BOLD, 30), fill=WHITE)
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 272),
            FONT_BLACK,
            96,
            56,
            950,
            WHITE,
            max_lines=2,
            line_gap=8,
            stroke_width=6,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.text((margin, 612), "AI偏差値", font=_font(FONT_BOLD, 34), fill=(235, 229, 209), stroke_width=3, stroke_fill=TEXT_OUTLINE)
        draw.text((margin, 650), score_text, font=_font("Inter-Black.ttf", 150), fill=EDITORIAL_GOLD, stroke_width=4, stroke_fill=TEXT_OUTLINE)
        _draw_horse_number_badge(draw, (margin + 68, 940), hero_horse, 88, stroke_width=4)
        _draw_fit_text_no_ellipsis(draw, horse_name, (margin + 136, 900), FONT_BLACK, 47, 30, 660, WHITE, max_lines=1, stroke_width=4, stroke_fill=TEXT_OUTLINE)
    else:
        _draw_v4_brand(draw, margin, 88, compact=True, light=True)
        draw.text((width - margin, 100), date_text, font=_font(FONT_BOLD, 28), fill=WHITE, anchor="ra")
        _draw_fit_text_no_ellipsis(draw, headline, (margin, 310), FONT_BLACK, 74, 44, width - margin * 2, WHITE, max_lines=2, line_gap=8, stroke_width=5, stroke_fill=TEXT_OUTLINE)
        draw.text((margin, 650), "AI偏差値", font=_font(FONT_BOLD, 34), fill=(235, 229, 209))
        draw.text((margin, 700), score_text, font=_font("Inter-Black.ttf", 170), fill=EDITORIAL_GOLD, stroke_width=4, stroke_fill=TEXT_OUTLINE)
        _draw_horse_number_badge(draw, (margin + 66, 1050), hero_horse, 92, stroke_width=4)
        _draw_fit_text_no_ellipsis(draw, horse_name, (margin + 136, 1008), FONT_BLACK, 48, 30, width - margin * 2 - 136, WHITE, max_lines=1, stroke_width=4, stroke_fill=TEXT_OUTLINE)
    _draw_asset_credit(draw, asset, width, height)
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
        filter_parts.append(f"[{idx}:v]setpts=PTS-STARTPTS,fps={fps},format=yuv420p[v{idx}]")

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


def _add_bgm_if_configured(ffmpeg: str, video_path: Path, output_path: Path) -> bool:
    bgm = os.getenv("SOCIAL_VIDEO_BGM_PATH")
    if not bgm:
        return False
    bgm_path = Path(bgm)
    if not bgm_path.exists():
        raise RuntimeError(f"SOCIAL_VIDEO_BGM_PATH が見つかりません: {bgm_path}")
    volume = os.getenv("SOCIAL_VIDEO_BGM_VOLUME", "0.20")
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(bgm_path),
        "-filter_complex",
        f"[1:a]volume={volume}[bgm]",
        "-map",
        "0:v",
        "-map",
        "[bgm]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)
    return True


def render_mp4(slides: Sequence[Slide], output_path: Path, width: int, height: int) -> None:
    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpegが見つかりません。ローカル検証では --skip-video を使うか、ffmpegをインストールしてください。")
    if os.getenv("SOCIAL_VIDEO_DISABLE_MOTION") == "1":
        manifest = output_path.with_suffix(".concat.txt")
        _write_concat_manifest(slides, manifest)
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
            str(output_path),
        ]
        subprocess.run(command, check=True)
        return

    motion_dir = output_path.parent / f".{output_path.stem}_motion"
    if motion_dir.exists():
        shutil.rmtree(motion_dir)
    motion_dir.mkdir(parents=True, exist_ok=True)
    clip_paths: List[Path] = []
    durations: List[float] = []
    for idx, slide in enumerate(slides):
        clip_path = motion_dir / f"clip_{idx:03d}.mp4"
        _render_static_clip(ffmpeg, slide, clip_path, width, height, VIDEO_FPS)
        clip_paths.append(clip_path)
        durations.append(slide.duration_seconds)

    video_without_audio = output_path.with_suffix(".video.mp4") if os.getenv("SOCIAL_VIDEO_BGM_PATH") else output_path
    _concat_motion_clips(ffmpeg, clip_paths, durations, video_without_audio, VIDEO_FPS)
    if video_without_audio != output_path:
        _add_bgm_if_configured(ffmpeg, video_without_audio, output_path)
        try:
            video_without_audio.unlink()
        except OSError:
            pass


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
) -> List[Slide]:
    target_score = hero_horse.deviation_score if hero_horse and hero_horse.deviation_score is not None else None
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
        )
        return [Slide(intro, 2.5)]

    slides: List[Slide] = []
    frame_count = 7
    for frame in range(frame_count):
        ratio = frame / max(frame_count - 1, 1)
        eased = 1 - (1 - ratio) * (1 - ratio)
        score_value = target_score * eased
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
        )
        slides.append(Slide(path, 0.15 if frame < frame_count - 1 else 1.6))
    return slides


def _long_title(venue: VenueVideoData, target_date: str) -> str:
    grade_names = "・".join(race.display_name for race in venue.grade_races[:2])
    if grade_names:
        return f"【{grade_names}】{venue.venue_name} 全レースAI分析 {target_date}"
    return f"【{venue.venue_name}】全レースAI分析 {target_date}"


def _description(title: str, target_date: str, url: str, venue_name: Optional[str] = None) -> str:
    venue_line = f"{venue_name}の" if venue_name else ""
    return textwrap.dedent(
        f"""\
        {title}

        {venue_line}AI偏差値、位置取り、枠順傾向をレース順に整理しています。
        詳細な出走馬データはUMA-FREEで無料公開しています。

        ▼当日の全レース分析
        {url}

        ※本動画は過去データをもとにした確認材料です。結果を保証するものではありません。

        #競馬 #AI予想 #UMA_FREE
        """
    ).strip()


def render_long_video(venue: VenueVideoData, target_date: str, output_dir: Path, skip_video: bool = False) -> RenderedVideo:
    stable_id = f"venue_{_safe_filename(venue.venue_name)}"
    video_dir = output_dir / "long" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    size = (1920, 1080)
    utm_content = f"venue_long_{_safe_filename(venue.venue_name)}"
    title = _long_title(venue, target_date)
    slides: List[Slide] = []
    hero_race, hero_horse = _best_horse_for_venue(venue)
    grade_names = " / ".join(race.display_name for race in venue.grade_races[:2])
    thumb_title = grade_names or f"{venue.venue_name} 全{len(venue.races)}R"
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
            race_number=hero_race.race_number if hero_race else None,
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
    _draw_outro_slide(outro, target_date, size, utm_content)
    slides.append(Slide(outro, LONG_OUTRO_SECONDS))

    thumbnail = video_dir / "thumbnail.png"
    subtitle = "AI偏差値"
    hero_grade = hero_race.grade if hero_race and hero_race.grade else ""
    _draw_thumbnail(
        thumbnail,
        thumb_title,
        subtitle,
        target_date,
        size,
        hero_horse=hero_horse,
        venue_name=venue.venue_name,
        race_number=hero_race.race_number if hero_race else None,
        grade=hero_grade,
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_mp4(slides, video_path, *size)

    url = build_video_url(target_date, utm_content, venue.venue_name)
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "venue_long",
        "stable_id": stable_id,
        "title": title,
        "description": _description(title, target_date, url, venue.venue_name),
        "tags": ["競馬", "AI予想", "UMA-FREE", venue.venue_name, *(race.display_name for race in venue.grade_races[:2])],
        "target_date": target_date,
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "utm_content": utm_content,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo("venue_long", stable_id, title, metadata["description"], metadata["tags"], video_path, thumbnail, metadata_path, 0)


def _short_title(race: RaceVideoData, target_date: str) -> str:
    if race.grade:
        return f"【{race.display_name}】AI偏差値と位置取り {target_date} #shorts"
    return f"【{race.venue_name}{race.race_number}R】AI偏差値と位置取り {target_date} #shorts"


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
        )
    )

    race_slide = video_dir / "001_race.png"
    _draw_race_slide(race_slide, race, target_date, size, utm_content)
    slides.append(Slide(race_slide, SHORT_RACE_SLIDE_SECONDS))

    position_slide = video_dir / "002_position.png"
    _draw_short_position_slide(position_slide, race, target_date, size, utm_content)
    slides.append(Slide(position_slide, SHORT_POSITION_SLIDE_SECONDS))

    outro = video_dir / "999_outro.png"
    _draw_outro_slide(outro, target_date, size, utm_content)
    slides.append(Slide(outro, SHORT_OUTRO_SECONDS))

    thumbnail = video_dir / "thumbnail.png"
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
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_mp4(slides, video_path, *size)

    url = build_video_url(target_date, utm_content, race.venue_name, race.race_number)
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "short",
        "stable_id": stable_id,
        "title": title,
        "description": _description(title, target_date, url, race.venue_name),
        "tags": ["競馬", "AI予想", "UMA-FREE", "Shorts", race.venue_name, race.display_name],
        "target_date": target_date,
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "utm_content": utm_content,
        "publish_order": index,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo("short", stable_id, title, metadata["description"], metadata["tags"], video_path, thumbnail, metadata_path, 10 + index * 10)
