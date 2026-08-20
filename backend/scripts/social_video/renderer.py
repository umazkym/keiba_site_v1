from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import tempfile
import textwrap
from dataclasses import dataclass, replace
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from ..race_classification import prediction_exclusion_reason
from .data_loader import (
    HorseVideoData,
    RaceVideoData,
    VenueVideoData,
    build_race_path,
    build_video_url,
    pick_featured_race,
    top_by_deviation,
)
from .motion import AudioCue, MotionLayer, MotionScene, render_motion_scenes, resolve_motion_profile
from .video_package import VideoPackage, build_content_hash, build_rights_manifest_hash
from .visual_assets import (
    AudioAsset,
    CourseAsset,
    VideoAsset,
    VisualAsset,
    audio_asset_metadata,
    course_asset_metadata,
    resolve_audio_asset,
    resolve_course_asset,
    resolve_sfx_assets,
    resolve_video_asset,
    resolve_visual_asset,
    video_asset_metadata,
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
DATA_BLUE = (47, 111, 237)
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
LONG_INTRO_SECONDS = 2.2
LONG_RACE_SCENE_SECONDS = 6.0
LONG_OUTRO_SECONDS = 3.0
SHORT_SCENE_SECONDS = 15.5
SHORT_MAX_COMPILATION_SECONDS = 59.5
LONG_CONTENT_LEFT = 44
LONG_CONTENT_RIGHT = 1876
LONG_CONTENT_WIDTH = LONG_CONTENT_RIGHT - LONG_CONTENT_LEFT
LONG_DATA_PANEL_BOTTOM = 824
LONG_CTA_Y = 848
LONG_SITE_ACCESS_CTA = "その他の分析情報は概要欄のサイトから"
SHORT_SITE_ACCESS_CTA = "その他の分析情報はUMA-FREEで公開"
SHORT_CLEAN_INFORMATION_CTA = "4つの分析視点で全レースを毎日整理"
# 旧テスト・補助スクリプト向けの互換値。本線は1レース1シーンを使用する。
LONG_VENUE_SLIDE_SECONDS = LONG_INTRO_SECONDS
LONG_RACE_SLIDE_SECONDS = LONG_RACE_SCENE_SECONDS
LONG_POSITION_SLIDE_SECONDS = 0.0
SHORT_RACE_SLIDE_SECONDS = 5.0
SHORT_POSITION_SLIDE_SECONDS = 4.0
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


def _excluded_race_copy(venue: VenueVideoData) -> tuple[str, str]:
    """収録対象外レースの内容に合わせて、章見出し用の短い説明を返す。"""
    if any(race.omission_reason for race in venue.excluded_races):
        return "対象外・未掲載除く", "AI偏差値の算出対象外・データ未掲載レース"
    reasons = [
        prediction_exclusion_reason(race.race_name, race.course_type)
        for race in venue.excluded_races
    ]
    if reasons and all(reason.startswith("新馬戦") for reason in reasons):
        return "新馬戦除く", "AI偏差値の算出対象外となる新馬戦"
    return "算出対象外除く", "AI偏差値の算出対象外レース"


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
        excluded_scope, _ = _excluded_race_copy(venue)
        race_heading = f"AI偏差値対象レース（{excluded_scope}）" if venue.excluded_races else "本日のレース"
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


def _save_transparent_layer(image: Image.Image, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGBA").save(path, optimize=True)
    return path


def _compose_motion_preview(
    background_path: Path,
    layers: Sequence[tuple[Path, int, int]],
    destination: Path,
) -> Path:
    with Image.open(background_path) as source:
        preview = source.convert("RGBA")
    for layer_path, x, y in layers:
        with Image.open(layer_path) as source:
            layer = source.convert("RGBA")
        preview.alpha_composite(layer, (x, y))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(destination)
    return destination


def _broadcast_panel(
    size: tuple[int, int],
    fill: tuple[int, int, int, int] = (20, 29, 32, 244),
    border: tuple[int, int, int, int] = (69, 82, 83, 255),
    radius: int = 20,
) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1, 1, width - 2, height - 2), radius=radius, fill=fill, outline=border, width=2)
    return image


