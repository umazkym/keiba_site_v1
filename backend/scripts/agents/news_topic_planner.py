"""
競馬ニュース起点の記事WriteOrder生成スクリプト。

Tavilyで取得したニュース候補をそのまま要約記事にせず、
UMA-FREEの自動記事生成パイプラインへ渡せるWriteOrderへ変換する。

設計意図:
  - LangGraph風に、状態(State)を複数ノードで順番に変換する
  - 外部記事本文の焼き直しではなく、公式・信頼媒体の「使ってよい事実」だけを抽出する
  - 既存の Writer / Editor / Publisher に接続し、完全自動公開フローへ流す
"""

from __future__ import annotations

import glob
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import urlparse

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    # GitHub Actionsでは環境変数から直接読むため、dotenvがなくても動作できるようにする。
    pass


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, "data", "write_orders")
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "posted_history.json")
NEWS_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "news_topic_history.json")
ARTICLES_DIR = os.path.join(PROJECT_ROOT, "frontend", "content", "articles")

JST = timezone(timedelta(hours=9))

DEFAULT_INCLUDE_DOMAINS = [
    "jra.go.jp",
    "jra.jp",
    "keiba.go.jp",
    "news.netkeiba.com",
    "race.netkeiba.com",
    "keibalab.jp",
    "sponichi.co.jp",
    "nikkansports.com",
    "sanspo.com",
    "hochi.news",
    "tospo-keiba.jp",
]

OFFICIAL_DOMAIN_PATTERNS = (
    "jra.go.jp",
    "jra.jp",
    "keiba.go.jp",
)

TRUSTED_MEDIA_PATTERNS = (
    "news.netkeiba.com",
    "race.netkeiba.com",
    "keibalab.jp",
    "sponichi.co.jp",
    "nikkansports.com",
    "sanspo.com",
    "hochi.news",
    "tospo-keiba.jp",
)

QUERY_TEMPLATES = [
    "JRA 公式 競馬 ニュース 重賞 出走予定 枠順 確定 {year}",
    "JRA 公式 重賞 出走馬 馬場 発表 {year}",
    "競馬 ニュース 重賞 枠順 出走予定 騎手変更 馬場 {year}",
    "地方競馬 ニュース 重賞 出走予定 枠順 {year}",
]

RACE_QUERY_INTENTS = [
    "枠順 出走馬 出走予定",
    "馬場 追い切り 騎手変更",
]

SOURCE_METRIC_REJECT_PATTERN = re.compile(
    r"勝率|複勝率|連対率|回収率|単勝回収|複勝回収|AI偏差値|指数|予想印|本命|穴馬|オッズ|買い目"
)

HIGH_VALUE_TOPIC_PATTERN = re.compile(
    r"G1|G2|G3|Ｇ１|Ｇ２|Ｇ３|重賞|枠順|出走予定|出走馬|馬場|騎手変更|開催|"
    r"ダービー|オークス|安田記念|宝塚記念|有馬記念|ジャパンカップ|天皇賞|皐月賞|菊花賞|桜花賞|"
    r"マイルCS|スプリンターズS|高松宮記念|フェブラリーS|チャンピオンズC|ホープフルS"
)

RACE_NAME_PATTERN = re.compile(
    r"([一-龥ァ-ヴーA-Za-z0-9・（）()]{2,24}(?:S|ステークス|カップ|記念|賞|杯|ダービー|オークス|マイル|スプリント))"
)

SEARCH_INTENT_RULES = [
    ("waku", "枠順", re.compile(r"枠順|枠順確定|抽選|ゲート"), 30),
    ("entries", "出走馬", re.compile(r"出走予定|出走馬|登録馬|出馬表|出走"), 26),
    ("track_condition", "馬場", re.compile(r"馬場|天気|雨|稍重|重馬場|不良馬場|良馬場"), 22),
    ("training", "追い切り", re.compile(r"追い切り|調教|最終追い"), 20),
    ("jockey_change", "騎手変更", re.compile(r"騎手変更|乗り替わり|鞍上"), 20),
    ("schedule", "開催情報", re.compile(r"開催|日程|発走|確定"), 14),
]


