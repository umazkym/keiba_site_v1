"""動画の場面を、サイト・SNS画像と同じ色・書体・部品で描く（デザイン改修 2026-09 段階6）。

ポートフォリオ「YouTube・縦動画」（sns.mjs の ytThumb・ytLong・short）を実装したもの。
- 長尺（1920×1080）：導入 → 競馬場の章 → レース（上位5頭と展開予測）→ 締め。サムネイルは 1280×720。
- Shorts（1080×1920）：1レースを 表紙（AI偏差値1位）→ 上位5頭 → 序盤の位置取り の順に見せ、
  最後のレースだけ締めを付ける。TikTok 用の版（branded=False）は、ロゴ・案内役の馬・サイトへの案内を焼き込まない。
- 部品（会場×Rの札・グレード・枠色の馬番・印・AI偏差値の行）は sns_images.py と同じ関数を使い、
  暗い面の版・コース図・4つの視点だけここで足す。
- 動く部分は要素ごとの透過PNGにし、motion.py が時間差で重ねる。どの画像も2倍で描いて縮小する。
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from .. import brand_tokens as T
from ..sns_content import JRA_VENUES, WEEKDAYS, HorseRow, RaceCard, date_label, grade_priority, parse_date, race_card_from_api
from ..sns_images import SCALE, Canvas, _logo, center_lane_rows, grade_badge, horse_no, lockup, mark_glyph, plate, rank_row, score_bar
from .data_loader import RaceVideoData
from .motion import MotionLayer, MotionScene
from .visual_assets import VideoAsset, VisualAsset

BACKEND_DIR = Path(__file__).resolve().parents[2]
VIDEO_ASSET_DIR = BACKEND_DIR / "assets" / "video"
# サイトのコース図（CourseGlyph）と同じデータを読む。GitHub Actions でもリポジトリ全体を取得している。
COURSE_SHAPES_PATH = BACKEND_DIR.parent / "frontend" / "lib" / "course-shapes.ts"

LONG_SIZE = (1920, 1080)
SHORT_SIZE = (1080, 1920)
THUMBNAIL_SIZE = (1280, 720)

# Shorts：中身の列は画面の中央（左右90px）。YouTube の右の操作ボタン（いいね・コメント）の下に数字が入らないよう、
# 行や札の内側で右に余白を取り、数字の右端を SHORT_SAFE_RIGHT までにする（列そのものは左へ寄せない）。
SHORT_LEFT = 90
SHORT_RIGHT = 990
SHORT_WIDTH = SHORT_RIGHT - SHORT_LEFT
SHORT_SAFE_RIGHT = 948
SHORT_INNER_PAD = SHORT_RIGHT - SHORT_SAFE_RIGHT
SHORT_HEADER_TOP = 240
SHORT_CONTENT_BOTTOM = 1500
# 文字・数字・札を置いてよい範囲（下の題名・説明の上まで）
SHORT_SAFE_BOX = (SHORT_LEFT - 4, 230, SHORT_RIGHT + 4, 1540)

FOUR_VIEWS = (("AI偏差値", "gauge"), ("対戦成績", "swords"), ("展開予測", "lanes"), ("馬番の傾向", "bars"))
LANES = ("先行", "中団", "後方")
LONG_FOOTER_TEXT = "対戦成績・馬番の傾向は概要欄のサイトで確認できます"

Color = tuple  # (r, g, b) または (r, g, b, a)


def white(alpha: float) -> tuple[int, int, int, int]:
    return (255, 255, 255, round(255 * alpha))


def tint(color: Sequence[int], alpha: float) -> tuple[int, int, int, int]:
    return (int(color[0]), int(color[1]), int(color[2]), round(255 * alpha))


# ---------------------------------------------------------------------------
# 描く面
# ---------------------------------------------------------------------------
class VideoCanvas(Canvas):
    """sns_images.Canvas を動画用に広げたもの。transparent=True で透過のレイヤー（RGBA）を描く。

    Pillow は透過の面の上に描くと色を上書きし、文字の縁が黒ずむ。形と文字をいったんマスクに描き、
    その形で色を重ねる（半透明の色も下の絵に正しく重なる）。
    """

    def __init__(self, width: int, height: int, background: Color = T.NIGHT, *, transparent: bool = False) -> None:
        self.width = width
        self.height = height
        self.transparent = transparent
        if transparent:
            self.image = Image.new("RGBA", (width * SCALE, height * SCALE), (0, 0, 0, 0))
        else:
            self.image = Image.new("RGB", (width * SCALE, height * SCALE), tuple(background[:3]))
        self.draw = ImageDraw.Draw(self.image)

    # ---- 重ね方 ----
    def _apply_mask(self, left: int, top: int, mask: Image.Image, color: Color) -> None:
        alpha = color[3] if len(color) > 3 else 255
        if alpha < 255:
            mask = mask.point(lambda value, a=alpha: value * a // 255)
        rgb = tuple(int(v) for v in color[:3])
        if self.transparent:
            patch = Image.new("RGBA", mask.size, (*rgb, 255))
            patch.putalpha(mask)
            self.image.alpha_composite(patch, (left, top))
        else:
            self.image.paste(rgb, (left, top, left + mask.width, top + mask.height), mask)

    def _paint(self, box: Sequence[float], color: Optional[Color], shape: Callable[[ImageDraw.ImageDraw, int, int], None]) -> None:
        if color is None:
            return
        left = max(0, math.floor(box[0]) - 3)
        top = max(0, math.floor(box[1]) - 3)
        right = min(self.image.width, math.ceil(box[2]) + 3)
        bottom = min(self.image.height, math.ceil(box[3]) + 3)
        if right <= left or bottom <= top:
            return
        mask = Image.new("L", (right - left, bottom - top), 0)
        shape(ImageDraw.Draw(mask), left, top)
        self._apply_mask(left, top, mask, color)

    # ---- 形 ----
    def rect(
        self,
        box: Sequence[float],
        *,
        radius: float = 0,
        fill: Optional[Color] = None,
        outline: Optional[Color] = None,
        width: float = 0,
    ) -> None:
        scaled = [self._s(v) for v in box]
        corner = self._s(radius)

        def shape(**kwargs):
            def paint(draw: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
                local = (scaled[0] - ox, scaled[1] - oy, scaled[2] - ox, scaled[3] - oy)
                if corner:
                    draw.rounded_rectangle(local, radius=corner, **kwargs)
                else:
                    draw.rectangle(local, **kwargs)
            return paint

        self._paint(scaled, fill, shape(fill=255))
        if outline is not None and width:
            self._paint(scaled, outline, shape(outline=255, width=max(1, self._s(width))))

    def circle(
        self,
        cx: float,
        cy: float,
        radius: float,
        *,
        fill: Optional[Color] = None,
        outline: Optional[Color] = None,
        width: float = 0,
    ) -> None:
        box = [self._s(cx - radius), self._s(cy - radius), self._s(cx + radius), self._s(cy + radius)]

        def shape(**kwargs):
            return lambda draw, ox, oy: draw.ellipse((box[0] - ox, box[1] - oy, box[2] - ox, box[3] - oy), **kwargs)

        self._paint(box, fill, shape(fill=255))
        if outline is not None and width:
            self._paint(box, outline, shape(outline=255, width=max(1, self._s(width))))

    def line(self, points: Sequence[float], fill: Color, width: float = 1) -> None:
        scaled = [self._s(v) for v in points]
        stroke = max(1, self._s(width))
        xs, ys = scaled[0::2], scaled[1::2]
        box = (min(xs) - stroke, min(ys) - stroke, max(xs) + stroke, max(ys) + stroke)
        self._paint(
            box,
            fill,
            lambda draw, ox, oy: draw.line([(x - ox, y - oy) for x, y in zip(xs, ys)], fill=255, width=stroke),
        )

    # ---- 文字 ----
    def text(self, x: float, y: float, text: str, kind: str, size: float, fill: Color, anchor: str = "lm") -> float:
        font = self.font(kind, size)
        position = (self._s(x), self._s(y))
        box = self.draw.textbbox(position, text, font=font, anchor=anchor)
        self._paint(
            box,
            fill,
            lambda draw, ox, oy: draw.text((position[0] - ox, position[1] - oy), text, font=font, fill=255, anchor=anchor),
        )
        return self.text_width(text, kind, size)

    def text_center(self, cx: float, cy: float, text: str, kind: str, size: float, fill: Color) -> None:
        font = self.font(kind, size)
        left, top, right, bottom = self.draw.textbbox((0, 0), text, font=font, anchor="ls")
        position = (self._s(cx) - (left + right) / 2, self._s(cy) - (top + bottom) / 2)
        box = self.draw.textbbox(position, text, font=font, anchor="ls")
        self._paint(
            box,
            fill,
            lambda draw, ox, oy: draw.text((position[0] - ox, position[1] - oy), text, font=font, fill=255, anchor="ls"),
        )

    # ---- 画像 ----
    def paste_image(self, image: Image.Image, x: float, y: float, size: Optional[tuple[float, float]] = None) -> None:
        picture = image.convert("RGBA")
        if size is not None:
            picture = picture.resize((max(1, self._s(size[0])), max(1, self._s(size[1]))), Image.Resampling.LANCZOS)
        left, top = self._s(x), self._s(y)
        if left < 0 or top < 0:
            picture = picture.crop((max(0, -left), max(0, -top), picture.width, picture.height))
            left, top = max(0, left), max(0, top)
        if self.transparent:
            self.image.alpha_composite(picture, (left, top))
        else:
            self.image.paste(picture, (left, top), picture)

    def paste_logo(self, x: float, y: float, size: float) -> None:
        self.paste_image(_logo(self._s(size)), x, y)

    def shadow(self, box: Sequence[float], *, radius: float, offset: float = 12, blur: float = 20, alpha: float = 0.3) -> None:
        """白い札の下の影（写真の上のサムネイル用）。"""
        spread = self._s(blur * 2)
        left, top, right, bottom = (self._s(v) for v in box)
        mask = Image.new("L", (right - left + spread * 2, bottom - top + spread * 2), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (spread, spread, spread + right - left, spread + bottom - top), radius=self._s(radius), fill=255
        )
        mask = mask.filter(ImageFilter.GaussianBlur(self._s(blur) / 2))
        self._apply_mask(left - spread, top - spread + self._s(offset), mask, (0, 0, 0, round(255 * alpha)))

    def save(self, path: Path | str, *, fmt: str = "PNG") -> Path:
        output = self.image.resize((self.width, self.height), Image.Resampling.LANCZOS)
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if fmt.upper() == "JPEG":
            output.convert("RGB").save(path, "JPEG", quality=90, optimize=True, progressive=True)
        else:
            output.save(path, "PNG", compress_level=4)
        return path


def element(path: Path, size: tuple[float, float], draw: Callable[[VideoCanvas], None]) -> Path:
    """1つの要素を、その大きさの透過PNGに描く（重ねる位置は MotionLayer の x・y）。"""
    canvas = VideoCanvas(max(1, math.ceil(size[0])), max(1, math.ceil(size[1])), transparent=True)
    draw(canvas)
    return canvas.save(path)


# ---------------------------------------------------------------------------
# 素材
# ---------------------------------------------------------------------------
@lru_cache(maxsize=16)
def video_asset(name: str) -> Image.Image:
    return Image.open(VIDEO_ASSET_DIR / f"{name}.png").convert("RGBA")


@lru_cache(maxsize=1)
def course_shapes() -> dict[str, dict]:
    """frontend/lib/course-shapes.ts の24場。bbox は [左, 上, 右, 下]。"""
    text = COURSE_SHAPES_PATH.read_text(encoding="utf-8")
    pattern = re.compile(r'"([^"]+)": \{ bbox: \[([^\]]+)\], turf: (null|"[^"]*"), dirt: (null|"[^"]*") \}')
    shapes: dict[str, dict] = {}
    for name, bbox, turf, dirt in pattern.findall(text):
        shapes[name] = {
            "bbox": [float(value) for value in bbox.split(",")],
            "turf": None if turf == "null" else turf.strip('"'),
            "dirt": None if dirt == "null" else dirt.strip('"'),
        }
    return shapes


def _subpaths(path_data: str) -> list[list[tuple[float, float]]]:
    """「M… L… Z」だけの輪郭を多角形の並びにする。"""
    polygons: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for command, body in re.findall(r"([MLZ])([^MLZ]*)", path_data):
        numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", body)]
        points = list(zip(numbers[0::2], numbers[1::2]))
        if command == "M":
            if len(current) >= 3:
                polygons.append(current)
            current = points
        elif command == "L":
            current.extend(points)
        else:
            if len(current) >= 3:
                polygons.append(current)
            current = []
    if len(current) >= 3:
        polygons.append(current)
    return polygons


def course_glyph_size(venue: str, max_width: float, max_height: float) -> Optional[tuple[float, float]]:
    shape = course_shapes().get(venue)
    if not shape:
        return None
    left, top, right, bottom = shape["bbox"]
    view_w, view_h = right - left + 28, bottom - top + 28
    scale = min(max_width / view_w, max_height / view_h)
    return view_w * scale, view_h * scale


def course_glyph(c: VideoCanvas, venue: str, x: float, y: float, width: float, *, active: Optional[str] = None) -> float:
    """サイトの CourseGlyph と同じ塗り（芝＝緑、ダート＝茶、今回のコース以外は淡く）。高さを返す。"""
    shape = course_shapes().get(venue)
    if not shape:
        return 0
    left, top, right, bottom = shape["bbox"]
    pad = 14
    view_w, view_h = right - left + pad * 2, bottom - top + pad * 2
    scale = c._s(width) / view_w
    height = width * view_h / view_w
    turf_on = not active or active == "turf"
    dirt_on = not active or active == "dirt"
    fills = (("turf", T.TURF if turf_on else T.hex_to_rgb("#BCD9C6")), ("dirt", T.DIRT if dirt_on else T.hex_to_rgb("#E3CDB5")))
    origin_x, origin_y = c._s(x), c._s(y)
    size = (max(1, math.ceil(c._s(width))), max(1, math.ceil(c._s(height))))
    for key, color in fills:
        data = shape[key]
        if not data:
            continue
        mask = Image.new("L", size, 0)
        for polygon in _subpaths(data):
            piece = Image.new("L", size, 0)
            ImageDraw.Draw(piece).polygon(
                [((px - left + pad) * scale, (py - top + pad) * scale) for px, py in polygon], fill=255
            )
            mask = ImageChops.difference(mask, piece)  # 塗りの規則 evenodd（内側の穴を抜く）
        c._apply_mask(origin_x, origin_y, mask, color)
    return height


def surface_key(course_type: Optional[str]) -> str:
    text = str(course_type or "")
    return "dirt" if "ダ" in text else "turf"


# ---------------------------------------------------------------------------
# 部品（暗い面の版など）
# ---------------------------------------------------------------------------
def race_card(race: RaceVideoData) -> RaceCard:
    """動画用のレースを、SNS画像と同じ並び（AI偏差値の高い順・位置取り・印）のカードにする。"""
    predictions = [
        {
            "horse_number": horse.horse_number,
            "waku_number": horse.waku_number,
            "horse_name": horse.horse_name,
            "deviation_score": horse.deviation_score,
            "mark": horse.mark,
            "start_1c_indicator": horse.start_1c_indicator,
        }
        for horse in race.predictions
        if horse.horse_number > 0
    ]
    return race_card_from_api(
        {
            "id": race.id,
            "race_date": race.race_date,
            "venue_name": race.venue_name,
            "race_number": race.race_number,
            "race_name": race.race_name,
            "grade": race.grade,
            "course_type": race.course_type,
            "distance": race.distance,
            "total_horses": len(predictions),
            "predictions": predictions,
            "horse_number_advantages": race.horse_number_advantages,
        }
    )


def meta_line(card: RaceCard, date_text: str) -> str:
    parts = [date_text]
    if card.course:
        parts.append(card.course)
    if card.runners:
        parts.append(f"{card.runners}頭")
    return " · ".join(parts)


def short_date(value: str) -> str:
    """「9/20(日)」"""
    day = parse_date(value)
    return f"{day.month}/{day.day}({WEEKDAYS[day.weekday()]})"


def long_date(value: str) -> str:
    """「2026年9月20日(日)」"""
    return f"{str(value)[:4]}年{date_label(value)}"


def r_box(c: VideoCanvas, x: float, y: float, size: float, number: int, *, light: bool = False) -> None:
    """R番号の札（ポートフォリオの rBox）。"""
    background, foreground = (T.WHITE, T.NAVY) if light else (T.NAVY, T.WHITE)
    c.rect((x, y, x + size, y + size), radius=size * 0.24, fill=background)
    number_text = str(number)
    number_size, r_size = size * 0.5, size * 0.28
    total = c.text_width(number_text, "num", number_size) + 1 + c.text_width("R", "num", r_size)
    left = x + (size - total) / 2
    baseline = y + size * 0.7
    c.text(left, baseline, number_text, "num", number_size, foreground, anchor="ls")
    c.text(left + c.text_width(number_text, "num", number_size) + 1, baseline, "R", "num", r_size, foreground, anchor="ls")


def score_bar_dark(c: VideoCanvas, x: float, cy: float, width: float, height: float, score: Optional[float], *, highlight: bool = False) -> None:
    c.rect((x, cy - height / 2, x + width, cy + height / 2), radius=height / 2, fill=white(0.16))
    if score is None:
        return
    ratio = max(0.04, min(1.0, (score - 30) / 50))
    c.rect((x, cy - height / 2, x + width * ratio, cy + height / 2), radius=height / 2, fill=T.AI if highlight else T.BRAND)


def rank_row_dark(
    c: VideoCanvas,
    x: float,
    y: float,
    width: float,
    row: HorseRow,
    index: int,
    *,
    s: float = 1.0,
    bar_width: float = 260,
    right_pad: float = 0,
) -> float:
    """夜の紺の上の AI偏差値の順位の行（sns_images.rank_row の暗い面の版）。高さを返す。

    right_pad：行の面は幅いっぱいに描き、数字と棒だけ右に余白を取る（Shorts の操作ボタンの下を避ける）。
    """
    height = 80 * s
    highlight = index == 0
    c.rect(
        (x, y, x + width, y + height),
        radius=16 * s,
        fill=tint(T.AI, 0.16) if highlight else white(0.07),
        outline=T.AI if highlight else white(0.14),
        width=2 if highlight else 1,
    )
    cy = y + height / 2
    cursor = x + 18 * s
    c.text(cursor, cy, str(index + 1), "num", 30 * s, T.AI if highlight else T.ON_NIGHT_FAINT)
    cursor += 52 * s
    mark_glyph(c, cursor + 14 * s, cy, row.mark, 28 * s, dark=True)
    cursor += 46 * s
    horse_no(c, cursor + 20 * s, cy, 40 * s, row.number, row.waku)
    cursor += 58 * s
    right = x + width - 18 * s - right_pad
    bar = bar_width * s * 0.5
    name, name_size = c.fit(row.name, "disp", 32 * s, right - bar - 18 * s - cursor, 22 * s)
    c.text(cursor, cy, name, "disp", name_size, T.WHITE)
    score_text = f"{row.score:.1f}" if row.score is not None else "--"
    c.text(right, cy - 6 * s, score_text, "num", 40 * s, T.AI if highlight else T.WHITE, anchor="rm")
    score_bar_dark(c, right - bar, cy + 22 * s, bar, 7 * s, row.score, highlight=highlight)
    return height


@dataclass
class LanePlan:
    """位置取りの図の並べ方。lanes は (段の名前, [(馬, 左からの位置, 行)], 段の高さ, 段の行数)。"""

    lanes: list[tuple[str, list[tuple[HorseRow, float, int]], float, int]]
    height: float
    unknown: int
    size: float
    label_width: float
    right_pad: float


def plan_lanes(
    card: RaceCard,
    width: float,
    *,
    size: float,
    label_width: float,
    right_pad: float = 0,
) -> Optional[LanePlan]:
    """序盤の位置取りの並べ方。段ごとに馬番の小さい順に左から並べ、段の中で横の中央にそろえる（入らなければ折り返す）。
    サイトの展開予測と同じ（2026-09-26。以前は右ほど前で、重なる馬を下の行へずらしていた）。"""
    rows_by_lane = {lane: [row for row in card.rows if row.position == lane] for lane in LANES}
    if not any(rows_by_lane.values()):
        return None
    # 左の段の名前と同じ幅を右にも空け、馬の並びを図の真ん中にそろえる
    usable = width - 2 * label_width - right_pad
    lanes: list[tuple[str, list[tuple[HorseRow, float, int]], float, int]] = []
    total = 6.0
    for lane in LANES:
        placed, rows = center_lane_rows(rows_by_lane[lane], label_width, usable, size)
        lane_height = rows * (size + 8) + 16
        lanes.append((lane, placed, lane_height, rows))
        total += lane_height
    total += lanes_footer_height(size)
    unknown = sum(1 for row in card.rows if row.number and not row.position)
    return LanePlan(lanes=lanes, height=total, unknown=unknown, size=size, label_width=label_width, right_pad=right_pad)


def lanes_footer_height(size: float) -> float:
    return size * 0.5 + 20


def stretch_lanes(plan: LanePlan, height: float) -> LanePlan:
    """図の高さを height にそろえる。余りは段の行数に比例して足し（馬のいない段だけが広がらない）、馬は段の中で上下の中央に置く。"""
    extra = height - plan.height
    if extra <= 0:
        return plan
    weights = [rows if placed else 0.5 for _, placed, _, rows in plan.lanes]
    total = sum(weights)
    lanes = [
        (lane, placed, lane_height + extra * weight / total, rows)
        for (lane, placed, lane_height, rows), weight in zip(plan.lanes, weights)
    ]
    return LanePlan(lanes=lanes, height=height, unknown=plan.unknown, size=plan.size, label_width=plan.label_width, right_pad=plan.right_pad)


def lanes_legend(plan: LanePlan) -> str:
    legend = "琥珀の輪はAI偏差値の上位3頭"
    if plan.unknown:
        legend += f" · 予測なし{plan.unknown}頭"
    return legend


def draw_lanes(c: VideoCanvas, x: float, y: float, width: float, plan: LanePlan, *, dark: bool = False) -> float:
    """位置取りの図。AI偏差値の上位3頭に琥珀の輪。下の行に凡例（進行方向の文字は出さない。2026-09-26）。高さを返す。"""
    size = plan.size
    background = white(0.06) if dark else T.TURF_SOFT
    label_color = T.ON_NIGHT_TEXT if dark else T.TURF_DEEP
    separator = white(0.10) if dark else tint(T.TURF_DEEP, 0.18)
    c.rect((x, y, x + width, y + plan.height), radius=size * 0.5, fill=background)
    cursor = y + 6
    for index, (lane, placed, lane_height, rows) in enumerate(plan.lanes):
        c.text(x + size * 0.5, cursor + lane_height / 2, lane, "bold", size * 0.6, label_color)
        top = cursor + (lane_height - (rows * (size + 8) - 8)) / 2
        for row, px, slot in placed:
            cx = x + px + size / 2
            cy = top + slot * (size + 8) + size / 2
            if row.ai_rank and row.ai_rank <= 3:
                c.circle(cx, cy, size / 2 + 5, outline=T.AI, width=size * 0.1)
            horse_no(c, cx, cy, size, row.number, row.waku)
        cursor += lane_height
        if index < len(plan.lanes) - 1:
            c.line((x, cursor, x + width, cursor), separator, 1.5)
    footer_cy = cursor + lanes_footer_height(size) / 2
    text_size = size * 0.46
    legend, legend_size = c.fit(lanes_legend(plan), "bold", text_size, width - size - plan.right_pad - 24, text_size * 0.8)
    c.text(x + size * 0.5, footer_cy, legend, "bold", legend_size, T.AI if dark else T.AI_DEEP)
    return plan.height


def view_chip_width(c: VideoCanvas, label: str, *, size: float, icon: float, pad: float) -> float:
    return pad + icon + size * 0.42 + c.text_width(label, "bold", size) + pad


def view_chip(c: VideoCanvas, x: float, y: float, width: float, height: float, label: str, icon_name: str, *, size: float, icon: float, pad: float) -> None:
    """4つの視点の札（夜の紺の上）。"""
    c.rect((x, y, x + width, y + height), radius=height * 0.24, fill=white(0.08), outline=white(0.14), width=2)
    c.paste_image(video_asset(f"icon-{icon_name}"), x + pad, y + (height - icon) / 2, (icon, icon))
    c.text(x + pad + icon + size * 0.42, y + height / 2, label, "bold", size, T.WHITE)


def lockup_width(c: VideoCanvas, size: float) -> float:
    return size + size * 0.28 + c.text_width("UMA-FREE", "disp", size * 0.56)


# ---------------------------------------------------------------------------
# 背景
# ---------------------------------------------------------------------------
def cover_crop(source: Image.Image, size: tuple[int, int], focus: tuple[float, float]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    resized = source.resize(
        (max(target_w, round(source.width * scale)), max(target_h, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = max(0, min(resized.width - target_w, round(focus[0] * resized.width - target_w / 2)))
    top = max(0, min(resized.height - target_h, round(focus[1] * resized.height - target_h / 2)))
    return resized.crop((left, top, left + target_w, top + target_h))


def photo(size: tuple[int, int], asset: Optional[VisualAsset]) -> Optional[Image.Image]:
    if asset is None:
        return None
    try:
        with Image.open(asset.path) as source:
            return cover_crop(source.convert("RGB"), size, asset.focus)
    except OSError as exc:
        raise RuntimeError(f"動画用写真を読み込めません: {asset.path} ({exc})") from exc


def gradient_mask(size: tuple[int, int], stops: Sequence[tuple[float, float]], *, horizontal: bool = True) -> Image.Image:
    """夜の紺の幕の濃さ（stops は (位置0〜1, 不透明度0〜1)）。"""
    length = size[0] if horizontal else size[1]
    values = []
    for i in range(length):
        position = i / max(1, length - 1)
        value = stops[-1][1]
        for (p0, a0), (p1, a1) in zip(stops, stops[1:]):
            if p0 <= position <= p1:
                value = a0 + (a1 - a0) * (0 if p1 == p0 else (position - p0) / (p1 - p0))
                break
        values.append(round(255 * value))
    if horizontal:
        line = Image.new("L", (length, 1))
        line.putdata(values)
        return line.resize(size)
    line = Image.new("L", (1, length))
    line.putdata(values)
    return line.resize(size)


# ポートフォリオの幕：linear-gradient(90deg, .95 0%, .72 55%, .15 100%)
INTRO_SCRIM = ((0.0, 0.95), (0.55, 0.72), (1.0, 0.15))
THUMBNAIL_SCRIM = ((0.0, 0.96), (0.55, 0.70), (1.0, 0.15))


def photo_with_scrim(size: tuple[int, int], asset: Optional[VisualAsset], stops: Sequence[tuple[float, float]]) -> Image.Image:
    picture = photo(size, asset)
    night = Image.new("RGB", size, T.NIGHT)
    if picture is None:
        return night
    return Image.composite(night, picture, gradient_mask(size, stops))


def scrim_layer(path: Path, size: tuple[int, int], stops: Sequence[tuple[float, float]], *, horizontal: bool = True) -> Path:
    """背景が動画のときに重ねる幕（透過PNG）。写真の背景と同じ濃さにする。"""
    layer = Image.new("RGBA", size, (*T.NIGHT, 0))
    layer.putalpha(gradient_mask(size, stops, horizontal=horizontal))
    path.parent.mkdir(parents=True, exist_ok=True)
    layer.save(path, "PNG", compress_level=4)
    return path


def short_photo_base(asset: Optional[VisualAsset]) -> Image.Image:
    """縦動画の背景：上と中央（見出しと中身）は夜の紺で静かにし、写真の馬群（下の3割）を下の方だけ見せる。"""
    night = Image.new("RGB", SHORT_SIZE, T.NIGHT)
    picture = photo(SHORT_SIZE, asset)
    if picture is None:
        return night
    return Image.composite(night, picture, gradient_mask(SHORT_SIZE, SHORT_SCRIM, horizontal=False))


# 縦の幕の濃さ（上から下へ）。写真の指定書：上18%と中央50%は暗く静かな面、被写体は下35%。
SHORT_SCRIM = ((0.0, 0.88), (0.64, 0.92), (0.84, 0.62), (1.0, 0.38))




def compose_preview(base: Path, layers: Sequence[tuple[Path, int, int]], destination: Path) -> Path:
    with Image.open(base) as source:
        preview = source.convert("RGBA")
    for layer_path, x, y in layers:
        with Image.open(layer_path) as source:
            preview.alpha_composite(source.convert("RGBA"), (max(0, x), max(0, y)))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(destination)
    return destination


# ---------------------------------------------------------------------------
# レイヤーの並べ方
# ---------------------------------------------------------------------------
@dataclass
class Placed:
    path: Path
    x: int
    y: int
    start: float
    end: float
    enter: float = 0.28
    exit: float = 0.0
    dx: int = 0
    dy: int = 0
    z: int = 10
    reveal: float = 0.0

    def layer(self) -> MotionLayer:
        return MotionLayer(
            self.path,
            x=self.x,
            y=self.y,
            start_seconds=self.start,
            end_seconds=self.end,
            enter_duration=self.enter,
            exit_duration=self.exit,
            start_x=self.x + self.dx if self.dx else None,
            end_x=self.x if self.dx else None,
            start_y=self.y + self.dy if self.dy else None,
            end_y=self.y if self.dy else None,
            z_index=self.z,
            reveal_duration=self.reveal,
        )


def _scene(background: Path, render_background: Path, duration: float, placed: Sequence[Placed], preview: Path, scene_id: str, *, extra_layers: Sequence[MotionLayer] = ()) -> MotionScene:
    compose_preview(background, [(item.path, item.x, item.y) for item in placed if item.reveal == 0.0], preview)
    return MotionScene(
        background_path=render_background,
        duration_seconds=duration,
        preview_path=preview,
        layers=[*extra_layers, *(item.layer() for item in placed)],
        scene_id=scene_id,
    )


def _progress_bar(path: Path, width: float, height: float, color: Color) -> Path:
    return element(path, (width, height), lambda c: c.rect((0, 0, width, height), radius=height / 2, fill=color))


# ---------------------------------------------------------------------------
# 長尺（1920×1080）
# ---------------------------------------------------------------------------
def build_long_intro(
    directory: Path,
    *,
    target_date: str,
    race_count: int,
    venue_names: Sequence[str],
    asset: Optional[VisualAsset],
    video: Optional[VideoAsset],
    duration: float,
    prefix: str = "000_intro",
) -> MotionScene:
    """導入：写真＋左の幕、日付と「全Nレース AI分析」、収録の順。"""
    base_canvas = VideoCanvas(*LONG_SIZE)
    base_canvas.paste_image(photo_with_scrim(LONG_SIZE, asset, INTRO_SCRIM), 0, 0, LONG_SIZE)
    base_canvas.rect((110, 990, 1810, 1000), radius=5, fill=white(0.14))
    base = base_canvas.save(directory / f"{prefix}_base.png")

    brand = element(directory / f"{prefix}_brand.png", (640, 90), lambda c: lockup(c, 0, 45, 72, dark=True))

    def title(c: VideoCanvas) -> None:
        c.text(0, 30, long_date(target_date), "bold", 44, T.ON_NIGHT_TEXT)
        c.text(0, 160, f"全{race_count}レース", "disp", 150, T.WHITE)
        c.text(0, 318, "AI分析", "disp", 150, T.AI)

    title_path = element(directory / f"{prefix}_title.png", (1700, 420), title)
    scope_text = "・".join(venue_names) + "の順に収録"

    def scope(c: VideoCanvas) -> None:
        fitted, size = c.fit(scope_text, "bold", 44, 1700, 30)
        c.text(0, 32, fitted, "bold", size, T.ON_NIGHT_TEXT)

    scope_path = element(directory / f"{prefix}_scope.png", (1700, 64), scope)
    bar = _progress_bar(directory / f"{prefix}_progress.png", 1700, 10, T.BRAND)
    placed = [
        Placed(brand, 110, 81, 0.0, duration, enter=0.3),
        Placed(title_path, 110, 330, 0.08, duration, enter=0.36, dx=-60),
        Placed(scope_path, 110, 760, 0.42, duration, enter=0.3, dy=20),
        Placed(bar, 110, 990, 0.0, duration, enter=0.0, reveal=duration, z=20),
    ]
    extra: list[MotionLayer] = []
    render_background = base
    if video is not None:
        render_background = video.path
        scrim = scrim_layer(directory / f"{prefix}_video_scrim.png", LONG_SIZE, INTRO_SCRIM)
        track = element(directory / f"{prefix}_track.png", (1700, 10), lambda c: c.rect((0, 0, 1700, 10), radius=5, fill=white(0.14)))
        extra = [
            MotionLayer(scrim, 0, 0, 0.0, duration, enter_duration=0.0, z_index=1),
            MotionLayer(track, 110, 990, 0.0, duration, enter_duration=0.0, z_index=2),
        ]
    return _scene(base, render_background, duration, placed, directory / f"{prefix}.png", prefix, extra_layers=extra)


def build_long_chapter(
    directory: Path,
    *,
    venue_name: str,
    race_type: str,
    chapter_index: int,
    scope_text: str,
    featured: RaceVideoData,
    race_numbers: Sequence[tuple[int, bool]],
    duration: float,
    prefix: str,
) -> MotionScene:
    """競馬場の章：夜の紺。左に会場名・収録の範囲・レースの並び・注目のレース、右にコース図（上下の中央をそろえる）。"""
    base = VideoCanvas(*LONG_SIZE).save(directory / f"{prefix}_base.png")
    brand = element(directory / f"{prefix}_brand.png", (560, 76), lambda c: lockup(c, 0, 38, 60, dark=True))

    # 左の固まり：見出し(64) + 会場名(220) + 範囲(64) + 間(34) + レースの並び(64) + 間(34) + 注目のレース(118)
    block_height = 64 + 220 + 64 + 34 + 64 + 34 + 118
    area_top, area_bottom = 180, 1020
    top = round(area_top + (area_bottom - area_top - block_height) / 2)

    def heading(c: VideoCanvas) -> None:
        c.text(0, 32, f"{chapter_index}場目 · {race_type}競馬", "bold", 44, T.ON_NIGHT_FAINT)
        name, size = c.fit(venue_name, "disp", 200, 860, 120)
        c.text(0, 64 + 110, name, "disp", size, T.WHITE)
        fitted, scope_size = c.fit(scope_text, "bold", 48, 860, 32)
        c.text(0, 64 + 220 + 32, fitted, "bold", scope_size, T.ON_NIGHT_TEXT)

    heading_path = element(directory / f"{prefix}_heading.png", (860, 64 + 220 + 64), heading)

    count = max(1, len(race_numbers))
    box = min(64.0, (860 - 10 * (count - 1)) / count)

    def strip(c: VideoCanvas) -> None:
        for index, (number, included) in enumerate(race_numbers):
            left = index * (box + 10)
            if number == featured.race_number:
                r_box(c, left, 0, box, number, light=True)
                continue
            c.rect((left, 0, left + box, box), radius=box * 0.24, fill=white(0.08) if included else None, outline=white(0.24) if included else white(0.12), width=1.5)
            color = T.WHITE if included else tint(T.WHITE, 0.32)
            number_text = str(number)
            number_size, r_size = box * 0.46, box * 0.26
            total = c.text_width(number_text, "num", number_size) + 1 + c.text_width("R", "num", r_size)
            start = left + (box - total) / 2
            c.text(start, box * 0.68, number_text, "num", number_size, color, anchor="ls")
            c.text(start + c.text_width(number_text, "num", number_size) + 1, box * 0.68, "R", "num", r_size, color, anchor="ls")

    strip_width = count * box + (count - 1) * 10
    strip_path = element(directory / f"{prefix}_races.png", (strip_width, box), strip)

    card = race_card(featured)
    probe = VideoCanvas(1, 1, transparent=True)
    badge_width = (probe.text_width(card.grade, "num" if card.grade.isascii() else "bold", 34) + 34 * 1.2 + 18) if card.grade else 0
    label = "注目の重賞" if card.grade else "メインレース"
    label_width = probe.text_width(label, "bold", 30) + 24
    name, name_size = probe.fit(card.race_name, "disp", 60, 860 - 30 - label_width - 70 - 22 - badge_width - 30, 38)
    card_width = 30 + label_width + 70 + 22 + probe.text_width(name, "disp", name_size) + badge_width + 30

    def featured_card(c: VideoCanvas) -> None:
        c.rect((0, 0, card_width, 118), radius=24, fill=white(0.08), outline=white(0.14), width=2)
        c.text(30, 59, label, "bold", 30, T.ON_NIGHT_FAINT)
        r_box(c, 30 + label_width, 24, 70, card.race_number, light=True)
        text_x = 30 + label_width + 70 + 22
        c.text(text_x, 59, name, "disp", name_size, T.WHITE)
        if card.grade:
            grade_badge(c, text_x + c.text_width(name, "disp", name_size) + 18, 59, card.grade, 34)

    card_path = element(directory / f"{prefix}_card.png", (card_width, 118), featured_card)
    strip_top = top + 64 + 220 + 64 + 34
    placed = [
        Placed(brand, 110, 90, 0.0, duration, enter=0.24),
        Placed(heading_path, 110, top, 0.06, duration, enter=0.34, dx=-60),
        Placed(strip_path, 110, strip_top, 0.24, duration, enter=0.3, dx=-40),
        Placed(card_path, 110, strip_top + 64 + 34, 0.4, duration, enter=0.3, dy=24),
    ]
    glyph_box = (1060, top, 1810, top + block_height)
    glyph_size = course_glyph_size(venue_name, glyph_box[2] - glyph_box[0], glyph_box[3] - glyph_box[1])
    if glyph_size is not None:
        glyph_w, glyph_h = glyph_size
        glyph = element(directory / f"{prefix}_course.png", glyph_size, lambda c: course_glyph(c, venue_name, 0, 0, glyph_w))
        placed.append(
            Placed(
                glyph,
                round(glyph_box[0] + (glyph_box[2] - glyph_box[0] - glyph_w) / 2),
                round(glyph_box[1] + (glyph_box[3] - glyph_box[1] - glyph_h) / 2),
                0.12,
                duration,
                enter=0.5,
                dx=40,
            )
        )
    return _scene(base, base, duration, placed, directory / f"{prefix}.png", prefix)


def build_long_race(
    directory: Path,
    race: RaceVideoData,
    *,
    target_date: str,
    progress_index: int,
    progress_total: int,
    duration: float,
    prefix: str,
) -> MotionScene:
    """レース：上に会場×Rの札とレース名、左に AI偏差値の上位5頭、右に展開予測（左右の上下の端をそろえる）。

    prefix は動画の中で場面ごとに一意にする（会場をまたいで同じ名前にすると、後の会場の絵で上書きされる）。
    """
    card = race_card(race)
    base_canvas = VideoCanvas(*LONG_SIZE, background=T.BG)
    base_canvas.rect((0, 0, 1920, 150), fill=T.NIGHT)
    base_canvas.rect((0, 984, 1920, 1080), fill=T.PANEL)
    base_canvas.line((0, 985, 1920, 985), T.LINE, 2)
    base_canvas.text(90, 1032, LONG_FOOTER_TEXT, "bold", 32, T.INK2)
    base_canvas.paste_logo(1920 - 90 - 54, 1032 - 27, 54)
    base = base_canvas.save(directory / f"{prefix}_base.png")

    counter = f"{progress_index} / {progress_total}"

    def header(c: VideoCanvas) -> None:
        plate(c, 0, 33, 84, card.venue, card.race_number, tone="white")
        counter_width = c.text(1740, 75, counter, "num", 40, T.ON_NIGHT_FAINT, anchor="rm")
        c.text(114, 52, meta_line(card, date_label(card.date)), "bold", 28, T.ON_NIGHT_SUB)
        badge_width = (c.text_width(card.grade, "num" if card.grade.isascii() else "bold", 28) + 28 * 1.2 + 18) if card.grade else 0
        name, size = c.fit(card.race_name, "disp", 62, 1740 - 114 - counter_width - 60 - badge_width, 40)
        c.text(114, 106, name, "disp", size, T.WHITE)
        if card.grade:
            grade_badge(c, 114 + c.text_width(name, "disp", size) + 18, 106, card.grade, 28)

    header_path = element(directory / f"{prefix}_header.png", (1740, 150), header)
    bar = _progress_bar(directory / f"{prefix}_progress.png", 1920, 6, T.BRAND)
    top = card.scored_rows[:5]
    left_title = element(
        directory / f"{prefix}_top_title.png",
        (860, 40),
        lambda c: c.text(0, 20, f"AI偏差値 上位{len(top)}頭", "bold", 32, T.BRAND_DEEP),
    )
    placed = [
        # 見出しは切り替えの瞬間から出す（レースごとに白い面が一瞬空になると、44回のくり返しでちらつく）
        Placed(header_path, 90, 0, 0.0, duration, enter=0.0),
        Placed(bar, 0, 144, 0.0, duration, enter=0.0, reveal=duration, z=30),
        Placed(left_title, 90, LONG_TITLE_TOP, 0.0, duration, enter=0.0),
    ]
    row_height = (LONG_BODY_HEIGHT - LONG_ROW_GAP * 4) / 5
    s = row_height / 80
    for index, row in enumerate(top):
        row_path = element(
            directory / f"{prefix}_rank_{index + 1}.png",
            (860, row_height),
            lambda c, row=row, index=index: rank_row(c, 0, 0, 860, row, index, s=s, bar_width=220),
        )
        placed.append(
            Placed(row_path, 90, round(LONG_BODY_TOP + index * (row_height + LONG_ROW_GAP)), 0.04 + index * 0.06, duration, enter=0.22, dx=-40, z=12 + index)
        )

    plan = plan_lanes(card, 830, size=50, label_width=110)
    right_title = element(
        directory / f"{prefix}_lanes_title.png",
        (830, 40),
        lambda c: c.text(0, 20, "展開予測（序盤の位置取り）", "bold", 32, T.TURF_DEEP),
    )
    placed.append(Placed(right_title, 1000, LONG_TITLE_TOP, 0.0, duration, enter=0.0))
    placed.append(_long_lanes(directory / f"{prefix}_lanes.png", plan, 0.34, duration))
    return _scene(base, base, duration, placed, directory / f"{prefix}_race.png", f"race-{race.race_number}")


# レースの場面の縦の割り付け（見出しの帯 0〜150、下の案内 984〜1080）。左の5行と右の位置取りを同じ高さにする。
LONG_TITLE_TOP = 192
LONG_BODY_TOP = 246
LONG_BODY_HEIGHT = 704
LONG_ROW_GAP = 18


def _long_lanes(path: Path, plan: Optional[LanePlan], start: float, duration: float) -> Placed:
    if plan is None:
        def empty(c: VideoCanvas) -> None:
            c.rect((0, 0, 830, LONG_BODY_HEIGHT), radius=25, fill=T.TURF_SOFT)
            c.text_center(415, LONG_BODY_HEIGHT / 2, "このレースは位置取りの予測がありません", "bold", 30, T.TURF_DEEP)

        return Placed(element(path, (830, LONG_BODY_HEIGHT), empty), 1000, LONG_BODY_TOP, start, duration, enter=0.3, dx=50)

    stretched = stretch_lanes(plan, LONG_BODY_HEIGHT)
    return Placed(
        element(path, (830, stretched.height), lambda c: draw_lanes(c, 0, 0, 830, stretched)),
        1000,
        LONG_BODY_TOP,
        start,
        duration,
        enter=0.3,
        dx=50,
    )


def build_long_outro(directory: Path, *, duration: float, prefix: str = "999_outro") -> MotionScene:
    """締め：案内役の馬、「全頭のデータはサイトで」、4つの視点、UMA-FREE と URL（画面の中央にそろえる）。"""
    base = VideoCanvas(*LONG_SIZE).save(directory / f"{prefix}_base.png")
    probe = VideoCanvas(1, 1, transparent=True)
    widths = [view_chip_width(probe, label, size=40, icon=44, pad=32) for label, _ in FOUR_VIEWS]
    chips_width = sum(widths) + 22 * (len(widths) - 1)
    site_width = lockup_width(probe, 76) + 26 + probe.text_width("uma-free.com", "num", 60)
    # 馬(230) + 48 + 見出し(116) + 48 + 4つの視点(100) + 48 + ロゴとURL(76) + 40 + 注記(52)
    heights = (230, 48, 116, 48, 100, 48, 76, 40, 52)
    top = round((1080 - sum(heights)) / 2)
    y_horse = top
    y_title = y_horse + 230 + 48
    y_views = y_title + 116 + 48
    y_site = y_views + 100 + 48
    y_note = y_site + 76 + 40

    horse = element(directory / f"{prefix}_horse.png", (230, 230), lambda c: c.paste_image(video_asset("guide-horse"), 0, 0, (230, 230)))
    title = element(directory / f"{prefix}_title.png", (1920, 116), lambda c: c.text_center(960, 58, "全頭のデータはサイトで", "disp", 94, T.WHITE))

    def chips(c: VideoCanvas) -> None:
        cursor = 0.0
        for (label, icon_name), width in zip(FOUR_VIEWS, widths):
            view_chip(c, cursor, 0, width, 100, label, icon_name, size=40, icon=44, pad=32)
            cursor += width + 22

    chips_path = element(directory / f"{prefix}_views.png", (chips_width, 100), chips)

    def site(c: VideoCanvas) -> None:
        width = lockup(c, 0, 38, 76, dark=True)
        c.text(width + 26, 38, "uma-free.com", "num", 60, T.ON_NIGHT_TEXT)

    site_path = element(directory / f"{prefix}_site.png", (site_width, 76), site)
    note = element(
        directory / f"{prefix}_note.png",
        (1920, 52),
        lambda c: c.text_center(960, 26, "登録不要 · 毎朝7時ごろ更新 · 概要欄のリンクから", "bold", 34, T.ON_NIGHT_FAINT),
    )
    placed = [
        Placed(horse, 845, y_horse, 0.0, duration, enter=0.3, dy=24),
        Placed(title, 0, y_title, 0.12, duration, enter=0.3, dy=20),
        Placed(chips_path, round((1920 - chips_width) / 2), y_views, 0.3, duration, enter=0.3, dy=20),
        Placed(site_path, round((1920 - site_width) / 2), y_site, 0.5, duration, enter=0.3),
        Placed(note, 0, y_note, 0.66, duration, enter=0.3),
    ]
    return _scene(base, base, duration, placed, directory / f"{prefix}.png", prefix)


def featured_for_thumbnail(races: Sequence[RaceVideoData], fallback: Optional[RaceVideoData]) -> Optional[RaceVideoData]:
    """サムネイルの札に出すレース：格の最も高い重賞。重賞が無ければ代表レース。"""
    graded = [race for race in races if race.grade]
    if graded:
        return min(graded, key=lambda race: (grade_priority(race.grade), 0 if race.venue_name in JRA_VENUES else 1, -race.race_number))
    return fallback


def draw_thumbnail(path: Path, *, target_date: str, headline: str, accent: str, featured: Optional[RaceVideoData], asset: Optional[VisualAsset]) -> Path:
    """サムネイル（1280×720）：写真＋左の幕、大きな日付、「全Nレース」「AI分析」、右下に注目のレースの白い札。"""
    c = VideoCanvas(*THUMBNAIL_SIZE)
    c.paste_image(photo_with_scrim(THUMBNAIL_SIZE, asset, THUMBNAIL_SCRIM), 0, 0, THUMBNAIL_SIZE)
    lockup(c, 56, 74, 52, dark=True)
    day = short_date(target_date)
    number, weekday = day.split("(", 1)
    width = c.text(56, 227, number, "num", 120, T.WHITE)
    c.text(56 + width + 8, 250, f"({weekday}", "bold", 56, T.WHITE)
    fitted, size = c.fit(headline, "disp", 96, 1180, 64)
    c.text(56, 344, fitted, "disp", size, T.WHITE)
    c.text(56, 455, accent, "disp", 96, T.AI)
    if featured is not None:
        card = race_card(featured)
        top = card.scored_rows[0] if card.scored_rows else None
        badge = (c.text_width(card.grade, "num" if card.grade.isascii() else "bold", 24) + 24 * 1.2 + 12) if card.grade else 0
        name, name_size = c.fit(card.race_name, "disp", 40, 560 - badge, 28)
        line_1 = c.text_width(name, "disp", name_size) + badge
        line_2 = 0.0
        horse_name = ""
        if top is not None:
            horse_name, _ = c.fit(top.name, "bold", 26, 260, 20)
            line_2 = c.text_width("AI 1位", "bold", 26) + 10 + 32 + 10 + c.text_width(horse_name, "bold", 26) + 12 + c.text_width(f"{top.score:.1f}", "num", 34)
        inner = max(line_1, line_2)
        card_w, card_h = 26 + 60 + 18 + inner + 26, 134
        right, bottom = 1280 - 48, 720 - 48
        left, top_y = right - card_w, bottom - card_h
        c.shadow((left, top_y, right, bottom), radius=24, offset=18, blur=20, alpha=0.3)
        c.rect((left, top_y, right, bottom), radius=24, fill=T.WHITE)
        plate(c, left + 26, top_y + (card_h - 60) / 2, 60, card.venue, card.race_number)
        text_x = left + 26 + 60 + 18
        c.text(text_x, top_y + 44, name, "disp", name_size, T.INK)
        if card.grade:
            grade_badge(c, text_x + c.text_width(name, "disp", name_size) + 12, top_y + 44, card.grade, 24)
        if top is not None:
            cursor = text_x + c.text(text_x, top_y + 96, "AI 1位", "bold", 26, T.MUTED) + 10
            horse_no(c, cursor + 16, top_y + 96, 32, top.number, top.waku)
            cursor += 32 + 10
            cursor += c.text(cursor, top_y + 96, horse_name, "bold", 26, T.INK) + 12
            c.text(cursor, top_y + 96, f"{top.score:.1f}", "num", 34, T.AI_DEEP)
    return c.save(path, fmt="JPEG")


# ---------------------------------------------------------------------------
# Shorts（1080×1920）
# ---------------------------------------------------------------------------
SHORT_PHASES = (("cover", 0.0, 1.2), ("top5", 1.2, 5.0), ("lanes", 5.0, 12.0))
SHORT_CLOSING = ("closing", 12.0, 15.5)


def short_phase_windows(duration: float, *, include_closing: bool, has_lanes: bool) -> list[tuple[str, float, float]]:
    """場面の時間。締めの無いレースは 12 秒の型を duration に合わせて縮める。"""
    if include_closing:
        scale = 1.0
        body_end = SHORT_CLOSING[1]
    else:
        scale = duration / SHORT_PHASES[-1][2]
        body_end = duration
    windows = [(name, start * scale, end * scale) for name, start, end in SHORT_PHASES]
    if not has_lanes:
        windows = [windows[0], ("top5", windows[1][1], windows[2][2])]
    windows[-1] = (windows[-1][0], windows[-1][1], body_end)
    if include_closing:
        windows.append((SHORT_CLOSING[0], SHORT_CLOSING[1], duration))
    return windows


def build_short_race(
    directory: Path,
    race: RaceVideoData,
    *,
    target_date: str,
    race_index: int,
    race_total: int,
    asset: Optional[VisualAsset],
    video: Optional[VideoAsset],
    branded: bool,
    include_closing: bool,
    duration: float,
) -> MotionScene:
    """Shorts の1レース。上に見出しと伸びる棒、その下の場所に各場面の中身を上下の中央にそろえて置く。"""
    card = race_card(race)
    plan = plan_lanes(card, SHORT_WIDTH, size=64, label_width=130, right_pad=SHORT_INNER_PAD)
    windows = short_phase_windows(duration, include_closing=include_closing, has_lanes=plan is not None)

    base_canvas = VideoCanvas(*SHORT_SIZE)
    base_canvas.paste_image(short_photo_base(asset), 0, 0, SHORT_SIZE)
    if branded:
        lockup(base_canvas, SHORT_LEFT, 138, 56, dark=True)
    base = base_canvas.save(directory / "000_short_base.png")

    header_path, header_height = _short_header(directory / "000_header.png", card, race_index, race_total)
    progress_y = round(SHORT_HEADER_TOP + header_height + 22)
    area = (progress_y + 8 + 40, SHORT_CONTENT_BOTTOM)
    track = element(directory / "000_track.png", (SHORT_WIDTH, 8), lambda c: c.rect((0, 0, SHORT_WIDTH, 8), radius=4, fill=white(0.14)))
    placed: list[Placed] = [
        Placed(header_path, SHORT_LEFT, SHORT_HEADER_TOP, 0.0, duration, enter=0.0, z=40),
        Placed(track, SHORT_LEFT, progress_y, 0.0, duration, enter=0.0, z=41),
        Placed(_progress_bar(directory / "000_progress.png", SHORT_WIDTH, 8, T.BRAND), SHORT_LEFT, progress_y, 0.0, duration, enter=0.0, reveal=duration, z=42),
    ]
    previews: dict[str, list[Placed]] = {}
    for order, (name, start, end) in enumerate(windows):
        exit_fade = 0.12 if end < duration - 0.01 else 0.0
        enter = 0.0 if start == 0.0 else 0.18
        items = {
            "cover": lambda: _short_cover(directory, card),
            "top5": lambda: _short_top5(directory, card),
            "lanes": lambda: _short_lanes(directory, plan),
            "closing": lambda: _short_closing(directory, branded=branded),
        }[name]()
        phase_items = []
        for offset, (path, x, y) in enumerate(_center_block(items, area)):
            stagger = 0.0 if start == 0.0 else min(0.25, offset * 0.05)
            phase_items.append(
                Placed(path, x, y, start + stagger, end, enter=enter, exit=exit_fade, dy=24 if enter else 0, z=10 + order * 10 + offset)
            )
        placed.extend(phase_items)
        previews[name] = phase_items

    fixed = placed[:2]
    preview_names = {"cover": "000_intro.png", "top5": "001_top5.png", "lanes": "002_lanes.png", "closing": "999_outro.png"}
    for name, items in previews.items():
        compose_preview(base, [(item.path, item.x, item.y) for item in [*fixed, *items]], directory / preview_names[name])
    final_name = "closing" if include_closing else windows[-1][0]

    validate_short_layers(placed)
    extra: list[MotionLayer] = []
    render_background = base
    if video is not None:
        render_background = video.path
        extra.append(MotionLayer(scrim_layer(directory / "000_video_scrim.png", SHORT_SIZE, SHORT_SCRIM, horizontal=False), 0, 0, 0.0, duration, enter_duration=0.0, z_index=1))
        if branded:
            brand = element(directory / "000_brand.png", (400, 60), lambda c: lockup(c, 0, 30, 56, dark=True))
            extra.append(MotionLayer(brand, SHORT_LEFT, 108, 0.0, duration, enter_duration=0.0, z_index=2))
    return MotionScene(
        background_path=render_background,
        duration_seconds=duration,
        preview_path=directory / preview_names[final_name],
        layers=[*extra, *(item.layer() for item in placed)],
        scene_id=f"short-{race.id}",
    )


def _center_block(items: Sequence[tuple[Path, int, float]], area: tuple[float, float]) -> list[tuple[Path, int, int]]:
    """場面の中身（上からの相対位置で並べた要素）を、場所の上下の中央に置く。"""
    if not items:
        return []
    bottoms = []
    for path, _, y in items:
        with Image.open(path) as image:
            bottoms.append(y + image.height)
    height = max(bottoms)
    offset = area[0] + max(0.0, (area[1] - area[0] - height) / 2)
    return [(path, x, round(offset + y)) for path, x, y in items]


def _short_header(path: Path, card: RaceCard, race_index: int, race_total: int) -> tuple[Path, float]:
    """会場×Rの札、日付・コース・頭数、レース名（長い名前は2行）とグレード。高さも返す。"""
    probe = VideoCanvas(1, 1, transparent=True)
    text_x = 106
    counter = f"{race_index} / {race_total}" if race_total > 1 else ""
    counter_width = probe.text_width(counter, "num", 34) + 20 if counter else 0
    badge_width = (probe.text_width(card.grade, "num" if card.grade.isascii() else "bold", 30) + 30 * 1.2 + 16) if card.grade else 0
    available = SHORT_SAFE_RIGHT - SHORT_LEFT - text_x
    single_size = next((size for size in (78, 72, 66, 60, 56) if probe.text_width(card.race_name, "disp", size) + badge_width <= available), None)
    if single_size is not None:
        lines, size = [card.race_name], single_size
    else:
        lines, size = probe.wrap(card.race_name, "disp", (60, 56, 52, 48, 44), available - badge_width, max_lines=2)
    line_height = size * 1.14
    first_center = 32 + 22 + line_height / 2
    height = max(94.0, first_center + line_height * (len(lines) - 1) + line_height / 2 + 6)

    def draw(c: VideoCanvas) -> None:
        plate(c, 0, 5, 84, card.venue, card.race_number, tone="white")
        meta, meta_size = c.fit(meta_line(card, short_date(card.date)), "bold", 32, available - counter_width, 24)
        c.text(text_x, 26, meta, "bold", meta_size, T.ON_NIGHT_SUB)
        if counter:
            c.text(SHORT_SAFE_RIGHT - SHORT_LEFT, 26, counter, "num", 34, T.ON_NIGHT_FAINT, anchor="rm")
        for index, line in enumerate(lines):
            c.text(text_x, first_center + index * line_height, line, "disp", size, T.WHITE)
        if card.grade:
            last_width = c.text_width(lines[-1], "disp", size)
            grade_badge(c, text_x + last_width + 16, first_center + (len(lines) - 1) * line_height, card.grade, 30)

    return element(path, (SHORT_WIDTH, height), draw), height


def _short_label(path: Path, text: str, color: Color) -> Path:
    return element(path, (SHORT_WIDTH, 56), lambda c: c.text(0, 28, text, "bold", 42, color))


def position_dots(c: VideoCanvas, x: float, cy: float, position: Optional[str], *, size: float = 36) -> float:
    """位置取りの3つの点（左から後方・中団・先行。今回の位置を紺で）と名前。サイトの位置取りの表示と同じ形。幅を返す。"""
    radius = size * 0.24
    active = {"後方": 0, "中団": 1, "先行": 2}.get(position or "")
    for index in range(3):
        c.circle(x + radius + index * radius * 2.8, cy, radius, fill=T.NAVY if index == active else T.LINE2)
    text_x = x + radius * 2 + 2 * radius * 2.8 + size * 0.36
    width = c.text(text_x, cy, position or "予測なし", "bold", size, T.INK)
    return text_x - x + width


def _short_cover(directory: Path, card: RaceCard) -> list[tuple[Path, int, float]]:
    """表紙：最初の1.2秒でレース名と AI偏差値1位が分かる。2位との差と序盤の位置取りも添える。"""
    leader = card.scored_rows[0] if card.scored_rows else None
    items: list[tuple[Path, int, float]] = [
        (_short_label(directory / "010_cover_label.png", "AI偏差値 1位", T.AI), SHORT_LEFT, 0)
    ]
    if leader is None:
        return items
    runner_up = card.scored_rows[1] if len(card.scored_rows) > 1 else None
    # 数字は左と中ほどに置き、右の操作ボタンの下に入らない。区切り線と棒は左右対称に伸ばす。
    inner_right = SHORT_WIDTH - 48
    card_height = 700

    def leader_card(c: VideoCanvas) -> None:
        c.rect((0, 0, SHORT_WIDTH, card_height), radius=36, fill=T.WHITE)
        c.rect((0, 0, SHORT_WIDTH, card_height), radius=36, outline=T.AI, width=4)
        horse_no(c, 48 + 60, 48 + 60, 120, leader.number, leader.waku)
        name, size = c.fit(leader.name, "disp", 96, inner_right - (48 + 120 + 28), 52)
        c.text(48 + 120 + 28, 108, name, "disp", size, T.INK)
        c.line((48, 220, inner_right, 220), T.LINE, 2)
        c.text(48, 290, "AI偏差値", "bold", 40, T.AI_DEEP)
        c.text(40, 440, f"{leader.score:.1f}", "num", 210, T.AI_DEEP)
        column = 520
        if runner_up is not None:
            c.text(column, 290, "2位との差", "bold", 38, T.MUTED)
            c.text(column, 368, f"+{leader.score - runner_up.score:.1f}", "num", 84, T.INK)
        c.text(column, 466, "序盤の位置取り", "bold", 38, T.MUTED)
        position_dots(c, column, 536, leader.position, size=46)
        score_bar(c, 48, 628, inner_right - 48, 20, leader.score, highlight=True)

    items.append((element(directory / "011_cover_card.png", (SHORT_WIDTH, card_height), leader_card), SHORT_LEFT, 76))
    return items


def _short_top5(directory: Path, card: RaceCard) -> list[tuple[Path, int, float]]:
    rows = card.scored_rows[:5]
    s = 1.8
    row_height = 80 * s
    items: list[tuple[Path, int, float]] = [
        (_short_label(directory / "020_top5_label.png", f"AI偏差値 上位{len(rows)}頭", T.ON_NIGHT_TEXT), SHORT_LEFT, 0)
    ]
    for index, row in enumerate(rows):
        path = element(
            directory / f"02{index + 1}_top5_row.png",
            (SHORT_WIDTH, row_height),
            lambda c, row=row, index=index: rank_row_dark(c, 0, 0, SHORT_WIDTH, row, index, s=s, bar_width=130, right_pad=SHORT_INNER_PAD),
        )
        items.append((path, SHORT_LEFT, 72 + index * (row_height + 20)))
    return items


def _short_lanes(directory: Path, plan: Optional[LanePlan]) -> list[tuple[Path, int, float]]:
    if plan is None:
        return []
    stretched = stretch_lanes(plan, SHORT_LANES_MIN_HEIGHT)
    label = _short_label(directory / "030_lanes_label.png", "序盤の位置取り", T.ON_NIGHT_TEXT)
    lanes_path = element(directory / "031_lanes.png", (SHORT_WIDTH, stretched.height), lambda c: draw_lanes(c, 0, 0, SHORT_WIDTH, stretched, dark=True))
    return [(label, SHORT_LEFT, 0), (lanes_path, SHORT_LEFT, 72)]


# 位置取りの図の最小の高さ（頭数が少なくても、上位5頭の場面と同じくらいの固まりにする）
SHORT_LANES_MIN_HEIGHT = 780


def _short_closing(directory: Path, *, branded: bool) -> list[tuple[Path, int, float]]:
    """締め。TikTok 用の版は案内役の馬とサイトへの案内を入れない。画面の中央にそろえる。"""
    items: list[tuple[Path, int, float]] = []
    cursor = 0.0
    if branded:
        horse = element(directory / "040_closing_horse.png", (240, 240), lambda c: c.paste_image(video_asset("guide-horse"), 0, 0, (240, 240)))
        items.append((horse, round((1080 - 240) / 2), cursor))
        cursor += 240 + 44
    lines = ("対戦成績と馬番の傾向は", "サイトで公開") if branded else ("対戦成績と馬番の傾向も", "同じ基準で整理")

    def title(c: VideoCanvas) -> None:
        for index, line in enumerate(lines):
            c.text_center(SHORT_WIDTH / 2, 52 + index * 104, line, "disp", 80, T.WHITE)

    items.append((element(directory / "041_closing_title.png", (SHORT_WIDTH, 208), title), SHORT_LEFT, cursor))
    cursor += 208 + 44
    cell_w, cell_h = (SHORT_WIDTH - 20) / 2, 104

    def chips(c: VideoCanvas) -> None:
        for index, (label, icon_name) in enumerate(FOUR_VIEWS):
            x = (index % 2) * (cell_w + 20)
            y = (index // 2) * (cell_h + 20)
            view_chip(c, x, y, cell_w, cell_h, label, icon_name, size=40, icon=46, pad=30)

    items.append((element(directory / "042_closing_views.png", (SHORT_WIDTH, cell_h * 2 + 20), chips), SHORT_LEFT, cursor))
    cursor += cell_h * 2 + 20 + 44
    note = "登録不要 · 毎日無料で公開" if branded else "過去データをもとにした参考情報です"
    items.append((
        element(directory / "043_closing_note.png", (SHORT_WIDTH, 60), lambda c: c.text_center(SHORT_WIDTH / 2, 30, note, "bold", 40, T.ON_NIGHT_TEXT)),
        SHORT_LEFT,
        cursor,
    ))
    return items


def validate_short_layers(placed: Sequence[Placed]) -> None:
    """文字・数字・札が、Shorts の上の見出しから下の題名・説明の上までに収まることを確かめる。場面が時間の上で重ならないことも。"""
    left_limit, top_limit, right_limit, bottom_limit = SHORT_SAFE_BOX
    for item in placed:
        if item.reveal:
            continue
        with Image.open(item.path) as source:
            bounds = source.getchannel("A").getbbox()
        if bounds is None:
            continue
        for dx, dy in {(0, 0), (item.dx, item.dy)}:
            left = item.x + dx + bounds[0]
            top = item.y + dy + bounds[1]
            right = item.x + dx + bounds[2]
            bottom = item.y + dy + bounds[3]
            if left < left_limit or top < top_limit or right > right_limit or bottom > bottom_limit:
                raise ValueError(
                    "Shortsの文字・数字が安全な範囲の外にあります: "
                    f"{item.path.name} bounds=({left},{top},{right},{bottom})"
                )
    windows: dict[str, tuple[float, float]] = {}
    for item in placed:
        phase = item.path.name[:2]
        if phase in {"01", "02", "03", "04"}:
            start, end = windows.get(phase, (item.start, item.end))
            windows[phase] = (min(start, item.start), max(end, item.end))
    ordered = sorted(windows.values())
    for (_, previous_end), (next_start, _) in zip(ordered, ordered[1:]):
        if next_start < previous_end - 1e-6:
            raise ValueError("Shortsの場面が時間の上で重なっています")