def _draw_broadcast_race_base(
    path: Path,
    race: RaceVideoData,
    size: tuple[int, int],
) -> Path:
    width, height = size
    image = Image.new("RGB", size, CHARCOAL)
    draw = ImageDraw.Draw(image)
    for x in range(0, width, 80):
        draw.line((x, 0, x, height), fill=(24, 33, 36), width=1)
    for y in range(0, height, 80):
        draw.line((0, y, width, y), fill=(24, 33, 36), width=1)
    draw.rectangle((0, 0, width, 18), fill=DEEP_GREEN)
    draw.rectangle((0, 18, width, 23), fill=EDITORIAL_GOLD)
    # 背景は「面」だけで左右の情報群を分ける。外枠を付けると、
    # ランキングカード・位置取りレーン・CTAの枠線と重なって階層が崩れる。
    draw.rounded_rectangle((LONG_CONTENT_LEFT, 170, 1114, LONG_DATA_PANEL_BOTTOM), radius=18, fill=(12, 20, 23))
    draw.rounded_rectangle((1136, 170, 1876, LONG_DATA_PANEL_BOTTOM), radius=18, fill=(12, 20, 23))
    draw.line((60, 1048, width - 60, 1048), fill=(68, 78, 80), width=3)

    course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
    if course_asset is not None:
        try:
            with Image.open(course_asset.path) as source:
                course = source.convert("RGBA")
            alpha = course.getchannel("A")
            bbox = alpha.getbbox()
            if bbox:
                course = course.crop(bbox)
                course.thumbnail((590, 560), Image.Resampling.LANCZOS)
                course_alpha = course.getchannel("A").point(lambda value: round(value * 0.16))
                tint = Image.new("RGBA", course.size, (*DEEP_GREEN, 0))
                tint.putalpha(course_alpha)
                image = image.convert("RGBA")
                image.alpha_composite(
                    tint,
                    (1506 - course.width // 2, 510 - course.height // 2),
                )
                image = image.convert("RGB")
        except OSError:
            pass
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return path


def _draw_broadcast_header_layer(
    path: Path,
    race: RaceVideoData,
    target_date: str,
    progress_index: int,
    progress_total: int,
) -> Path:
    image = Image.new("RGBA", (1832, 122), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text((0, 3), f"{race.race_number:02d}", font=_font("Inter-Black.ttf", 88), fill=EDITORIAL_GOLD)
    draw.text((112, 48), "R", font=_font("Inter-Bold.ttf", 30), fill=WHITE)
    draw.line((164, 12, 164, 108), fill=(82, 94, 95), width=2)
    _draw_fit_text_no_ellipsis(
        draw,
        race.display_name,
        (194, 4),
        FONT_BLACK,
        48,
        28,
        1040,
        WHITE,
        max_lines=1,
    )
    grade = f"  {race.grade}" if race.grade else ""
    draw.text(
        (196, 70),
        f"{race.venue_name}  {_display_short_date(target_date)}  {race.course_label}{grade}",
        font=_font(FONT_BOLD, 24),
        fill=(188, 198, 196),
    )
    draw.text((1828, 12), f"{progress_index:02d} / {progress_total:02d}", font=_font("Inter-Black.ttf", 40), fill=WHITE, anchor="ra")
    draw.text((1828, 67), "RACE PREVIEW", font=_font("Inter-Bold.ttf", 18), fill=EDITORIAL_GOLD, anchor="ra")
    return _save_transparent_layer(image, path)


def _draw_broadcast_rank_layer(
    path: Path,
    horse: HorseVideoData,
    rank: int,
    size: tuple[int, int],
    score_override: Optional[float] = None,
    show_score: bool = True,
    right_safe_padding: int = 0,
) -> Path:
    width, height = size
    top_rank = rank == 1
    image = _broadcast_panel(
        size,
        fill=(244, 241, 232, 252) if top_rank else (31, 41, 44, 252),
        border=(*EDITORIAL_GOLD, 255) if top_rank else (76, 91, 93, 255),
        radius=18,
    )
    draw = ImageDraw.Draw(image)
    foreground = INK_DARK if top_rank else WHITE
    muted = (82, 91, 91) if top_rank else (175, 185, 184)
    accent = EDITORIAL_GOLD if top_rank else DATA_BLUE if rank == 2 else DEEP_GREEN
    draw.rectangle((0, 0, 12 if top_rank else 8, height), fill=accent)
    draw.text((30, 20 if top_rank else 16), f"{rank}", font=_font("Inter-Black.ttf", 62 if top_rank else 48), fill=accent)
    draw.text((84, 46 if top_rank else 37), "位", font=_font(FONT_BLACK, 24 if top_rank else 21), fill=muted)
    badge_d = 76 if top_rank else 62
    _draw_horse_number_badge(draw, (166, height // 2), horse, badge_d, stroke_width=3)
    name_x = 222
    _draw_fit_text_no_ellipsis(
        draw,
        horse.horse_name,
        (name_x, 24 if top_rank else 18),
        FONT_BLACK,
        42 if top_rank else 34,
        22,
        width - name_x - 260 - right_safe_padding,
        foreground,
        max_lines=1,
    )
    position = horse.position_label if horse.position_label in {"先行", "中団", "後方"} else "不明"
    draw.text(
        (name_x, 88 if top_rank else 72),
        f"位置取り  {position}",
        font=_font(FONT_BOLD, 23 if top_rank else 20),
        fill=muted,
    )
    score_value = score_override if score_override is not None else horse.deviation_score
    if show_score:
        draw.text(
            (width - 28 - right_safe_padding, 8 if top_rank else 5),
            _score_text(score_value),
            font=_font("Inter-Black.ttf", 92 if top_rank else 72),
            fill=EDITORIAL_GOLD_DARK if top_rank else WHITE,
            anchor="ra",
        )
        draw.text(
            (width - 32 - right_safe_padding, 98 if top_rank else 78),
            "AI偏差値",
            font=_font(FONT_BOLD, 19),
            fill=muted,
            anchor="ra",
        )
    bar_y = height - 18
    bar_right = width - 30 - right_safe_padding
    draw.rounded_rectangle((name_x, bar_y - 6, bar_right, bar_y), radius=3, fill=(91, 102, 102))
    if horse.deviation_score is not None:
        ratio = max(0.05, min(1.0, (horse.deviation_score - 40.0) / 35.0))
        draw.rounded_rectangle(
            (name_x, bar_y - 6, name_x + round((bar_right - name_x) * ratio), bar_y),
            radius=3,
            fill=accent,
        )
    return _save_transparent_layer(image, path)


def _draw_broadcast_score_fragment(path: Path, score: Optional[float]) -> Path:
    image = Image.new("RGBA", (246, 150), (244, 241, 232, 255))
    draw = ImageDraw.Draw(image)
    draw.text(
        (220, 2),
        _score_text(score),
        font=_font("Inter-Black.ttf", 92),
        fill=EDITORIAL_GOLD_DARK,
        anchor="ra",
    )
    draw.text((216, 98), "AI偏差値", font=_font(FONT_BOLD, 19), fill=(82, 91, 91), anchor="ra")
    return _save_transparent_layer(image, path)


def _draw_broadcast_position_lane_layer(
    path: Path,
    label: str,
    horses: Sequence[HorseVideoData],
    ranked_numbers: dict[int, int],
) -> Path:
    width, height = 704, 144
    image = _broadcast_panel((width, height), fill=(24, 34, 36, 246), border=(61, 75, 77, 255), radius=14)
    draw = ImageDraw.Draw(image)
    label_fill = _lane_label_fill(label if label != "不明" else "")
    draw.rounded_rectangle((12, 12, 116, height - 12), radius=10, fill=label_fill)
    draw.text((64, 48), label, font=_font(FONT_BLACK, 25), fill=WHITE, anchor="mm")
    draw.text((64, 91), f"{len(horses)}頭", font=_font(FONT_BOLD, 17), fill=(225, 230, 225), anchor="mm")
    columns = 8
    token_d = 42
    token_zone_left = 146
    token_zone_right = width - 32
    step_x = 66
    row_count = max(1, math.ceil(len(horses) / columns))
    step_y = 44 if row_count >= 3 else 48
    first_row_y = height // 2 - ((row_count - 1) * step_y) // 2
    for index, horse in enumerate(horses):
        column = index % columns
        row = index // columns
        row_start_index = row * columns
        horses_in_row = min(columns, max(0, len(horses) - row_start_index))
        occupied_width = max(0, horses_in_row - 1) * step_x
        row_start_x = token_zone_left + max(
            0,
            (token_zone_right - token_zone_left - occupied_width) // 2,
        )
        center = (row_start_x + column * step_x, first_row_y + row * step_y)
        rank = ranked_numbers.get(horse.horse_number)
        if rank is not None:
            draw.ellipse(
                (
                    center[0] - token_d // 2 - 4,
                    center[1] - token_d // 2 - 4,
                    center[0] + token_d // 2 + 4,
                    center[1] + token_d // 2 + 4,
                ),
                outline=EDITORIAL_GOLD,
                width=4,
            )
            draw.text(
                (center[0] + 24, center[1] - 24),
                str(rank),
                font=_font("Inter-Black.ttf", 14),
                fill=EDITORIAL_GOLD,
                anchor="mm",
            )
        _draw_horse_number_badge(draw, center, horse, token_d, stroke_width=1)
    return _save_transparent_layer(image, path)


ANALYSIS_FEATURES = (
    ("AI偏差値", "全頭の能力比較", "score", DATA_BLUE),
    ("対戦成績", "過去の直接対決", "matchup", (99, 102, 241)),
    ("展開・脚質", "全馬の位置取り", "pace", (18, 148, 105)),
    ("枠順傾向", "コース別データ", "frame", EDITORIAL_GOLD),
)


def _draw_analysis_feature_visual(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    visual_type: str,
    accent: tuple[int, int, int],
) -> None:
    left, top, right, bottom = box
    width = right - left
    height = bottom - top
    if visual_type == "score":
        ratios = (0.88, 0.64, 0.74)
        for index, ratio in enumerate(ratios):
            y = top + 3 + index * max(6, height // 3)
            draw.rounded_rectangle(
                (left, y, right, y + 4),
                radius=2,
                fill=(68, 79, 81),
            )
            draw.rounded_rectangle(
                (left, y, left + round(width * ratio), y + 4),
                radius=2,
                fill=accent if index == 0 else (126, 139, 140),
            )
        return
    if visual_type == "matchup":
        values = (("+2", (25, 112, 84)), ("0", (65, 76, 79)), ("-1", (137, 58, 67)))
        chip_width = max(22, (width - 8) // 3)
        for index, (value, fill) in enumerate(values):
            x = left + index * (chip_width + 4)
            draw.rounded_rectangle((x, top, x + chip_width, bottom), radius=5, fill=fill)
            draw.text(
                (x + chip_width // 2, top + height // 2),
                value,
                font=_font("Inter-Bold.ttf", max(12, min(18, height - 5))),
                fill=WHITE,
                anchor="mm",
            )
        return

    ratios = (0.56, 0.84, 0.42, 0.68) if visual_type == "pace" else (0.86, 0.45, 0.70, 0.38)
    bar_gap = 5
    bar_width = max(5, (width - bar_gap * 3) // 4)
    for index, ratio in enumerate(ratios):
        x = left + index * (bar_width + bar_gap)
        bar_height = max(5, round(height * ratio))
        draw.rounded_rectangle(
            (x, bottom - bar_height, x + bar_width, bottom),
            radius=3,
            fill=accent if index == 0 else (94, 111, 111),
        )


def _draw_analysis_feature_strip(
    path: Path,
    size: tuple[int, int],
    *,
    stacked: bool = False,
    outlined: bool = True,
    right_safe_padding: int = 0,
) -> Path:
    width, height = size
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    columns = 2 if stacked else 4
    rows = 2 if stacked else 1
    gap = 8
    cell_width = (width - gap * (columns - 1)) // columns
    cell_height = (height - gap * (rows - 1)) // rows

    for index, (label, description, visual_type, accent) in enumerate(ANALYSIS_FEATURES):
        column = index % columns
        row = index // columns
        left = column * (cell_width + gap)
        top = row * (cell_height + gap)
        right = left + cell_width
        bottom = top + cell_height
        cell_options: dict[str, object] = {
            "radius": 10,
            "fill": (19, 29, 31, 252),
        }
        if outlined:
            cell_options.update({"outline": (61, 76, 77, 255), "width": 2})
        draw.rounded_rectangle((left, top, right, bottom), **cell_options)
        draw.rectangle((left, top, left + 6, bottom), fill=accent)
        if stacked:
            draw.text((left + 20, top + 15), label, font=_font(FONT_BLACK, 27), fill=WHITE)
            draw.text(
                (left + 20, top + 52),
                description,
                font=_font(FONT_BOLD, 17),
                fill=(183, 195, 191),
            )
            content_right = right - (right_safe_padding if column == columns - 1 else 0)
            visual_box = (content_right - 118, top + 23, content_right - 18, bottom - 22)
        else:
            draw.text((left + 18, top + 11), label, font=_font(FONT_BLACK, 23), fill=WHITE)
            draw.text(
                (left + 18, top + 43),
                description,
                font=_font(FONT_BOLD, 15),
                fill=(183, 195, 191),
            )
            visual_box = (right - 112, top + 22, right - 18, bottom - 18)
        _draw_analysis_feature_visual(draw, visual_box, visual_type, accent)
    return _save_transparent_layer(image, path)


def _draw_broadcast_cta_layer(path: Path, compact: bool = False) -> Path:
    size = (864, 210) if compact else (LONG_CONTENT_WIDTH, 186)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # CTAは全周を囲まず、左のゴールド線だけで重要度を示す。
    # 周囲のカード枠との二重線・三重線を防ぎ、視線を文言へ戻す。
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=14, fill=(8, 16, 18, 246))
    draw.rectangle((0, 0, 8, size[1]), fill=EDITORIAL_GOLD)
    if compact:
        draw.text(
            (34, 66),
            SHORT_SITE_ACCESS_CTA,
            font=_fit_font_for_width(
                draw,
                SHORT_SITE_ACCESS_CTA,
                FONT_BLACK,
                42,
                28,
                size[0] - 68,
            ),
            fill=EDITORIAL_GOLD,
        )
        draw.text((size[0] - 26, 170), "UMA-FREE", font=_font("Inter-Black.ttf", 23), fill=WHITE, anchor="ra")
    else:
        draw.text((30, 9), LONG_SITE_ACCESS_CTA, font=_font(FONT_BLACK, 35), fill=EDITORIAL_GOLD)
        feature_path = _draw_analysis_feature_strip(
            path.with_name(f"{path.stem}_features.png"),
            (size[0] - 52, 104),
            outlined=False,
        )
        with Image.open(feature_path) as feature_source:
            image.alpha_composite(feature_source.convert("RGBA"), (26, 68))
    return _save_transparent_layer(image, path)


def _draw_motion_wipe_layer(path: Path, height: int) -> Path:
    width = 220
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for x in range(width):
        alpha = round(125 * (x / max(1, width - 1)))
        ImageDraw.Draw(image).line((x, 0, x, height), fill=(8, 16, 18, alpha), width=1)
    draw = ImageDraw.Draw(image)
    draw.rectangle((width - 22, 0, width - 1, height), fill=(*EDITORIAL_GOLD, 245))
    draw.rectangle((width - 30, 0, width - 24, height), fill=(255, 248, 215, 210))
    return _save_transparent_layer(image, path)


def _draw_progress_tick_layer(path: Path) -> Path:
    image = Image.new("RGBA", (92, 7), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, 91, 6), radius=3, fill=EDITORIAL_GOLD)
    return _save_transparent_layer(image, path)


def _build_long_race_motion_scene(
    video_dir: Path,
    race: RaceVideoData,
    target_date: str,
    progress_index: int,
    progress_total: int,
) -> MotionScene:
    scene_prefix = video_dir / f"{progress_index + 1:03d}_{race.race_number:02d}r"
    background = _draw_broadcast_race_base(scene_prefix.with_name(f"{scene_prefix.name}_base.png"), race, (1920, 1080))
    header = _draw_broadcast_header_layer(
        scene_prefix.with_name(f"{scene_prefix.name}_header.png"),
        race,
        target_date,
        progress_index,
        progress_total,
    )
    top_horses = top_by_deviation(race, 3)
    rank_specs = [
        (44, 188, 1070, 220),
        (44, 428, 1070, 188),
        (44, 636, 1070, 188),
    ]
    rank_layers: list[tuple[Path, int, int]] = []
    score_layers: list[tuple[Path, int, int, float, float]] = []
    for rank, horse in enumerate(top_horses, start=1):
        x, y, card_w, card_h = rank_specs[rank - 1]
        layer_path = _draw_broadcast_rank_layer(
            scene_prefix.with_name(f"{scene_prefix.name}_rank_{rank}.png"),
            horse,
            rank,
            (card_w, card_h),
            show_score=rank != 1,
        )
        rank_layers.append((layer_path, x, y))
        if rank == 1:
            target_score = horse.deviation_score
            frame_count = 7
            for frame in range(frame_count):
                ratio = frame / max(1, frame_count - 1)
                eased = 1 - (1 - ratio) * (1 - ratio)
                if target_score is None:
                    score = None
                else:
                    start_score = min(50.0, target_score)
                    score = start_score + (target_score - start_score) * eased
                start = 0.70 + frame * (0.80 / frame_count)
                end = (
                    LONG_RACE_SCENE_SECONDS
                    if frame == frame_count - 1
                    else 0.70 + (frame + 1) * (0.80 / frame_count) + 0.02
                )
                score_path = _draw_broadcast_score_fragment(
                    scene_prefix.with_name(f"{scene_prefix.name}_score_{frame:02d}.png"),
                    score,
                )
                score_layers.append((score_path, x + card_w - 254, y + 8, start, end))

    groups = _position_groups(race)
    ranked_numbers = {horse.horse_number: rank for rank, horse in enumerate(top_horses, start=1)}
    position_layers: list[tuple[Path, int, int]] = []
    lane_specs = [
        ("先行", groups["先行"]),
        ("中団", groups["中団"]),
        ("後方", groups["後方"]),
        ("不明", groups["-"]),
    ]
    for lane_index, (label, horses) in enumerate(lane_specs):
        lane_path = _draw_broadcast_position_lane_layer(
            scene_prefix.with_name(f"{scene_prefix.name}_lane_{lane_index}.png"),
            label,
            horses,
            ranked_numbers,
        )
        position_layers.append((lane_path, 1154, 188 + lane_index * 158))

    cta = _draw_broadcast_cta_layer(scene_prefix.with_name(f"{scene_prefix.name}_cta.png"))
    wipe = _draw_motion_wipe_layer(scene_prefix.with_name(f"{scene_prefix.name}_wipe.png"), 1080)
    progress = _draw_progress_tick_layer(scene_prefix.with_name(f"{scene_prefix.name}_progress.png"))
    preview = scene_prefix.with_name(f"{scene_prefix.name}_race.png")
    _compose_motion_preview(
        background,
        [
            (header, 44, 36),
            *rank_layers,
            *[(layer_path, x, y) for layer_path, x, y, _, _ in score_layers[-1:]],
            *position_layers,
            (cta, LONG_CONTENT_LEFT, LONG_CTA_Y),
            (progress, 910, 1045),
        ],
        preview,
    )

    layers: list[MotionLayer] = [
        MotionLayer(
            wipe,
            x=1920,
            y=0,
            start_seconds=0.0,
            end_seconds=0.32,
            enter_duration=0.30,
            start_x=-220,
            end_x=1920,
            easing="ease_out",
            z_index=100,
        ),
        MotionLayer(
            header,
            x=44,
            y=36,
            start_seconds=0.15,
            end_seconds=LONG_RACE_SCENE_SECONDS,
            enter_duration=0.32,
            start_x=-36,
            end_x=44,
            z_index=10,
        ),
    ]
    for rank, (layer_path, x, y) in enumerate(rank_layers, start=1):
        start = 0.45 + (rank - 1) * 0.12
        layers.append(
            MotionLayer(
                layer_path,
                x=x,
                y=y,
                start_seconds=start,
                end_seconds=LONG_RACE_SCENE_SECONDS,
                enter_duration=0.30,
                start_x=x - 84,
                end_x=x,
                z_index=20 + rank,
            )
        )
    for frame, (layer_path, x, y, start, end) in enumerate(score_layers):
        layers.append(
            MotionLayer(
                layer_path,
                x=x,
                y=y,
                start_seconds=start,
                end_seconds=end,
                enter_duration=0.0,
                exit_duration=0.0,
                z_index=28 + frame,
            )
        )
    for lane_index, (layer_path, x, y) in enumerate(position_layers):
        start = 1.20 + lane_index * 0.20
        layers.append(
            MotionLayer(
                layer_path,
                x=x,
                y=y,
                start_seconds=start,
                end_seconds=LONG_RACE_SCENE_SECONDS,
                enter_duration=0.30,
                start_x=x + 70,
                end_x=x,
                z_index=30 + lane_index,
            )
        )
    layers.extend(
        [
            MotionLayer(
                cta,
                x=LONG_CONTENT_LEFT,
                y=LONG_CTA_Y,
                start_seconds=0.32,
                end_seconds=LONG_RACE_SCENE_SECONDS,
                enter_duration=0.28,
                start_y=LONG_CTA_Y + 36,
                end_y=LONG_CTA_Y,
                z_index=50,
            ),
            MotionLayer(
                progress,
                x=1784,
                y=1045,
                start_seconds=0.30,
                end_seconds=5.86,
                enter_duration=5.56,
                start_x=60,
                end_x=1768,
                easing="linear",
                z_index=60,
            ),
        ]
    )
    return MotionScene(
        background_path=background,
        duration_seconds=LONG_RACE_SCENE_SECONDS,
        preview_path=preview,
        layers=layers,
        scene_id=f"race-{race.race_number}",
    )


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
        draw.text((margin, 176), "全頭データをサイトで確認", font=_font(FONT_BLACK, 69), fill=WHITE, stroke_width=2, stroke_fill=TEXT_OUTLINE)
        draw.text(
            (margin, 278),
            "動画では上位3頭と位置取りを要約。詳しい比較データはUMA-FREEへ。",
            font=_font(FONT_BOLD, 28),
            fill=(223, 229, 225),
        )
        chip_y = 378
        chip_gap = 18
        chip_width = 390
        for index, (label, sublabel) in enumerate(
            (
                ("全頭AI偏差値", "全出走馬を一覧"),
                ("対戦成績", "過去の直接対決"),
                ("枠順傾向", "コース別に確認"),
            )
        ):
            x = margin + index * (chip_width + chip_gap)
            draw.rounded_rectangle(
                (x, chip_y, x + chip_width, chip_y + 154),
                radius=14,
                fill=(12, 22, 24),
                outline=(79, 93, 93),
                width=2,
            )
            draw.rectangle((x, chip_y, x + 7, chip_y + 154), fill=DEEP_GREEN if index != 1 else DATA_BLUE)
            draw.text((x + 28, chip_y + 26), label, font=_font(FONT_BLACK, 31), fill=WHITE)
            draw.text((x + 28, chip_y + 88), sublabel, font=_font(FONT_REGULAR, 22), fill=(192, 202, 198))
        draw.rectangle((margin, 592, 1535, 870), fill=(7, 15, 17), outline=(87, 101, 101), width=2)
        draw.rectangle((margin, 592, margin + 10, 870), fill=EDITORIAL_GOLD)
        draw.text((margin + 44, 626), "その他の分析情報は", font=_font(FONT_BOLD, 37), fill=(216, 223, 219))
        draw.text((margin + 44, 692), "概要欄のサイトから", font=_font(FONT_BLACK, 70), fill=EDITORIAL_GOLD)
        draw.text((margin + 46, 798), "登録不要 / 毎日無料公開", font=_font(FONT_BOLD, 27), fill=WHITE)
        draw.text((1496, 801), "uma-free.com", font=_font("Inter-Black.ttf", 31), fill=WHITE, anchor="ra")
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
        site_cta = SHORT_SITE_ACCESS_CTA
        draw.text((margin + 38, cta_y + 34), site_cta, font=_fit_font_for_width(draw, site_cta, FONT_BOLD, 36, 25, 760), fill=WHITE)
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
        _draw_brand_lockup(image, draw, margin, 42, compact=False, light=True, logo_size=64)
        draw.rectangle((margin, 132, 1240, 138), fill=EDITORIAL_GOLD)
        chip_text = "  /  ".join(part for part in (date_text, venue_name, grade) if part)
        draw.text((margin, 166), chip_text, font=_font(FONT_BOLD, 32), fill=(236, 235, 229))
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 244),
            FONT_BLACK,
            166,
            78,
            1190,
            WHITE,
            max_lines=2,
            line_gap=0,
            stroke_width=4,
            stroke_fill=TEXT_OUTLINE,
        )
        subtitle_text = subtitle or "全レース AI偏差値・位置取り"
        draw.rectangle((margin, 724, 1030, 792), fill=(8, 16, 18))
        draw.rectangle((margin, 724, margin + 9, 792), fill=EDITORIAL_GOLD)
        draw.text((margin + 30, 738), subtitle_text, font=_font(FONT_BLACK, 31), fill=WHITE)
        score_box = (margin, 828, 790, 1000)
        draw.rounded_rectangle(score_box, radius=16, fill=(8, 16, 18), outline=(102, 111, 108), width=2)
        if hero_horse:
            _draw_horse_number_badge(draw, (margin + 64, 914), hero_horse, 72, stroke_width=3)
            _draw_fit_text_no_ellipsis(
                draw,
                hero_horse.horse_name,
                (margin + 120, 856),
                FONT_BLACK,
                36,
                23,
                410,
                WHITE,
                max_lines=1,
            )
            draw.text((margin + 120, 924), "AI偏差値", font=_font(FONT_BOLD, 22), fill=(202, 210, 206))
            draw.text((score_box[2] - 28, 842), _score_text(hero_horse.deviation_score), font=_font("Inter-Black.ttf", 94), fill=EDITORIAL_GOLD, anchor="ra")
        draw.text((width - margin, height - 52), "UMA-FREE", font=_font("Inter-Black.ttf", 28), fill=WHITE, anchor="ra")
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
    audio_cues: Sequence[AudioCue] = (),
) -> None:
    fade_in = min(0.6, max(0.1, duration_seconds * 0.1))
    fade_out = min(0.8, max(0.1, duration_seconds * 0.15))
    fade_out_start = max(fade_in, duration_seconds - fade_out)
    filter_parts = [
        "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11,"
        "aresample=48000,"
        f"volume={audio_asset.volume:.4f},"
        f"afade=t=in:st=0:d={fade_in:.3f},"
        f"afade=t=out:st={fade_out_start:.3f}:d={fade_out:.3f},"
        f"atrim=0:{duration_seconds:.3f},asetpts=N/SR/TB[bgm]"
    ]
    cue_labels: list[str] = []
    cue_inputs: list[str] = []
    for index, cue in enumerate(audio_cues, start=2):
        cue_inputs.extend(["-i", str(cue.asset_path)])
        label = f"cue{index}"
        delay_ms = max(0, round(cue.start_seconds * 1000))
        filter_parts.append(
            f"[{index}:a]aresample=48000,volume={max(0.0, min(1.0, cue.volume)):.4f},"
            f"atrim=0:{max(0.05, cue.max_duration):.3f},"
            f"afade=t=out:st={max(0.02, cue.max_duration - 0.10):.3f}:d=0.10,"
            f"adelay={delay_ms}:all=1[{label}]"
        )
        cue_labels.append(f"[{label}]")
    if cue_labels:
        filter_parts.append(
            f"[bgm]{''.join(cue_labels)}amix=inputs={1 + len(cue_labels)}:"
            f"duration=first:normalize=0,alimiter=limit=0.891,"
            f"atrim=0:{duration_seconds:.3f}[mix]"
        )
        audio_map = "[mix]"
    else:
        audio_map = "[bgm]"
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(audio_asset.path),
        *cue_inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        "0:v",
        "-map",
        audio_map,
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


def render_motion_video(
    scenes: Sequence[MotionScene],
    output_path: Path,
    width: int,
    height: int,
    audio_asset: Optional[AudioAsset] = None,
) -> None:
    """Broadcast Editorialのレイヤーシーンを動画化し、既存BGMを付与する。"""

    ffmpeg = os.getenv("FFMPEG_BINARY") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpegが見つかりません。ローカル検証では --skip-video を使うか、ffmpegをインストールしてください。"
        )
    video_without_audio = output_path.with_suffix(".video.mp4") if audio_asset else output_path
    duration_seconds = render_motion_scenes(
        scenes,
        video_without_audio,
        width,
        height,
        VIDEO_FPS,
    )
    if audio_asset:
        timeline_cues: list[AudioCue] = []
        scene_offset = 0.0
        for scene in scenes:
            for cue in scene.audio_cues:
                timeline_cues.append(
                    AudioCue(
                        asset_path=cue.asset_path,
                        start_seconds=scene_offset + cue.start_seconds,
                        volume=cue.volume,
                        max_duration=cue.max_duration,
                        cue_type=cue.cue_type,
                    )
                )
            scene_offset += scene.duration_seconds
        _add_bgm(
            ffmpeg,
            video_without_audio,
            output_path,
            audio_asset,
            duration_seconds,
            audio_cues=timeline_cues,
        )
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


def _draw_broadcast_intro_overlay(
    path: Path,
    target_date: str,
    headline: str,
    race_label: str,
    scope_label: str,
    size: tuple[int, int],
) -> Path:
    width, height = size
    compact = height > width
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    margin = 60 if compact else 68
    _draw_brand_lockup(image, draw, margin, 76 if compact else 42, compact=compact, light=True)
    draw.text(
        (width - (180 if compact else margin), 84 if compact else 52),
        _display_short_date(target_date),
        font=_font(FONT_BOLD, 27),
        fill=WHITE,
        anchor="ra",
    )
    if compact:
        draw.text((margin, 260), race_label, font=_font(FONT_BOLD, 31), fill=(229, 232, 227))
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 328),
            FONT_BLACK,
            84,
            50,
            820,
            WHITE,
            max_lines=2,
            line_gap=3,
            stroke_width=3,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.rectangle((margin, 560, 900, 626), fill=(9, 17, 19, 226))
        draw.text((margin + 26, 575), scope_label, font=_font(FONT_BLACK, 30), fill=EDITORIAL_GOLD)
    else:
        draw.text((margin, 148), race_label, font=_font(FONT_BOLD, 30), fill=(229, 232, 227))
        _draw_fit_text_no_ellipsis(
            draw,
            headline,
            (margin, 214),
            FONT_BLACK,
            138,
            70,
            1030,
            WHITE,
            max_lines=2,
            line_gap=0,
            stroke_width=3,
            stroke_fill=TEXT_OUTLINE,
        )
        draw.rectangle((margin, 570, 978, 642), fill=(9, 17, 19, 226))
        draw.text((margin + 28, 584), scope_label, font=_font(FONT_BLACK, 34), fill=EDITORIAL_GOLD)
    return _save_transparent_layer(image, path)


def _draw_intro_score_layer(
    path: Path,
    horse: Optional[HorseVideoData],
    score: Optional[float],
    compact: bool,
) -> Path:
    size = (840, 214) if compact else (910, 216)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _draw_photo_score_module(
        draw,
        (0, 0, size[0], size[1]),
        horse,
        compact=compact,
        score_override=score,
        show_score=True,
    )
    return _save_transparent_layer(image, path)


def _build_intro_motion_scene(
    video_dir: Path,
    target_date: str,
    headline: str,
    size: tuple[int, int],
    hero_horse: Optional[HorseVideoData],
    race_label: str,
    scope_label: str,
    venue_name: str,
    race_number: Optional[int],
    visual_asset: Optional[VisualAsset],
    video_asset: Optional[VideoAsset],
    duration_seconds: float,
    scene_prefix: str = "000_intro",
) -> MotionScene:
    compact = size[1] > size[0]
    background_image, _ = _hero_background(
        size,
        target_date,
        venue_name,
        race_number,
        visual_asset,
    )
    background_image = _apply_photo_scrim(background_image, compact)
    background = video_dir / f"{scene_prefix}_base.png"
    _save_slide(background_image, background, size)
    overlay = _draw_broadcast_intro_overlay(
        video_dir / f"{scene_prefix}_title.png",
        target_date,
        headline,
        race_label,
        scope_label,
        size,
    )
    rail = Image.new("RGBA", (820 if compact else 1050, 7), (*EDITORIAL_GOLD, 255))
    rail_path = _save_transparent_layer(rail, video_dir / f"{scene_prefix}_rail.png")
    score_y = 680 if compact else 700
    score_x = 60 if compact else 68
    score_layers: list[tuple[Path, float, float]] = []
    target_score = hero_horse.deviation_score if hero_horse else None
    if target_score is None:
        score_path = _draw_intro_score_layer(
            video_dir / f"{scene_prefix}_score_00.png",
            hero_horse,
            None,
            compact,
        )
        score_layers.append((score_path, 0.70, duration_seconds))
    else:
        frame_count = 7
        for frame in range(frame_count):
            ratio = frame / max(1, frame_count - 1)
            eased = 1 - (1 - ratio) * (1 - ratio)
            start_score = min(50.0, target_score)
            score = start_score + (target_score - start_score) * eased
            start = 0.70 + frame * (0.74 / frame_count)
            end = duration_seconds if frame == frame_count - 1 else 0.70 + (frame + 1) * (0.74 / frame_count) + 0.02
            score_path = _draw_intro_score_layer(
                video_dir / f"{scene_prefix}_score_{frame:02d}.png",
                hero_horse,
                score,
                compact,
            )
            score_layers.append((score_path, start, end))
    wipe = _draw_motion_wipe_layer(video_dir / f"{scene_prefix}_wipe.png", size[1])
    preview = video_dir / f"{scene_prefix}.png"
    _compose_motion_preview(
        background,
        [
            (rail_path, 60 if compact else 68, 184 if compact else 118),
            (overlay, 0, 0),
            (score_layers[-1][0], score_x, score_y),
        ],
        preview,
    )
    layers: list[MotionLayer] = []
    render_background = background
    if video_asset is not None:
        render_background = video_asset.path
        scrim = Image.new("RGBA", size, (7, 14, 16, 154 if compact else 132))
        scrim_path = _save_transparent_layer(scrim, video_dir / f"{scene_prefix}_video_scrim.png")
        layers.append(
            MotionLayer(
                scrim_path,
                0,
                0,
                0.0,
                duration_seconds,
                enter_duration=0.0,
                z_index=1,
            )
        )
    layers.extend([
        MotionLayer(
            rail_path,
            x=60 if compact else 68,
            y=184 if compact else 118,
            start_seconds=0.02,
            end_seconds=duration_seconds,
            enter_duration=0.42,
            start_x=-(820 if compact else 1050),
            end_x=60 if compact else 68,
            z_index=10,
        ),
        MotionLayer(
            overlay,
            x=0,
            y=0,
            start_seconds=0.06,
            end_seconds=duration_seconds,
            enter_duration=0.34,
            start_x=-76,
            end_x=0,
            z_index=20,
        ),
    ])
    for frame, (score_path, start, end) in enumerate(score_layers):
        layers.append(
            MotionLayer(
                score_path,
                x=score_x,
                y=score_y,
                start_seconds=start,
                end_seconds=end,
                enter_duration=0.0,
                z_index=30 + frame,
            )
        )
    if not compact:
        layers.append(
            MotionLayer(
                wipe,
                x=size[0],
                y=0,
                start_seconds=duration_seconds - 0.30,
                end_seconds=duration_seconds,
                enter_duration=0.30,
                start_x=-220,
                end_x=size[0],
                z_index=100,
            )
        )
    return MotionScene(
        background_path=render_background,
        duration_seconds=duration_seconds,
        preview_path=preview,
        layers=layers,
        scene_id=scene_prefix,
    )


def _build_outro_motion_scene(
    video_dir: Path,
    target_date: str,
    size: tuple[int, int],
    utm_content: str,
    venue_name: str,
    race_number: Optional[int],
    visual_asset: Optional[VisualAsset],
    duration_seconds: float,
    prefix: str = "999_outro",
) -> MotionScene:
    final_path = video_dir / f"{prefix}.png"
    _draw_outro_slide(
        final_path,
        target_date,
        size,
        utm_content,
        venue_name=venue_name,
        race_number=race_number,
        visual_asset=visual_asset,
    )
    highlight = Image.new("RGBA", (620 if size[0] > size[1] else 690, 7), (*EDITORIAL_GOLD, 255))
    highlight_path = _save_transparent_layer(highlight, video_dir / f"{prefix}_highlight.png")
    compact = size[1] > size[0]
    return MotionScene(
        background_path=final_path,
        duration_seconds=duration_seconds,
        preview_path=final_path,
        layers=[
            MotionLayer(
                highlight_path,
                x=68 if not compact else 60,
                y=936 if not compact else 1438,
                start_seconds=0.18,
                end_seconds=duration_seconds,
                enter_duration=0.46,
                start_x=-700,
                end_x=68 if not compact else 60,
                z_index=10,
            )
        ],
        scene_id=prefix,
    )


SHORT_COLUMN_X = 108
SHORT_COLUMN_WIDTH = 864
SHORT_COLUMN_RIGHT = SHORT_COLUMN_X + SHORT_COLUMN_WIDTH
SHORT_CRITICAL_RIGHT = 936
SHORT_ANALYSIS_FOOTER_Y = 1318
SHORT_PHASE_TIMINGS = (
    ("000_cover.png", 0.0, 1.20),
    ("001_ranking.png", 1.20, 5.00),
    ("002_position.png", 5.00, 9.00),
    ("003_hero.png", 9.00, 12.00),
    ("999_outro.png", 12.00, SHORT_SCENE_SECONDS),
)
SHORT_TRANSITION_TIMES = tuple(timing[1] for timing in SHORT_PHASE_TIMINGS[1:])
SHORT_COMBINED_RACE_SECONDS = 12.0
SHORT_COMBINED_PHASE_TIMINGS = (
    ("000_cover.png", 0.0, 1.20),
    ("001_ranking.png", 1.20, 5.00),
    ("002_position.png", 5.00, 9.00),
    ("003_hero.png", 9.00, SHORT_COMBINED_RACE_SECONDS),
)


def _scaled_short_phase_timings(
    duration_seconds: float,
) -> tuple[tuple[str, float, float], ...]:
    if duration_seconds <= 0:
        raise ValueError("Shortsのレース表示時間は0秒より長くしてください")
    scale = duration_seconds / SHORT_COMBINED_RACE_SECONDS
    return tuple(
        (name, start * scale, end * scale)
        for name, start, end in SHORT_COMBINED_PHASE_TIMINGS
    )


def _daily_short_intermediate_duration(race_count: int) -> float:
    if race_count <= 1:
        return 0.0
    available = SHORT_MAX_COMPILATION_SECONDS - SHORT_SCENE_SECONDS
    return min(SHORT_COMBINED_RACE_SECONDS, available / (race_count - 1))


def _validate_short_content_layers(
    layers: Sequence[MotionLayer],
    size: tuple[int, int],
    phase_timings: Sequence[tuple[str, float, float]] = SHORT_PHASE_TIMINGS,
) -> None:
    """Shortsの主要コンテンツが重ならず、全フレームで画面内に収まることを検証する。"""

    phase_names = {timing[0] for timing in phase_timings}
    phase_layers = sorted(
        (layer for layer in layers if layer.image_path.name in phase_names),
        key=lambda layer: layer.start_seconds,
    )
    if len(phase_layers) != len(phase_timings):
        raise ValueError("Shortsの表示フェーズが不足しています")
    for previous, current in zip(phase_layers, phase_layers[1:]):
        if current.start_seconds < previous.end_seconds:
            raise ValueError(
                "Shortsの前後フェーズが時間上で重複しています: "
                f"{previous.image_path.name} / {current.image_path.name}"
            )

    content_names = phase_names | {"000_short_analysis_footer.png"}
    canvas_width, canvas_height = size
    for layer in layers:
        if layer.image_path.name not in content_names:
            continue
        with Image.open(layer.image_path) as source:
            alpha = source.convert("RGBA").getchannel("A")
            bounds = alpha.getbbox()
        if bounds is None:
            continue
        positions = {
            (
                layer.x if x is None else x,
                layer.y if y is None else y,
            )
            for x, y in (
                (None, None),
                (layer.start_x, layer.start_y),
                (layer.end_x, layer.end_y),
            )
        }
        for x, y in positions:
            left = x + bounds[0]
            top = y + bounds[1]
            right = x + bounds[2]
            bottom = y + bounds[3]
            if left < 0 or top < 0 or right > canvas_width or bottom > canvas_height:
                raise ValueError(
                    "Shortsの主要コンテンツが画面外へ出ています: "
                    f"{layer.image_path.name} bounds=({left},{top},{right},{bottom})"
                )


def _short_phase_header(
    draw: ImageDraw.ImageDraw,
    race: RaceVideoData,
    target_date: str,
    label: str,
) -> None:
    draw.text(
        (SHORT_COLUMN_X, 294),
        f"{race.venue_name}{race.race_number}R",
        font=_font(FONT_BOLD, 30),
        fill=EDITORIAL_GOLD,
    )
    draw.text(
        (SHORT_CRITICAL_RIGHT, 296),
        _display_short_date(target_date),
        font=_font(FONT_BOLD, 24),
        fill=(213, 221, 217),
        anchor="ra",
    )
    _draw_fit_text_no_ellipsis(
        draw,
        race.display_name,
        (SHORT_COLUMN_X, 350),
        FONT_BLACK,
        58,
        38,
        SHORT_CRITICAL_RIGHT - SHORT_COLUMN_X,
        WHITE,
        max_lines=2,
        line_gap=1,
    )
    draw.text((SHORT_COLUMN_X, 478), label, font=_font(FONT_BLACK, 30), fill=DATA_BLUE)


def _draw_short_analysis_footer(path: Path, *, branded: bool = True) -> Path:
    image = Image.new("RGBA", (SHORT_COLUMN_WIDTH, 250), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text(
        (0, 0),
        SHORT_SITE_ACCESS_CTA if branded else SHORT_CLEAN_INFORMATION_CTA,
        font=_font(FONT_BLACK, 25),
        fill=WHITE,
    )
    feature_path = _draw_analysis_feature_strip(
        path.with_name(f"{path.stem}_features.png"),
        (SHORT_COLUMN_WIDTH, 208),
        stacked=True,
        right_safe_padding=18,
    )
    with Image.open(feature_path) as feature_source:
        image.alpha_composite(feature_source.convert("RGBA"), (0, 42))
    return _save_transparent_layer(image, path)


def _draw_short_cover_phase(
    path: Path,
    race: RaceVideoData,
    target_date: str,
    hero_horse: Optional[HorseVideoData],
    *,
    branded: bool = True,
) -> Path:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # 背景面は画面中央へ配置し、重要文字だけ右側の操作UIを避ける。
    draw.rounded_rectangle((72, 270, 1008, 1290), radius=22, fill=(7, 14, 16, 218))
    _short_phase_header(draw, race, target_date, "AI偏差値 TOP3")
    draw.line((SHORT_COLUMN_X, 538, SHORT_COLUMN_RIGHT, 538), fill=EDITORIAL_GOLD, width=5)
    if hero_horse is not None:
        score_layer = _draw_broadcast_rank_layer(
            path.with_name(f"{path.stem}_hero_card.png"),
            hero_horse,
            1,
            (SHORT_COLUMN_WIDTH, 278),
            right_safe_padding=12,
        )
        with Image.open(score_layer) as source:
            image.alpha_composite(source.convert("RGBA"), (SHORT_COLUMN_X, 590))
    draw = ImageDraw.Draw(image)
    draw.text(
        (SHORT_COLUMN_X, 950),
        "上位3頭と全馬の位置取りを15秒で確認",
        font=_font(FONT_BOLD, 27),
        fill=(218, 225, 221),
    )
    draw.text(
        (SHORT_COLUMN_X, 1006),
        "対戦成績やコース別の枠順傾向も全レース掲載"
        if branded
        else "対戦成績やコース別の枠順傾向も同じ基準で整理",
        font=_font(FONT_BOLD, 24),
        fill=EDITORIAL_GOLD,
    )
    return _save_transparent_layer(image, path)


def _draw_short_ranking_phase(
    path: Path,
    race: RaceVideoData,
    target_date: str,
) -> Path:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _short_phase_header(draw, race, target_date, "AI偏差値 上位3頭")
    top_horses = top_by_deviation(race, 3)
    y_positions = (558, 826, 1046)
    heights = (246, 202, 202)
    for rank, horse in enumerate(top_horses, start=1):
        card_path = _draw_broadcast_rank_layer(
            path.with_name(f"{path.stem}_rank_{rank}.png"),
            horse,
            rank,
            (SHORT_COLUMN_WIDTH, heights[rank - 1]),
            right_safe_padding=12,
        )
        with Image.open(card_path) as source:
            image.alpha_composite(source.convert("RGBA"), (SHORT_COLUMN_X, y_positions[rank - 1]))
    return _save_transparent_layer(image, path)


def _draw_short_position_phase(
    path: Path,
    race: RaceVideoData,
    target_date: str,
) -> Path:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _short_phase_header(draw, race, target_date, "全馬の位置取り")
    groups = _position_groups(race)
    top_horses = top_by_deviation(race, 3)
    ranked_numbers = {horse.horse_number: rank for rank, horse in enumerate(top_horses, start=1)}
    for lane_index, (label, horses) in enumerate(
        (
            ("先行", groups["先行"]),
            ("中団", groups["中団"]),
            ("後方", groups["後方"]),
            ("不明", groups["-"]),
        )
    ):
        lane_path = _draw_broadcast_position_lane_layer(
            path.with_name(f"{path.stem}_lane_{lane_index}.png"),
            label,
            horses,
            ranked_numbers,
        )
        with Image.open(lane_path) as source:
            lane = source.convert("RGBA").resize((SHORT_COLUMN_WIDTH, 164), Image.Resampling.LANCZOS)
        image.alpha_composite(lane, (SHORT_COLUMN_X, 570 + lane_index * 174))
    draw = ImageDraw.Draw(image)
    draw.text(
        (SHORT_COLUMN_X, 1276),
        "金枠はAI偏差値上位3頭",
        font=_font(FONT_BOLD, 24),
        fill=EDITORIAL_GOLD,
    )
    return _save_transparent_layer(image, path)


def _draw_short_hero_phase(
    path: Path,
    race: RaceVideoData,
    target_date: str,
    hero_horse: Optional[HorseVideoData],
    *,
    branded: bool = True,
) -> Path:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _short_phase_header(draw, race, target_date, "AI偏差値 1位")
    if hero_horse is not None:
        card_path = _draw_broadcast_rank_layer(
            path.with_name(f"{path.stem}_card.png"),
            hero_horse,
            1,
            (SHORT_COLUMN_WIDTH, 344),
            right_safe_padding=12,
        )
        with Image.open(card_path) as source:
            image.alpha_composite(source.convert("RGBA"), (SHORT_COLUMN_X, 620))
    draw = ImageDraw.Draw(image)
    draw.text(
        (SHORT_COLUMN_X, 1018),
        "対戦成績・展開・脚質・枠順傾向もサイトで公開"
        if branded
        else "対戦成績・展開・脚質・枠順傾向もあわせて確認",
        font=_font(FONT_BOLD, 26),
        fill=(218, 225, 221),
    )
    draw.text(
        (SHORT_COLUMN_X, 1072),
        "全レースを同じ4視点で比較できます",
        font=_font(FONT_BOLD, 23),
        fill=EDITORIAL_GOLD,
    )
    draw.line((SHORT_COLUMN_X, 1126, SHORT_COLUMN_RIGHT, 1126), fill=EDITORIAL_GOLD, width=4)
    return _save_transparent_layer(image, path)


def _draw_short_cta_phase(
    path: Path,
    race: RaceVideoData,
    target_date: str,
    *,
    branded: bool = True,
) -> Path:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    _short_phase_header(draw, race, target_date, "全頭データ・対戦成績・枠順傾向")
    if branded:
        cta_path = _draw_broadcast_cta_layer(path.with_name(f"{path.stem}_panel.png"), compact=True)
        with Image.open(cta_path) as source:
            image.alpha_composite(source.convert("RGBA"), (SHORT_COLUMN_X, 630))
        draw = ImageDraw.Draw(image)
        draw.text(
            (SHORT_COLUMN_X, 900),
            "登録不要 / 毎日無料公開",
            font=_font(FONT_BOLD, 28),
            fill=(219, 226, 222),
        )
        draw.text(
            (SHORT_COLUMN_X, 970),
            "uma-free.com",
            font=_font("Inter-Black.ttf", 42),
            fill=EDITORIAL_GOLD,
        )
    else:
        draw.rounded_rectangle(
            (SHORT_COLUMN_X, 620, SHORT_COLUMN_RIGHT, 1030),
            radius=18,
            fill=(10, 25, 30, 222),
            outline=EDITORIAL_GOLD,
            width=3,
        )
        draw.text(
            (SHORT_COLUMN_X + 36, 704),
            "AI偏差値・位置取り",
            font=_font(FONT_BLACK, 40),
            fill=WHITE,
        )
        draw.text(
            (SHORT_COLUMN_X + 36, 778),
            "対戦成績・枠順傾向",
            font=_font(FONT_BLACK, 40),
            fill=WHITE,
        )
        draw.text(
            (SHORT_COLUMN_X + 36, 888),
            "過去データをもとにした参考情報です",
            font=_font(FONT_BOLD, 25),
            fill=EDITORIAL_GOLD,
        )
    return _save_transparent_layer(image, path)


def _build_short_motion_scene(
    video_dir: Path,
    race: RaceVideoData,
    target_date: str,
    hero_horse: Optional[HorseVideoData],
    visual_asset: Optional[VisualAsset],
    video_asset: Optional[VideoAsset],
    *,
    branded: bool = True,
    include_cta: bool = True,
    duration_seconds: Optional[float] = None,
) -> MotionScene:
    size = (1080, 1920)
    if include_cta:
        scene_duration = SHORT_SCENE_SECONDS
        phase_timings = SHORT_PHASE_TIMINGS
    else:
        scene_duration = duration_seconds or SHORT_COMBINED_RACE_SECONDS
        phase_timings = _scaled_short_phase_timings(scene_duration)
    transition_times = tuple(timing[1] for timing in phase_timings[1:])
    background_image, _ = _hero_background(
        size,
        target_date,
        race.venue_name,
        race.race_number,
        visual_asset,
    )
    background_image = ImageEnhance.Color(background_image).enhance(0.34)
    overlay = Image.new("RGBA", size, (7, 14, 16, 170))
    background_image = Image.alpha_composite(background_image.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(background_image)
    if branded:
        _draw_brand_lockup(background_image, draw, SHORT_COLUMN_X, 82, compact=True, light=True)
    draw.line((SHORT_COLUMN_X, 174, SHORT_COLUMN_RIGHT, 174), fill=EDITORIAL_GOLD, width=4)
    background = video_dir / "000_short_base.png"
    _save_slide(background_image, background, size)

    cover = _draw_short_cover_phase(
        video_dir / "000_cover.png",
        race,
        target_date,
        hero_horse,
        branded=branded,
    )
    ranking = _draw_short_ranking_phase(video_dir / "001_ranking.png", race, target_date)
    position = _draw_short_position_phase(video_dir / "002_position.png", race, target_date)
    hero = _draw_short_hero_phase(
        video_dir / "003_hero.png",
        race,
        target_date,
        hero_horse,
        branded=branded,
    )
    cta = _draw_short_cta_phase(
        video_dir / "999_outro.png",
        race,
        target_date,
        branded=branded,
    )
    analysis_footer = _draw_short_analysis_footer(
        video_dir / "000_short_analysis_footer.png",
        branded=branded,
    )
    wipe = _draw_motion_wipe_layer(video_dir / "000_short_wipe.png", size[1])
    progress_horizontal = _draw_progress_tick_layer(video_dir / "000_short_progress_horizontal.png")
    with Image.open(progress_horizontal) as source:
        progress_vertical = source.convert("RGBA").rotate(90, expand=True)
    progress = _save_transparent_layer(progress_vertical, video_dir / "000_short_progress.png")

    for phase_path, preview_name in (
        (cover, "000_intro.png"),
        (ranking, "001_race.png"),
        (position, "002_position_preview.png"),
        (hero, "003_hero_preview.png"),
        (cta, "999_outro_preview.png"),
    ):
        _compose_motion_preview(
            background,
            [(phase_path, 0, 0), (analysis_footer, SHORT_COLUMN_X, SHORT_ANALYSIS_FOOTER_Y)],
            video_dir / preview_name,
        )
    final_preview = video_dir / ("999_outro_preview.png" if include_cta else "003_hero_preview.png")

    layers: list[MotionLayer] = []
    render_background = background
    if video_asset is not None:
        render_background = video_asset.path
        video_scrim = Image.new("RGBA", size, (7, 14, 16, 176))
        scrim_draw = ImageDraw.Draw(video_scrim)
        if branded:
            _draw_brand_lockup(video_scrim, scrim_draw, SHORT_COLUMN_X, 82, compact=True, light=True)
        scrim_draw.line((SHORT_COLUMN_X, 174, SHORT_COLUMN_RIGHT, 174), fill=EDITORIAL_GOLD, width=4)
        scrim_path = _save_transparent_layer(video_scrim, video_dir / "000_short_video_scrim.png")
        layers.append(
            MotionLayer(
                scrim_path,
                0,
                0,
                0.0,
                scene_duration,
                enter_duration=0.0,
                z_index=1,
            )
        )
    phase_paths = {
        "000_cover.png": cover,
        "001_ranking.png": ranking,
        "002_position.png": position,
        "003_hero.png": hero,
        "999_outro.png": cta,
    }
    layers.extend([
        MotionLayer(
            phase_paths[name],
            0,
            0,
            start,
            end,
            enter_duration=0.0 if start == 0.0 else 0.14,
            exit_duration=0.0,
            z_index=10 + index * 10,
        )
        for index, (name, start, end) in enumerate(phase_timings)
    ])
    layers.extend([
        MotionLayer(
            analysis_footer,
            SHORT_COLUMN_X,
            SHORT_ANALYSIS_FOOTER_Y,
            0.0,
            scene_duration,
            enter_duration=0.22,
            start_y=SHORT_ANALYSIS_FOOTER_Y + 30,
            end_y=SHORT_ANALYSIS_FOOTER_Y,
            z_index=65,
        ),
        MotionLayer(
            progress,
            1008,
            1580,
            0.15,
            max(0.30, scene_duration - 0.20),
            enter_duration=max(0.15, scene_duration - 0.35),
            start_y=300,
            end_y=1580,
            easing="linear",
            z_index=70,
        ),
    ])
    for transition_index, start in enumerate(transition_times):
        layers.append(
            MotionLayer(
                wipe,
                size[0],
                0,
                start,
                start + 0.28,
                enter_duration=0.28,
                start_x=-220,
                end_x=size[0],
                z_index=90 + transition_index,
            )
        )
    _validate_short_content_layers(layers, size, phase_timings)
    return MotionScene(
        background_path=render_background,
        duration_seconds=scene_duration,
        preview_path=final_preview,
        layers=layers,
        scene_id=f"short-{race.id}",
    )


def _sentence_date_label(target_date: str) -> str:
    """概要欄の本文で使う日付表記（例: 2026年8月19日(水)）を返す。"""
    parsed = date.fromisoformat(target_date)
    weekday = "月火水木金土日"[parsed.weekday()]
    return f"{parsed.year}年{parsed.month}月{parsed.day}日({weekday})"


def _bullet_lines(heading: str, items: Sequence[str]) -> List[str]:
    """見出し付きの箇条書きを返す。項目が無ければ何も返さない。"""
    if not items:
        return []
    return ["", heading, *[f"・{item}" for item in items]]


def _title_date_parts(target_date: str) -> tuple[str, str]:
    parsed = date.fromisoformat(target_date)
    weekday = "月火水木金土日"[parsed.weekday()]
    return f"{parsed.month}/{parsed.day}({weekday})", f"{parsed.year}年"


# YouTubeのタイトル上限。
YOUTUBE_TITLE_MAX_LENGTH = 100


def _assemble_title(essential: Sequence[str], optional: Sequence[str]) -> str:
    """必須要素を先に確保し、残りは丸ごと入るものだけを採用する。

    単純に連結して末尾を切ると、上限ぴったりのところで重賞名が
    語の途中で切れて「スパーキングサマーカ」のような検索されない
    文字列になる。入らない要素は落として、残った要素は原形を保つ。
    """
    parts = [str(item).strip() for item in essential if str(item).strip()]
    title = "｜".join(parts)
    for item in optional:
        candidate = str(item).strip()
        if not candidate:
            continue
        merged = f"{title}｜{candidate}" if title else candidate
        if len(merged) > YOUTUBE_TITLE_MAX_LENGTH:
            continue
        title = merged
    return title[:YOUTUBE_TITLE_MAX_LENGTH].rstrip("｜・ ")


def _venue_label(venue_names: Sequence[str], limit: int = 2) -> str:
    """タイトルへ入れる会場名。多すぎる場合は先頭だけ挙げて「ほか」で締める。"""
    unique = list(dict.fromkeys(name for name in venue_names if name))
    if not unique:
        return ""
    if len(unique) <= limit:
        return "・".join(unique)
    return "・".join(unique[:limit]) + "ほか"


def _long_title_essential(venue: VenueVideoData, target_date: str) -> str:
    date_label, _ = _title_date_parts(target_date)
    return f"{date_label}｜全{len(venue.races)}レースAI分析"


def _long_title(venue: VenueVideoData, target_date: str) -> str:
    # 先頭は _long_title_essential（日付＋レース数）で固定する。
    # モバイルのYouTubeはタイトルを早い位置で省略するため、
    # 重賞名は必須プレフィックスの直後という最速の位置に置く。
    date_label, year_label = _title_date_parts(target_date)
    parts = [
        date_label,
        f"全{len(venue.races)}レースAI分析",
    ]
    featured_race = pick_featured_race(venue)
    optional = []
    if featured_race is not None and featured_race.is_grade_race:
        optional.append(featured_race.display_name)
    optional.extend([
        f"{venue.venue_name}競馬予想",
        year_label,
    ])
    return _assemble_title(parts, optional)


def _description(
    title: str,
    url: str,
    venue_name: Optional[str] = None,
    excluded_race_labels: Sequence[str] = (),
    excluded_race_intro: str = "AI偏差値の算出対象外となる新馬戦",
    chapter_lines: Sequence[str] = (),
    lead: str = "",
) -> str:
    venue_line = f"{venue_name}の" if venue_name else ""
    # 概要欄の冒頭はYouTube検索のスニペットに使われるため、
    # タイトルをそのまま繰り返さず、レース名と「予想」を含む文章を置く。
    lines = [
        url,
        "",
        lead or title,
        "",
        "UMA-FREEでは、中央・地方競馬の全レース分析データを毎日無料で掲載しています。登録は不要です。",
        f"{venue_line}AI偏差値、過去対戦成績、位置取り予測、枠順傾向をレース順に掲載しています。",
    ]
    if chapter_lines:
        lines.extend(("", "チャプター", *chapter_lines))
    lines.extend(
        (
            "",
            "※本動画は過去データをもとにした参考情報です。結果を保証するものではありません。",
            "",
            "#競馬 #競馬データ #UMA_FREE",
        )
    )
    description = "\n".join(lines).strip()
    if excluded_race_labels:
        description += (
            f"\n\n※{excluded_race_intro}は収録していません: "
            + "、".join(excluded_race_labels)
        )
    return description


def _compilation_races(venues: Sequence[VenueVideoData]) -> List[RaceVideoData]:
    return [race for venue in venues for race in venue.races]


def _compilation_grade_races(venues: Sequence[VenueVideoData]) -> List[RaceVideoData]:
    return [race for race in _compilation_races(venues) if race.is_grade_race]


# YouTubeのタグはリスト全体で500文字までで、超えるとアップロードが
# invalidTags で失敗する。件数の上限は30件。
YOUTUBE_TAG_TOTAL_LIMIT = 500
YOUTUBE_TAG_COUNT_LIMIT = 30


def _dedupe_tags(
    tags: Iterable[str],
    limit: int = YOUTUBE_TAG_COUNT_LIMIT,
    total_char_limit: int = YOUTUBE_TAG_TOTAL_LIMIT,
) -> List[str]:
    """空文字と重複を除き、YouTubeの上限に収まるタグ列を返す。

    引数は優先度の高い順に渡すこと。文字数の予算を超えたタグは
    そこで打ち切らず読み飛ばすため、後ろにある短い汎用タグは残る。
    """
    seen: set[str] = set()
    result: List[str] = []
    used_chars = 0
    for tag in tags:
        normalized = str(tag or "").strip()
        if not normalized or normalized in seen:
            continue
        # 区切り文字ぶんを1文字として見積もる。
        cost = len(normalized) + (1 if result else 0)
        if used_chars + cost > total_char_limit:
            continue
        seen.add(normalized)
        result.append(normalized)
        used_chars += cost
        if len(result) >= min(limit, YOUTUBE_TAG_COUNT_LIMIT):
            break
    return result


def _grade_race_intent_tags(
    races: Sequence[RaceVideoData],
    limit: int = 2,
) -> List[str]:
    """重賞名と検索意図を組み合わせたタグを返す。

    「スパーキングサマーカップ 予想」のように、レース名と「予想」を
    合わせて検索されるため、名前単体だけでなく組み合わせも持たせる。
    """
    tags: List[str] = []
    for race in races[:limit]:
        name = race.display_name
        if not name:
            continue
        tags.extend([name, f"{name}予想", f"{name}AI予想"])
    return tags


def _venue_intent_tags(venue_names: Sequence[str], limit: int = 3) -> List[str]:
    """競馬場名の検索バリエーションを返す（川崎 / 川崎競馬 / 川崎競馬予想）。"""
    tags: List[str] = []
    for name in list(dict.fromkeys(n for n in venue_names if n))[:limit]:
        tags.extend([name, f"{name}競馬", f"{name}競馬予想"])
    return tags


def _date_tag(target_date: str) -> str:
    """日付での検索に当てるタグ（例: 8月19日競馬）を返す。"""
    try:
        parsed = date.fromisoformat(target_date)
    except (TypeError, ValueError):
        return ""
    return f"{parsed.month}月{parsed.day}日競馬"


def _race_condition_tags(races: Sequence[RaceVideoData], limit: int = 4) -> List[str]:
    """収録レースのコース条件を検索語に近い形（例: 芝1600m）でタグ化する。"""
    conditions: List[str] = []
    for race in races:
        if not race.course_type or not race.distance:
            continue
        conditions.append(f"{race.course_type}{race.distance}m")
    return _dedupe_tags(conditions, limit=limit)


def _grade_tags(races: Sequence[RaceVideoData]) -> List[str]:
    """重賞のグレード表記を検索されやすい形でタグ化する。"""
    grades: List[str] = []
    for race in races:
        grade = str(race.grade or "").strip()
        if grade:
            grades.append(grade)
    return _dedupe_tags(grades, limit=3)


def _race_type_scope(venues: Sequence[VenueVideoData]) -> str:
    types = {str(venue.race_type).strip() for venue in venues}
    if "中央" in types and "地方" in types:
        return "中央競馬・地方競馬"
    if "中央" in types:
        return "中央競馬"
    if "地方" in types:
        return "地方競馬"
    return "競馬"


def _daily_long_title(venues: Sequence[VenueVideoData], target_date: str) -> str:
    date_label, year_label = _title_date_parts(target_date)
    races = _compilation_races(venues)
    grade_names = "・".join(
        race.display_name for race in _compilation_grade_races(venues)[:2]
    )
    # 「{競馬場名} 予想」で検索されるため、収録会場をタイトルにも入れる。
    # 4場以上あるので上位2場＋「ほか」に留める。
    venue_label = _venue_label([venue.venue_name for venue in venues])
    return _assemble_title(
        [date_label, f"全{len(races)}レースAI分析"],
        [
            venue_label,
            grade_names,
            f"{_race_type_scope(venues)}予想",
            year_label,
        ],
    )


def _daily_short_title(races: Sequence[RaceVideoData], target_date: str) -> str:
    if not races:
        raise ValueError("Shortsの収録対象レースがありません")
    date_label, year_label = _title_date_parts(target_date)
    grade_races = [race for race in races if race.is_grade_race]
    # 収録会場は1〜3場に収まるため、日付の直後に置いて
    # 「{競馬場名} 予想」の検索に当てる。
    venue_label = _venue_label([race.venue_name for race in races], limit=3)
    essential = [date_label]
    if venue_label:
        essential.append(f"{venue_label} 注目{len(races)}レースAI分析")
    else:
        essential.append(f"注目{len(races)}レースAI分析")
    optional = []
    if grade_races:
        optional.append("・".join(race.display_name for race in grade_races[:2]))
    optional.extend([
        "AI競馬予想",
        f"{year_label} #Shorts",
    ])
    return _assemble_title(essential, optional)


def _format_chapter_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(seconds))
    minutes, second = divmod(total_seconds, 60)
    hours, minute = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minute:02d}:{second:02d}"
    return f"{minute:02d}:{second:02d}"


# YouTubeがタイムスタンプをチャプターのリンクに変換する条件。
# 「先頭が00:00」「3件以上」「各チャプターが10秒以上」を
# すべて満たしたときだけリンク化され、1つでも欠けると
# 全チャプターがただの文字列として表示される。
YOUTUBE_MIN_CHAPTER_COUNT = 3
YOUTUBE_MIN_CHAPTER_SECONDS = 10.0


def _finalize_chapter_lines(
    entries: Sequence[tuple[float, str]],
    total_seconds: float,
) -> List[str]:
    """チャプター候補をYouTubeの要件に合わせて整形する。

    10秒に満たない区間は直前のチャプターへ統合する（見出しも連結するため、
    表示と中身がずれない）。統合しても要件を満たせない場合は空リストを返し、
    リンクにならないタイムスタンプを概要欄へ載せない。
    """
    if not entries:
        return []

    merged: List[list] = []
    for start, label in sorted(entries, key=lambda item: item[0]):
        text = str(label).strip()
        if not text:
            continue
        if merged and start - merged[-1][0] < YOUTUBE_MIN_CHAPTER_SECONDS:
            merged[-1][1] = f"{merged[-1][1]} / {text}"
        else:
            merged.append([float(start), text])

    # 最終チャプターも10秒以上必要。足りなければ1つ前へ畳む。
    while len(merged) > 1 and total_seconds - merged[-1][0] < YOUTUBE_MIN_CHAPTER_SECONDS:
        tail = merged.pop()
        merged[-1][1] = f"{merged[-1][1]} / {tail[1]}"

    if len(merged) < YOUTUBE_MIN_CHAPTER_COUNT or merged[0][0] > 0.5:
        return []
    merged[0][0] = 0.0
    return [
        f"{_format_chapter_timestamp(start)} {label}"
        for start, label in merged
    ]


def _daily_compilation_lead(
    venues: Sequence[VenueVideoData],
    target_date: str,
    short_races: Sequence[RaceVideoData] = (),
) -> str:
    """概要欄の冒頭に置く1文を組み立てる。

    YouTube検索の結果に出るのは概要欄の先頭部分なので、
    「日付」「開催場」「レース名」「予想」という
    実際に検索される語を自然な文章のまま先頭へ入れる。
    """
    if not target_date:
        return ""
    date_label = _sentence_date_label(target_date)
    scope = _race_type_scope(venues)
    if short_races:
        venue_names = "・".join(
            dict.fromkeys(race.venue_name for race in short_races)
        )
        lead = (
            f"{date_label}の{scope}から、{venue_names}の注目"
            f"{len(short_races)}レースを取り上げ、AI偏差値をもとにした予想データを紹介します。"
        )
        grade_races = [race for race in short_races if race.is_grade_race]
    else:
        venue_names = "・".join(venue.venue_name for venue in venues)
        lead = (
            f"{date_label}に行われる{scope} {venue_names}の全"
            f"{len(_compilation_races(venues))}レースについて、"
            "AI偏差値をもとにした予想データをレース順にまとめました。"
        )
        grade_races = _compilation_grade_races(venues)
    if grade_races:
        names = "、".join(race.display_name for race in grade_races[:3])
        lead += f"注目の重賞は{names}です。"
    return lead


def _daily_compilation_description(
    *,
    title: str,
    url: str,
    venues: Sequence[VenueVideoData],
    target_date: str = "",
    chapter_lines: Sequence[str] = (),
    short_races: Sequence[RaceVideoData] = (),
    additional_excluded_labels: Sequence[str] = (),
) -> str:
    grade_races = [
        race
        for race in (short_races or _compilation_grade_races(venues))
        if race.is_grade_race
    ]
    venue_items = [
        f"{venue.race_type}競馬 {venue.venue_name}（全{len(venue.races)}レース）"
        for venue in venues
    ]
    race_items = [
        f"{race.venue_name}{race.race_number}R {race.display_name}"
        for race in short_races
    ]
    lines = [
        url,
        "",
        _daily_compilation_lead(venues, target_date, short_races) or title,
        "",
        "【中央・地方競馬のAI分析をいつでも無料公開中】",
        "UMA-FREEでは、AI偏差値、過去対戦成績、位置取り予測、枠順傾向を登録不要で確認できます。",
        "本動画は、当日の競馬予想を検討する際の参考情報として、過去データに基づくAI分析をまとめたものです。",
    ]
    if race_items:
        lines.extend(_bullet_lines("収録レース", race_items))
    else:
        lines.extend(_bullet_lines("収録開催場", venue_items))
    # 収録レース一覧に重賞名が出ている場合、同じ名前をもう一度並べない。
    if grade_races and not race_items:
        lines.extend(
            _bullet_lines("収録重賞", [race.display_name for race in grade_races])
        )
    if chapter_lines:
        lines.extend(("", "チャプター", *chapter_lines))

    excluded_labels = [
        f"{venue.venue_name}{race.race_number}R {race.display_name}"
        for venue in venues
        for race in venue.excluded_races
    ] + list(additional_excluded_labels)
    if excluded_labels:
        lines.extend(
            (
                "",
                "※AI偏差値の算出対象外・データ未掲載のレースは収録していません: "
                + "、".join(excluded_labels),
            )
        )
    lines.extend(
        (
            "",
            "※本動画は過去データをもとにした参考情報です。結果を保証するものではありません。",
            "",
            "#競馬 #AI予想 #競馬予想 #中央競馬 #地方競馬 #UMA_FREE",
        )
    )
    return "\n".join(lines).strip()


def render_long_video(venue: VenueVideoData, target_date: str, output_dir: Path, skip_video: bool = False) -> RenderedVideo:
    stable_id = f"venue_{_safe_filename(venue.venue_name)}"
    video_dir = output_dir / "long" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    size = (1920, 1080)
    utm_content = f"venue_long_{_safe_filename(venue.venue_name)}"
    title = _long_title(venue, target_date)
    scenes: List[MotionScene] = []
    hero_race, hero_horse = _best_horse_for_venue(venue)
    hero_race_number = hero_race.race_number if hero_race else None
    visual_asset = resolve_visual_asset(
        target_date,
        venue.venue_name,
        hero_race_number,
        "wide",
        selection_key=stable_id,
    )
    motion_video_asset = resolve_video_asset(
        target_date,
        venue.venue_name,
        hero_race_number,
        "wide",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "venue_long", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "venue_long", stable_id)
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

    excluded_scope, excluded_race_intro = _excluded_race_copy(venue)
    scope_label = (
        f"対象{len(venue.races)}レース AI偏差値（{excluded_scope}）"
        if venue.excluded_races
        else f"全{len(venue.races)}レース AI偏差値"
    )
    scenes.append(
        _build_intro_motion_scene(
            video_dir=video_dir,
            target_date=target_date,
            headline=thumb_title,
            size=size,
            hero_horse=hero_horse,
            race_label=hero_label,
            scope_label=scope_label,
            venue_name=venue.venue_name,
            race_number=hero_race_number,
            visual_asset=visual_asset,
            video_asset=motion_video_asset,
            duration_seconds=LONG_INTRO_SECONDS,
        )
    )
    # レース単位のチャプターを作る。視聴者が目的のレースへ直接飛べるようにし、
    # YouTube側の検索スニペットにもレース名が載る。
    chapter_entries: List[tuple[float, str]] = [(0.0, "オープニング")]
    elapsed_seconds = float(LONG_INTRO_SECONDS)
    for progress_index, race in enumerate(venue.races, start=1):
        race_scene = _build_long_race_motion_scene(
            video_dir,
            race,
            target_date,
            progress_index,
            len(venue.races),
        )
        scenes.append(race_scene)
        chapter_entries.append(
            (elapsed_seconds, f"{race.race_number}R {race.display_name}")
        )
        elapsed_seconds += race_scene.duration_seconds
    scenes.append(
        _build_outro_motion_scene(
            video_dir,
            target_date,
            size,
            utm_content,
            venue.venue_name,
            hero_race_number,
            visual_asset,
            LONG_OUTRO_SECONDS,
        )
    )
    _attach_long_audio_cues(scenes, sfx_assets)
    chapter_lines = _finalize_chapter_lines(
        chapter_entries,
        sum(scene.duration_seconds for scene in scenes),
    )

    thumbnail = video_dir / "thumbnail.jpg"
    subtitle = (
        f"対象{len(venue.races)}R（{excluded_scope}） AI偏差値・位置取り"
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
        render_motion_video(scenes, video_path, *size, audio_asset=audio_asset)

    if hero_race_number is None:
        raise RuntimeError(f"代表レースを選定できません: {venue.venue_name}")
    url = build_video_url(target_date)
    course_assets: dict[str, CourseAsset] = {}
    for race in venue.races:
        course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
        if course_asset is not None:
            course_assets[course_asset.asset_id] = course_asset
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "thumbnail_image": visual_asset_metadata(visual_asset),
        "intro_video": video_asset_metadata(motion_video_asset),
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
        "courses": [course_asset_metadata(asset) for asset in course_assets.values()],
    }
    excluded_race_labels = [
        f"{race.race_number}R {race.display_name}"
        for race in venue.excluded_races
    ]
    featured_race = pick_featured_race(venue)
    lead = (
        f"{_sentence_date_label(target_date)}の{venue.race_type}競馬 {venue.venue_name}"
        f"、全{len(venue.races)}レースの予想データをAI偏差値をもとにレース順でまとめました。"
    )
    if featured_race is not None and featured_race.is_grade_race:
        lead += f"注目の重賞は{featured_race.display_name}です。"
    description = _description(
        title,
        url,
        venue.venue_name,
        excluded_race_labels=excluded_race_labels,
        excluded_race_intro=excluded_race_intro,
        chapter_lines=chapter_lines,
        lead=lead,
    )
    tags = _dedupe_tags([
        "競馬",
        "競馬予想",
        "AI競馬予想",
        "AI偏差値",
        "UMA-FREE",
        *_venue_intent_tags([venue.venue_name]),
        *_grade_race_intent_tags(venue.grade_races),
        *_grade_tags(venue.grade_races),
        _date_tag(target_date),
        *_race_condition_tags(venue.races),
    ])
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
            "design_system": "broadcast_editorial_v8",
            "motion_profile": resolve_motion_profile(),
        }
    )
    total_duration_seconds = sum(scene.duration_seconds for scene in scenes)
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
                "reason": prediction_exclusion_reason(race.race_name, race.course_type).rstrip("。")
                or "AI偏差値算出対象外",
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
        "design_system": "broadcast_editorial_v8",
        "motion_profile": resolve_motion_profile(),
        "scene_count": len(scenes),
        "race_scene_seconds": LONG_RACE_SCENE_SECONDS,
        "estimated_duration_seconds": total_duration_seconds,
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
        estimated_duration_seconds=total_duration_seconds,
    )


