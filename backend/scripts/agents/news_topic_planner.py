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
from datetime import datetime, timedelta, timezone
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
    score: float
    reason: str
    race_name: str
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
    value = re.sub(r"20\d{2}|令和\d+年|\d{1,2}月\d{1,2}日", "", value)
    value = re.sub(r"[【】「」『』（）()\[\]＜＞<>:：｜|・\s　、。,.!?！？]", "", value)
    return value.lower().strip()


def stable_hash(value: str, length: int = 10) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:length]


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
    now = datetime.now(JST)
    year = now.year
    custom_queries = parse_csv_env("KEIBA_NEWS_CUSTOM_QUERIES", [])
    default_queries = [template.format(year=year) for template in QUERY_TEMPLATES]
    state.queries = custom_queries or default_queries
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
    if HIGH_VALUE_TOPIC_PATTERN.search(joined):
        score += 24
    if re.search(r"枠順|出走予定|出走馬|馬場|騎手変更|開催", joined):
        score += 16
    if re.search(r"G1|G2|G3|Ｇ１|Ｇ２|Ｇ３|重賞", joined):
        score += 12
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


def make_target_keyword(card: SourceCard, race_name: str) -> str:
    title = re.sub(r"【[^】]+】|\[[^\]]+]", "", card.title).strip()
    year_match = re.search(r"20\d{2}", title)
    year = year_match.group(0) if year_match else str(datetime.now(JST).year)

    if race_name:
        if re.search(r"枠順", title):
            return f"{race_name}{year} 枠順 データ確認"
        if re.search(r"出走予定|出走馬", title):
            return f"{race_name}{year} 出走予定 データ確認"
        if re.search(r"馬場", title):
            return f"{race_name}{year} 馬場 データ確認"
        return f"{race_name}{year} ニュース データ確認"

    normalized_title = re.sub(r"\s+", " ", title)
    normalized_title = re.sub(r"https?://\S+", "", normalized_title)
    normalized_title = normalized_title[:32].strip(" 、。-_|｜")
    return f"{normalized_title} 競馬ニュース データ確認"


def cluster_topics_node(state: WorkflowState) -> WorkflowState:
    grouped: Dict[str, List[SourceCard]] = {}
    for card in state.source_cards:
        race_name = extract_race_name(card.title)
        base_key = race_name or card.title
        topic_key = normalize_key(base_key)
        if not topic_key:
            topic_key = stable_hash(card.url)
        grouped.setdefault(topic_key, []).append(card)

    known_keys = load_known_topic_keys()
    candidates: List[TopicCandidate] = []

    for topic_key, cards in grouped.items():
        cards.sort(key=lambda card: card.score, reverse=True)
        primary = cards[0]
        race_name = extract_race_name(primary.title)
        target_keyword = make_target_keyword(primary, race_name)
        target_key = normalize_key(target_keyword)
        url_key = normalize_key(primary.url)
        if topic_key in known_keys or target_key in known_keys or url_key in known_keys:
            continue

        article_type = "race_update" if race_name else "news_context"
        theme_cluster = "race_update" if race_name else "news_context"
        source_bonus = min(len(cards), 3) * 5
        score = primary.score + source_bonus
        reason_bits = []
        if primary.source_type == "official":
            reason_bits.append("公式ソースあり")
        if race_name:
            reason_bits.append(f"レース名検出: {race_name}")
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
                score=score,
                reason=reason,
                race_name=race_name,
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
            "同レースで先に見るべき枠順・脚質・馬場",
            "UMA-FREEの出馬表で確認する順番",
            "買い・抑え・見送りの条件",
        ]
    return [
        "ニュースで確認された事実",
        "競馬データとして見るべき論点",
        "出馬表や開催情報で確認する順番",
        "買い・抑え・見送りの条件",
    ]


def build_write_orders_node(state: WorkflowState) -> WorkflowState:
    max_orders = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN"), 2), 5)
    min_topic_score = float(os.environ.get("KEIBA_NEWS_MIN_TOPIC_SCORE", "45"))
    selected = [item for item in state.topic_candidates if item.score >= min_topic_score][:max_orders]
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
                "period": datetime.now(JST).strftime("%Y年%m月%d日取得"),
                "condition": "競馬ニュース起点の確認テーマ",
                "sample_size": len(candidate.source_cards),
                "key_metrics": key_metrics,
                "source": "Tavily Search + 公式・信頼媒体フィルタ",
                "article_type": candidate.article_type,
                "news_topic": candidate.title_seed,
                "news_topic_key": candidate.topic_key,
                "news_reason": candidate.reason,
                "race_name": candidate.race_name,
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
    now = datetime.now(JST)
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
    now = datetime.now(JST)
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