@dataclass(frozen=True)
class RaceDemand:
    name: str
    aliases: Tuple[str, ...]
    month: int
    day: int
    grade: str
    base_score: int


RACE_DEMAND_CALENDAR: Tuple[RaceDemand, ...] = (
    RaceDemand("フェブラリーS", ("フェブラリーS", "フェブラリーステークス"), 2, 22, "G1", 38),
    RaceDemand("高松宮記念", ("高松宮記念",), 3, 29, "G1", 38),
    RaceDemand("大阪杯", ("大阪杯",), 4, 5, "G1", 38),
    RaceDemand("桜花賞", ("桜花賞",), 4, 12, "G1", 40),
    RaceDemand("皐月賞", ("皐月賞",), 4, 19, "G1", 42),
    RaceDemand("天皇賞(春)", ("天皇賞(春)", "天皇賞春", "天皇賞・春"), 5, 3, "G1", 40),
    RaceDemand("NHKマイルC", ("NHKマイルC", "NHKマイルカップ"), 5, 10, "G1", 36),
    RaceDemand("ヴィクトリアマイル", ("ヴィクトリアマイル",), 5, 17, "G1", 36),
    RaceDemand("オークス", ("オークス", "優駿牝馬"), 5, 24, "G1", 42),
    RaceDemand("日本ダービー", ("日本ダービー", "東京優駿", "ダービー"), 5, 31, "G1", 48),
    RaceDemand("安田記念", ("安田記念",), 6, 7, "G1", 40),
    RaceDemand("函館SS", ("函館SS", "函館スプリントS", "函館スプリントステークス"), 6, 13, "G3", 30),
    RaceDemand("宝塚記念", ("宝塚記念",), 6, 14, "G1", 46),
    RaceDemand("スプリンターズS", ("スプリンターズS", "スプリンターズステークス"), 9, 27, "G1", 38),
    RaceDemand("秋華賞", ("秋華賞",), 10, 18, "G1", 38),
    RaceDemand("菊花賞", ("菊花賞",), 10, 25, "G1", 40),
    RaceDemand("天皇賞(秋)", ("天皇賞(秋)", "天皇賞秋", "天皇賞・秋"), 11, 1, "G1", 42),
    RaceDemand("エリザベス女王杯", ("エリザベス女王杯",), 11, 15, "G1", 36),
    RaceDemand("マイルCS", ("マイルCS", "マイルチャンピオンシップ"), 11, 22, "G1", 38),
    RaceDemand("ジャパンカップ", ("ジャパンカップ", "JC"), 11, 29, "G1", 44),
    RaceDemand("チャンピオンズC", ("チャンピオンズC", "チャンピオンズカップ"), 12, 6, "G1", 36),
    RaceDemand("阪神JF", ("阪神JF", "阪神ジュベナイルF", "阪神ジュベナイルフィリーズ"), 12, 13, "G1", 34),
    RaceDemand("朝日杯FS", ("朝日杯FS", "朝日杯フューチュリティS", "朝日杯フューチュリティステークス"), 12, 20, "G1", 34),
    RaceDemand("有馬記念", ("有馬記念",), 12, 27, "G1", 50),
    RaceDemand("ホープフルS", ("ホープフルS", "ホープフルステークス"), 12, 28, "G1", 34),
)


@dataclass
class SourceCard:
    title: str
    url: str
    content: str
    query: str
    source_name: str
    source_type: str
    score: float
    fetched_at: str
    allowed_claims: List[str]


@dataclass
class TopicCandidate:
    topic_key: str
    target_keyword: str
    title_seed: str
    article_type: str
    theme_cluster: str
    search_intent: str
    search_intent_label: str
    score: float
    reason: str
    race_name: str
    calendar_race: str
    days_to_race: Optional[int]
    source_cards: List[SourceCard]


@dataclass
class WorkflowState:
    run_id: str
    fetched_at: str
    queries: List[str] = field(default_factory=list)
    raw_results: List[Dict[str, Any]] = field(default_factory=list)
    source_cards: List[SourceCard] = field(default_factory=list)
    topic_candidates: List[TopicCandidate] = field(default_factory=list)
    selected_topics: List[TopicCandidate] = field(default_factory=list)
    write_orders: List[Dict[str, Any]] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)


