"""
常設コラム向けのWriteOrder生成スクリプト。

重賞の直近需要は news_topic_planner / grade_race_writer に任せつつ、
騎手分析、競馬場単位のコース分析、入門ガイドを毎日少しずつ補充する。
距離別にURLを乱立させず、コース分析は競馬場ごとに各距離を1本の記事へ束ねる。
"""

from __future__ import annotations

import glob
import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from bs4 import BeautifulSoup


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, "data", "write_orders")
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "posted_history.json")
EVERGREEN_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "evergreen_topic_history.json")
ARTICLES_DIR = os.path.join(PROJECT_ROOT, "frontend", "content", "articles")
REFERENCE_DATA_SUMMARY_PATH = os.path.join(PROJECT_ROOT, "docs", "reference_data_summary.md")

# ルート直下のtxtは移行期間中の補助スナップショット。将来削除されても、
# docs/reference_data_summary.md から常設コラム候補を生成できる構成を維持する。
JRA_JOCKEY_LEADING_PATH = os.path.join(PROJECT_ROOT, "中央競馬ジョッキーリーディング.txt")
NAR_JOCKEY_LEADING_PATH = os.path.join(PROJECT_ROOT, "地方競馬ジョッキーリーディング.txt")
JRA_COURSE_LIST_PATH = os.path.join(PROJECT_ROOT, "中央競馬ｺｰｽ一覧.txt")
NAR_COURSE_LIST_PATH = os.path.join(PROJECT_ROOT, "地方競馬ｺｰｽ一覧.txt")

JST = timezone(timedelta(hours=9))

VENUE_SLUGS = {
    "札幌": "sapporo",
    "函館": "hakodate",
    "福島": "fukushima",
    "新潟": "niigata",
    "東京": "tokyo",
    "中山": "nakayama",
    "中京": "chukyo",
    "京都": "kyoto",
    "阪神": "hanshin",
    "小倉": "kokura",
    "門別": "monbetsu",
    "盛岡": "morioka",
    "水沢": "mizusawa",
    "浦和": "urawa",
    "船橋": "funabashi",
    "大井": "ohi",
    "川崎": "kawasaki",
    "金沢": "kanazawa",
    "笠松": "kasamatsu",
    "名古屋": "nagoya",
    "園田": "sonoda",
    "姫路": "himeji",
    "高知": "kochi",
    "佐賀": "saga",
    "帯広": "obihiro",
    "帯広ば": "obihiro",
}

KNOWN_JOCKEY_SLUGS = {
    "武豊": "yutaka-take",
    "C.ルメール": "christophe-lemaire",
    "Ｃ.ルメール": "christophe-lemaire",
    "クリストフ・ルメール": "christophe-lemaire",
    "川田将雅": "yuga-kawada",
    "横山武史": "takeshi-yokoyama",
    "戸崎圭太": "keita-tosaki",
    "坂井瑠星": "rusei-sakai",
    "松山弘平": "hiroaki-matsuyama",
    "三浦皇成": "kosei-miura",
    "菅原明良": "akira-sugawara",
    "岩田望来": "mirai-iwata",
    "西村淳也": "atsuki-nishimura",
    "丹内祐次": "yuji-tannai",
    "横山和生": "kazuo-yokoyama",
}

COURSE_VENUE_PRIORITY = [
    "東京",
    "中山",
    "京都",
    "阪神",
    "中京",
    "新潟",
    "福島",
    "小倉",
    "札幌",
    "函館",
    "大井",
    "川崎",
    "船橋",
    "浦和",
    "門別",
    "盛岡",
    "水沢",
    "金沢",
    "笠松",
    "名古屋",
    "園田",
    "姫路",
    "高知",
    "佐賀",
    "帯広",
]


@dataclass(frozen=True)
class CourseVenueTopic:
    venue: str
    circuit: str
    source_file: str
    rows: Tuple[Dict[str, str], ...]


@dataclass(frozen=True)
class JockeyTopic:
    name: str
    circuit: str
    rank: int
    source_file: str
    rows: Tuple[Dict[str, str], ...]


@dataclass(frozen=True)
class BeginnerTopic:
    key: str
    target_keyword: str
    focus: str
    rows: Tuple[Dict[str, str], ...]
    structure: Tuple[str, ...]


@dataclass
class GeneratedOrder:
    kind: str
    key: str
    order: Dict[str, Any]


def current_jst() -> datetime:
    configured_now = os.environ.get("KEIBA_EVERGREEN_NOW") or os.environ.get("KEIBA_NEWS_NOW")
    if configured_now:
        try:
            parsed = datetime.fromisoformat(configured_now)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=JST)
            return parsed.astimezone(JST)
        except ValueError:
            pass
    return datetime.now(JST)


def stable_hash(value: str, length: int = 10) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:length]


def normalize_key(value: str) -> str:
    return re.sub(r"[\s　・（）()【】「」『』｜|:：,、。/\\_\-]", "", value or "").lower()


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").replace("　", " ")).strip()