def render_daily_long_video(
    venues: Sequence[VenueVideoData],
    target_date: str,
    output_dir: Path,
    skip_video: bool = False,
) -> RenderedVideo:
    """中央競馬の各場を先に、地方競馬を後にまとめた日次横動画を生成する。"""

    if not venues:
        raise ValueError("日次統合動画の対象開催場がありません")
    races = _compilation_races(venues)
    if not races:
        raise ValueError("日次統合動画の対象レースがありません")

    stable_id = "daily_all"
    video_dir = output_dir / "long" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    render_omissions: List[dict] = []
    filtered_venues: List[VenueVideoData] = []
    with tempfile.TemporaryDirectory(prefix="race-preflight-", dir=video_dir) as temp_dir:
        preflight_root = Path(temp_dir)
        for venue in venues:
            kept_races: List[RaceVideoData] = []
            failed_races: List[RaceVideoData] = []
            for race in venue.races:
                race_dir = preflight_root / _safe_filename(race.id)
                race_dir.mkdir(parents=True, exist_ok=True)
                try:
                    _build_long_race_motion_scene(
                        race_dir,
                        race,
                        target_date,
                        1,
                        1,
                    )
                except Exception as exc:
                    reason = f"描画失敗: {type(exc).__name__}: {str(exc)[:160]}"
                    failed_races.append(replace(race, omission_reason=reason))
                    render_omissions.append(
                        {
                            "race_id": race.id,
                            "venue_name": race.venue_name,
                            "race_number": race.race_number,
                            "race_name": race.display_name,
                            "grade": race.grade or "",
                            "reason": reason,
                            "category": "render_error",
                        }
                    )
                    continue
                kept_races.append(race)
            if kept_races:
                filtered_venues.append(
                    VenueVideoData(
                        venue_name=venue.venue_name,
                        race_type=venue.race_type,
                        races=kept_races,
                        excluded_races=[*venue.excluded_races, *failed_races],
                    )
                )
    venues = filtered_venues
    races = _compilation_races(venues)
    if not races:
        raise RuntimeError("全レースの事前描画に失敗したため、日次横動画を生成できません")
    size = (1920, 1080)
    utm_content = "daily_long_all"
    title = _daily_long_title(venues, target_date)
    combined_venue = VenueVideoData("日次統合", "統合", races)
    hero_race, hero_horse = _best_horse_for_venue(combined_venue)
    if hero_race is None:
        raise RuntimeError("日次統合動画の代表レースを選定できません")

    visual_asset = resolve_visual_asset(
        target_date,
        hero_race.venue_name,
        hero_race.race_number,
        "wide",
        selection_key=stable_id,
    )
    motion_video_asset = resolve_video_asset(
        target_date,
        hero_race.venue_name,
        hero_race.race_number,
        "wide",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "venue_long", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "venue_long", stable_id)
    publish_block_reasons: List[str] = []
    asset_warnings: List[str] = []
    if visual_asset is None:
        asset_warnings.append("日次横動画用の横写真が見つからないため代替背景を使用")
    if audio_asset is None:
        publish_block_reasons.append("日次横動画用BGMが見つかりません")

    scenes: List[MotionScene] = []
    date_label, _ = _title_date_parts(target_date)
    thumbnail_headline = f"{date_label} 全{len(races)}レース AI分析"
    scenes.append(
        _build_intro_motion_scene(
            video_dir=video_dir,
            target_date=target_date,
            headline=thumbnail_headline,
            size=size,
            hero_horse=hero_horse,
            race_label=_race_type_scope(venues),
            scope_label="中央競馬の各場から地方競馬へ順に収録",
            venue_name=hero_race.venue_name,
            race_number=hero_race.race_number,
            visual_asset=visual_asset,
            video_asset=motion_video_asset,
            duration_seconds=LONG_INTRO_SECONDS,
            scene_prefix="000_intro",
        )
    )

    chapter_entries: List[tuple[float, str]] = [(0.0, "本日のAI分析まとめ")]
    elapsed_seconds = LONG_INTRO_SECONDS
    chapter_visual_assets: List[Optional[VisualAsset]] = []
    chapter_video_assets: List[Optional[VideoAsset]] = []
    for venue_index, venue in enumerate(venues, start=1):
        featured_race = pick_featured_race(venue)
        if featured_race is None:
            continue
        featured_horse = _best_horse_for_race(featured_race)
        venue_visual = resolve_visual_asset(
            target_date,
            venue.venue_name,
            featured_race.race_number,
            "wide",
            selection_key=f"{stable_id}_{venue.venue_name}",
        )
        venue_video = resolve_video_asset(
            target_date,
            venue.venue_name,
            featured_race.race_number,
            "wide",
            selection_key=f"{stable_id}_{venue.venue_name}",
        )
        chapter_visual_assets.append(venue_visual)
        chapter_video_assets.append(venue_video)
        if venue_visual is None:
            asset_warnings.append(f"{venue.venue_name}章は代替背景を使用")
        chapter_entries.append(
            (
                elapsed_seconds,
                f"{venue.race_type}競馬 {venue.venue_name} 全{len(venue.races)}レース",
            )
        )
        grade_names = "・".join(race.display_name for race in venue.grade_races)
        venue_headline = grade_names or f"{venue.venue_name} 全{len(venue.races)}レース"
        excluded_scope, _ = _excluded_race_copy(venue)
        scope_label = (
            f"対象{len(venue.races)}レース AI分析（{excluded_scope}）"
            if venue.excluded_races
            else f"全{len(venue.races)}レース AI分析"
        )
        scenes.append(
            _build_intro_motion_scene(
                video_dir=video_dir,
                target_date=target_date,
                headline=venue_headline,
                size=size,
                hero_horse=featured_horse,
                race_label=f"{venue.race_type}競馬  {venue.venue_name}",
                scope_label=scope_label,
                venue_name=venue.venue_name,
                race_number=featured_race.race_number,
                visual_asset=venue_visual,
                video_asset=venue_video,
                duration_seconds=LONG_INTRO_SECONDS,
                scene_prefix=f"chapter_{venue_index:02d}_{_safe_filename(venue.venue_name)}",
            )
        )
        elapsed_seconds += LONG_INTRO_SECONDS
        for progress_index, race in enumerate(venue.races, start=1):
            scenes.append(
                _build_long_race_motion_scene(
                    video_dir,
                    race,
                    target_date,
                    progress_index,
                    len(venue.races),
                )
            )
            elapsed_seconds += LONG_RACE_SCENE_SECONDS

    scenes.append(
        _build_outro_motion_scene(
            video_dir,
            target_date,
            size,
            utm_content,
            hero_race.venue_name,
            hero_race.race_number,
            visual_asset,
            LONG_OUTRO_SECONDS,
        )
    )
    _attach_long_audio_cues(scenes, sfx_assets)

    thumbnail = video_dir / "thumbnail.jpg"
    grade_label = " / ".join(race.display_name for race in _compilation_grade_races(venues)[:2])
    _draw_thumbnail(
        thumbnail,
        thumbnail_headline,
        f"{_race_type_scope(venues)}  AI予想" + (f"  {grade_label}" if grade_label else ""),
        target_date,
        size,
        hero_horse=hero_horse,
        venue_name="中央→地方" if len({venue.race_type for venue in venues}) > 1 else venues[0].race_type,
        race_number=hero_race.race_number,
        grade=hero_race.grade or "",
        visual_asset=visual_asset,
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    if skip_video:
        video_path = None
    else:
        render_motion_video(scenes, video_path, *size, audio_asset=audio_asset)

    url = build_video_url(target_date)
    chapter_lines = _finalize_chapter_lines(
        chapter_entries,
        sum(scene.duration_seconds for scene in scenes),
    )
    description = _daily_compilation_description(
        title=title,
        url=url,
        venues=venues,
        target_date=target_date,
        chapter_lines=chapter_lines,
    )
    grade_names = [race.display_name for race in _compilation_grade_races(venues)]
    tags = _dedupe_tags([
        "競馬",
        "AI予想",
        "競馬予想",
        "AI競馬予想",
        "中央競馬",
        "地方競馬",
        "UMA-FREE",
        *_grade_race_intent_tags(_compilation_grade_races(venues)),
        *_grade_tags(_compilation_grade_races(venues)),
        *_venue_intent_tags([venue.venue_name for venue in venues]),
        _date_tag(target_date),
        *_race_condition_tags(races),
    ])
    course_assets: dict[str, CourseAsset] = {}
    for race in races:
        course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
        if course_asset is not None:
            course_assets[course_asset.asset_id] = course_asset
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "chapter_images": [visual_asset_metadata(asset) for asset in chapter_visual_assets],
        "intro_videos": [
            video_asset_metadata(asset)
            for asset in [motion_video_asset, *chapter_video_assets]
        ],
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
        "courses": [course_asset_metadata(asset) for asset in course_assets.values()],
    }
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "daily_long",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "venue_order": [venue.venue_name for venue in venues],
            "race_ids": [race.id for race in races],
            "excluded_race_ids": [race.id for venue in venues for race in venue.excluded_races],
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
            "design_system": "broadcast_editorial_v9_daily_compilation",
            "motion_profile": resolve_motion_profile(),
        }
    )
    total_duration_seconds = sum(scene.duration_seconds for scene in scenes)
    metadata_path = video_dir / "metadata.json"
    metadata = {
        "video_type": "daily_long",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": "・".join(venue.venue_name for venue in venues),
        "venue_order": [
            {"race_type": venue.race_type, "venue_name": venue.venue_name}
            for venue in venues
        ],
        "race_ids": [race.id for race in races],
        "render_omissions": render_omissions,
        "aspect_ratio": "16:9",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "thumbnail_path": str(thumbnail),
        "thumbnail_text": thumbnail_headline,
        "chapters": chapter_lines,
        "utm_content": utm_content,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": True,
        "publishable": not publish_block_reasons,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": asset_warnings,
        "design_system": "broadcast_editorial_v9_daily_compilation",
        "motion_profile": resolve_motion_profile(),
        "scene_count": len(scenes),
        "race_scene_seconds": LONG_RACE_SCENE_SECONDS,
        "estimated_duration_seconds": total_duration_seconds,
    }
    _write_metadata(metadata_path, metadata)
    return RenderedVideo(
        video_type="daily_long",
        stable_id=stable_id,
        title=title,
        description=description,
        tags=tags,
        video_path=video_path,
        thumbnail_path=thumbnail,
        metadata_path=metadata_path,
        publish_offset_minutes=0,
        publishable=not publish_block_reasons,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name="・".join(venue.venue_name for venue in venues),
        race_ids=[race.id for race in races],
        aspect_ratio="16:9",
        destination_url=url,
        destination_path=build_race_path(target_date),
        utm_content=utm_content,
        race_number=hero_race.race_number,
        race_name=hero_race.display_name,
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=True,
        estimated_duration_seconds=total_duration_seconds,
    )