def parse_positive_int(value: Optional[str], fallback: int) -> int:
    try:
        parsed = int(value or "")
        return parsed if parsed > 0 else fallback
    except ValueError:
        return fallback


def parse_csv_env(name: str, fallback: Sequence[str]) -> List[str]:
    raw = os.environ.get(name, "")
    if not raw:
        return list(fallback)
    return [item.strip() for item in raw.split(",") if item.strip()]


def compact_text(value: str, max_length: int = 180) -> str:
    compacted = re.sub(r"\s+", " ", value).strip()
    if len(compacted) <= max_length:
        return compacted
    return compacted[: max_length - 1].rstrip("、。,. ") + "…"


def hostname(url_value: str) -> str:
    try:
        return urlparse(url_value).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def classify_source_type(url_value: str) -> str:
    host = hostname(url_value)
    if any(host == domain or host.endswith("." + domain) for domain in OFFICIAL_DOMAIN_PATTERNS):
        return "official"
    if any(host == domain or host.endswith("." + domain) for domain in TRUSTED_MEDIA_PATTERNS):
        return "trusted_media"
    return "other"


def normalize_key(value: str) -> str:
    value = re.sub(r"https?://\S+", "", value)
    value = re.sub(r"令和\d+年|\d{1,2}月\d{1,2}日", "", value)
    value = re.sub(r"[【】「」『』（）()\[\]＜＞<>:：｜|・\s　、。,.!?！？]", "", value)
    return value.lower().strip()


def stable_hash(value: str, length: int = 10) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:length]


def current_jst() -> datetime:
    raw = os.environ.get("KEIBA_NEWS_NOW", "").strip()
    if raw:
        try:
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
                parsed = datetime.fromisoformat(raw).replace(tzinfo=JST)
            else:
                parsed = datetime.fromisoformat(raw)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=JST)
            return parsed.astimezone(JST)
        except ValueError:
            pass
    return datetime.now(JST)


def race_demand_date(entry: RaceDemand, now: Optional[datetime] = None) -> date:
    base_now = now or current_jst()
    target = date(base_now.year, entry.month, entry.day)
    delta = (target - base_now.date()).days
    if delta < -180:
        target = date(base_now.year + 1, entry.month, entry.day)
    elif delta > 210:
        target = date(base_now.year - 1, entry.month, entry.day)
    return target


def days_until_race(entry: RaceDemand, now: Optional[datetime] = None) -> int:
    base_now = now or current_jst()
    return (race_demand_date(entry, base_now) - base_now.date()).days


def focus_window() -> Tuple[int, int]:
    before = parse_positive_int(os.environ.get("KEIBA_NEWS_RACE_WINDOW_BEFORE_DAYS"), 21)
    after = parse_positive_int(os.environ.get("KEIBA_NEWS_RACE_WINDOW_AFTER_DAYS"), 3)
    return before, after


def is_in_focus_window(days_to_race: int) -> bool:
    before, after = focus_window()
    return -after <= days_to_race <= before


def race_window_score(days_to_race: Optional[int]) -> float:
    if days_to_race is None:
        return 0
    if not is_in_focus_window(days_to_race):
        return -70
    if 0 <= days_to_race <= 3:
        return 34
    if 4 <= days_to_race <= 7:
        return 28
    if 8 <= days_to_race <= 14:
        return 18
    if days_to_race < 0:
        return 12
    return 10


def normalize_race_alias(value: str) -> str:
    return normalize_key(value).replace("ステークス", "s").replace("スプリント", "s")


def find_race_demand(text: str, race_name: str = "") -> Optional[RaceDemand]:
    haystack = normalize_race_alias(f"{race_name} {text}")
    if not haystack:
        return None

    for entry in RACE_DEMAND_CALENDAR:
        for alias in (entry.name, *entry.aliases):
            alias_key = normalize_race_alias(alias)
            if alias_key and alias_key in haystack:
                return entry
    return None


def focus_races(now: Optional[datetime] = None) -> List[Tuple[RaceDemand, int]]:
    base_now = now or current_jst()
    entries: List[Tuple[RaceDemand, int]] = []
    for entry in RACE_DEMAND_CALENDAR:
        days = days_until_race(entry, base_now)
        if is_in_focus_window(days):
            entries.append((entry, days))
    entries.sort(key=lambda item: (abs(item[1]), -item[0].base_score))
    return entries


