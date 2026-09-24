"""SNS投稿の中身（投稿文・画像に載せる値）を、APIの日次データから組み立てる。

- 投稿文はデザイン改修の「言葉の決まり」に合わせる：絵文字を使わない、「！」を重ねない、
  「必勝・絶対・最強・圧倒的・推奨・買い・投資」「〜はこちら」を使わない。事実を短く、数字には条件を添える。
- Xの本文にはURLを入れない（sns_poster がURL行とその直前の案内行を落とす）。案内行は LINK_LABELS のどれかにする。
- X の文字数は X の数え方（日本語などは2、URLは23）で数える。
- 画像の描画は sns_images.py、投稿は sns_poster.py が受け持つ。
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterable, Optional

from core.race_name import display_race_name

SITE_BASE_URL = "https://uma-free.com"
JRA_VENUES = ("札幌", "函館", "福島", "新潟", "東京", "中山", "中京", "京都", "阪神", "小倉")
WEEKDAYS = ("月", "火", "水", "木", "金", "土", "日")
MARKS = ("◎", "○", "▲", "△", "☆")

# URLの直前に置く案内行。Xの本文ではURLと一緒に落とす。
LINK_LABELS = ("全レースの分析", "全頭の分析", "結果とAIの評価")

X_MAX_WEIGHTED_LENGTH = 280
X_URL_WEIGHT = 23
URL_PATTERN = re.compile(r"https?://\S+")

# 使わない言葉（SNS動画の配信と同じ一覧に、推奨・買い目などを足す）
PROHIBITED_SNS_PHRASES = (
    "投資", "必勝", "絶対", "圧倒的", "最強", "消去対象", "推奨", "買い目", "おすすめ", "はこちら",
)


# ---------------------------------------------------------------------------
# Xの文字数
# ---------------------------------------------------------------------------
def _is_light_char(code_point: int) -> bool:
    """X（twitter-text v3）で1文字と数える範囲。ほかは2文字。"""
    return (
        0x0000 <= code_point <= 0x10FF
        or 0x2000 <= code_point <= 0x200D
        or 0x2010 <= code_point <= 0x201F
        or 0x2032 <= code_point <= 0x2037
    )


def _weighted_chars(text: str) -> int:
    return sum(1 if _is_light_char(ord(ch)) else 2 for ch in text)


def x_weighted_length(text: str) -> int:
    """Xの数え方での長さ。URLは長さに関係なく23。"""
    text = unicodedata.normalize("NFC", text)
    total = 0
    last = 0
    for match in URL_PATTERN.finditer(text):
        total += _weighted_chars(text[last:match.start()]) + X_URL_WEIGHT
        last = match.end()
    return total + _weighted_chars(text[last:])


def find_prohibited_phrases(text: str) -> list[str]:
    return [phrase for phrase in PROHIBITED_SNS_PHRASES if phrase in text]


# ---------------------------------------------------------------------------
# 表記
# ---------------------------------------------------------------------------
def parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def date_label(value: str | date) -> str:
    """「9月20日(日)」"""
    day = parse_date(value)
    return f"{day.month}月{day.day}日({WEEKDAYS[day.weekday()]})"


def build_race_url(date_str: str) -> str:
    """その日のレース一覧（開催日ボード）。/races/ 配下はクエリを付けても落とされるため付けない。"""
    return f"{SITE_BASE_URL}/races/{str(date_str)[:10]}"


def is_jra_venue(venue_name: str) -> bool:
    return any(venue in (venue_name or "") for venue in JRA_VENUES)


def surface_label(course_type: Any) -> Optional[str]:
    """「芝」「ダ」「障」。分からなければ None。"""
    text = str(course_type or "")
    if "障" in text:
        return "障"
    if "芝" in text:
        return "芝"
    if "ダ" in text:
        return "ダ"
    return None


def course_label(surface: Optional[str], distance: Optional[int]) -> str:
    """「芝2200m」「ダ1400m」「障害3000m」"""
    if not surface and not distance:
        return ""
    name = {"芝": "芝", "ダ": "ダ", "障": "障害"}.get(surface or "", "")
    return f"{name}{distance}m" if distance else name


def grade_label(grade: Any) -> Optional[str]:
    """バッジに出す文字。地方重賞は「重賞」だけにする。"""
    text = str(grade or "").strip()
    if not text:
        return None
    return "重賞" if text == "地方重賞" else text


def grade_priority(grade: Any) -> int:
    """並べる順（小さいほど先）。G1・Jpn1 → G2・Jpn2 → G3・Jpn3 → そのほかの重賞。"""
    text = str(grade or "").upper()
    for rank, digit in enumerate(("1", "2", "3")):
        if text.endswith(digit):
            return rank
    return 3 if text else 9


def hashtag(text: str) -> str:
    """ハッシュタグに使えない記号を落とす。"""
    cleaned = re.sub(r"[\s#＃・･,，、。．\.\(\)（）\[\]【】「」『』!！?？:：/／\-‐－〔〕]", "", text or "")
    return f"#{cleaned}" if cleaned else ""


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None and str(value).strip() != "" else None
    except (TypeError, ValueError):
        return None


def waku_for(horse_number: Optional[int], runners: int) -> Optional[int]:
    """枠番が無いときに、頭数と馬番から枠を求める（frontend/lib/utils.ts の getWakuNumber と同じ）。"""
    if not horse_number or horse_number < 1:
        return None
    if runners <= 8:
        return horse_number
    quotient, remainder = divmod(runners, 8)
    counts = [quotient + 1 if (7 - index) < remainder else quotient for index in range(8)]
    current = 1
    for index, count in enumerate(counts):
        if horse_number < current + count:
            return index + 1
        current += count
    return 8


# ---------------------------------------------------------------------------
# 画像と投稿文に使う値
# ---------------------------------------------------------------------------
@dataclass
class HorseRow:
    number: Optional[int]
    waku: Optional[int]
    name: str
    score: Optional[float]
    mark: str = ""
    ai_rank: Optional[int] = None
    # 序盤の位置取り（「先行」「中団」「後方」）と、レース内の前後（0〜100。大きいほど前）
    position: Optional[str] = None
    position_index: Optional[float] = None

    @property
    def mark_or_rank(self) -> str:
        if self.mark in MARKS:
            return self.mark
        return f"{self.ai_rank}位" if self.ai_rank else ""


@dataclass
class RaceCard:
    date: str
    venue: str
    race_number: int
    race_name: str
    race_id: str = ""
    grade: Optional[str] = None
    surface: Optional[str] = None
    distance: Optional[int] = None
    runners: int = 0
    rows: list[HorseRow] = field(default_factory=list)  # AI偏差値の高い順（値の無い馬は最後）
    advantages: list[tuple[int, float]] = field(default_factory=list)  # 馬番の傾向（馬番, 値）

    @property
    def scored_rows(self) -> list[HorseRow]:
        return [row for row in self.rows if row.score is not None]

    @property
    def course(self) -> str:
        return course_label(self.surface, self.distance)

    @property
    def is_jra(self) -> bool:
        return is_jra_venue(self.venue)

    def meta_parts(self, *, with_grade: bool = True) -> list[str]:
        parts = []
        label = grade_label(self.grade)
        if with_grade and label:
            parts.append(label)
        if self.course:
            parts.append(self.course)
        if self.runners:
            parts.append(f"{self.runners}頭")
        return parts

    def front_runner_count(self) -> int:
        return sum(1 for row in self.rows if row.position == "先行")


@dataclass
class PickCard:
    race: RaceCard
    pick: HorseRow
    total_races: int
    venues_label: str


@dataclass
class HitCard:
    date: str
    venue: str
    race_number: int
    race_name: str
    bet_type: str
    winning_numbers: str
    payout: int


def _position_labels(predictions: list[dict[str, Any]]) -> dict[int, tuple[str, float]]:
    """序盤の位置取りをレース内の相対値で分ける（frontend/lib/race-display.ts の getPositionLabels と同じ）。"""
    values = [
        (int(p["horse_number"]), float(p["start_1c_indicator"]))
        for p in predictions
        if _safe_int(p.get("horse_number")) is not None and _safe_float(p.get("start_1c_indicator")) is not None
    ]
    if not values:
        return {}
    low = min(value for _, value in values)
    high = max(value for _, value in values)
    spread = high - low
    labels: dict[int, tuple[str, float]] = {}
    for number, value in values:
        if spread < 0.01:
            labels[number] = ("中団", 50.0)
            continue
        ratio = (value - low) / spread
        label = "後方" if ratio < 0.35 else "先行" if ratio > 0.65 else "中団"
        labels[number] = (label, ratio * 100)
    return labels


def race_card_from_api(race: dict[str, Any], venue_name: str = "", race_date: str = "") -> RaceCard:
    predictions = [p for p in (race.get("predictions") or []) if isinstance(p, dict)]
    runners = _safe_int(race.get("total_horses")) or len(predictions)
    positions = _position_labels(predictions)
    rows: list[HorseRow] = []
    for prediction in predictions:
        number = _safe_int(prediction.get("horse_number"))
        waku = _safe_int(prediction.get("waku_number"))
        if not waku or not 1 <= waku <= 8:
            waku = waku_for(number, runners)
        label, index = positions.get(number, (None, None)) if number is not None else (None, None)
        rows.append(HorseRow(
            number=number,
            waku=waku,
            name=str(prediction.get("horse_name") or "").strip(),
            score=_safe_float(prediction.get("deviation_score")),
            mark=str(prediction.get("mark") or "").replace("〇", "○").strip(),
            position=label,
            position_index=index,
        ))
    rows.sort(key=lambda row: (row.score is None, -(row.score or 0.0), row.number or 99))
    rank = 0
    for row in rows:
        if row.score is not None:
            rank += 1
            row.ai_rank = rank
    advantages = []
    runner_numbers = {row.number for row in rows if row.number}
    for item in race.get("horse_number_advantages") or []:
        number = _safe_int(item.get("horse_number")) if isinstance(item, dict) else None
        value = _safe_float(item.get("advantage_score")) if isinstance(item, dict) else None
        if number is not None and value is not None and number in runner_numbers:
            advantages.append((number, value))
    advantages.sort()
    return RaceCard(
        date=str(race.get("race_date") or race_date)[:10],
        venue=str(race.get("venue_name") or venue_name or ""),
        race_number=_safe_int(race.get("race_number")) or 0,
        race_name=display_race_name(str(race.get("race_name") or "")) or str(race.get("race_name") or ""),
        race_id=str(race.get("id") or race.get("race_id") or ""),
        grade=grade_label(race.get("grade")),
        surface=surface_label(race.get("course_type")),
        distance=_safe_int(race.get("distance")),
        runners=runners,
        rows=rows,
        advantages=advantages,
    )


def iter_race_cards(day: Optional[dict[str, Any]], race_date: str) -> Iterable[RaceCard]:
    for venue in (day or {}).get("jra", []) + (day or {}).get("nar", []):
        for race in venue.get("races") or []:
            if isinstance(race, dict):
                yield race_card_from_api(race, str(venue.get("venue_name") or ""), race_date)


def describe_venues(day: Optional[dict[str, Any]]) -> str:
    """「中央2場・地方2場」"""
    jra = sum(1 for venue in (day or {}).get("jra", []) if venue.get("races"))
    nar = sum(1 for venue in (day or {}).get("nar", []) if venue.get("races"))
    return "・".join(part for part in (f"中央{jra}場" if jra else "", f"地方{nar}場" if nar else "") if part)


def find_best_pick(day: Optional[dict[str, Any]], race_date: str) -> Optional[PickCard]:
    """その日の全レースで最もAI偏差値の高い馬。"""
    best: Optional[tuple[RaceCard, HorseRow]] = None
    # 「全47レースで最上位」の母数は、AI偏差値の出ないレース（新馬戦など）も含めたその日の全レース
    total = 0
    for card in iter_race_cards(day, race_date):
        total += 1
        scored = card.scored_rows
        if not scored:
            continue
        if best is None or (scored[0].score or 0) > (best[1].score or 0):
            best = (card, scored[0])
    if best is None:
        return None
    return PickCard(race=best[0], pick=best[1], total_races=total, venues_label=describe_venues(day))


def find_grade_races(day: Optional[dict[str, Any]], race_date: str, *, min_scored: int = 3) -> list[RaceCard]:
    """重賞（グレードの付いたレース）をグレードの高い順に。AI偏差値のある馬が min_scored 頭未満のレースは外す。"""
    cards = [
        card
        for card in iter_race_cards(day, race_date)
        if card.grade and len(card.scored_rows) >= min_scored
    ]
    cards.sort(key=lambda card: (grade_priority(card.grade), not card.is_jra, card.venue, card.race_number))
    return cards


def hit_card_from_api(hit: dict[str, Any], fallback_date: str) -> HitCard:
    return HitCard(
        date=str(hit.get("race_date") or fallback_date)[:10],
        venue=str(hit.get("venue_name") or ""),
        race_number=_safe_int(hit.get("race_number")) or 0,
        race_name=display_race_name(str(hit.get("race_name") or "")) or str(hit.get("race_name") or ""),
        bet_type=str(hit.get("bet_type") or ""),
        winning_numbers=str(hit.get("winning_numbers") or ""),
        payout=_safe_int(hit.get("payout")) or 0,
    )


# ---------------------------------------------------------------------------
# 投稿文
# ---------------------------------------------------------------------------
def _link_block(label: str, url: str) -> list[str]:
    assert label in LINK_LABELS
    return [label, url]


def _race_heading(card: RaceCard) -> str:
    """「中山11R オールカマー（G2・芝2200m・13頭）」"""
    meta = "・".join(card.meta_parts())
    return f"{card.venue}{card.race_number}R {card.race_name}" + (f"（{meta}）" if meta else "")


def _horse_label(row: HorseRow) -> str:
    return f"{row.number}番 {row.name}" if row.number else row.name


def _hashtags(*tags: str) -> str:
    seen: list[str] = []
    for tag in tags:
        if tag and tag not in seen:
            seen.append(tag)
    return " ".join(seen)


def build_pick_text(card: PickCard) -> str:
    race = card.race
    pick = card.pick
    lines = [
        f"{date_label(race.date)} 本日のAI注目馬",
        _race_heading(race),
        _horse_label(pick),
        f"AI偏差値 {pick.score:.1f}（全{card.total_races}レースで最上位）" if card.total_races > 1 else f"AI偏差値 {pick.score:.1f}",
    ]
    others = [row for row in race.scored_rows if row is not pick][:2]
    if others:
        lines.append("／".join(f"{row.ai_rank}位 {row.name} {row.score:.1f}" for row in others))
    lines += _link_block("全レースの分析", build_race_url(race.date))
    lines.append(_hashtags(
        hashtag(f"{race.venue}競馬"),
        "#中央競馬" if race.is_jra else "#地方競馬",
        "#競馬予想",
    ))
    return "\n".join(lines)


def build_hit_text(hit: HitCard, honmei: Optional[dict[str, Any]] = None) -> str:
    lines = [
        f"{date_label(hit.date)}の結果 AI予想の的中",
        f"{hit.venue}{hit.race_number}R {hit.race_name}".strip(),
        f"{hit.bet_type} {hit.winning_numbers} {hit.payout:,}円",
    ]
    total = int((honmei or {}).get("total") or 0)
    if total > 0:
        win = int(honmei.get("win") or 0)
        second = int(honmei.get("second") or 0)
        third = int(honmei.get("third") or 0)
        other = int(honmei.get("other") or 0)
        win_rate = win / total * 100
        place_rate = (win + second + third) / total * 100
        lines.append(f"AI本命(◎)の成績 {win}-{second}-{third}-{other}（勝率{win_rate:.1f}%・複勝率{place_rate:.1f}%）")
    lines += _link_block("結果とAIの評価", build_race_url(hit.date))
    lines.append(_hashtags(
        hashtag(f"{hit.venue}競馬"),
        "#万馬券" if hit.payout >= 10000 else "",
        "#競馬予想",
    ))
    return "\n".join(lines)


def build_day_summary_text(
    race_date: str,
    day: Optional[dict[str, Any]],
    top_hit: Optional[HitCard] = None,
) -> Optional[str]:
    venues: list[tuple[str, int, bool]] = []
    for group in ("jra", "nar"):
        for venue in (day or {}).get(group, []):
            count = len(venue.get("races") or [])
            if count:
                venues.append((str(venue.get("venue_name") or ""), count, group == "jra"))
    if not venues:
        return None
    total = sum(count for _, count, _ in venues)
    ordered = sorted(venues, key=lambda item: item[1], reverse=True)[:5]
    lines = [
        f"{date_label(race_date)} 本日の開催",
        f"{describe_venues(day)}・全{total}レースのAI偏差値を公開しています",
        "・".join(f"{name} 全{count}R" for name, count, _ in ordered),
    ]
    if top_hit and top_hit.payout > 0:
        lines.append(
            f"{date_label(top_hit.date)}の最高配当 {top_hit.venue}{top_hit.race_number}R "
            f"{top_hit.bet_type} {top_hit.payout:,}円"
        )
    lines += _link_block("全レースの分析", build_race_url(race_date))
    lines.append(_hashtags(
        "#中央競馬" if any(is_jra for _, _, is_jra in venues) else "",
        "#地方競馬" if any(not is_jra for _, _, is_jra in venues) else "",
        "#競馬予想",
    ))
    return "\n".join(lines)


def build_race_text(card: RaceCard, headline: str, *, top: int = 3) -> str:
    """重賞・メインレースの投稿。headline は「9月20日(日)の重賞」「9月20日(日) 本日のメインレース」など。"""
    lines = [
        # 地方重賞のバッジは「重賞」なので、見出しと重ならないよう括弧では書かない
        f"{headline} {card.venue}{card.race_number}R {card.race_name}" + (f"（{card.grade}）" if card.grade and card.grade != "重賞" else ""),
        "・".join(card.meta_parts(with_grade=False)) + f" AI偏差値の上位{min(top, len(card.scored_rows))}頭",
    ]
    for row in card.scored_rows[:top]:
        lines.append(f"{row.mark_or_rank} {_horse_label(row)} {row.score:.1f}")
    lines += _link_block("全頭の分析", build_race_url(card.date))
    lines.append(_hashtags(hashtag(card.race_name), hashtag(f"{card.venue}競馬"), "#競馬予想"))
    return "\n".join(lines)


def build_carousel_caption(card: RaceCard) -> str:
    top = card.scored_rows[:3]
    lines = [
        f"{date_label(card.date)} {card.venue}{card.race_number}R {card.race_name}" + (f"（{card.grade}）" if card.grade else ""),
        "・".join(card.meta_parts(with_grade=False)) + "のAI偏差値の上位と、序盤の位置取りの予測です。",
        "／".join(f"{row.ai_rank}位 {row.name} {row.score:.1f}" for row in top),
        "全頭の分析はプロフィールのリンクから確認できます。",
        _hashtags(hashtag(card.race_name), hashtag(f"{card.venue}競馬"), "#競馬予想", "#AI予想"),
    ]
    return "\n".join(line for line in lines if line)