def _short_title(race: RaceVideoData, target_date: str) -> str:
    date_label, year_label = _title_date_parts(target_date)
    parts = [
        date_label,
        f"{race.venue_name}{race.race_number}R AI分析",
    ]
    optional = []
    if race.grade:
        optional.append(race.display_name)
    optional.extend([
        f"{race.venue_name}競馬予想",
        f"{year_label} #Shorts",
    ])
    return _assemble_title(parts, optional)


def _append_audio_cue(
    scene: MotionScene,
    assets: dict[str, AudioAsset],
    cue_type: str,
    start_seconds: float,
    volume_scale: float = 1.0,
    max_duration: float = 0.8,
) -> None:
    asset = assets.get(cue_type)
    if asset is None:
        return
    scene.audio_cues.append(
        AudioCue(
            asset_path=asset.path,
            start_seconds=start_seconds,
            volume=max(0.0, min(1.0, asset.volume * volume_scale)),
            max_duration=max_duration,
            cue_type=cue_type,
        )
    )


def _attach_long_audio_cues(
    scenes: Sequence[MotionScene],
    sfx_assets: dict[str, AudioAsset],
) -> None:
    if not scenes:
        return
    _append_audio_cue(scenes[0], sfx_assets, "whoosh", 0.02, 1.0, 0.9)
    _append_audio_cue(scenes[0], sfx_assets, "score_reveal", 0.72, 0.85, 0.7)
    for scene in scenes[1:-1]:
        _append_audio_cue(scene, sfx_assets, "transition", 0.02, 0.52, 0.45)
        _append_audio_cue(scene, sfx_assets, "data_tick", 0.52, 0.44, 0.35)
    if len(scenes) > 1:
        _append_audio_cue(scenes[-1], sfx_assets, "cta", 0.22, 0.82, 0.9)