def detect_search_intent(title: str, content: str = "", query: str = "") -> Tuple[str, str, int]:
    joined = f"{title} {content} {query}"
    for key, label, pattern, score in SEARCH_INTENT_RULES:
        if pattern.search(joined):
            return key, label, score
    return "ai_prediction", "AI予想", 12


def infer_target_year(title: str, demand: Optional[RaceDemand]) -> str:
    year_match = re.search(r"20\d{2}", title)
    if year_match:
        return year_match.group(0)
    if demand:
        return str(race_demand_date(demand).year)
    return str(current_jst().year)


def make_topic_key(race_name: str, title: str, search_intent: str, demand: Optional[RaceDemand]) -> str:
    year = infer_target_year(title, demand)
    base = race_name or (demand.name if demand else title)
    return normalize_key(f"{base}{year}:{search_intent}")


def recent_news_history(days: int) -> List[Dict[str, Any]]:
    cutoff = current_jst() - timedelta(days=days)
    recent: List[Dict[str, Any]] = []
    for item in load_json_array(NEWS_HISTORY_PATH):
        created_at = str(item.get("created_at") or "")
        try:
            parsed = datetime.fromisoformat(created_at)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=JST)
        except ValueError:
            continue
        if parsed.astimezone(JST) >= cutoff:
            recent.append(item)
    return recent


def recent_race_counts(days: int) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in recent_news_history(days):
        race = normalize_key(str(item.get("race_name") or ""))
        if race:
            counts[race] = counts.get(race, 0) + 1
    return counts


def sentence_split(content: str) -> List[str]:
    normalized = content.replace("\r\n", "\n")
    parts = re.split(r"。|\n", normalized)
    return [compact_text(part, 180) for part in parts if len(part.strip()) >= 18]


def extract_allowed_claims(content: str) -> List[str]:
    claims: List[str] = []
    for sentence in sentence_split(content):
        if SOURCE_METRIC_REJECT_PATTERN.search(sentence):
            continue
        if len(sentence) < 18:
            continue
        claims.append(sentence)
        if len(claims) >= 4:
            break
    return claims


def extract_race_name(title: str) -> str:
    match = RACE_NAME_PATTERN.search(title)
    if not match:
        return ""
    race_name = match.group(1)
    race_name = re.sub(r"^(?:JRA|NAR|地方競馬|競馬)", "", race_name).strip()
    return race_name[:24]


def extract_race_name_from_text(title: str, content: str = "") -> str:
    race_name = extract_race_name(title) or extract_race_name(content)
    demand = find_race_demand(f"{title} {content}", race_name)
    if demand:
        return demand.name
    return race_name


