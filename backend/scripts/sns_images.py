"""SNS投稿の画像。サイトと同じ色・文字・部品で描く（デザイン改修 2026-09 のポートフォリオ「SNS」）。

- X（1200×675）：本文にURLを入れないため、画像の下端に行き先（UMA-FREE）を書く。
- Threads・Instagram（1080×1350）：縦長。Threads は本文にサイトのURLを入れる。
- 色は brand_tokens.py、書体は backend/fonts の M PLUS Rounded 1c（見出し800・本文700）と Barlow Semi Condensed（数字）。
- 角丸と円をなめらかにするため、2倍の大きさで描いてから縮小して保存する。
- 絵文字や星空の背景は使わない。写真は backend/assets/sns の4枚だけ。
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional, Sequence

from PIL import Image, ImageDraw, ImageFont

from scripts import brand_tokens as T
from scripts.sns_content import HitCard, HorseRow, PickCard, RaceCard, date_label

BACKEND_DIR = Path(__file__).resolve().parents[1]
FONT_DIR = BACKEND_DIR / "fonts"
PHOTO_DIR = BACKEND_DIR / "assets" / "sns"
LOGO_PATH = FONT_DIR / "new-logo.png"
SCALE = 2

X_SIZE = (1200, 675)
PORTRAIT_SIZE = (1080, 1350)

_FONT_FILES = {
    "disp": T.FONT_DISPLAY,
    "bold": T.FONT_BODY,
    "reg": T.FONT_BODY_REGULAR,
    "num": T.FONT_NUM,
    "num_semi": T.FONT_NUM_SEMI,
}

MARK_COLORS = {"◎": T.AI_DEEP, "○": T.BRAND_DEEP, "▲": T.NAVY, "△": T.MUTED, "☆": T.MUTED}
MARK_COLORS_DARK = {"◎": T.AI, "○": T.BRAND_ON_NIGHT, "▲": T.WHITE, "△": T.ON_NIGHT_FAINT, "☆": T.ON_NIGHT_FAINT}


@lru_cache(maxsize=512)
def _font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / _FONT_FILES[kind]), max(1, size))


def _is_ascii(text: str) -> bool:
    return all(ord(ch) < 128 for ch in text)


def _mix(color: tuple[int, int, int], base: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    return tuple(round(c * alpha + b * (1 - alpha)) for c, b in zip(color, base))  # type: ignore[return-value]


@lru_cache(maxsize=8)
def _logo(size_px: int) -> Image.Image:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    return logo.resize((size_px, size_px), Image.Resampling.LANCZOS)


@lru_cache(maxsize=8)
def _photo(name: str) -> Image.Image:
    return Image.open(PHOTO_DIR / f"{name}.jpg").convert("RGB")


class Canvas:
    """ポートフォリオと同じ座標（px）で描き、内部では SCALE 倍で持つ。"""

    def __init__(self, width: int, height: int, background: tuple[int, int, int] = T.WHITE) -> None:
        self.width = width
        self.height = height
        self.image = Image.new("RGB", (width * SCALE, height * SCALE), background)
        self.draw = ImageDraw.Draw(self.image)

    # ---- 基本 ----
    @staticmethod
    def _s(value: float) -> int:
        return int(round(value * SCALE))

    def font(self, kind: str, size: float) -> ImageFont.FreeTypeFont:
        return _font(kind, self._s(size))

    def text_width(self, text: str, kind: str, size: float) -> float:
        return self.draw.textlength(text, font=self.font(kind, size)) / SCALE

    def text(
        self,
        x: float,
        y: float,
        text: str,
        kind: str,
        size: float,
        fill: tuple[int, int, int],
        anchor: str = "lm",
    ) -> float:
        self.draw.text((self._s(x), self._s(y)), text, font=self.font(kind, size), fill=fill, anchor=anchor)
        return self.text_width(text, kind, size)

    def _runs(self, text: str, kind: str) -> list[tuple[str, str]]:
        """数字の書体（Barlow）に無い文字（→・全角など）だけ本文の書体に切り替える。"""
        if kind not in ("num", "num_semi"):
            return [(text, kind)]
        runs: list[tuple[str, str]] = []
        for ch in text:
            run_kind = kind if ord(ch) < 128 else "bold"
            if runs and runs[-1][1] == run_kind:
                runs[-1] = (runs[-1][0] + ch, run_kind)
            else:
                runs.append((ch, run_kind))
        return runs

    def mixed_width(self, text: str, kind: str, size: float) -> float:
        return sum(self.text_width(run, run_kind, size) for run, run_kind in self._runs(text, kind))

    def mixed_text(self, x: float, y: float, text: str, kind: str, size: float, fill: tuple[int, int, int], anchor: str = "lm") -> float:
        """数字と記号の混ざった文字列（「11→13→1」など）。anchor は l/r と m/s の組み合わせ。"""
        width = self.mixed_width(text, kind, size)
        left = x - width if anchor[0] == "r" else x
        if anchor[1] == "m":
            font = self.font(kind, size)
            _, top, _, bottom = self.draw.textbbox((0, 0), "0", font=font, anchor="ls")
            baseline = y - (top + bottom) / 2 / SCALE
        else:
            baseline = y
        for run, run_kind in self._runs(text, kind):
            self.text(left, baseline, run, run_kind, size, fill, anchor="ls")
            left += self.text_width(run, run_kind, size)
        return width

    def text_center(self, cx: float, cy: float, text: str, kind: str, size: float, fill: tuple[int, int, int]) -> None:
        """字面の中心を (cx, cy) に合わせる（丸や札の中の数字用）。"""
        font = self.font(kind, size)
        left, top, right, bottom = self.draw.textbbox((0, 0), text, font=font, anchor="ls")
        x = self._s(cx) - (left + right) / 2
        y = self._s(cy) - (top + bottom) / 2
        self.draw.text((x, y), text, font=font, fill=fill, anchor="ls")

    def rect(
        self,
        box: Sequence[float],
        *,
        radius: float = 0,
        fill: Optional[tuple[int, int, int]] = None,
        outline: Optional[tuple[int, int, int]] = None,
        width: float = 0,
    ) -> None:
        scaled = [self._s(v) for v in box]
        if radius:
            self.draw.rounded_rectangle(scaled, radius=self._s(radius), fill=fill, outline=outline, width=self._s(width) if outline else 0)
        else:
            self.draw.rectangle(scaled, fill=fill, outline=outline, width=self._s(width) if outline else 0)

    def circle(
        self,
        cx: float,
        cy: float,
        radius: float,
        *,
        fill: Optional[tuple[int, int, int]] = None,
        outline: Optional[tuple[int, int, int]] = None,
        width: float = 0,
    ) -> None:
        box = [self._s(cx - radius), self._s(cy - radius), self._s(cx + radius), self._s(cy + radius)]
        self.draw.ellipse(box, fill=fill, outline=outline, width=self._s(width) if outline else 0)

    def line(self, points: Sequence[float], fill: tuple[int, int, int], width: float = 1) -> None:
        self.draw.line([self._s(v) for v in points], fill=fill, width=self._s(width))

    def paste_logo(self, x: float, y: float, size: float) -> None:
        logo = _logo(self._s(size))
        self.image.paste(logo, (self._s(x), self._s(y)), logo)

    def paste_photo(self, name: str, box: Sequence[float], focus: tuple[float, float] = (0.5, 0.6)) -> None:
        """写真を box いっぱいに敷く（はみ出す分は focus を中心に切る）。"""
        left, top, right, bottom = (self._s(v) for v in box)
        width, height = right - left, bottom - top
        photo = _photo(name)
        scale = max(width / photo.width, height / photo.height)
        resized = photo.resize((max(width, round(photo.width * scale)), max(height, round(photo.height * scale))), Image.Resampling.LANCZOS)
        offset_x = round((resized.width - width) * focus[0])
        offset_y = round((resized.height - height) * focus[1])
        self.image.paste(resized.crop((offset_x, offset_y, offset_x + width, offset_y + height)), (left, top))

    def scrim(self, box: Sequence[float], stops: Sequence[tuple[float, float]], *, horizontal: bool = False) -> None:
        """夜の紺の幕。stops は (位置0〜1, 不透明度0〜1)。"""
        left, top, right, bottom = (self._s(v) for v in box)
        length = (right - left) if horizontal else (bottom - top)
        values = []
        for i in range(length):
            pos = i / max(1, length - 1)
            for (p0, a0), (p1, a1) in zip(stops, stops[1:]):
                if p0 <= pos <= p1:
                    t = 0 if p1 == p0 else (pos - p0) / (p1 - p0)
                    values.append(round(255 * (a0 + (a1 - a0) * t)))
                    break
            else:
                values.append(round(255 * (stops[-1][1] if pos > stops[-1][0] else stops[0][1])))
        if horizontal:
            mask = Image.new("L", (length, 1))
            mask.putdata(values)
            mask = mask.resize((length, bottom - top))
        else:
            mask = Image.new("L", (1, length))
            mask.putdata(values)
            mask = mask.resize((right - left, length))
        overlay = Image.new("RGB", (right - left, bottom - top), T.NIGHT)
        region = self.image.crop((left, top, right, bottom))
        self.image.paste(Image.composite(overlay, region, mask), (left, top))

    def save(self, path: Path | str, *, fmt: str = "PNG") -> str:
        output = self.image.resize((self.width, self.height), Image.Resampling.LANCZOS)
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if fmt.upper() == "JPEG":
            output.save(path, "JPEG", quality=90, optimize=True, progressive=True)
        else:
            output.save(path, "PNG", optimize=True)
        return str(path)

    # ---- 文字の収め方 ----
    def fit(self, text: str, kind: str, size: float, max_width: float, min_size: float) -> tuple[str, float]:
        """max_width に収まる大きさを探し、最小でも入らなければ末尾を「…」にする。"""
        current = size
        while current > min_size and self.text_width(text, kind, current) > max_width:
            current -= 1
        if self.text_width(text, kind, current) <= max_width:
            return text, current
        trimmed = text
        while trimmed and self.text_width(trimmed + "…", kind, current) > max_width:
            trimmed = trimmed[:-1]
        return (trimmed + "…" if trimmed else text[:1]), current

    def wrap(self, text: str, kind: str, sizes: Iterable[float], max_width: float, max_lines: int = 2) -> tuple[list[str], float]:
        """1文字ずつ折り返し、max_lines に収まる最大の大きさを返す。"""
        sizes = list(sizes)
        for size in sizes:
            lines: list[str] = []
            current = ""
            for ch in text:
                if self.text_width(current + ch, kind, size) > max_width and current:
                    lines.append(current)
                    current = ch
                else:
                    current += ch
            if current:
                lines.append(current)
            if len(lines) <= max_lines:
                return lines, size
        size = sizes[-1]
        fitted, _ = self.fit(text, kind, size, max_width * max_lines, size)
        return self.wrap(fitted, kind, [size], max_width, max_lines + 1)[0][:max_lines], size


# ---------------------------------------------------------------------------
# 部品（ポートフォリオ lib.mjs と同じ寸法）
# ---------------------------------------------------------------------------
def lockup(c: Canvas, x: float, cy: float, size: float, *, dark: bool = False) -> float:
    """ロゴの円＋「UMA-FREE」。幅を返す。"""
    c.paste_logo(x, cy - size / 2, size)
    text_x = x + size + size * 0.28
    width = c.text(text_x, cy, "UMA-FREE", "disp", size * 0.56, T.WHITE if dark else T.NAVY)
    return size + size * 0.28 + width


def plate(c: Canvas, x: float, y: float, d: float, venue: str, number: int, *, tone: str = "navy") -> None:
    """会場×R番号の札。"""
    background = T.WHITE if tone == "white" else T.NAVY
    foreground = T.NAVY if tone == "white" else T.WHITE
    c.rect((x, y, x + d, y + d), radius=d * 0.2, fill=background, outline=T.NAVY_SOFT if tone == "white" else None, width=1.5)
    venue_size = max(9, d * 0.167)
    c.text_center(x + d / 2, y + d * 0.31, venue, "bold", venue_size, _mix(foreground, background, 0.86))
    number_size = d * 0.5
    small_size = number_size * 0.5
    number_text = str(number)
    total = c.text_width(number_text, "num", number_size) + c.text_width("R", "num", small_size) + 1
    left = x + (d - total) / 2
    baseline = y + d * 0.84
    c.text(left, baseline, number_text, "num", number_size, foreground, anchor="ls")
    c.text(left + c.text_width(number_text, "num", number_size) + 1, baseline, "R", "num", small_size, foreground, anchor="ls")


def grade_badge(c: Canvas, x: float, cy: float, label: Optional[str], size: float) -> float:
    """グレードのバッジ。幅を返す。"""
    if not label:
        return 0
    upper = label.upper()
    color = (
        T.GRADE["G1"] if upper.endswith("1") else
        T.GRADE["G2"] if upper.endswith("2") else
        T.GRADE["G3"] if upper.endswith("3") else
        T.GRADE["LOCAL"]
    )
    kind = "num" if _is_ascii(label) else "bold"
    pad = size * 0.6
    width = c.text_width(label, kind, size) + pad * 2
    height = size * 1.55
    c.rect((x, cy - height / 2, x + width, cy + height / 2), radius=size * 0.33, fill=color)
    c.text_center(x + width / 2, cy, label, kind, size, T.WHITE)
    return width


def horse_no(c: Canvas, cx: float, cy: float, size: float, number: Optional[int], waku: Optional[int]) -> None:
    background, foreground, border = T.WAKU.get(waku or 0, (T.LINE, T.INK2, T.LINE2))
    c.circle(cx, cy, size / 2, fill=background, outline=border, width=max(1.0, size * 0.054))
    if number:
        c.text_center(cx, cy, str(number), "num", size * 0.52, foreground)


def mark_glyph(c: Canvas, cx: float, cy: float, mark: str, size: float, *, dark: bool = False) -> None:
    if mark not in MARK_COLORS:
        c.text_center(cx, cy, "－", "bold", size * 0.8, T.ON_NIGHT_FAINT if dark else T.LINE2)
        return
    color = (MARK_COLORS_DARK if dark else MARK_COLORS)[mark]
    c.text_center(cx, cy, mark, "disp", size, color)


def score_bar(c: Canvas, x: float, cy: float, width: float, height: float, score: Optional[float], *, highlight: bool = False) -> None:
    c.rect((x, cy - height / 2, x + width, cy + height / 2), radius=height / 2, fill=T.PANEL2)
    if score is None:
        return
    ratio = max(0.04, min(1.0, (score - 30) / 50))
    c.rect((x, cy - height / 2, x + width * ratio, cy + height / 2), radius=height / 2, fill=T.AI if highlight else T.BRAND)


def top_bar(c: Canvas, height: float, date_text: str, *, size: float = 44, pad: float = 56) -> None:
    c.rect((0, 0, c.width, height), fill=T.NIGHT)
    lockup(c, pad, height / 2, size, dark=True)
    c.text(c.width - pad, height / 2, date_text, "bold", round(size * 0.62), T.ON_NIGHT_SUB, anchor="rm")


def footer_bar(c: Canvas, height: float, text: str, *, size: float = 22, pad: float = 56) -> None:
    top = c.height - height
    c.rect((0, top, c.width, c.height), fill=T.PANEL)
    c.line((0, top + 1, c.width, top + 1), T.LINE, 2)
    mark = height * 0.56
    fitted, fitted_size = c.fit(text, "bold", size, c.width - pad * 2 - mark - 24, size * 0.8)
    c.text(pad, top + height / 2, fitted, "bold", fitted_size, T.INK2)
    c.paste_logo(c.width - pad - mark, top + (height - mark) / 2, mark)


def rank_row(c: Canvas, x: float, y: float, width: float, row: HorseRow, index: int, *, s: float = 1.0, bar_width: float = 260) -> float:
    """AI偏差値の順位の行。高さを返す。"""
    height = 80 * s
    highlight = index == 0
    c.rect(
        (x, y, x + width, y + height),
        radius=16 * s,
        fill=T.AI_ROW if highlight else T.WHITE,
        outline=T.AI if highlight else T.LINE,
        width=2 if highlight else 1,
    )
    cy = y + height / 2
    cursor = x + 18 * s
    c.text(cursor, cy, str(index + 1), "num", 30 * s, T.AI if highlight else T.MUTED)
    cursor += 34 * s + 18 * s
    mark_glyph(c, cursor + 14 * s, cy, row.mark, 28 * s)
    cursor += 28 * s + 18 * s
    horse_no(c, cursor + 20 * s, cy, 40 * s, row.number, row.waku)
    cursor += 40 * s + 18 * s
    right = x + width - 18 * s
    bar = bar_width * s * 0.5
    score_x = right
    name_width = score_x - bar - 18 * s - cursor
    name, name_size = c.fit(row.name, "disp", 32 * s, name_width, 22 * s)
    c.text(cursor, cy, name, "disp", name_size, T.INK)
    score_text = f"{row.score:.1f}" if row.score is not None else "--"
    c.text(right, cy - 6 * s, score_text, "num", 40 * s, T.AI_DEEP if highlight else T.INK, anchor="rm")
    score_bar(c, right - bar, cy + 22 * s, bar, 7 * s, row.score, highlight=highlight)
    return height


def lanes_block(c: Canvas, x: float, y: float, width: float, card: RaceCard, *, size: float = 40, label_width: float = 110) -> float:
    """序盤の位置取り（右ほど前）。AI偏差値の上位3頭に琥珀の輪。高さを返す。"""
    lanes = ("先行", "中団", "後方")
    rows_by_lane = {lane: sorted((r for r in card.rows if r.position == lane), key=lambda r: r.position_index or 0) for lane in lanes}
    layouts = []
    total = 6.0
    usable = width - label_width - size - 16
    for lane in lanes:
        subs: list[float] = []
        placed = []
        for row in rows_by_lane[lane]:
            px = label_width + ((row.position_index or 0) / 100) * usable
            slot = next((k for k, last in enumerate(subs) if last + size + 4 <= px), -1)
            if slot < 0:
                if len(subs) < 3:
                    slot = len(subs)
                    subs.append(-1e9)
                else:
                    slot = subs.index(min(subs))
                    px = max(px, subs[slot] + size + 4)
            subs[slot] = px
            placed.append((row, px, slot))
        lane_height = max(1, len(subs)) * (size + 8) + 16
        layouts.append((lane, placed, lane_height))
        total += lane_height
    footer = size * 0.5 + 16
    total += footer
    c.rect((x, y, x + width, y + total), radius=size * 0.5, fill=T.TURF_SOFT)
    cursor = y + 6
    for index, (lane, placed, lane_height) in enumerate(layouts):
        c.text(x + size * 0.5, cursor + lane_height / 2, lane, "bold", size * 0.6, T.TURF_DEEP)
        for row, px, slot in placed:
            cx = x + px + size / 2
            cy = cursor + 8 + slot * (size + 8) + size / 2
            if row.ai_rank and row.ai_rank <= 3:
                c.circle(cx, cy, size / 2 + 5, outline=T.AI, width=size * 0.1)
            horse_no(c, cx, cy, size, row.number, row.waku)
        cursor += lane_height
        if index < len(layouts) - 1:
            c.line((x, cursor, x + width, cursor), _mix(T.TURF_DEEP, T.TURF_SOFT, 0.18), 1.5)
    c.text(x + width - size * 0.5, cursor + footer / 2, "進行方向 →", "bold", size * 0.5, T.TURF_DEEP, anchor="rm")
    return total


def _race_meta(card: RaceCard) -> str:
    return " · ".join([date_label(card.date)] + card.meta_parts(with_grade=False))


def _lanes_note(card: RaceCard) -> Optional[str]:
    front = card.front_runner_count()
    top = card.scored_rows[0] if card.scored_rows else None
    if not front or not top or not top.position:
        return None
    return f"序盤に前へ行きそうな馬は{front}頭。1位の{top.name}は{top.position}の予測"


# ---------------------------------------------------------------------------
# X（1200×675）
# ---------------------------------------------------------------------------
def render_x_pick(card: PickCard, path: Path | str) -> str:
    race, pick = card.race, card.pick
    c = Canvas(*X_SIZE)
    top_bar(c, 96, date_label(race.date))
    left = 56
    column = 1200 - 56 * 2 - 40 - 360
    c.text(left, 96 + 44 + 12, "本日のAI注目馬", "bold", 24, T.BRAND_DEEP)
    plate(c, left, 96 + 44 + 40, 60, race.venue, race.race_number)
    meta = " · ".join([race.race_name] + race.meta_parts())
    meta, meta_size = c.fit(meta, "bold", 24, column - 76, 18)
    c.text(left + 76, 96 + 44 + 70, meta, "bold", meta_size, T.MUTED)
    name_y = 96 + 44 + 150
    horse_no(c, left + 28, name_y, 56, pick.number, pick.waku)
    name, name_size = c.fit(pick.name, "disp", 76, column - 74, 48)
    c.text(left + 74, name_y, name, "disp", name_size, T.INK)
    # AI偏差値の箱
    box = (1200 - 56 - 360, 96 + 44, 1200 - 56, 96 + 44 + 250)
    c.rect(box, radius=24, fill=T.AI_ROW, outline=T.AI, width=2)
    c.text(box[2] - 30, box[1] + 42, "AI偏差値", "bold", 22, T.AI_DEEP, anchor="rm")
    c.text(box[2] - 30, box[1] + 130, f"{pick.score:.1f}", "num", 120, T.AI_DEEP, anchor="rm")
    note = f"本日の全{card.total_races}レースで最上位" if card.total_races > 1 else "本日のレースで最上位"
    c.text(box[2] - 30, box[3] - 34, note, "bold", 18, T.AI_DEEP, anchor="rm")
    # 4つの視点
    chip_y = 675 - 72 - 44 - 52
    cursor = left
    for label in ("AI偏差値", "対戦成績", "展開予測", "馬番の傾向"):
        w = c.text_width(label, "bold", 19) + 36
        c.rect((cursor, chip_y, cursor + w, chip_y + 52), radius=14, fill=T.PANEL, outline=T.LINE, width=1.5)
        c.text(cursor + 18, chip_y + 26, label, "bold", 19, T.INK2)
        cursor += w + 12
    footer_bar(c, 72, f"{card.venues_label} 全{card.total_races}レースの分析を UMA-FREE で公開中", size=21)
    return c.save(path)


def _other_hit_chips(c: Canvas, x: float, y: float, max_right: float, others: Sequence[HitCard], *, size: float = 20) -> None:
    cursor = x
    for other in others:
        tag_w = c.text_width(other.bet_type, "bold", size * 0.9) + 16
        numbers_w = c.mixed_width(other.winning_numbers, "num", size * 1.3)
        payout = f"{other.payout:,}円"
        payout_w = c.mixed_width(payout, "num", size * 1.5)
        width = 20 + tag_w + 14 + numbers_w + 14 + payout_w + 20
        if cursor + width > max_right:
            break
        c.rect((cursor, y, cursor + width, y + size * 2.9), radius=14, fill=T.WHITE, outline=T.LINE, width=1.5)
        cy = y + size * 1.45
        c.rect((cursor + 20, cy - size * 0.75, cursor + 20 + tag_w, cy + size * 0.75), radius=6, fill=T.NAVY_SOFT)
        c.text_center(cursor + 20 + tag_w / 2, cy, other.bet_type, "bold", size * 0.9, T.NAVY)
        c.mixed_text(cursor + 20 + tag_w + 14, cy, other.winning_numbers, "num", size * 1.3, T.INK2)
        c.mixed_text(cursor + width - 20, cy, payout, "num", size * 1.5, T.INK, anchor="rm")
        cursor += width + 14


def render_x_hit(hit: HitCard, path: Path | str, others: Sequence[HitCard] = ()) -> str:
    c = Canvas(*X_SIZE)
    top_bar(c, 96, f"{date_label(hit.date)}の結果")
    left = 56
    c.text(left, 96 + 40 + 14, "AI予想の的中", "bold", 24, T.BRAND_DEEP)
    plate(c, left, 96 + 40 + 44, 60, hit.venue, hit.race_number)
    name, size = c.fit(hit.race_name, "disp", 40, 1200 - left * 2 - 76, 28)
    c.text(left + 76, 96 + 40 + 74, name, "disp", size, T.INK)
    box = (left, 96 + 40 + 132, 1200 - left, 96 + 40 + 132 + 150)
    c.rect(box, radius=24, fill=T.PANEL, outline=T.LINE, width=1.5)
    cy = (box[1] + box[3]) / 2
    tag_w = c.text_width(hit.bet_type, "bold", 26) + 28
    c.rect((box[0] + 30, cy - 24, box[0] + 30 + tag_w, cy + 24), radius=8, fill=T.NAVY)
    c.text_center(box[0] + 30 + tag_w / 2, cy, hit.bet_type, "bold", 26, T.WHITE)
    c.mixed_text(box[0] + 30 + tag_w + 28, cy, hit.winning_numbers, "num", 54, T.INK2)
    yen_w = c.text_width("円", "bold", 34)
    c.text(box[2] - 30, cy + 30, "円", "bold", 34, T.NAVY, anchor="rs")
    c.text(box[2] - 30 - yen_w - 4, cy + 30, f"{hit.payout:,}", "num", 96, T.NAVY, anchor="rs")
    if others:
        _other_hit_chips(c, left, box[3] + 24, 1200 - left, others)
    footer_bar(c, 72, "当日の全レースのAI偏差値は UMA-FREE で公開", size=21)
    return c.save(path)


def render_x_race(card: RaceCard, path: Path | str, *, label: str = "AI偏差値 上位3頭") -> str:
    """重賞・メインレース。左に紺の面（札・レース名）、右に上位3頭。"""
    c = Canvas(*X_SIZE, background=T.BG)
    panel_w, body_h = 470, 675 - 72
    c.rect((0, 0, panel_w, body_h), fill=T.NIGHT)
    lockup(c, 44, 44 + 22, 44, dark=True)
    plate(c, 44, 150, 84, card.venue, card.race_number, tone="white")
    c.text(44, 150 + 84 + 30, _race_meta(card), "bold", 21, T.ON_NIGHT_SUB)
    lines, size = c.wrap(card.race_name, "disp", (54, 48, 42, 36), panel_w - 88, max_lines=2)
    y = 150 + 84 + 30 + 36
    for line in lines:
        c.text(44, y + size * 0.6, line, "disp", size, T.WHITE)
        y += size * 1.2
    if card.grade:
        grade_badge(c, 44, y + 26, card.grade, 20)
    # 右：上位3頭
    x0, width = panel_w + 48, 1200 - panel_w - 96
    c.text(x0, 40 + 14, label, "bold", 22, T.BRAND_DEEP)
    y = 40 + 36
    for index, row in enumerate(card.scored_rows[:3]):
        y += rank_row(c, x0, y, width, row, index, s=1.0, bar_width=300) + 14
    note = _lanes_note(card)
    if note:
        note, note_size = c.fit(note, "bold", 19, width - 36, 15)
        c.rect((x0, y + 6, x0 + width, y + 6 + 56), radius=14, fill=T.TURF_SOFT)
        c.text(x0 + 18, y + 6 + 28, note, "bold", note_size, T.TURF_DEEP)
    footer_bar(c, 72, "全頭のAI偏差値・展開予測・馬番の傾向は UMA-FREE で公開", size=21)
    return c.save(path)


# ---------------------------------------------------------------------------
# Threads（1080×1350）
# ---------------------------------------------------------------------------
def photo_for(card: RaceCard) -> str:
    return "sns-turf" if card.surface == "芝" else "sns-dirt"


def render_threads_pick(card: PickCard, path: Path | str) -> str:
    race, pick = card.race, card.pick
    c = Canvas(*PORTRAIT_SIZE)
    c.paste_photo(photo_for(race), (0, 0, 1080, 620), focus=(0.5, 0.62))
    c.scrim((0, 0, 1080, 620), [(0, 0.3), (0.5, 0.25), (1, 0.82)])
    lockup(c, 56, 40 + 26, 52, dark=True)
    c.text(1080 - 56, 40 + 26, date_label(race.date), "bold", 30, T.WHITE, anchor="rm")
    c.text(56, 620 - 44 - 92 - 34, "本日のAI注目馬", "bold", 32, T.WHITE)
    name, size = c.fit(pick.name, "disp", 92, 1080 - 112, 56)
    c.text(56, 620 - 44 - 46, name, "disp", size, T.WHITE)
    y = 620 + 44
    plate(c, 56, y, 84, race.venue, race.race_number)
    title, title_size = c.fit(race.race_name, "disp", 44, 1080 - 56 - 76 - 300 - 20, 30)
    c.text(56 + 104, y + 24, title, "disp", title_size, T.INK)
    meta_parts = race.meta_parts()
    if pick.number:
        meta_parts.append(f"{pick.number}番")
    c.text(56 + 104, y + 66, " · ".join(meta_parts), "bold", 26, T.MUTED)
    c.text(1080 - 56, y + 12, "AI偏差値", "bold", 24, T.AI_DEEP, anchor="rm")
    c.text(1080 - 56, y + 86, f"{pick.score:.1f}", "num", 112, T.AI_DEEP, anchor="rm")
    sentence = f"本日の{card.venues_label}・全{card.total_races}レースの中で、最も高いAI偏差値です。"
    sentence, sentence_size = c.fit(sentence, "reg", 28, 1080 - 112, 22)
    c.text(56, y + 84 + 84, sentence, "reg", sentence_size, T.INK2)
    y += 84 + 136
    c.text(56, y + 14, "同じレースのAI偏差値の上位", "bold", 24, T.MUTED)
    y += 40
    for row in [r for r in race.scored_rows if r is not pick][:3]:
        c.rect((56, y, 1080 - 56, y + 66), radius=16, fill=T.PANEL, outline=T.LINE, width=1.5)
        cy = y + 33
        c.text(76, cy, f"{row.ai_rank}位", "bold", 26, T.MUTED)
        mark_glyph(c, 76 + 84, cy, row.mark, 26)
        horse_no(c, 76 + 84 + 44, cy, 38, row.number, row.waku)
        name, size = c.fit(row.name, "disp", 30, 1080 - 56 - 20 - 120 - (76 + 84 + 70), 22)
        c.text(76 + 84 + 70, cy, name, "disp", size, T.INK)
        c.text(1080 - 56 - 20, cy, f"{row.score:.1f}", "num", 36, T.INK, anchor="rm")
        y += 66 + 10
    footer_bar(c, 90, "全レースの分析は uma-free.com", size=26)
    return c.save(path, fmt="JPEG")


def render_threads_hit(hit: HitCard, path: Path | str, others: Sequence[HitCard] = ()) -> str:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    top_bar(c, 110, f"{date_label(hit.date)}の結果", size=50)
    y = 110 + 60
    c.text(56, y, "AI予想の的中", "bold", 30, T.BRAND_DEEP)
    y += 40
    plate(c, 56, y, 84, hit.venue, hit.race_number)
    lines, size = c.wrap(hit.race_name, "disp", (46, 40, 34), 1080 - 56 * 2 - 104, max_lines=2)
    text_y = y + 42 - (len(lines) - 1) * size * 0.6
    for line in lines:
        c.text(56 + 104, text_y, line, "disp", size, T.INK)
        text_y += size * 1.2
    y += 84 + 50
    box = (56, y, 1080 - 56, y + 360)
    c.rect(box, radius=28, fill=T.WHITE, outline=T.LINE, width=1.5)
    tag_w = c.text_width(hit.bet_type, "bold", 34) + 36
    c.rect((box[0] + 40, box[1] + 44, box[0] + 40 + tag_w, box[1] + 44 + 60), radius=10, fill=T.NAVY)
    c.text_center(box[0] + 40 + tag_w / 2, box[1] + 44 + 30, hit.bet_type, "bold", 34, T.WHITE)
    c.mixed_text(box[0] + 40 + tag_w + 28, box[1] + 44 + 30, hit.winning_numbers, "num", 64, T.INK2)
    yen_w = c.text_width("円", "bold", 44)
    c.text(box[2] - 40, box[3] - 46, "円", "bold", 44, T.NAVY, anchor="rs")
    c.text(box[2] - 40 - yen_w - 6, box[3] - 46, f"{hit.payout:,}", "num", 150, T.NAVY, anchor="rs")
    y = box[3] + 30
    for other in list(others)[:3]:
        c.rect((56, y, 1080 - 56, y + 84), radius=18, fill=T.WHITE, outline=T.LINE, width=1.5)
        cy = y + 42
        tag_w = c.text_width(other.bet_type, "bold", 26) + 24
        c.rect((84, cy - 22, 84 + tag_w, cy + 22), radius=8, fill=T.NAVY_SOFT)
        c.text_center(84 + tag_w / 2, cy, other.bet_type, "bold", 26, T.NAVY)
        c.mixed_text(84 + tag_w + 24, cy, other.winning_numbers, "num", 40, T.INK2)
        c.mixed_text(1080 - 56 - 28, cy, f"{other.payout:,}円", "num", 44, T.INK, anchor="rm")
        y += 84 + 14
    c.text(56, y + 40, "AIの印と全レースの結果は、サイトの開催日のページで確認できます。", "reg", 26, T.INK2)
    footer_bar(c, 90, "全レースの分析は uma-free.com", size=26)
    return c.save(path, fmt="JPEG")


def race_title(c: Canvas, x: float, y: float, card: RaceCard, *, s: float = 1.0, max_width: float = 968) -> float:
    """札・日付と条件・レース名とグレード。高さを返す。"""
    d = 84 * s
    plate(c, x, y, d, card.venue, card.race_number)
    text_x = x + d + 22 * s
    c.text(text_x, y + 18 * s, _race_meta(card), "bold", 20 * s, T.MUTED)
    badge = c.text_width(card.grade or "", "num" if _is_ascii(card.grade or "") else "bold", 22 * s) + 30 * s if card.grade else 0
    name, size = c.fit(card.race_name, "disp", 52 * s, max_width - (text_x - x) - badge - 14 * s, 30 * s)
    c.text(text_x, y + d - 22 * s, name, "disp", size, T.INK)
    if card.grade:
        grade_badge(c, text_x + c.text_width(name, "disp", size) + 14 * s, y + d - 22 * s, card.grade, 22 * s)
    return d


def render_threads_race(card: RaceCard, path: Path | str) -> str:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    top_bar(c, 110, date_label(card.date), size=50)
    x, width = 56, 968
    y = 110 + 48
    y += race_title(c, x, y, card, s=1.2) + 30
    c.text(x, y + 14, f"AI偏差値 上位{min(5, len(card.scored_rows))}頭", "bold", 26, T.BRAND_DEEP)
    y += 44
    for index, row in enumerate(card.scored_rows[:5]):
        y += rank_row(c, x, y, width, row, index, s=0.98, bar_width=320) + 12
    if any(row.position for row in card.rows):
        y += 18
        c.text(x, y + 14, "序盤の位置取り（右ほど前）", "bold", 26, T.TURF_DEEP)
        y += 40
        lanes_block(c, x, y, width, card, size=36, label_width=100)
    runners = f"全{card.runners}頭" if card.runners else "全頭"
    footer_bar(c, 90, f"{runners}のAI偏差値と展開予測はサイトで確認できます", size=24)
    return c.save(path, fmt="JPEG")


# ---------------------------------------------------------------------------
# Instagram カルーセル（1080×1350 × 最大6枚）
# ---------------------------------------------------------------------------
def _page_number(c: Canvas, number: int, total: int, *, dark: bool = False) -> None:
    c.text(1080 - 48, 44 + 13, f"{number} / {total}", "num", 26, T.ON_NIGHT_TEXT if dark else T.FAINT, anchor="rm")


def _carousel_cover(card: RaceCard, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.NIGHT)
    c.paste_photo(photo_for(card), (0, 0, 1080, 1350), focus=(0.5, 0.6))
    c.scrim((0, 0, 1080, 1350), [(0, 0.35), (0.4, 0.3), (0.65, 0.7), (1, 0.92)])
    lockup(c, 64, 60 + 29, 58, dark=True)
    _page_number(c, 1, total, dark=True)
    lines, size = c.wrap(card.race_name, "disp", (120, 104, 88, 76), 1080 - 128, max_lines=2)
    bottom = 1350 - 120
    y = bottom - 38 * 1.5 * 2 - 40 - 64 - 26 - size * 1.1 * len(lines) - 26 - 52
    pill = f"{date_label(card.date)} · {card.venue}{card.race_number}R"
    pill_w = c.text_width(pill, "bold", 28) + 40
    c.rect((64, y, 64 + pill_w, y + 52), radius=14, fill=_mix(T.WHITE, T.NIGHT, 0.14))
    c.text(84, y + 26, pill, "bold", 28, T.WHITE)
    y += 52 + 26
    for line in lines:
        c.text(64, y + size * 0.55, line, "disp", size, T.WHITE)
        y += size * 1.1
    y += 26
    badge_w = grade_badge(c, 64, y + 32, card.grade, 34) if card.grade else 0
    meta = " · ".join(card.meta_parts(with_grade=False))
    c.text(64 + badge_w + (18 if badge_w else 0), y + 32, meta, "bold", 34, T.ON_NIGHT_TEXT)
    y += 64 + 40
    c.text(64, y + 28, "AI偏差値の上位5頭と、", "bold", 38, T.WHITE)
    c.text(64, y + 28 + 57, "序盤の位置取りの予測", "bold", 38, T.WHITE)
    return c


def _carousel_header(c: Canvas, title: str, number: int, total: int) -> float:
    lockup(c, 56, 56 + 23, 46)
    _page_number(c, number, total)
    c.text(56, 56 + 46 + 40 + 34, title, "disp", 58, T.NAVY)
    return 56 + 46 + 40 + 84


def _carousel_top5(card: RaceCard, number: int, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    y = _carousel_header(c, f"AI偏差値 上位{min(5, len(card.scored_rows))}頭", number, total)
    c.text(56, y + 12, f"{card.race_name}（{date_label(card.date)} {card.venue}{card.race_number}R）", "bold", 28, T.MUTED)
    y += 70
    for index, row in enumerate(card.scored_rows[:5]):
        y += rank_row(c, 56, y, 968, row, index, s=1.42, bar_width=360) + 22
    return c


def _carousel_all(card: RaceCard, number: int, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    count = len(card.rows)
    y = _carousel_header(c, f"全{count}頭のAI偏差値", number, total)
    y += 10
    row_h = min(62.0, (1350 - y - 60 - 20) / max(1, count))
    c.rect((56, y, 1080 - 56, y + row_h * count + 20), radius=28, fill=T.WHITE, outline=T.LINE, width=1.5)
    y += 10
    scale = row_h / 62
    for row in card.rows:
        cy = y + row_h / 2
        mark_glyph(c, 56 + 28 + 15, cy, row.mark, 30 * scale)
        horse_no(c, 56 + 28 + 48 + 21 * scale, cy, 42 * scale, row.number, row.waku)
        name, size = c.fit(row.name, "disp", 32 * scale, 968 - 56 - 90 - 330, 20)
        c.text(56 + 28 + 100, cy, name, "disp", size, T.INK)
        score = f"{row.score:.1f}" if row.score is not None else "--"
        c.text(1080 - 56 - 28 - 250, cy, score, "num", 34 * scale, T.AI_DEEP if row.ai_rank == 1 else T.INK, anchor="rm")
        score_bar(c, 1080 - 56 - 28 - 236, cy, 236, 10 * scale, row.score, highlight=row.ai_rank == 1)
        y += row_h
        if row is not card.rows[-1]:
            c.line((56 + 28, y, 1080 - 56 - 28, y), T.LINE, 1.5)
    return c


def _carousel_lanes(card: RaceCard, number: int, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    y = _carousel_header(c, "展開予測", number, total)
    c.text(56, y + 20, "序盤（1コーナー）の位置取りの予測です。", "reg", 30, T.INK2)
    c.text(56, y + 20 + 48, "右ほど前。琥珀の輪はAI偏差値の上位3頭。", "reg", 30, T.INK2)
    y += 130
    height = lanes_block(c, 56, y, 968, card, size=62, label_width=130)
    note = _lanes_note(card)
    if note:
        note, size = c.fit(note + "です。", "reg", 28, 968, 22)
        c.text(56, y + height + 50, note, "reg", size, T.INK2)
    return c


def _carousel_advantages(card: RaceCard, number: int, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.BG)
    y = _carousel_header(c, "馬番の傾向", number, total)
    course = f"{card.venue}{card.course}" if card.course else card.venue
    c.text(56, y + 20, f"{course}の過去データで、", "reg", 30, T.INK2)
    c.text(56, y + 20 + 48, "今回の出走馬の馬番を並べています。", "reg", 30, T.INK2)
    y += 140
    values = card.advantages
    peak = max(abs(v) for _, v in values) or 1.0
    best = max(values, key=lambda item: item[1])[0]
    worst = min(values, key=lambda item: item[1])[0]
    chart_h = 250
    box = (56, y, 1080 - 56, y + 36 + chart_h * 2 + 30 + 70)
    c.rect(box, radius=28, fill=T.WHITE, outline=T.LINE, width=1.5)
    axis = y + 36 + chart_h
    c.line((box[0] + 20, axis, box[2] - 20, axis), T.LINE2, 2)
    slot = (box[2] - box[0] - 40) / len(values)
    waku = {row.number: row.waku for row in card.rows}
    for index, (horse_number, value) in enumerate(values):
        cx = box[0] + 20 + slot * index + slot / 2
        bar_h = abs(value) / peak * chart_h
        bar_w = min(40, slot * 0.6)
        color = T.BRAND if horse_number == best else T.BAD if horse_number == worst else (
            _mix(T.BRAND, T.WHITE, 0.5) if value >= 0 else _mix(T.BAD, T.WHITE, 0.45)
        )
        if value >= 0:
            c.rect((cx - bar_w / 2, axis - bar_h, cx + bar_w / 2, axis), radius=min(8, bar_h / 2), fill=color)
        else:
            c.rect((cx - bar_w / 2, axis, cx + bar_w / 2, axis + bar_h), radius=min(8, bar_h / 2), fill=color)
        horse_no(c, cx, box[3] - 50, min(48, slot * 0.8), horse_number, waku.get(horse_number))
    c.text(56, box[3] + 60, f"最も良い傾向は{best}番、最も低い傾向は{worst}番の馬番です。", "reg", 28, T.INK2)
    return c


def _carousel_closing(number: int, total: int) -> Canvas:
    c = Canvas(*PORTRAIT_SIZE, background=T.NIGHT)
    _page_number(c, number, total, dark=True)
    c.paste_logo(540 - 110, 230, 220)
    c.text_center(540, 560, "対戦成績・馬番の傾向も", "disp", 60, T.WHITE)
    c.text_center(540, 560 + 80, "全レースで公開中", "disp", 60, T.WHITE)
    labels = ("AI偏差値", "対戦成績", "展開予測", "馬番の傾向")
    cell_w, cell_h = (1080 - 140 - 16) / 2, 96
    for index, label in enumerate(labels):
        col, line = index % 2, index // 2
        x = 70 + col * (cell_w + 16)
        y = 740 + line * (cell_h + 16)
        c.rect((x, y, x + cell_w, y + cell_h), radius=20, fill=_mix(T.WHITE, T.NIGHT, 0.08), outline=_mix(T.WHITE, T.NIGHT, 0.16), width=1.5)
        c.text_center(x + cell_w / 2, y + cell_h / 2, label, "bold", 32, T.WHITE)
    c.text_center(540, 1010, "全レースの分析は", "bold", 34, T.ON_NIGHT_TEXT)
    c.text_center(540, 1010 + 54, "プロフィールのリンクから", "bold", 34, T.ON_NIGHT_TEXT)
    width = 56 + 56 * 0.28 + c.text_width("UMA-FREE", "disp", 56 * 0.56)
    lockup(c, 540 - width / 2, 1190, 56, dark=True)
    return c


def render_carousel(card: RaceCard, directory: Path | str) -> list[str]:
    """重賞1レースのカルーセル。位置取り・馬番の傾向のデータが無いページは作らない。"""
    directory = Path(directory)
    pages = ["cover", "top5", "all"]
    if any(row.position for row in card.rows):
        pages.append("lanes")
    if len(card.advantages) >= 2:
        pages.append("advantages")
    pages.append("closing")
    total = len(pages)
    paths = []
    for number, page in enumerate(pages, 1):
        canvas = {
            "cover": lambda: _carousel_cover(card, total),
            "top5": lambda: _carousel_top5(card, number, total),
            "all": lambda: _carousel_all(card, number, total),
            "lanes": lambda: _carousel_lanes(card, number, total),
            "advantages": lambda: _carousel_advantages(card, number, total),
            "closing": lambda: _carousel_closing(number, total),
        }[page]()
        paths.append(canvas.save(directory / f"{number:02d}-{page}.jpg", fmt="JPEG"))
    return paths