def _attach_short_audio_cues(
    scene: MotionScene,
    sfx_assets: dict[str, AudioAsset],
    *,
    include_cta: bool = True,
) -> None:
    base_duration = SHORT_SCENE_SECONDS if include_cta else SHORT_COMBINED_RACE_SECONDS
    scale = scene.duration_seconds / base_duration
    _append_audio_cue(scene, sfx_assets, "whoosh", 0.02 * scale, 1.0, 0.9)
    _append_audio_cue(scene, sfx_assets, "data_tick", 1.18 * scale, 0.62, 0.35)
    _append_audio_cue(scene, sfx_assets, "transition", 4.92 * scale, 0.64, 0.5)
    _append_audio_cue(scene, sfx_assets, "score_reveal", 9.05 * scale, 0.86, 0.8)
    if include_cta:
        _append_audio_cue(scene, sfx_assets, "cta", 11.82 * scale, 0.92, 0.9)


def _draw_short_position_slide(path: Path, race: RaceVideoData, target_date: str, size: tuple[int, int], utm_content: str) -> None:
    _draw_position_slide(path, race, target_date, size)


def render_short_video(race: RaceVideoData, target_date: str, output_dir: Path, index: int, skip_video: bool = False) -> RenderedVideo:
    stable_id = f"short_{_safe_filename(race.id)}"
    video_dir = output_dir / "shorts" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    size = (1080, 1920)
    utm_content = f"short_{_safe_filename(race.id)}"
    title = _short_title(race, target_date)
    hero_horse = _best_horse_for_race(race)
    visual_asset = resolve_visual_asset(
        target_date,
        race.venue_name,
        race.race_number,
        "vertical",
        selection_key=stable_id,
    )
    motion_video_asset = resolve_video_asset(
        target_date,
        race.venue_name,
        race.race_number,
        "vertical",
        selection_key=stable_id,
    )
    audio_asset = resolve_audio_asset(target_date, "short", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "short", stable_id)
    publish_block_reasons: List[str] = []
    if visual_asset is None:
        publish_block_reasons.append("Shorts用の縦写真が見つかりません")
    if audio_asset is None:
        publish_block_reasons.append("Shorts用BGMが見つかりません")
    publishable = not publish_block_reasons

    scene = _build_short_motion_scene(
        video_dir,
        race,
        target_date,
        hero_horse,
        visual_asset,
        motion_video_asset,
        branded=True,
    )
    _attach_short_audio_cues(scene, sfx_assets)
    tiktok_video_dir = video_dir / "tiktok-clean"
    tiktok_video_dir.mkdir(parents=True, exist_ok=True)
    tiktok_scene = _build_short_motion_scene(
        tiktok_video_dir,
        race,
        target_date,
        hero_horse,
        visual_asset,
        motion_video_asset,
        branded=False,
    )
    _attach_short_audio_cues(tiktok_scene, sfx_assets)

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
    tiktok_video_path: Optional[Path] = tiktok_video_dir / f"{stable_id}_clean.mp4"
    if skip_video:
        video_path = None
        tiktok_video_path = None
    else:
        render_motion_video([scene], video_path, *size, audio_asset=audio_asset)
        render_motion_video([tiktok_scene], tiktok_video_path, *size, audio_asset=audio_asset)

    url = build_video_url(target_date)
    course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "hero_image": visual_asset_metadata(visual_asset),
        "cover_frame_image": visual_asset_metadata(visual_asset),
        "background_video": video_asset_metadata(motion_video_asset),
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
        "course": course_asset_metadata(course_asset),
    }
    description = _description(title, url, race.venue_name)
    tags = _dedupe_tags([
        "競馬",
        "競馬予想",
        "AI競馬予想",
        "AI偏差値",
        "UMA-FREE",
        "Shorts",
        *_venue_intent_tags([race.venue_name]),
        *_grade_race_intent_tags([race] if race.is_grade_race else []),
        race.display_name,
        *_grade_tags([race]),
        _date_tag(target_date),
        *_race_condition_tags([race]),
    ])
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
            "design_system": "broadcast_editorial_v8",
            "motion_profile": resolve_motion_profile(),
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
        "variant_video_paths": {
            "standard": str(video_path) if video_path else None,
            "tiktok_clean": str(tiktok_video_path) if tiktok_video_path else None,
        },
        "thumbnail_path": str(thumbnail),
        "vertical_cover_path": str(video_dir / "000_intro.png"),
        "destination_path": build_race_path(target_date),
        "race_number": race.race_number,
        "race_name": race.display_name,
        "utm_content": utm_content,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": False,
        "publish_order": index,
        "publishable": publishable,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": publish_block_reasons,
        "design_system": "broadcast_editorial_v8",
        "motion_profile": resolve_motion_profile(),
        "scene_count": 1,
        "estimated_duration_seconds": scene.duration_seconds,
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
        publish_offset_minutes=0,
        publishable=publishable,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name=race.venue_name,
        race_ids=[race.id],
        aspect_ratio="9:16",
        destination_url=url,
        destination_path=build_race_path(target_date),
        utm_content=utm_content,
        race_number=race.race_number,
        race_name=race.display_name,
        vertical_cover_path=video_dir / "000_intro.png",
        variant_video_paths={
            **({"standard": video_path} if video_path else {}),
            **({"tiktok_clean": tiktok_video_path} if tiktok_video_path else {}),
        },
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=False,
    )