def load_json_array(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def load_existing_article_keywords() -> Set[str]:
    keywords: Set[str] = set()
    if not os.path.exists(ARTICLES_DIR):
        return keywords

    for filepath in glob.glob(os.path.join(ARTICLES_DIR, "*.md")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            if not content.startswith("---"):
                continue
            frontmatter = content.split("---", 2)[1]
            for line in frontmatter.splitlines():
                if line.strip().startswith("target_keyword:"):
                    keyword = line.split(":", 1)[1].strip().strip("\"'")
                    if keyword:
                        keywords.add(keyword)
                    break
        except Exception:
            continue
    return keywords


def load_pending_order_keywords() -> Set[str]:
    keywords: Set[str] = set()
    if not os.path.exists(WRITE_ORDERS_DIR):
        return keywords

    for filepath in glob.glob(os.path.join(WRITE_ORDERS_DIR, "*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                order = json.load(f)
            keyword = order.get("target_keyword")
            if keyword:
                keywords.add(str(keyword))
        except Exception:
            continue
    return keywords


def load_known_topic_keys() -> Set[str]:
    known: Set[str] = set()

    for item in load_json_array(POSTED_HISTORY_PATH):
        for key in (item.get("target_keyword"), item.get("title"), item.get("news_topic_key")):
            if key:
                known.add(normalize_key(str(key)))

    for item in load_json_array(NEWS_HISTORY_PATH):
        for key in (item.get("topic_key"), item.get("target_keyword"), item.get("source_url")):
            if key:
                known.add(normalize_key(str(key)))

    for keyword in load_existing_article_keywords() | load_pending_order_keywords():
        known.add(normalize_key(keyword))

    return known


def build_queries_node(state: WorkflowState) -> WorkflowState:
    now = current_jst()
    year = now.year
    custom_queries = parse_csv_env("KEIBA_NEWS_CUSTOM_QUERIES", [])
    if custom_queries:
        state.queries = custom_queries
        return state

    queries: List[str] = []
    max_focus_races = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_FOCUS_RACES"), 3), 5)
    for race, _days in focus_races(now)[:max_focus_races]:
        primary_alias = race.aliases[0] if race.aliases else race.name
        for intent_words in RACE_QUERY_INTENTS:
            queries.append(f"{primary_alias} {year} {intent_words} JRA 公式")

    queries.extend(template.format(year=year) for template in QUERY_TEMPLATES)
    max_queries = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_QUERIES_PER_RUN"), 6), 10)

    deduped: List[str] = []
    seen: Set[str] = set()
    for query in queries:
        key = normalize_key(query)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(query)
        if len(deduped) >= max_queries:
            break

    state.queries = deduped
    return state


def tavily_search(query: str, include_domains: List[str], max_results: int, days: int) -> Dict[str, Any]:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError("TAVILY_API_KEY is not set.")

    response = requests.post(
        "https://api.tavily.com/search",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "search_depth": "advanced",
            "topic": "news",
            "days": days,
            "max_results": max_results,
            "include_answer": True,
            "include_raw_content": False,
            "include_images": False,
            "include_domains": include_domains,
        },
        timeout=45,
    )
    if not response.ok:
        raise RuntimeError(f"Tavily search failed: {response.status_code} {response.text[:160]}")
    return response.json()


def fetch_tavily_node(state: WorkflowState) -> WorkflowState:
    if not os.environ.get("TAVILY_API_KEY"):
        state.issues.append("TAVILY_API_KEY is not set. News topic planner skipped.")
        return state

    include_domains = parse_csv_env("KEIBA_NEWS_INCLUDE_DOMAINS", DEFAULT_INCLUDE_DOMAINS)
    max_results = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_RESULTS_PER_QUERY"), 5), 8)
    days = min(parse_positive_int(os.environ.get("KEIBA_NEWS_LOOKBACK_DAYS"), 7), 30)
    sleep_seconds = float(os.environ.get("KEIBA_NEWS_REQUEST_SLEEP_SECONDS", "1.0"))

    for query in state.queries:
        try:
            response = tavily_search(query, include_domains, max_results, days)
            for result in response.get("results", []) or []:
                if isinstance(result, dict):
                    result["_query"] = query
                    state.raw_results.append(result)
            time.sleep(max(0.0, sleep_seconds))
        except Exception as exc:
            state.issues.append(f"Tavily query failed: {query} / {exc}")
    return state


def score_source(title: str, content: str, url_value: str) -> float:
    source_type = classify_source_type(url_value)
    score = 0.0
    if source_type == "official":
        score += 35
    elif source_type == "trusted_media":
        score += 18
    else:
        score -= 30

    joined = f"{title} {content}"
    race_name = extract_race_name_from_text(title, content)
    demand = find_race_demand(joined, race_name)
    _intent_key, _intent_label, intent_score = detect_search_intent(title, content)

    if HIGH_VALUE_TOPIC_PATTERN.search(joined):
        score += 24
    if re.search(r"枠順|出走予定|出走馬|馬場|騎手変更|開催", joined):
        score += 16
    if re.search(r"G1|G2|G3|Ｇ１|Ｇ２|Ｇ３|重賞", joined):
        score += 12
    score += intent_score
    if demand:
        days = days_until_race(demand)
        score += demand.base_score + race_window_score(days)
    elif race_name:
        score -= 18
    if re.search(r"予想|買い目|的中|オッズ", joined):
        score -= 8
    if len(content) >= 120:
        score += 6
    return score


def filter_sources_node(state: WorkflowState) -> WorkflowState:
    seen_urls: Set[str] = set()
    min_score = float(os.environ.get("KEIBA_NEWS_MIN_SOURCE_SCORE", "28"))

    for result in state.raw_results:
        title = compact_text(str(result.get("title") or ""), 140)
        url_value = str(result.get("url") or "").strip()
        content = compact_text(str(result.get("content") or ""), 560)
        query = str(result.get("_query") or "")
        if not title or not url_value or not content or url_value in seen_urls:
            continue
        seen_urls.add(url_value)

        source_type = classify_source_type(url_value)
        if source_type == "other":
            continue

        allowed_claims = extract_allowed_claims(content)
        if not allowed_claims:
            continue

        source_score = score_source(title, content, url_value)
        if source_score < min_score:
            continue

        state.source_cards.append(
            SourceCard(
                title=title,
                url=url_value,
                content=content,
                query=query,
                source_name=hostname(url_value),
                source_type=source_type,
                score=source_score,
                fetched_at=state.fetched_at,
                allowed_claims=allowed_claims,
            )
        )

    state.source_cards.sort(key=lambda card: card.score, reverse=True)
    return state


def make_target_keyword(card: SourceCard, race_name: str, search_intent_label: str, demand: Optional[RaceDemand]) -> str:
    title = re.sub(r"【[^】]+】|\[[^\]]+]", "", card.title).strip()
    year = infer_target_year(title, demand)

    if race_name:
        if search_intent_label == "AI予想":
            return f"{race_name}{year} AI予想"
        return f"{race_name}{year} {search_intent_label} AI予想"

    normalized_title = re.sub(r"\s+", " ", title)
    normalized_title = re.sub(r"https?://\S+", "", normalized_title)
    normalized_title = normalized_title[:30].strip(" 、。-_|｜")
    return f"{normalized_title} 競馬ニュース"


def cluster_topics_node(state: WorkflowState) -> WorkflowState:
    grouped: Dict[str, List[SourceCard]] = {}
    enforce_season_window = os.environ.get("KEIBA_NEWS_ENFORCE_SEASON_WINDOW", "true").lower() not in {"0", "false", "no"}

    for card in state.source_cards:
        race_name = extract_race_name_from_text(card.title, card.content)
        demand = find_race_demand(f"{card.title} {card.content}", race_name)
        if demand and enforce_season_window and not is_in_focus_window(days_until_race(demand)):
            continue

        search_intent, _label, _score = detect_search_intent(card.title, card.content, card.query)
        topic_key = make_topic_key(race_name, card.title, search_intent, demand)
        if not topic_key:
            topic_key = stable_hash(card.url)
        grouped.setdefault(topic_key, []).append(card)

    known_keys = load_known_topic_keys()
    candidates: List[TopicCandidate] = []

    for topic_key, cards in grouped.items():
        cards.sort(key=lambda card: card.score, reverse=True)
        primary = cards[0]
        race_name = extract_race_name_from_text(primary.title, primary.content)
        demand = find_race_demand(f"{primary.title} {primary.content}", race_name)
        search_intent, search_intent_label, intent_score = detect_search_intent(primary.title, primary.content, primary.query)
        days_to_race = days_until_race(demand) if demand else None
        if demand and enforce_season_window and days_to_race is not None and not is_in_focus_window(days_to_race):
            continue

        target_keyword = make_target_keyword(primary, race_name, search_intent_label, demand)
        target_key = normalize_key(target_keyword)
        url_key = normalize_key(primary.url)
        if topic_key in known_keys or target_key in known_keys or url_key in known_keys:
            continue

        article_type = "race_update" if race_name else "news_context"
        theme_cluster = "race_update" if race_name else "news_context"
        source_bonus = min(len(cards), 3) * 5
        score = primary.score + source_bonus + intent_score
        reason_bits = []
        if primary.source_type == "official":
            reason_bits.append("公式ソースあり")
        if race_name:
            reason_bits.append(f"レース名検出: {race_name}")
        if search_intent_label:
            reason_bits.append(f"検索意図: {search_intent_label}")
        if demand and days_to_race is not None:
            reason_bits.append(f"開催接近: {days_to_race}日")
        if HIGH_VALUE_TOPIC_PATTERN.search(primary.title + primary.content):
            reason_bits.append("検索需要が高い競馬トピック")
        reason = " / ".join(reason_bits) or "競馬ニュース候補"

        candidates.append(
            TopicCandidate(
                topic_key=topic_key,
                target_keyword=target_keyword,
                title_seed=primary.title,
                article_type=article_type,
                theme_cluster=theme_cluster,
                search_intent=search_intent,
                search_intent_label=search_intent_label,
                score=score,
                reason=reason,
                race_name=race_name,
                calendar_race=demand.name if demand else "",
                days_to_race=days_to_race,
                source_cards=cards[:3],
            )
        )

    state.topic_candidates = sorted(candidates, key=lambda item: item.score, reverse=True)
    return state


def source_cards_to_claim_rows(cards: List[SourceCard]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for index, card in enumerate(cards, start=1):
        rows.append(
            {
                "確認項目": f"外部ソース{index}",
                "内容": card.title,
                "出典種別": "公式" if card.source_type == "official" else "信頼媒体",
            }
        )
        for claim in card.allowed_claims[:2]:
            rows.append(
                {
                    "確認項目": f"使える事実{index}",
                    "内容": claim,
                    "出典種別": "公式" if card.source_type == "official" else "信頼媒体",
                }
            )
    return rows[:8]


def build_competing_structure(candidate: TopicCandidate) -> List[str]:
    if candidate.article_type == "race_update":
        return [
            "ニュースで確認された事実",
            f"{candidate.search_intent_label}を出馬表で確認する順番",
            "同レースで先に見るべき枠順・脚質・馬場",
            "UMA-FREEの出馬表で確認する順番",
            "買い・抑え・見送りの条件",
        ]
    return [
        "ニュースで確認された事実",
        f"{candidate.search_intent_label}として見るべき論点",
        "出馬表や開催情報で確認する順番",
        "買い・抑え・見送りの条件",
    ]


def build_write_orders_node(state: WorkflowState) -> WorkflowState:
    max_orders = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN"), 2), 5)
    min_topic_score = float(os.environ.get("KEIBA_NEWS_MIN_TOPIC_SCORE", "45"))
    cooldown_days = parse_positive_int(os.environ.get("KEIBA_NEWS_RACE_TOPIC_COOLDOWN_DAYS"), 7)
    max_topics_per_race_window = parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_TOPICS_PER_RACE_WINDOW"), 2)
    max_topics_per_race_run = parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_TOPICS_PER_RACE_PER_RUN"), 1)
    recent_counts = recent_race_counts(cooldown_days)
    selected: List[TopicCandidate] = []
    selected_race_counts: Dict[str, int] = {}

    for item in state.topic_candidates:
        if item.score < min_topic_score:
            continue

        race_key = normalize_key(item.race_name)
        if race_key:
            if recent_counts.get(race_key, 0) >= max_topics_per_race_window:
                continue
            if selected_race_counts.get(race_key, 0) >= max_topics_per_race_run:
                continue

        selected.append(item)
        if race_key:
            selected_race_counts[race_key] = selected_race_counts.get(race_key, 0) + 1
        if len(selected) >= max_orders:
            break

    state.selected_topics = selected

    for candidate in selected:
        source_urls = [card.url for card in candidate.source_cards]
        key_metrics = source_cards_to_claim_rows(candidate.source_cards)
        if not key_metrics:
            continue

        order = {
            "target_keyword": candidate.target_keyword,
            "theme_cluster": candidate.theme_cluster,
            "priority": int(min(99, max(35, candidate.score))),
            "has_external_research": True,
            "reference_data": {
                "period": current_jst().strftime("%Y年%m月%d日取得"),
                "condition": "競馬ニュース起点の確認テーマ",
                "sample_size": len(candidate.source_cards),
                "key_metrics": key_metrics,
                "source": "Tavily Search + 公式・信頼媒体フィルタ",
                "article_type": candidate.article_type,
                "news_topic": candidate.title_seed,
                "news_topic_key": candidate.topic_key,
                "news_reason": candidate.reason,
                "race_name": candidate.race_name,
                "calendar_race": candidate.calendar_race,
                "days_to_race": candidate.days_to_race,
                "search_intent": candidate.search_intent,
                "search_intent_label": candidate.search_intent_label,
                "source_urls": source_urls,
                "source_cards": [
                    {
                        "source_url": card.url,
                        "source_name": card.source_name,
                        "source_type": card.source_type,
                        "fetched_at": card.fetched_at,
                        "title": card.title,
                        "allowed_claims": card.allowed_claims,
                    }
                    for card in candidate.source_cards
                ],
                "external_research_required": True,
                "race_url": "/races/today",
            },
            "research_sources": [
                {
                    "source_url": card.url,
                    "source_name": card.source_name,
                    "source_type": card.source_type,
                    "fetched_at": card.fetched_at,
                    "title": card.title,
                    "allowed_claims": card.allowed_claims,
                }
                for card in candidate.source_cards
            ],
            "competing_article_structure": build_competing_structure(candidate),
        }
        state.write_orders.append(order)
    return state


def unique_order_path(index: int) -> str:
    now = current_jst()
    base = now.strftime("%Y%m%d_%H%M%S")
    filename = f"{base}_news_{index}.json"
    path = os.path.join(WRITE_ORDERS_DIR, filename)
    suffix = 2
    while os.path.exists(path):
        filename = f"{base}_news_{index}_{suffix}.json"
        path = os.path.join(WRITE_ORDERS_DIR, filename)
        suffix += 1
    return path


def persist_orders_node(state: WorkflowState) -> WorkflowState:
    if not state.write_orders:
        return state

    os.makedirs(WRITE_ORDERS_DIR, exist_ok=True)
    history = load_json_array(NEWS_HISTORY_PATH)

    for index, order in enumerate(state.write_orders, start=1):
        output_path = unique_order_path(index)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(order, f, ensure_ascii=False, indent=2)
        print(f"[NewsTopicPlanner] WriteOrder generated: {output_path}")

        ref = order.get("reference_data", {})
        history.append(
            {
                "run_id": state.run_id,
                "created_at": state.fetched_at,
                "target_keyword": order.get("target_keyword"),
                "theme_cluster": order.get("theme_cluster"),
                "topic_key": ref.get("news_topic_key"),
                "race_name": ref.get("race_name"),
                "search_intent": ref.get("search_intent"),
                "search_intent_label": ref.get("search_intent_label"),
                "days_to_race": ref.get("days_to_race"),
                "source_url": (ref.get("source_urls") or [""])[0],
                "score": order.get("priority"),
                "status": "write_order_created",
            }
        )

    os.makedirs(os.path.dirname(NEWS_HISTORY_PATH), exist_ok=True)
    with open(NEWS_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history[-500:], f, ensure_ascii=False, indent=2)
    return state


def run_graph() -> WorkflowState:
    now = current_jst()
    state = WorkflowState(
        run_id=f"news-{now.strftime('%Y%m%d-%H%M%S')}-{stable_hash(str(now.timestamp()), 6)}",
        fetched_at=now.isoformat(),
    )

    nodes = [
        ("BuildQueries", build_queries_node),
        ("FetchTavily", fetch_tavily_node),
        ("FilterSources", filter_sources_node),
        ("ClusterTopics", cluster_topics_node),
        ("BuildWriteOrders", build_write_orders_node),
        ("PersistOrders", persist_orders_node),
    ]

    for name, node in nodes:
        print(f"[NewsTopicPlanner] Node start: {name}")
        state = node(state)
        print(
            "[NewsTopicPlanner] Node done: "
            f"{name} / raw={len(state.raw_results)} sources={len(state.source_cards)} "
            f"topics={len(state.topic_candidates)} orders={len(state.write_orders)}"
        )

    if state.issues:
        print("[NewsTopicPlanner] Issues:")
        for issue in state.issues:
            print(f"  - {issue}")

    if not state.write_orders:
        print("[NewsTopicPlanner] No news write orders generated.")

    return state


if __name__ == "__main__":
    if os.environ.get("KEIBA_NEWS_PIPELINE_ENABLED", "true").lower() in {"0", "false", "no"}:
        print("[NewsTopicPlanner] KEIBA_NEWS_PIPELINE_ENABLED=false. Skipping.")
    else:
        run_graph()