def percent_from_rate(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.endswith("%"):
        return raw
    try:
        number = float(raw)
    except ValueError:
        return raw
    if number <= 1:
        return f"{number * 100:.1f}%"
    return f"{number:.1f}%"


def compact_join(items: Iterable[str], limit: int = 14) -> str:
    values = [item for item in dict.fromkeys(item.strip() for item in items if item.strip())]
    if len(values) <= limit:
        return "、".join(values)
    return "、".join(values[:limit]) + f"、ほか{len(values) - limit}件"


def parse_positive_int(value: Optional[str], fallback: int) -> int:
    try:
        parsed = int(value or "")
        return parsed if parsed > 0 else fallback
    except ValueError:
        return fallback


def clean_markdown_cell(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"\s+", " ", text.replace("　", " ")).strip()
    return text


def split_markdown_row(line: str) -> List[str]:
    raw = line.strip()
    if not raw.startswith("|") or not raw.endswith("|"):
        return []
    return [clean_markdown_cell(cell) for cell in raw.strip("|").split("|")]


def is_markdown_separator(cells: Sequence[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", cell.strip()) for cell in cells)


def read_reference_summary() -> str:
    if not os.path.exists(REFERENCE_DATA_SUMMARY_PATH):
        return ""
    with open(REFERENCE_DATA_SUMMARY_PATH, "r", encoding="utf-8") as f:
        return f.read()


def reference_source_name() -> str:
    return os.path.join("docs", os.path.basename(REFERENCE_DATA_SUMMARY_PATH)).replace("\\", "/")


def extract_reference_section(markdown: str, heading_prefix: str) -> str:
    pattern = re.compile(
        rf"^##\s+{re.escape(heading_prefix)}[\s\S]*?(?=^---\s*$\s*^##\s+|\Z)",
        re.MULTILINE,
    )
    match = pattern.search(markdown)
    return match.group(0) if match else ""


def extract_markdown_tables(section: str) -> List[Tuple[List[str], List[List[str]]]]:
    tables: List[Tuple[List[str], List[List[str]]]] = []
    current: List[str] = []
    for line in section.splitlines():
        if line.strip().startswith("|") and line.strip().endswith("|"):
            current.append(line)
            continue
        if current:
            table = parse_markdown_table(current)
            if table:
                tables.append(table)
            current = []
    if current:
        table = parse_markdown_table(current)
        if table:
            tables.append(table)
    return tables


def parse_markdown_table(lines: Sequence[str]) -> Optional[Tuple[List[str], List[List[str]]]]:
    rows = [split_markdown_row(line) for line in lines]
    rows = [row for row in rows if row]
    if len(rows) < 2:
        return None
    header = rows[0]
    body = rows[1:]
    if body and is_markdown_separator(body[0]):
        body = body[1:]
    body = [row for row in body if len(row) == len(header) and not is_markdown_separator(row)]
    if not body:
        return None
    return header, body


def reference_table_by_heading(heading_prefix: str) -> Optional[Tuple[List[str], List[List[str]]]]:
    section = extract_reference_section(read_reference_summary(), heading_prefix)
    tables = extract_markdown_tables(section)
    return tables[0] if tables else None


def value_from_row(header: Sequence[str], row: Sequence[str], name: str) -> str:
    for index, header_name in enumerate(header):
        if clean_markdown_cell(header_name) == name and index < len(row):
            return clean_markdown_cell(row[index])
    return ""


def parse_distance_entries(raw: str) -> List[str]:
    values: List[str] = []
    for item in re.split(r"[,、]", raw or ""):
        cleaned = clean_markdown_cell(item)
        cleaned = re.sub(r"\s+", "", cleaned)
        match = re.search(r"(\d{3,4}m)(?:\(([^)]+)\)|（([^）]+)）)?", cleaned)
        if not match:
            continue
        label = match.group(1)
        note = match.group(2) or match.group(3) or ""
        if note and "芝あり" not in note:
            label += f"（{note}）"
        values.append(label)
    return values


def merge_source_names(*names: str) -> str:
    values = [name for name in dict.fromkeys(name for name in names if name)]
    return "+".join(values)


def load_json_array(path_value: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path_value):
        return []
    try:
        with open(path_value, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def frontmatter_value(frontmatter: str, key: str) -> str:
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*:\s*(.+?)\s*$", re.MULTILINE)
    match = pattern.search(frontmatter)
    if not match:
        return ""
    return match.group(1).strip().strip('"').strip("'")


def load_existing_article_keys() -> Set[str]:
    keys: Set[str] = set()
    if not os.path.exists(ARTICLES_DIR):
        return keys

    for filepath in glob.glob(os.path.join(ARTICLES_DIR, "*.md")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            continue
        if not content.startswith("---"):
            continue
        parts = content.split("---", 2)
        if len(parts) < 3:
            continue
        frontmatter = parts[1]
        for key in (
            "target_keyword",
            "title",
            "entity_key",
            "content_target",
            "theme_cluster",
        ):
            value = frontmatter_value(frontmatter, key)
            if value:
                keys.add(normalize_key(value))
    return keys


def load_pending_order_keys() -> Set[str]:
    keys: Set[str] = set()
    if not os.path.exists(WRITE_ORDERS_DIR):
        return keys
    for filepath in glob.glob(os.path.join(WRITE_ORDERS_DIR, "*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                order = json.load(f)
        except Exception:
            continue
        for value in (
            order.get("target_keyword"),
            order.get("entity_key"),
            order.get("content_target"),
            order.get("theme_cluster"),
        ):
            if value:
                keys.add(normalize_key(str(value)))
    return keys


def load_posted_keys() -> Set[str]:
    keys: Set[str] = set()
    for item in load_json_array(POSTED_HISTORY_PATH):
        for value in (item.get("target_keyword"), item.get("slug"), item.get("entity_key")):
            if value:
                keys.add(normalize_key(str(value)))
    return keys


def all_known_keys() -> Set[str]:
    return load_existing_article_keys() | load_pending_order_keys() | load_posted_keys()


def topic_is_known(target_keyword: str, extra_key: str, known_keys: Set[str]) -> bool:
    normalized_target = normalize_key(target_keyword)
    normalized_extra = normalize_key(extra_key)
    return normalized_target in known_keys or (normalized_extra and normalized_extra in known_keys)


def parse_reference_jra_jockey_topics() -> List[JockeyTopic]:
    table = reference_table_by_heading("1.")
    if not table:
        return []
    header, rows = table
    topics: List[JockeyTopic] = []
    source = reference_source_name()
    for row in rows:
        rank_raw = value_from_row(header, row, "順位")
        if not rank_raw.isdigit():
            continue
        rank = int(rank_raw)
        name = normalize_name(value_from_row(header, row, "騎手名"))
        metric = {
            "順位": f"{rank}位",
            "騎手": name,
            "所属": "JRA",
            "騎乗回数": value_from_row(header, row, "騎乗回数"),
            "1着": value_from_row(header, row, "1着"),
            "2着": value_from_row(header, row, "2着"),
            "3着": value_from_row(header, row, "3着"),
            "勝率": value_from_row(header, row, "勝率"),
            "連対率": value_from_row(header, row, "連対率"),
            "3着内率": value_from_row(header, row, "3着内率"),
        }
        topics.append(JockeyTopic(name=name, circuit="中央", rank=rank, source_file=source, rows=(metric,)))
    return topics


def parse_reference_nar_jockey_topics() -> List[JockeyTopic]:
    table = reference_table_by_heading("2.")
    if not table:
        return []
    header, rows = table
    topics: List[JockeyTopic] = []
    source = reference_source_name()
    for row in rows:
        rank_raw = value_from_row(header, row, "順位")
        if not rank_raw.isdigit():
            continue
        rank = int(rank_raw)
        name = normalize_name(value_from_row(header, row, "騎手名"))
        metric = {
            "順位": f"{rank}位",
            "騎手": name,
            "所属": value_from_row(header, row, "所属"),
            "騎乗回数": value_from_row(header, row, "騎乗回数"),
            "1着": value_from_row(header, row, "1着"),
            "2着": value_from_row(header, row, "2着"),
            "3着": value_from_row(header, row, "3着"),
            "勝率": value_from_row(header, row, "勝率"),
            "連対率": value_from_row(header, row, "連対率"),
            "3着内率": value_from_row(header, row, "3着内率"),
        }
        topics.append(JockeyTopic(name=name, circuit="地方", rank=rank, source_file=source, rows=(metric,)))
    return topics


def merge_jockey_topics(reference_topics: Sequence[JockeyTopic], file_topics: Sequence[JockeyTopic]) -> List[JockeyTopic]:
    merged: Dict[str, JockeyTopic] = {}
    for topic in reference_topics:
        merged[normalize_name(topic.name)] = topic
    for topic in file_topics:
        key = normalize_name(topic.name)
        if key not in merged:
            merged[key] = topic
    return sorted(merged.values(), key=lambda item: item.rank)


def parse_reference_jra_course_topics() -> List[CourseVenueTopic]:
    table = reference_table_by_heading("5.")
    if not table:
        return []
    header, rows = table
    source = reference_source_name()
    topics: List[CourseVenueTopic] = []
    for row in rows:
        venue = value_from_row(header, row, "競馬場")
        feature = value_from_row(header, row, "特徴・確認ポイント")
        course_rows: List[Dict[str, str]] = []
        for distance in parse_distance_entries(value_from_row(header, row, "芝コース")):
            course_rows.append(
                {
                    "競馬場": venue,
                    "区分": "中央",
                    "回り": "",
                    "コース": f"芝{distance}",
                    "確認ポイント": feature or f"{venue}芝{distance}は、スタート位置と直線の形を確認する。",
                    "リファレンス要点": feature,
                }
            )
        for distance in parse_distance_entries(value_from_row(header, row, "ダートコース")):
            course_rows.append(
                {
                    "競馬場": venue,
                    "区分": "中央",
                    "回り": "",
                    "コース": f"ダート{distance}",
                    "確認ポイント": feature or f"{venue}ダート{distance}は、スタート位置とコーナーまでの距離を確認する。",
                    "リファレンス要点": feature,
                }
            )
        if course_rows:
            topics.append(CourseVenueTopic(venue=venue, circuit="中央", source_file=source, rows=tuple(course_rows)))
    return sorted(topics, key=lambda item: COURSE_VENUE_PRIORITY.index(item.venue) if item.venue in COURSE_VENUE_PRIORITY else 999)


def parse_reference_nar_course_topics() -> List[CourseVenueTopic]:
    table = reference_table_by_heading("6.")
    if not table:
        return []
    header, rows = table
    source = reference_source_name()
    topics: List[CourseVenueTopic] = []
    for row in rows:
        venue = value_from_row(header, row, "競馬場")
        turn = value_from_row(header, row, "回り")
        feature = value_from_row(header, row, "特徴・コース解説")
        course_rows: List[Dict[str, str]] = []
        for distance in parse_distance_entries(value_from_row(header, row, "主要距離（ダート）")):
            course = nar_course_label(venue, distance)
            course_rows.append(
                {
                    "競馬場": venue,
                    "区分": "地方",
                    "回り": turn,
                    "コース": course,
                    "確認ポイント": feature or f"{venue}{course}は、回り方向と直線までの位置取りを確認する。",
                    "リファレンス要点": feature,
                }
            )
        if venue == "盛岡" and not any(row_data["コース"].startswith("芝") for row_data in course_rows):
            course_rows.append(
                {
                    "競馬場": venue,
                    "区分": "地方",
                    "回り": turn,
                    "コース": "芝1600m",
                    "確認ポイント": feature or "盛岡は地方では珍しい芝コースを持つため、芝適性も確認する。",
                    "リファレンス要点": feature,
                }
            )
        if course_rows:
            topics.append(CourseVenueTopic(venue=venue, circuit="地方", source_file=source, rows=tuple(course_rows)))
    return sorted(topics, key=lambda item: COURSE_VENUE_PRIORITY.index(item.venue) if item.venue in COURSE_VENUE_PRIORITY else 999)


def compact_course_key(course: str) -> str:
    return re.sub(r"（[^）]+）|\([^)]*\)|\s+", "", course or "")


def merge_course_topics(file_topics: Sequence[CourseVenueTopic], reference_topics: Sequence[CourseVenueTopic]) -> List[CourseVenueTopic]:
    reference_by_venue = {topic.venue: topic for topic in reference_topics}
    file_by_venue = {topic.venue: topic for topic in file_topics}
    merged: List[CourseVenueTopic] = []
    for venue in COURSE_VENUE_PRIORITY + sorted((set(reference_by_venue) | set(file_by_venue)) - set(COURSE_VENUE_PRIORITY)):
        file_topic = file_by_venue.get(venue)
        reference_topic = reference_by_venue.get(venue)
        if not file_topic and not reference_topic:
            continue
        if not file_topic:
            merged.append(reference_topic)  # type: ignore[arg-type]
            continue
        if not reference_topic:
            merged.append(file_topic)
            continue

        reference_rows_by_key = {compact_course_key(row.get("コース", "")): row for row in reference_topic.rows}
        rows: List[Dict[str, str]] = []
        seen: Set[str] = set()
        for row in file_topic.rows:
            course = row.get("コース", "")
            key = compact_course_key(course)
            reference_row = reference_rows_by_key.get(key)
            merged_row = dict(row)
            if reference_row:
                feature = reference_row.get("リファレンス要点") or reference_row.get("確認ポイント") or ""
                if feature:
                    merged_row["リファレンス要点"] = feature
                    merged_row["確認ポイント"] = feature
            rows.append(merged_row)
            seen.add(key)

        for reference_row in reference_topic.rows:
            key = compact_course_key(reference_row.get("コース", ""))
            if key and key not in seen:
                rows.append(dict(reference_row))
                seen.add(key)

        source = merge_source_names(file_topic.source_file, reference_topic.source_file)
        merged.append(CourseVenueTopic(venue=venue, circuit=file_topic.circuit, source_file=source, rows=tuple(rows)))
    return merged


def parse_jra_course_topics() -> List[CourseVenueTopic]:
    if not os.path.exists(JRA_COURSE_LIST_PATH):
        return parse_reference_jra_course_topics()
    with open(JRA_COURSE_LIST_PATH, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    topics: Dict[str, List[Dict[str, str]]] = {}
    current_venue = ""
    current_surface = ""
    for node in soup.find_all(["h2", "h3", "img"]):
        if node.name == "h2":
            text_value = node.get_text(" ", strip=True)
            match = re.search(r"【([^】]+)】競馬場", text_value)
            current_venue = match.group(1) if match else ""
            current_surface = ""
            if current_venue:
                topics.setdefault(current_venue, [])
            continue
        if node.name == "h3":
            text_value = node.get_text(" ", strip=True)
            if "芝コース" in text_value:
                current_surface = "芝"
            elif "ダートコース" in text_value:
                current_surface = "ダート"
            elif "障害コース" in text_value:
                current_surface = "障害"
            continue
        if node.name != "img" or not current_venue or not current_surface:
            continue

        alt_text = node.get("alt") or ""
        match = re.search(r"(芝|ダート|障害)(\d{3,4})m(?:（([^）]+)）)?", alt_text)
        if not match:
            continue
        distance_label = f"{match.group(1)}{match.group(2)}m"
        if match.group(3):
            distance_label += f"（{match.group(3)}）"
        row = {
            "競馬場": current_venue,
            "区分": "中央",
            "回り": "",
            "コース": distance_label,
            "確認ポイント": f"{current_venue}{distance_label}は、スタート位置、最初のコーナー、直線の長さを分けて見る。",
        }
        if row not in topics[current_venue]:
            topics[current_venue].append(row)

    file_topics = [
        CourseVenueTopic(venue=venue, circuit="中央", source_file=os.path.basename(JRA_COURSE_LIST_PATH), rows=tuple(rows))
        for venue, rows in topics.items()
        if rows
    ]
    file_topics = sorted(file_topics, key=lambda item: COURSE_VENUE_PRIORITY.index(item.venue) if item.venue in COURSE_VENUE_PRIORITY else 999)
    return merge_course_topics(file_topics, parse_reference_jra_course_topics())


def nar_course_label(venue: str, distance: str) -> str:
    raw = re.sub(r"\s+", "", distance or "")
    if raw.startswith("芝"):
        return raw
    if venue in {"帯広", "帯広ば"}:
        return f"ばんえい{raw}"
    return f"ダート{raw}"


def parse_nar_course_topics() -> List[CourseVenueTopic]:
    if not os.path.exists(NAR_COURSE_LIST_PATH):
        return parse_reference_nar_course_topics()
    with open(NAR_COURSE_LIST_PATH, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    grouped: Dict[str, List[Dict[str, str]]] = {}
    for row in soup.select("tbody tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"])]
        if len(cells) < 3:
            continue
        venue, turn, distance = cells[0], cells[1], cells[2]
        if not venue or venue == "競馬場" or not re.search(r"\d+m", distance):
            continue
        venue = "帯広" if venue == "帯広ば" else venue
        course = nar_course_label(venue, distance)
        row_data = {
            "競馬場": venue,
            "区分": "地方",
            "回り": turn,
            "コース": course,
            "確認ポイント": f"{venue}{course}は、回り方向と直線までの位置取りを先に確認する。",
        }
        grouped.setdefault(venue, [])
        if row_data not in grouped[venue]:
            grouped[venue].append(row_data)

    file_topics = [
        CourseVenueTopic(venue=venue, circuit="地方", source_file=os.path.basename(NAR_COURSE_LIST_PATH), rows=tuple(rows))
        for venue, rows in grouped.items()
        if rows
    ]
    file_topics = sorted(file_topics, key=lambda item: COURSE_VENUE_PRIORITY.index(item.venue) if item.venue in COURSE_VENUE_PRIORITY else 999)
    return merge_course_topics(file_topics, parse_reference_nar_course_topics())


def parse_jra_jockey_topics() -> List[JockeyTopic]:
    if not os.path.exists(JRA_JOCKEY_LEADING_PATH):
        return parse_reference_jra_jockey_topics()
    with open(JRA_JOCKEY_LEADING_PATH, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    topics: List[JockeyTopic] = []
    for row in soup.select("tbody tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td")]
        if len(cells) < 13 or not cells[0].isdigit():
            continue
        rank = int(cells[0])
        name = normalize_name(cells[1])
        rides = cells[9].replace(",", "")
        metric = {
            "順位": f"{rank}位",
            "騎手": name,
            "所属": "JRA",
            "騎乗回数": rides,
            "1着": cells[2],
            "2着": cells[3],
            "3着": cells[4],
            "勝率": percent_from_rate(cells[10]),
            "連対率": percent_from_rate(cells[11]),
            "3着内率": percent_from_rate(cells[12]),
        }
        topics.append(
            JockeyTopic(
                name=name,
                circuit="中央",
                rank=rank,
                source_file=os.path.basename(JRA_JOCKEY_LEADING_PATH),
                rows=(metric,),
            )
        )
    return merge_jockey_topics(parse_reference_jra_jockey_topics(), topics)


def parse_nar_jockey_topics() -> List[JockeyTopic]:
    if not os.path.exists(NAR_JOCKEY_LEADING_PATH):
        return parse_reference_nar_jockey_topics()
    with open(NAR_JOCKEY_LEADING_PATH, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    topics: List[JockeyTopic] = []
    for row in soup.select("tbody tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"])]
        if len(cells) < 10 or not cells[0].isdigit():
            continue
        rank = int(cells[0])
        name = normalize_name(cells[1].split()[0])
        rides = int(cells[3].replace(",", ""))
        wins = int(cells[4].replace(",", ""))
        seconds = int(cells[5].replace(",", ""))
        thirds = int(cells[6].replace(",", ""))
        show_rate = f"{((wins + seconds + thirds) / rides * 100):.1f}%" if rides else ""
        metric = {
            "順位": f"{rank}位",
            "騎手": name,
            "所属": cells[2],
            "騎乗回数": str(rides),
            "1着": str(wins),
            "2着": str(seconds),
            "3着": str(thirds),
            "勝率": cells[8],
            "連対率": cells[9],
            "3着内率": show_rate,
        }
        topics.append(
            JockeyTopic(
                name=name,
                circuit="地方",
                rank=rank,
                source_file=os.path.basename(NAR_JOCKEY_LEADING_PATH),
                rows=(metric,),
            )
        )
    return merge_jockey_topics(parse_reference_nar_jockey_topics(), topics)


def beginner_topics() -> List[BeginnerTopic]:
    return [
        BeginnerTopic(
            key="race-card-check-order",
            target_keyword="出馬表の見方 初心者 確認順",
            focus="出馬表を開いた時に、枠順、脚質、騎手、馬体重、AI偏差値をどの順番で見るかを整理する。",
            rows=(
                {"確認項目": "枠順", "見る理由": "コース形態とスタート位置で評価が変わるため、最初に確認する。"},
                {"確認項目": "脚質", "見る理由": "逃げ・先行が多いか、差し馬に展開が向くかを分ける。"},
                {"確認項目": "騎手", "見る理由": "コース経験や位置取りの傾向を、馬の脚質と合わせて見る。"},
                {"確認項目": "馬体重", "見る理由": "成長分と消耗のどちらに近い変化かをパドック前に整理する。"},
            ),
            structure=(
                "出馬表を開いた直後に見る順番",
                "枠順と脚質を同時に確認する理由",
                "騎手と馬体重を過大評価しない線引き",
                "AI予想を最後に照合する使い方",
            ),
        ),
        BeginnerTopic(
            key="jra-nar-difference",
            target_keyword="中央競馬 地方競馬 違い 初心者",
            focus="中央と地方の開催場、コース、交流重賞、ナイター、馬場差を自然に整理する。",
            rows=(
                {"確認項目": "開催場", "見る理由": "中央10場と地方各場では回り方向、砂質、距離構成が違う。"},
                {"確認項目": "交流重賞", "見る理由": "中央馬と地方馬の条件差、輸送、コース経験を分けて見る。"},
                {"確認項目": "ナイター", "見る理由": "地方では時間帯や馬場の乾き方が判断材料になる。"},
            ),
            structure=(
                "中央競馬と地方競馬で最初に違うところ",
                "交流重賞で確認したい条件差",
                "地方競馬を見る時に重賞日程を使う理由",
                "UMA-FREEのレースページで確認する順番",
            ),
        ),
        BeginnerTopic(
            key="track-condition-basic",
            target_keyword="馬場状態の見方 初心者 良 稍重 重 不良",
            focus="馬場状態を単独で断定せず、コース、脚質、当日の時計と合わせて見る。",
            rows=(
                {"確認項目": "良馬場", "見る理由": "時計が出やすいか、内外どちらが使えるかを見る。"},
                {"確認項目": "稍重", "見る理由": "発表だけでなく、前のレースの時計と伸びる進路を確認する。"},
                {"確認項目": "重・不良", "見る理由": "道悪適性を断定せず、脚質とコース替わりを合わせる。"},
            ),
            structure=(
                "馬場状態の発表をそのまま使わない理由",
                "良・稍重・重・不良で変わる確認順",
                "芝とダートで違う見方",
                "レース直前に残す判断材料",
            ),
        ),
        BeginnerTopic(
            key="ticket-types-guide",
            target_keyword="競馬 馬券の種類 初心者 違い",
            focus="単勝・複勝・馬連・三連複・三連単などの特徴と、初心者が最初に比較しやすい券種を整理する。",
            rows=(
                {"確認項目": "単勝・複勝", "見る理由": "最もシンプルで、馬の能力や単体の評価を確認しやすい。"},
                {"確認項目": "馬連・ワイド", "見る理由": "2頭を選ぶため、軸馬と相手候補の関係性を整理できる。"},
                {"確認項目": "三連複・三連単", "見る理由": "高配当の魅力はあるが、点数管理と買い目構築の難易度が高い。"},
            ),
            structure=(
                "初心者が最初に知るべき馬券の基本分類",
                "単勝と複勝をベースにするメリット",
                "馬連とワイドを使い分ける判断基準",
                "三連複や三連単に挑戦するタイミング",
            ),
        ),
        BeginnerTopic(
            key="racecourse-guide",
            target_keyword="競馬場 楽しみ方 初心者 見方",
            focus="競馬場ごとの特徴（直線坂、カーブのきつさ、芝ダートの構成）と現地・ネットでの見方をまとめる。",
            rows=(
                {"確認項目": "直線の長さと坂", "見る理由": "東京などの長い直線と中山などの急坂で脚質有利度が変わる。"},
                {"確認項目": "小回り・大回り", "見る理由": "ローカル場の小回りと主要場の大回りでの展開の差を見る。"},
                {"確認項目": "芝とダートのバランス", "見る理由": "開催場ごとの砂の深さや芝の傷み具合を確認する。"},
            ),
            structure=(
                "全国の競馬場で最初に注目すべき3大要素",
                "直線の長さと坂が脚質に与える影響",
                "主要場とローカル場で変わる予想のコツ",
                "UMA-FREEの競馬場別データ活用法",
            ),
        ),
        BeginnerTopic(
            key="jockey-selection-guide",
            target_keyword="競馬 騎手 選び方 初心者 指標",
            focus="騎手リーディングや勝率、回収率をもとに、評価を置きやすい条件と過大評価を避けたい条件を整理する。",
            rows=(
                {"確認項目": "勝率・連対率", "見る理由": "騎手自身の勝ちきる能力と上位進出の確率を示す基本指標。"},
                {"確認項目": "得意コース・競馬場", "見る理由": "競馬場ごとのコース特性を掴んでいるかどうかの相性。"},
                {"確認項目": "単勝回収率", "見る理由": "人気に先行して過大評価されていないかを判断する指標。"},
            ),
            structure=(
                "出馬表で騎手データを最初に見る理由",
                "リーディング順位と勝率の正しい解釈",
                "コース別実績から相性の良い騎手を見つける方法",
                "オッズとのバランスで過大評価を避ける線引き",
            ),
        ),
        BeginnerTopic(
            key="training-time-guide",
            target_keyword="競馬 調教タイム 見方 初心者",
            focus="坂路やウッドでの追い切りタイム、調教の評価をどのように予想へ取り入れるかを解説する。",
            rows=(
                {"確認項目": "追い切り場所", "見る理由": "坂路（パワー・短距離）かウッド（長距離・折り合い）かを見る。"},
                {"確認項目": "タイムの比較", "見る理由": "馬自身の過去タイムや当週の他馬のタイムとの比較が基本。"},
                {"確認項目": "調教後の馬体重・コメント", "見る理由": "仕上がり具合を補完する情報として合わせて見る。"},
            ),
            structure=(
                "調教タイムが示す馬の状態と適性",
                "坂路追いとウッド追いの見分け方と役割",
                "前走比でのタイム変化と調教評価の基本",
                "調教データを過信せず出馬表と合わせる手順",
            ),
        ),
        BeginnerTopic(
            key="turf-dirt-difference",
            target_keyword="競馬 芝 ダート 違い 初心者",
            focus="芝コースとダートコースの走破時計、要求される適性（スピード・パワー）の違いを解説する。",
            rows=(
                {"確認項目": "時計の速さ", "見る理由": "芝はスピードと瞬発力、ダートは一定のペースと持久力が求められる。"},
                {"確認項目": "血統の影響", "見る理由": "芝向きの種牡馬とダート向きの種牡馬で適性を大別できる。"},
                {"確認項目": "砂質と天候", "見る理由": "ダートは雨で水を含むと時計が速くなる特徴がある。"},
            ),
            structure=(
                "芝コースとダートコースの根本的な違い",
                "スピードの芝とパワー・タフさのダート",
                "血統から見極める芝・ダートの適性判断",
                "雨が降った時に芝とダートで起きる逆の変化",
            ),
        ),
        BeginnerTopic(
            key="draw-advantage-guide",
            target_keyword="競馬 枠順 有利不利 コース 違い",
            focus="内枠有利・外枠有利の決まり方と、競馬場や距離によって変化する枠順傾向の見方を解説する。",
            rows=(
                {"確認項目": "スタートから最初のコーナーまで", "見る理由": "距離が短いほど内枠が先行しやすく有利になりやすい。"},
                {"確認項目": "馬場状態の荒れ具合", "見る理由": "内側の芝が荒れると、外枠や外を通る馬が有利になる。"},
                {"確認項目": "コース形態とカーブ", "見る理由": "カーブが急な小回りコースほど内枠の距離ロスが少なくなる。"},
            ),
            structure=(
                "枠順がレース結果に与える影響の基本",
                "スタート位置と最初のコーナーまでの距離による違い",
                "馬場コンディションの悪化で変わる内枠・外枠の有利度",
                "当日の枠順別データをUMA-FREEで確認する手順",
            ),
        ),
        BeginnerTopic(
            key="graded-races-guide",
            target_keyword="競馬 重賞 グレード 違い 初心者",
            focus="G1・G2・G3やJpn1・Jpn2・Jpn3などのグレードの違いと、賞金や出走条件を解説する。",
            rows=(
                {"確認項目": "G1 / Jpn1", "見る理由": "その世代や路線の頂点を決める最も格式高いレース。"},
                {"確認項目": "G2・G3", "見る理由": "G1のステップレースや、別定・ハンデ戦による実力拮抗戦が多い。"},
                {"確認項目": "出走ローテーション", "見る理由": "前走重賞での着順や、格上挑戦の条件を確認する。"},
            ),
            structure=(
                "重賞（グレードレース）の仕組みと分類",
                "最高峰レースG1の見どころと他のグレードの役割",
                "中央重賞と地方交流重賞のグレード表記の違い",
                "重賞スケジュールをチェックして注目馬を追う方法",
            ),
        ),
        BeginnerTopic(
            key="odds-recovery-basic",
            target_keyword="競馬 オッズ 読み方 回収率 初心者",
            focus="オッズが示す支持率と、単勝回収率・複勝回収率の正しい捉え方を解説する。",
            rows=(
                {"確認項目": "単勝オッズ", "見る理由": "その馬が勝つ確率（ファンからの支持）を最も直接的に表す。"},
                {"確認項目": "支持率と人気のズレ", "見る理由": "過剰人気馬を避け、オッズ妙味がある馬を探すヒント. "},
                {"確認項目": "回収率の基準", "見る理由": "的中率だけでなく、払い戻しの大きさも振り返る考え方。"},
            ),
            structure=(
                "オッズの決定方法と示す支持率の意味",
                "過剰人気を避けて人気との釣り合いを確認する視点",
                "的中率と回収率のトレードオフの関係",
                "UMA-FREEの回収率データを参考に判断する手順",
            ),
        ),
        BeginnerTopic(
            key="previous-run-comments",
            target_keyword="競馬 前走コメント 追い切り 初心者",
            focus="前走後の敗因コメントや追い切り評価を、次のレースでどう活かすかを解説する。",
            rows=(
                {"確認項目": "敗因の特定", "見る理由": "「前が塞がった」「距離が長かった」等の敗因は巻き返しの材料になる。"},
                {"確認項目": "調整過程の変化", "見る理由": "前走時の調教量と今回の中間の調教量の違いを見る。"},
                {"確認項目": "状態面の前向きな材料", "見る理由": "今回の舞台設定に対する前向きなコメントと慎重に見たいコメントの差。"},
            ),
            structure=(
                "前走内容から評価を見直せる馬を探す方法",
                "レース後の公式コメントから読み解く具体的な敗因",
                "中間追い切りのタイム変化が示す状態の良化",
                "出馬表のコメントと実測データを比較する手順",
            ),
        ),
        BeginnerTopic(
            key="running-styles-guide",
            target_keyword="競馬 脚質 逃げ 先行 差し 追い込み",
            focus="4つの基本脚質の特徴と、コース形態・展開による有利不利の決まり方を解説する。",
            rows=(
                {"確認項目": "逃げ・先行", "見る理由": "レースの主導権を握り、直線での不利を受けにくく安定しやすい。"},
                {"確認項目": "差し・追い込み", "見る理由": "直線の長いコースで威力を発揮するが、進路妨害などのリスクもある。"},
                {"確認項目": "脚質の競合", "見る理由": "同型（逃げ馬）が複数いるとペースが速くなり、差し有利に傾く。"},
            ),
            structure=(
                "競走馬の4つの基本脚質とキャラクター",
                "前に行く馬（逃げ・先行）が基本的に有利な理由",
                "直線の長さや展開（ハイペース・スローペース）で変わる有利度",
                "出馬表からペース予測を組み立てる基本手順",
            ),
        ),
        BeginnerTopic(
            key="distance-aptitude-guide",
            target_keyword="競馬 距離適性 見方 初心者",
            focus="馬の血統や過去実績、体型から距離適性を見極め、距離短縮・距離延長の影響を解説する。",
            rows=(
                {"確認項目": "距離短縮", "見る理由": "スタミナに余裕ができ、ペースについていければ好走しやすい。"},
                {"確認項目": "距離延長", "見る理由": "折り合い（力まず走ること）が課題となり、スタミナ切れのリスクがある。"},
                {"確認項目": "血統の距離傾向", "見る理由": "スプリンターやステイヤーなど、種牡馬の距離適性が強く反映される。"},
            ),
            structure=(
                "競走馬の距離適性が決まる主な要因",
                "距離が短くなる時（短縮）と長くなる時（延長）の違い",
                "血統からスプリント戦・クラシックディスタンスを見極めるヒント",
                "UMA-FREEのコース統計で距離別成績を照合する手順",
            ),
        ),
        BeginnerTopic(
            key="bloodline-basics",
            target_keyword="競馬 血統 基礎知識 コース適性",
            focus="主要なサイアーライン（サンデーサイレンス系、キングマンボ系など）と芝・ダート・距離適性の関係を解説する。",
            rows=(
                {"確認項目": "サンデーサイレンス系", "見る理由": "芝の瞬発力と関係が深く、日本の主要重賞で存在感がある主力系統。"},
                {"確認項目": "キングマンボ系・ロベルト系", "見る理由": "タフな馬場やダート、急坂コースに合う例が多い系統。"},
                {"確認項目": "母系の血統", "見る理由": "父の適性に加えて、スピードやスタミナの裏付けを確認する。"},
            ),
            structure=(
                "競馬予想における血統データの役割",
                "日本の主要血統（サンデー系・キングカメハメハ系など）の特徴",
                "芝・ダートや重馬場に合う血統の傾向",
                "血統データを過大評価せず実績データと併用する方法",
            ),
        ),
        BeginnerTopic(
            key="post-race-review-comments",
            target_keyword="競馬 レース後 コメント 読み方 初心者",
            focus="ジョッキーが語る「敗因」「収穫」「馬の成長」などを整理し、次走で見直したい材料を分ける方法を解説する。",
            rows=(
                {"確認項目": "不利の有無", "見る理由": "出遅れ、他馬の妨害、進路が狭くなったなどの明確な敗因があるか。"},
                {"確認項目": "距離やコースへの言及", "見る理由": "「距離が長かった」「右回りが合わない」など適性外の敗戦かどうか。"},
                {"確認項目": "次走への材料", "見る理由": "大敗していても「次は良くなる」「能力はある」と騎手が評価しているか。"},
            ),
            structure=(
                "レース後の騎手コメントが宝の山である理由",
                "敗因が明確な「負けて強し」の馬を見つけるヒント",
                "適性外の条件で大敗した馬の条件替わりを狙う方法",
                "公式コメントを次の出馬表と照らし合わせる手順",
            ),
        ),
        BeginnerTopic(
            key="nar-jra-matchup-guide",
            target_keyword="競馬 交流重賞 楽しみ方 中央 地方",
            focus="ダートグレード競走（帝王賞、東京大賞典など）における中央馬と地方馬の力の差や適性の違いを解説する。",
            rows=(
                {"確認項目": "中央馬の優位性", "見る理由": "基本能力やスピードで勝ることが多いが、人気が集中しやすい。"},
                {"確認項目": "地方馬のコース適性", "見る理由": "砂質が深い・小回りなど、地方特有の馬場への適性が上位に加わる条件になる。"},
                {"確認項目": "斤量やダート適性", "見る理由": "ハンデ戦や実績馬の斤量、過去の交流実績を確認する。"},
            ),
            structure=(
                "交流重賞（ダートグレード競走）とは何か",
                "中央所属馬と地方所属馬の基本的な力関係とオッズ",
                "地方の深い砂（門別、大井など）と小回り適性の重要性",
                "交流重賞の出馬表で見るべきデータ優先順位",
            ),
        ),
        BeginnerTopic(
            key="horse-age-weight-guide",
            target_keyword="競馬 斤量 馬齢 影響 初心者",
            focus="競走馬の年齢（3歳と古馬の比較）やハンデ・斤量がレース結果に与える影響を解説する。",
            rows=(
                {"確認項目": "馬齢による斤量差", "見る理由": "3歳馬と4歳以上の古馬が戦う際、3歳馬は斤量が軽くなり有利。"},
                {"確認項目": "ハンデ戦の注目条件", "見る理由": "実績馬が重い斤量を背負い、軽斤量の新興勢力が台頭する構図。"},
                {"確認項目": "馬体重と斤量比", "見る理由": "馬体重が軽い馬ほど、重い斤量を背負った時の影響が大きい。"},
            ),
            structure=(
                "競走馬にかかる負担重量（斤量）の仕組み",
                "3歳春・秋の世代交代期における斤量差の有利不利",
                "定量・別定・ハンデ戦のクラス分けとオッズの関係",
                "出馬表で斤量変化を確認して判断材料に加える手順",
            ),
        ),
        BeginnerTopic(
            key="race-calendar-guide",
            target_keyword="競馬 カレンダー 重賞 スケジュール 活用",
            focus="春のクラシックや秋の古馬王道路線など、季節ごとの競馬カレンダーの主要レースの流れを解説する。",
            rows=(
                {"確認項目": "春のG1シーズン", "見る理由": "クラシック（桜花賞・皐月賞・ダービー等）や安田記念・宝塚記念。"},
                {"確認項目": "夏のローカル開催", "見る理由": "北海道や小倉などの夏競馬。秋に向けた新馬戦やサマージョッキーズ。"},
                {"確認項目": "秋・冬のG1シーズン", "見る理由": "天皇賞秋、ジャパンカップ、有馬記念など、実力馬がそろう王道。"},
            ),
            structure=(
                "1年の競馬スケジュールの全体像",
                "3歳クラシック路線と古馬王道（中距離・マイル・ダート）の流れ",
                "夏競馬と冬のローカル開催の特徴と予想の切り替え",
                "カレンダーと重賞一覧をチェックして出馬表に接続する方法",
            ),
        ),
        BeginnerTopic(
            key="all-venues-summary",
            target_keyword="全国 競馬場 特徴 一覧 初心者",
            focus="JRA全10競馬場と主要地方競馬場の特徴（右・左回り、直線の坂、平坦）を一覧でまとめる。",
            rows=(
                {"確認項目": "主要4場（東京・中山・京都・阪神）", "見る理由": "直線の長さや高低差があり、地力を問われるコースが多い。"},
                {"確認項目": "ローカル場（福島・新潟・中京・小倉・札幌・函館）", "見る理由": "新潟の直線1000mや、小回り・平坦による逃げ・先行有利傾向。"},
                {"確認項目": "地方競馬場（大井・川崎・園田・高知など）", "見る理由": "ダート専用で、砂が深く最後の直線が短い特徴がある。"},
            ),
            structure=(
                "日本の競馬場全体のレイアウトと特徴の分類",
                "中央主要4場とローカル場で大きく変わる攻略アプローチ",
                "地方ダートコースの特異性と見るべきポイント",
                "UMA-FREEで各競馬場の個別データを引く方法",
            ),
        )
    ]


def build_course_order(topic: CourseVenueTopic) -> GeneratedOrder:
    venue_slug = VENUE_SLUGS.get(topic.venue, stable_hash(topic.venue, 8))
    courses = [row["コース"] for row in topic.rows]
    target_keyword = f"{topic.venue}競馬場 全コース 距離別確認ガイド"
    condition = f"{topic.venue}競馬場 {compact_join(courses, 18)}"
    order = {
        "target_keyword": target_keyword,
        "theme_cluster": "course_venue",
        "entity_type": "",
        "entity_key": "",
        "season_year": current_jst().year,
        "entity_path": "",
        "canonical_path": "",
        "content_target": f"course_venue_{venue_slug}",
        "priority": 63 if topic.circuit == "中央" else 59,
        "has_external_research": True,
        "category": "コース分析",
        "reference_data": {
            "period": "コース一覧ファイル確認",
            "condition": condition,
            "sample_size": len(topic.rows),
            "key_metrics": list(topic.rows),
            "source": topic.source_file,
            "article_type": "course_venue",
            "category": "コース分析",
            "content_focus": "距離ごとに記事を分けず、競馬場ごとに芝・ダート・障害または地方の各距離を1本で整理する。",
            "course_venue": topic.venue,
            "course_circuit": topic.circuit,
            "course_count": len(topic.rows),
            "external_research_required": True,
            "external_research_queries": [
                f"{topic.venue}競馬場 コース 特徴 公式",
                f"{topic.venue}競馬場 距離 コース 競馬",
            ],
        },
        "competing_article_structure": [
            f"{topic.venue}競馬場で先に見るコース全体像",
            "芝・ダート・障害または地方コースを距離ごとに整理",
            "短距離・マイル・中距離・長距離で変わる確認順",
            "枠順や脚質を過大評価しない条件",
            "当日の出馬表で最後に照合する材料",
        ],
        "article_type": "course_venue",
    }
    return GeneratedOrder(kind="course", key=f"course_venue_{venue_slug}", order=order)


def build_jockey_order(topic: JockeyTopic) -> GeneratedOrder:
    known_slug = KNOWN_JOCKEY_SLUGS.get(topic.name, "")
    target_keyword = f"{topic.name}騎手 2026年成績と確認ポイント"
    entity_type = "jockey" if known_slug else ""
    entity_path = f"/articles/jockeys/{known_slug}" if known_slug else ""
    content_target = f"jockey_support_{known_slug}" if known_slug else f"jockey_profile_{stable_hash(topic.name, 8)}"
    order = {
        "target_keyword": target_keyword,
        "theme_cluster": "jockey_profile",
        "entity_type": entity_type,
        "entity_key": known_slug,
        "season_year": current_jst().year if known_slug else "",
        "entity_path": entity_path,
        "canonical_path": "",
        "content_target": content_target,
        "priority": 62 if topic.circuit == "中央" else 60,
        "has_external_research": True,
        "category": "騎手分析",
        "reference_data": {
            "period": "2026年リーディング一覧確認",
            "condition": f"{topic.name}騎手 {topic.circuit}リーディング",
            "sample_size": 1,
            "key_metrics": list(topic.rows),
            "source": topic.source_file,
            "article_type": "jockey_profile",
            "entity_type": entity_type,
            "entity_key": known_slug,
            "season_year": current_jst().year if known_slug else "",
            "entity_path": entity_path,
            "canonical_path": "",
            "content_target": content_target,
            "category": "騎手分析",
            "jockey_name": topic.name,
            "jockey_circuit": topic.circuit,
            "content_focus": "リーディング表の数値を入口にし、得意条件は外部調査とUMA-FREE内の出馬表で確認する前提で書く。",
            "external_research_required": True,
            "external_research_queries": [
                f"{topic.name} 騎手 得意コース 2026",
                f"{topic.name} 騎手 近況 競馬",
            ],
        },
        "competing_article_structure": [
            f"{topic.name}騎手の2026年リーディング成績",
            "勝率・連対率・3着内率をどう読むか",
            "得意条件を決めつけずに調査する観点",
            "人気馬と人気薄で評価を分ける条件",
            "当日の出馬表で確認する順番",
        ],
        "article_type": "jockey_profile",
    }
    return GeneratedOrder(kind="jockey", key=content_target, order=order)


def build_beginner_order(topic: BeginnerTopic) -> GeneratedOrder:
    order = {
        "target_keyword": topic.target_keyword,
        "theme_cluster": "beginner_guide",
        "entity_type": "",
        "entity_key": "",
        "season_year": "",
        "entity_path": "",
        "canonical_path": "",
        "content_target": f"beginner_{topic.key}",
        "priority": 56,
        "has_external_research": True,
        "category": "入門ガイド",
        "reference_data": {
            "period": "常設ガイド",
            "condition": topic.target_keyword,
            "sample_size": len(topic.rows),
            "key_metrics": list(topic.rows),
            "source": "UMA-FREE編集方針",
            "article_type": "beginner_guide",
            "category": "入門ガイド",
            "content_focus": topic.focus,
            "external_research_required": True,
            "external_research_queries": [
                f"{topic.target_keyword} JRA 公式",
                f"{topic.target_keyword} 地方競馬 公式",
            ],
        },
        "competing_article_structure": list(topic.structure),
        "article_type": "beginner_guide",
    }
    return GeneratedOrder(kind="beginner", key=f"beginner_{topic.key}", order=order)


def next_rotation_kinds(max_count: int, history: List[Dict[str, Any]]) -> List[str]:
    rotation = [item.strip() for item in os.environ.get("KEIBA_EVERGREEN_KIND_ROTATION", "course,jockey,beginner").split(",") if item.strip()]
    if not rotation:
        rotation = ["course", "jockey", "beginner"]

    last_kind = ""
    for item in reversed(history):
        kind = str(item.get("kind") or "")
        if kind in rotation:
            last_kind = kind
            break

    start_index = (rotation.index(last_kind) + 1) % len(rotation) if last_kind in rotation else 0
    ordered = [rotation[(start_index + index) % len(rotation)] for index in range(len(rotation))]
    return ordered[: max(max_count, len(rotation))]


def candidates_for_kind(kind: str, known_keys: Set[str]) -> List[GeneratedOrder]:
    if kind == "course":
        topics = parse_jra_course_topics() + parse_nar_course_topics()
        orders = [build_course_order(topic) for topic in topics]
    elif kind == "jockey":
        topics = parse_jra_jockey_topics() + parse_nar_jockey_topics()
        orders = [build_jockey_order(topic) for topic in topics]
    elif kind == "beginner":
        orders = [build_beginner_order(topic) for topic in beginner_topics()]
    else:
        return []

    return [
        order
        for order in orders
        if not topic_is_known(order.order["target_keyword"], order.key, known_keys)
    ]


def unique_order_path(kind: str, index: int) -> str:
    now = current_jst()
    base = now.strftime("%Y%m%d_%H%M%S")
    filename = f"{base}_evergreen_{kind}_{index}.json"
    path_value = os.path.join(WRITE_ORDERS_DIR, filename)
    suffix = 2
    while os.path.exists(path_value):
        filename = f"{base}_evergreen_{kind}_{index}_{suffix}.json"
        path_value = os.path.join(WRITE_ORDERS_DIR, filename)
        suffix += 1
    return path_value


def generate_evergreen_orders() -> int:
    max_orders = min(parse_positive_int(os.environ.get("KEIBA_EVERGREEN_MAX_ORDERS_PER_RUN"), 1), 3)
    known_keys = all_known_keys()
    history = load_json_array(EVERGREEN_HISTORY_PATH)
    selected: List[GeneratedOrder] = []
    used_kinds: Set[str] = set()

    for kind in next_rotation_kinds(max_orders, history):
        if len(selected) >= max_orders:
            break
        if kind in used_kinds:
            continue
        candidates = candidates_for_kind(kind, known_keys)
        if not candidates:
            continue
        chosen = candidates[0]
        selected.append(chosen)
        used_kinds.add(kind)
        known_keys.add(normalize_key(chosen.order["target_keyword"]))
        known_keys.add(normalize_key(chosen.key))

    if not selected:
        print("[EvergreenPlanner] 新規の常設コラム候補はありません。")
        return 0

    os.makedirs(WRITE_ORDERS_DIR, exist_ok=True)
    for index, generated in enumerate(selected, start=1):
        output_path = unique_order_path(generated.kind, index)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(generated.order, f, ensure_ascii=False, indent=2)
        print(f"[EvergreenPlanner] WriteOrder generated: {output_path}")
        history.append(
            {
                "created_at": current_jst().isoformat(),
                "kind": generated.kind,
                "key": generated.key,
                "target_keyword": generated.order.get("target_keyword"),
                "theme_cluster": generated.order.get("theme_cluster"),
                "status": "write_order_created",
            }
        )

    os.makedirs(os.path.dirname(EVERGREEN_HISTORY_PATH), exist_ok=True)
    with open(EVERGREEN_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history[-500:], f, ensure_ascii=False, indent=2)
    return len(selected)


if __name__ == "__main__":
    count = generate_evergreen_orders()
    print(f"[EvergreenPlanner] generated={count}")