def render_daily_short_video(
    races: Sequence[RaceVideoData],
    venues: Sequence[VenueVideoData],
    target_date: str,
    output_dir: Path,
    skip_video: bool = False,
) -> RenderedVideo:
    """当日の全重賞、重賞がない日は各場メインレースを1本のShortへまとめる。"""

    if not races:
        raise ValueError("日次Shortsの対象レースがありません")
    stable_id = "daily_short"
    video_dir = output_dir / "shorts" / stable_id
    video_dir.mkdir(parents=True, exist_ok=True)
    tiktok_video_dir = video_dir / "tiktok-clean"
    tiktok_video_dir.mkdir(parents=True, exist_ok=True)
    size = (1080, 1920)
    utm_content = "daily_short_compilation"
    render_omissions: List[dict] = []
    renderable_races: List[RaceVideoData] = []
    with tempfile.TemporaryDirectory(prefix="short-preflight-", dir=video_dir) as temp_dir:
        preflight_root = Path(temp_dir)
        for race in races:
            try:
                for branded in (True, False):
                    for include_cta in (False, True):
                        race_dir = (
                            preflight_root
                            / _safe_filename(race.id)
                            / ("brand" if branded else "clean")
                            / ("cta" if include_cta else "combined")
                        )
                        race_dir.mkdir(parents=True, exist_ok=True)
                        _build_short_motion_scene(
                            race_dir,
                            race,
                            target_date,
                            _best_horse_for_race(race),
                            None,
                            None,
                            branded=branded,
                            include_cta=include_cta,
                            duration_seconds=(
                                None if include_cta else SHORT_COMBINED_RACE_SECONDS
                            ),
                        )
            except Exception as exc:
                render_omissions.append(
                    {
                        "race_id": race.id,
                        "venue_name": race.venue_name,
                        "race_number": race.race_number,
                        "race_name": race.display_name,
                        "grade": race.grade or "",
                        "reason": f"描画失敗: {type(exc).__name__}: {str(exc)[:160]}",
                        "category": "render_error",
                    }
                )
                continue
            renderable_races.append(race)
    races = renderable_races
    if not races:
        raise RuntimeError("全対象レースの事前描画に失敗したため、日次Shortsを生成できません")
    title = _daily_short_title(races, target_date)
    lead_race = races[0]
    lead_horse = _best_horse_for_race(lead_race)
    audio_asset = resolve_audio_asset(target_date, "short", stable_id)
    sfx_assets = resolve_sfx_assets(target_date, "short", stable_id)
    publish_block_reasons: List[str] = []
    asset_warnings: List[str] = []
    if audio_asset is None:
        publish_block_reasons.append("日次Shorts用BGMが見つかりません")

    standard_scenes: List[MotionScene] = []
    tiktok_scenes: List[MotionScene] = []
    visual_assets: List[Optional[VisualAsset]] = []
    motion_video_assets: List[Optional[VideoAsset]] = []
    # Shortsプレイヤーはチャプターを解釈しないため、概要欄には出さず
    # メタデータ（収録順の記録）としてだけ保持する。
    chapter_lines: List[str] = []
    elapsed_seconds = 0.0
    intermediate_duration = _daily_short_intermediate_duration(len(races))
    for race_index, race in enumerate(races, start=1):
        race_key = f"{stable_id}_{race.id}"
        visual_asset = resolve_visual_asset(
            target_date,
            race.venue_name,
            race.race_number,
            "vertical",
            selection_key=race_key,
        )
        motion_video_asset = resolve_video_asset(
            target_date,
            race.venue_name,
            race.race_number,
            "vertical",
            selection_key=race_key,
        )
        visual_assets.append(visual_asset)
        motion_video_assets.append(motion_video_asset)
        if visual_asset is None:
            asset_warnings.append(
                f"{race.venue_name}{race.race_number}Rは代替背景を使用"
            )
        include_cta = race_index == len(races)
        chapter_lines.append(
            f"{_format_chapter_timestamp(elapsed_seconds)} "
            f"{race.venue_name}{race.race_number}R {race.display_name}"
        )
        standard_scene_dir = video_dir if race_index == 1 else video_dir / f"race_{race_index:02d}"
        standard_scene_dir.mkdir(parents=True, exist_ok=True)
        scene = _build_short_motion_scene(
            standard_scene_dir,
            race,
            target_date,
            _best_horse_for_race(race),
            visual_asset,
            motion_video_asset,
            branded=True,
            include_cta=include_cta,
            duration_seconds=intermediate_duration if not include_cta else None,
        )
        _attach_short_audio_cues(scene, sfx_assets, include_cta=include_cta)
        standard_scenes.append(scene)

        tiktok_scene_dir = (
            tiktok_video_dir
            if race_index == 1
            else tiktok_video_dir / f"race_{race_index:02d}"
        )
        tiktok_scene_dir.mkdir(parents=True, exist_ok=True)
        tiktok_scene = _build_short_motion_scene(
            tiktok_scene_dir,
            race,
            target_date,
            _best_horse_for_race(race),
            visual_asset,
            motion_video_asset,
            branded=False,
            include_cta=include_cta,
            duration_seconds=intermediate_duration if not include_cta else None,
        )
        _attach_short_audio_cues(tiktok_scene, sfx_assets, include_cta=include_cta)
        tiktok_scenes.append(tiktok_scene)
        elapsed_seconds += scene.duration_seconds

    total_duration_seconds = sum(scene.duration_seconds for scene in standard_scenes)
    if total_duration_seconds > SHORT_MAX_COMPILATION_SECONDS + 0.01:
        raise RuntimeError(
            "日次Shortsが59.5秒を超えています: "
            f"{total_duration_seconds:.3f}秒"
        )

    thumbnail = video_dir / "thumbnail.jpg"
    grade_races = [race for race in races if race.is_grade_race]
    thumbnail_title = (
        f"重賞{len(grade_races)}レース AI予想"
        if grade_races
        else f"各競馬場{len(races)}レース AI予想"
    )
    _draw_thumbnail(
        thumbnail,
        thumbnail_title,
        "1本でまとめて確認",
        target_date,
        (1920, 1080),
        hero_horse=lead_horse,
        venue_name=lead_race.venue_name,
        race_number=lead_race.race_number,
        grade=lead_race.grade or "",
        visual_asset=visual_assets[0],
    )

    video_path: Optional[Path] = video_dir / f"{stable_id}.mp4"
    tiktok_video_path: Optional[Path] = tiktok_video_dir / f"{stable_id}_clean.mp4"
    if skip_video:
        video_path = None
        tiktok_video_path = None
    else:
        render_motion_video(standard_scenes, video_path, *size, audio_asset=audio_asset)
        render_motion_video(tiktok_scenes, tiktok_video_path, *size, audio_asset=audio_asset)

    url = build_video_url(target_date)
    description = _daily_compilation_description(
        title=title,
        url=url,
        venues=venues,
        target_date=target_date,
        short_races=races,
        additional_excluded_labels=[
            f"{item['venue_name']}{item['race_number']}R {item['race_name']}"
            for item in render_omissions
        ],
    )
    tags = _dedupe_tags([
        "競馬",
        "AI予想",
        "競馬予想",
        "AI競馬予想",
        "Shorts",
        "UMA-FREE",
        *_grade_race_intent_tags([race for race in races if race.is_grade_race]),
        *_grade_tags([race for race in races if race.is_grade_race]),
        *_venue_intent_tags([race.venue_name for race in races]),
        _date_tag(target_date),
        *_race_condition_tags(races),
    ])
    course_assets: dict[str, CourseAsset] = {}
    for race in races:
        course_asset = resolve_course_asset(race.venue_name, race.course_type or "")
        if course_asset is not None:
            course_assets[course_asset.asset_id] = course_asset
    selected_assets = {
        "brand_logo": _brand_logo_metadata(),
        "race_images": [visual_asset_metadata(asset) for asset in visual_assets],
        "background_videos": [video_asset_metadata(asset) for asset in motion_video_assets],
        "bgm": audio_asset_metadata(audio_asset),
        "sfx": [audio_asset_metadata(asset) for asset in sfx_assets.values()],
        "courses": [course_asset_metadata(asset) for asset in course_assets.values()],
    }
    featured_races = [
        {
            "race_id": race.id,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.display_name,
            "grade": race.grade or "",
            "destination_path": build_race_path(target_date),
        }
        for race in races
    ]
    rights_manifest_hash = build_rights_manifest_hash(selected_assets)
    content_hash = build_content_hash(
        {
            "video_type": "short",
            "stable_id": stable_id,
            "target_date": target_date,
            "title": title,
            "description": description,
            "tags": tags,
            "race_ids": [race.id for race in races],
            "render_omissions": render_omissions,
            "destination_url": url,
            "rights_manifest_hash": rights_manifest_hash,
            "design_system": "broadcast_editorial_v9_daily_compilation",
            "motion_profile": resolve_motion_profile(),
        }
    )
    metadata_path = video_dir / "metadata.json"
    compilation_label = (
        f"重賞{len(grade_races)}レースまとめ"
        if grade_races
        else f"各競馬場メイン{len(races)}レースまとめ"
    )
    metadata = {
        "video_type": "short",
        "stable_id": stable_id,
        "title": title,
        "description": description,
        "tags": tags,
        "target_date": target_date,
        "venue_name": lead_race.venue_name,
        "race_ids": [race.id for race in races],
        "render_omissions": render_omissions,
        "featured_races": featured_races,
        "aspect_ratio": "9:16",
        "url": url,
        "video_path": str(video_path) if video_path else None,
        "variant_video_paths": {
            "standard": str(video_path) if video_path else None,
            "tiktok_clean": str(tiktok_video_path) if tiktok_video_path else None,
        },
        "thumbnail_path": str(thumbnail),
        "vertical_cover_path": str(video_dir / "000_intro.png"),
        "destination_path": build_race_path(target_date),
        "race_number": lead_race.race_number,
        "race_name": compilation_label,
        "utm_content": utm_content,
        "chapters": chapter_lines,
        "rights_manifest_hash": rights_manifest_hash,
        "content_hash": content_hash,
        "thumbnail_required": False,
        "publish_order": 1,
        "publishable": not publish_block_reasons,
        "publish_block_reasons": publish_block_reasons,
        "selected_assets": selected_assets,
        "asset_warnings": asset_warnings,
        "design_system": "broadcast_editorial_v9_daily_compilation",
        "motion_profile": resolve_motion_profile(),
        "scene_count": len(standard_scenes),
        "estimated_duration_seconds": total_duration_seconds,
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
        publish_offset_minutes=0,
        publishable=not publish_block_reasons,
        publish_block_reasons=publish_block_reasons,
        selected_assets=selected_assets,
        target_date=target_date,
        venue_name=lead_race.venue_name,
        race_ids=[race.id for race in races],
        aspect_ratio="9:16",
        destination_url=url,
        destination_path=build_race_path(target_date),
        utm_content=utm_content,
        race_number=lead_race.race_number,
        race_name=compilation_label,
        featured_races=featured_races,
        vertical_cover_path=video_dir / "000_intro.png",
        variant_video_paths={
            **({"standard": video_path} if video_path else {}),
            **({"tiktok_clean": tiktok_video_path} if tiktok_video_path else {}),
        },
        rights_manifest_hash=rights_manifest_hash,
        content_hash=content_hash,
        thumbnail_required=False,
        estimated_duration_seconds=total_duration_seconds,
    )
