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
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import quote, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    # GitHub Actionsでは環境変数から直接読むため、dotenvがなくても動作できるようにする。
    pass


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, "data", "write_orders")
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "posted_history.json")
NEWS_HISTORY_PATH = os.path.join(PROJECT_ROOT, "data", "news_topic_history.json")
ARTICLES_DIR = os.path.join(PROJECT_ROOT, "frontend", "content", "articles")

JST = timezone(timedelta(hours=9))

SessionLocal = None  # type: ignore[assignment]
models = None  # type: ignore[assignment]
text = None  # type: ignore[assignment]
DB_IMPORT_ERROR = ""
DB_IMPORT_ATTEMPTED = False

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
    "JRA 公式 重賞 開催日程 出走予定 コース {year}",
    "JRA 公式 重賞 登録馬 ローテーション 前走 {year}",
    "地方競馬 公式 重賞 開催日程 出走予定 交流競走 {year}",
    "競馬 重賞 結果 回顧 レース後 コメント {year}",
]

QUERY_TERMS_BY_INTENT = {
    "race_profile": "レース傾向 コース 距離 過去傾向",
    "field_analysis": "出走予定 登録馬 出走構成 距離適性",
    "past_trends": "過去結果 傾向 好走条件 コース",
    "previous_run": "前走 ローテーション 条件替わり",
    "stable_comment": "陣営コメント 厩舎コメント 状態",
    "track_condition": "馬場 天気 コース傾向",
    "jockey_change": "騎手 乗り替わり 鞍上",
    "local_matchup": "交流重賞 中央馬 地方馬 適性",
    "entries": "出走馬 出走予定 登録馬",
    "waku": "枠順 発表 出馬表",
    "training": "追い切り 調教 最終追い",
    "result_review": "結果 回顧 勝因 敗因 レース後",
}

NAR_VENUES = {
    "門別",
    "盛岡",
    "水沢",
    "浦和",
    "船橋",
    "大井",
    "川崎",
    "金沢",
    "笠松",
    "名古屋",
    "園田",
    "姫路",
    "高知",
    "佐賀",
    "帯広ば",
}

SOURCE_METRIC_REJECT_PATTERN = re.compile(
    r"勝率|複勝率|連対率|回収率|単勝回収|複勝回収|AI偏差値|指数|予想印|本命|穴馬|オッズ|買い目"
)

HIGH_VALUE_TOPIC_PATTERN = re.compile(
    r"G1|G2|G3|Ｇ１|Ｇ２|Ｇ３|JpnI|JpnII|JpnIII|Jpn1|Jpn2|Jpn3|重賞|交流重賞|地方重賞|南関|枠順|出走予定|出走馬|馬場|騎手変更|開催|"
    r"追い切り|調教|最終追い|前走|陣営|厩舎|コメント|話題馬|注目馬|SNS|騎手|乗り替わり|"
    r"ダービー|オークス|安田記念|宝塚記念|有馬記念|ジャパンカップ|天皇賞|皐月賞|菊花賞|桜花賞|"
    r"マイルCS|スプリンターズS|高松宮記念|フェブラリーS|チャンピオンズC|ホープフルS|"
    r"帝王賞|東京大賞典|JBC|かしわ記念|さきたま杯|関東オークス|全日本2歳優駿|ジャパンダートクラシック"
)

RACE_NAME_PATTERN = re.compile(
    r"([一-龥ァ-ヴーA-Za-z0-9・（）()]{2,24}(?:S|ステークス|カップ|記念|賞|杯|ダービー|オークス|マイル|スプリント|クラシック|レディスクラシック|グランプリ))"
)

OVERSEAS_KEYWORDS = re.compile(
    r"サウジカップ|サウジC|ドバイワールドC|ドバイWC|ドバイシーマ|ドバイターフ|ドバイゴールデン|ドバイSC|ドバイワールドカップ|"
    r"凱旋門賞|香港カップ|香港ヴァーズ|香港マイル|香港スプリント|BCクラシック|ブリーダーズC|BCターフ|マイルチャンピオンシップS|キングジョージ|"
    r"ケンタッキーダービー|プリークネスS|ベルモントS|海外遠征|海外重賞|中東遠征|サウジアラビア|キングアブドゥルアジーズ|メイダン|ロンシャン|シャティン|アスコット|サンタアニタ"
)

SEARCH_INTENT_RULES = [
    ("result_review", "結果・回顧", re.compile(r"レース結果|結果|回顧|勝因|敗因|レース後|優勝|制した|着順"), 34),
    ("local_matchup", "中央馬と地方馬の比較", re.compile(r"交流重賞|中央馬|地方馬|JRA勢|地方勢|遠征馬"), 28),
    ("field_analysis", "出走構成・適性", re.compile(r"出走構成|メンバー構成|距離適性|コース適性|相手関係|斤量|世代比較"), 27),
    ("past_trends", "過去傾向", re.compile(r"過去\d+年|過去結果|傾向|好走条件|歴代|データ分析"), 26),
    ("race_profile", "レース条件・コース", re.compile(r"開催日程|開催情報|コース|距離|舞台|レース概要|条件|特徴"), 25),
    ("entries", "出走馬", re.compile(r"出走予定|出走馬|登録馬|特別登録|出馬表|出走"), 26),
    ("previous_run", "前走後評価", re.compile(r"前走|巻き返し|立て直し|休み明け|敗因|上積み|反動"), 24),
    ("stable_comment", "陣営コメント", re.compile(r"陣営|厩舎|調教師|助手|コメント|手応え|状態|思惑"), 22),
    ("track_condition", "馬場", re.compile(r"馬場|天気|雨|稍重|重馬場|不良馬場|良馬場|道悪|脚質"), 22),
    ("jockey_change", "騎手変更", re.compile(r"騎手変更|乗り替わり|鞍上|騎手|ジョッキー"), 20),
    ("sns_buzz", "話題馬・騎手", re.compile(r"SNS|Ｘ|Xで|話題|反響|注目馬|有力馬|ファン|騎手|ジョッキー"), 20),
    ("training", "追い切り", re.compile(r"追い切り|調教|最終追い|坂路|ウッド|併せ馬"), 28),
    ("waku", "枠順", re.compile(r"枠順|枠順確定|抽選|ゲート|馬番"), 30),
    ("schedule", "開催情報", re.compile(r"開催|日程|発走|確定"), 14),
]

DRAW_PRE_ANNOUNCEMENT_PATTERN = re.compile(
    r"(?:枠順|馬番|出馬表).{0,16}(?:発表予定|発表日|発表は|いつ|見込み|予定)|"
    r"(?:発表予定|発表日).{0,16}(?:枠順|馬番|出馬表)"
)

DRAW_CONFIRMED_PATTERN = re.compile(
    r"枠順確定|枠順が確定|枠順が発表された|枠順を発表|枠順決定|枠順が決定|"
    r"馬番確定|馬番が確定|ゲート番.*確定|出馬表確定|出馬表が発表された|出馬表が公開された|出馬表を発表"
)

KEYWORD_LABEL_BY_INTENT = {
    "waku": "枠順",
    "entries": "出走馬",
    "training": "追い切り",
    "race_profile": "レース条件",
    "field_analysis": "出走構成",
    "past_trends": "過去傾向",
    "local_matchup": "中央馬と地方馬",
    "result_review": "結果回顧",
    "previous_run": "前走後評価",
    "stable_comment": "陣営コメント",
    "track_condition": "馬場",
    "jockey_change": "騎手変更",
    "sns_buzz": "話題馬 騎手",
    "schedule": "開催情報",
    "ai_prediction": "AI予想",
}

ANGLE_RULES_BY_INTENT = {
    "result_review": [
        ("結果回顧", re.compile(r"結果|回顧|勝因|敗因|レース後")),
    ],
    "local_matchup": [
        ("中央馬と地方馬の比較", re.compile(r"中央馬|地方馬|JRA勢|地方勢|交流重賞")),
    ],
    "field_analysis": [
        ("出走構成", re.compile(r"出走構成|メンバー構成|相手関係")),
        ("距離・コース適性", re.compile(r"距離適性|コース適性|条件替わり")),
        ("斤量と世代比較", re.compile(r"斤量|世代比較|古馬|3歳")),
    ],
    "past_trends": [
        ("過去傾向", re.compile(r"過去|傾向|好走条件|データ")),
    ],
    "race_profile": [
        ("開催条件", re.compile(r"開催日程|開催情報|レース概要|条件")),
        ("コースの特徴", re.compile(r"コース|距離|舞台|特徴")),
    ],
    "training": [
        ("最終追い切り", re.compile(r"最終追い|最終追切|最終調教")),
        ("坂路追い", re.compile(r"坂路")),
        ("ウッド追い", re.compile(r"ウッド|CW|Wコース")),
        ("調教評価", re.compile(r"調教|追い切り|追切")),
    ],
    "previous_run": [
        ("巻き返し条件", re.compile(r"巻き返し|反撃|立て直し")),
        ("敗因整理", re.compile(r"敗因|凡走|大敗|崩れ")),
        ("上積み", re.compile(r"上積み|良化|成長")),
        ("前走後評価", re.compile(r"前走|前回")),
    ],
    "stable_comment": [
        ("厩舎コメント", re.compile(r"厩舎|調教師|助手")),
        ("状態面", re.compile(r"状態|仕上がり|気配|手応え")),
        ("陣営コメント", re.compile(r"陣営|コメント")),
    ],
    "sns_buzz": [
        ("騎手ニュース", re.compile(r"騎手|ジョッキー|鞍上|乗り替わり")),
        ("注目馬", re.compile(r"注目馬|有力馬")),
        ("話題馬", re.compile(r"話題|SNS|Ｘ|Xで|反響")),
    ],
    "track_condition": [
        ("道悪馬場", re.compile(r"道悪|重馬場|不良馬場|稍重|雨")),
        ("天気馬場", re.compile(r"天気|雨|気温")),
        ("馬場傾向", re.compile(r"馬場|脚質")),
    ],
    "jockey_change": [
        ("乗り替わり", re.compile(r"乗り替わり|騎手変更|鞍上")),
        ("騎手ニュース", re.compile(r"騎手|ジョッキー")),
    ],
    "entries": [
        ("登録馬", re.compile(r"登録馬|特別登録")),
        ("出馬表", re.compile(r"出馬表|出走馬")),
        ("出走予定", re.compile(r"出走予定|出走")),
    ],
    "waku": [
        ("枠順発表後", DRAW_CONFIRMED_PATTERN),
        ("枠順発表前", re.compile(r"枠順|抽選|ゲート")),
        ("ゲート確認", re.compile(r"ゲート|抽選")),
    ],
}

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
    "ばんえい帯広": "obihiro",
}


@dataclass(frozen=True)
class RaceDemand:
    name: str
    aliases: Tuple[str, ...]
    month: int
    day: int
    grade: str
    base_score: int
    year: Optional[int] = None
    venue: str = ""
    distance: str = ""
    conditions: str = ""
    source_kind: str = "fallback"
    source_url: str = ""


RACE_DEMAND_CALENDAR: Tuple[RaceDemand, ...] = (
    RaceDemand("フェブラリーS", ("フェブラリーS", "フェブラリーステークス"), 2, 22, "G1", 38),
    RaceDemand("高松宮記念", ("高松宮記念",), 3, 29, "G1", 38),
    RaceDemand("大阪杯", ("大阪杯",), 4, 5, "G1", 38),
    RaceDemand("桜花賞", ("桜花賞",), 4, 12, "G1", 40),
    RaceDemand("皐月賞", ("皐月賞",), 4, 19, "G1", 42),
    RaceDemand("天皇賞(春)", ("天皇賞(春)", "天皇賞春", "天皇賞・春"), 5, 3, "G1", 40),
    RaceDemand("かしわ記念", ("かしわ記念",), 5, 5, "JpnI", 40),
    RaceDemand("NHKマイルC", ("NHKマイルC", "NHKマイルカップ"), 5, 10, "G1", 36),
    RaceDemand("ヴィクトリアマイル", ("ヴィクトリアマイル",), 5, 17, "G1", 36),
    RaceDemand("オークス", ("オークス", "優駿牝馬"), 5, 24, "G1", 42),
    RaceDemand("日本ダービー", ("日本ダービー", "東京優駿", "ダービー"), 5, 31, "G1", 48),
    RaceDemand("安田記念", ("安田記念",), 6, 7, "G1", 40),
    RaceDemand("関東オークス", ("関東オークス",), 6, 17, "JpnII", 32, 2026, "川崎", "2100m", "3歳牝馬", "nar"),
    RaceDemand("函館SS", ("函館SS", "函館スプリントS", "函館スプリントステークス"), 6, 13, "G3", 30),
    RaceDemand("宝塚記念", ("宝塚記念",), 6, 14, "G1", 46),
    RaceDemand("府中牝馬S", ("府中牝馬S", "府中牝馬ステークス"), 6, 21, "G3", 30, 2026, "東京", "芝1800m", "3歳以上牝馬", "jra"),
    RaceDemand("しらさぎS", ("しらさぎS", "しらさぎステークス"), 6, 21, "G3", 30, 2026, "阪神", "芝1600m", "3歳以上", "jra"),
    RaceDemand("さきたま杯", ("さきたま杯",), 6, 24, "JpnI", 40, 2026, "浦和", "1400m", "3歳以上", "nar"),
    RaceDemand("ラジオNIKKEI賞", ("ラジオNIKKEI賞", "ラジオNIKKEI"), 6, 28, "G3", 30, 2026, "福島", "芝1800m", "3歳", "jra"),
    RaceDemand("函館記念", ("函館記念",), 6, 28, "G3", 30, 2026, "函館", "芝2000m", "3歳以上", "jra"),
    RaceDemand("帝王賞", ("帝王賞",), 7, 1, "JpnI", 46, 2026, "大井", "2000m", "4歳以上", "nar"),
    RaceDemand("北九州記念", ("北九州記念",), 7, 5, "G3", 30, 2026, "小倉", "芝1200m", "3歳以上", "jra"),
    RaceDemand("スパーキングレディーカップ", ("スパーキングレディーカップ",), 7, 8, "JpnIII", 32, 2026, "川崎", "1600m", "3歳以上牝馬", "nar"),
    RaceDemand("スプリンターズS", ("スプリンターズS", "スプリンターズステークス"), 9, 27, "G1", 38),
    RaceDemand("ジャパンダートクラシック", ("ジャパンダートクラシック", "JDC"), 10, 7, "JpnI", 38),
    RaceDemand("秋華賞", ("秋華賞",), 10, 18, "G1", 38),
    RaceDemand("菊花賞", ("菊花賞",), 10, 25, "G1", 40),
    RaceDemand("天皇賞(秋)", ("天皇賞(秋)", "天皇賞秋", "天皇賞・秋"), 11, 1, "G1", 42),
    RaceDemand("JBCクラシック", ("JBCクラシック", "JBC Classic"), 11, 3, "JpnI", 42),
    RaceDemand("JBCスプリント", ("JBCスプリント",), 11, 3, "JpnI", 36),
    RaceDemand("JBCレディスクラシック", ("JBCレディスクラシック",), 11, 3, "JpnI", 34),
    RaceDemand("エリザベス女王杯", ("エリザベス女王杯",), 11, 15, "G1", 36),
    RaceDemand("マイルCS", ("マイルCS", "マイルチャンピオンシップ"), 11, 22, "G1", 38),
    RaceDemand("ジャパンカップ", ("ジャパンカップ", "JC"), 11, 29, "G1", 44),
    RaceDemand("チャンピオンズC", ("チャンピオンズC", "チャンピオンズカップ"), 12, 6, "G1", 36),
    RaceDemand("阪神JF", ("阪神JF", "阪神ジュベナイルF", "阪神ジュベナイルフィリーズ"), 12, 13, "G1", 34),
    RaceDemand("全日本2歳優駿", ("全日本2歳優駿",), 12, 16, "JpnI", 34),
    RaceDemand("朝日杯FS", ("朝日杯FS", "朝日杯フューチュリティS", "朝日杯フューチュリティステークス"), 12, 20, "G1", 34),
    RaceDemand("有馬記念", ("有馬記念",), 12, 27, "G1", 50),
    RaceDemand("東京大賞典", ("東京大賞典",), 12, 29, "G1", 46),
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
    search_angle_label: str
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


def ensure_db_modules() -> bool:
    global SessionLocal, models, text, DB_IMPORT_ERROR, DB_IMPORT_ATTEMPTED
    if DB_IMPORT_ATTEMPTED:
        return SessionLocal is not None and models is not None and text is not None

    DB_IMPORT_ATTEMPTED = True
    try:
        from database.database import SessionLocal as imported_session_local
        from database import models as imported_models
        from sqlalchemy import text as imported_text
    except Exception as exc:
        DB_IMPORT_ERROR = str(exc)
        return False

    SessionLocal = imported_session_local
    models = imported_models
    text = imported_text
    DB_IMPORT_ERROR = ""
    return True


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


_RACE_SCHEDULE_CACHE: Dict[Tuple[int, int], Tuple[RaceDemand, ...]] = {}


def normalize_grade_label(value: str) -> str:
    normalized = re.sub(r"\s+", "", value or "")
    replacements = {
        "GⅠ": "G1",
        "GⅡ": "G2",
        "GⅢ": "G3",
        "J・GⅢ": "JG3",
        "JpnI": "JpnI",
        "JpnII": "JpnII",
        "JpnIII": "JpnIII",
        "Jpn1": "JpnI",
        "Jpn2": "JpnII",
        "Jpn3": "JpnIII",
    }
    return replacements.get(normalized, normalized)


def base_score_for_grade(grade: str) -> int:
    normalized = normalize_grade_label(grade)
    return {
        "G1": 44,
        "JpnI": 44,
        "G2": 36,
        "JpnII": 36,
        "G3": 30,
        "JpnIII": 32,
        "JG3": 18,
        "重賞": 22,
    }.get(normalized, 20)


def aliases_for_schedule_race(name: str) -> Tuple[str, ...]:
    aliases: List[str] = [name]
    if name.endswith("S"):
        aliases.append(f"{name[:-1]}ステークス")
    if name.endswith("C"):
        aliases.append(f"{name[:-1]}カップ")
    if "ステークス" in name:
        aliases.append(name.replace("ステークス", "S"))
    if "カップ" in name:
        aliases.append(name.replace("カップ", "C"))
    return tuple(dict.fromkeys(alias for alias in aliases if alias))


def schedule_identity(name: str) -> str:
    return (
        normalize_key(name)
        .replace("ステークス", "s")
        .replace("スプリント", "s")
        .replace("カップ", "c")
    )


def parse_jra_schedule_html(html_text: str, year: int) -> List[RaceDemand]:
    soup = BeautifulSoup(html_text, "lxml")
    venue_pattern = r"札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉"
    row_pattern = re.compile(
        rf"^(?P<month>\d{{1,2}})月(?P<day>\d{{1,2}})日\s+\S+\s+"
        rf"(?P<grade>J\s*・\s*G[ⅠⅡⅢ]|G[ⅠⅡⅢ])\s+"
        rf"(?P<name>.+?)\s+(?P<venue>{venue_pattern})\s+"
        rf"(?P<conditions>.+?)\s+(?P<surface>芝|ダ|障)\s+(?P<distance>[\d,]+)\s*メートル"
    )
    entries: List[RaceDemand] = []
    for row in soup.find_all("tr"):
        text_value = " ".join(row.stripped_strings)
        match = row_pattern.search(text_value)
        if not match:
            continue
        name = match.group("name").strip()
        grade = normalize_grade_label(match.group("grade"))
        surface = {"ダ": "ダート", "障": "障害"}.get(match.group("surface"), match.group("surface"))
        distance = match.group("distance").replace(",", "")
        entries.append(
            RaceDemand(
                name=name,
                aliases=aliases_for_schedule_race(name),
                month=int(match.group("month")),
                day=int(match.group("day")),
                grade=grade,
                base_score=base_score_for_grade(grade),
                year=year,
                venue=match.group("venue"),
                distance=f"{surface}{distance}m",
                conditions=match.group("conditions").strip(),
                source_kind="jra",
                source_url=f"https://www.jra.go.jp/datafile/seiseki/replay/{year}/jyusyo.html",
            )
        )
    return entries


def parse_nar_schedule_html(html_text: str, year: int) -> List[RaceDemand]:
    soup = BeautifulSoup(html_text, "lxml")
    venue_pattern = "|".join(sorted(NAR_VENUES, key=len, reverse=True))
    row_pattern = re.compile(
        rf"^(?P<month>\d{{1,2}})/(?P<day>\d{{1,2}})\([^)]+\)\s+"
        rf"(?P<name>.+?)\s+(?P<grade>Jpn[123]|重賞)\s+"
        rf"(?P<venue>{venue_pattern})\s+(?P<distance>\d+m)\s+(?P<conditions>.+)$"
    )
    entries: List[RaceDemand] = []
    for row in soup.find_all("tr"):
        text_value = " ".join(row.stripped_strings)
        match = row_pattern.search(text_value)
        if not match:
            continue
        name = match.group("name").strip()
        grade = normalize_grade_label(match.group("grade"))
        entries.append(
            RaceDemand(
                name=name,
                aliases=aliases_for_schedule_race(name),
                month=int(match.group("month")),
                day=int(match.group("day")),
                grade=grade,
                base_score=base_score_for_grade(grade),
                year=year,
                venue=match.group("venue"),
                distance=match.group("distance"),
                conditions=match.group("conditions").strip(),
                source_kind="nar",
                source_url=f"https://nar.sp.netkeiba.com/top/schedule.html?year={year}&month={int(match.group('month'))}",
            )
        )
    return entries


def schedule_months_in_window(now: datetime) -> List[Tuple[int, int]]:
    before, after = focus_window()
    start = now.date() - timedelta(days=after + 2)
    end = now.date() + timedelta(days=before + 2)
    months: List[Tuple[int, int]] = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        months.append((cursor.year, cursor.month))
        cursor = date(cursor.year + (1 if cursor.month == 12 else 0), 1 if cursor.month == 12 else cursor.month + 1, 1)
    return months


def fetch_remote_race_schedule(now: datetime) -> List[RaceDemand]:
    remote_enabled = os.environ.get("KEIBA_NEWS_REMOTE_SCHEDULE_ENABLED", "true").lower() not in {
        "0",
        "false",
        "no",
    }
    if not remote_enabled:
        return []

    timeout_seconds = min(parse_positive_int(os.environ.get("KEIBA_NEWS_SCHEDULE_TIMEOUT_SECONDS"), 15), 30)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; UMA-FREE schedule verifier/1.0)",
        "Accept-Language": "ja,en;q=0.7",
    }
    entries: List[RaceDemand] = []

    try:
        response = requests.get(
            f"https://www.jra.go.jp/datafile/seiseki/replay/{now.year}/jyusyo.html",
            headers=headers,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        response.encoding = "cp932"
        entries.extend(parse_jra_schedule_html(response.text, now.year))
    except Exception as exc:
        print(f"[NewsPlanner] JRA重賞日程の取得に失敗。内蔵日程へフォールバック: {exc}")

    for year, month in schedule_months_in_window(now):
        try:
            response = requests.get(
                f"https://nar.sp.netkeiba.com/top/schedule.html?year={year}&month={month}",
                headers=headers,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            response.encoding = "utf-8"
            entries.extend(parse_nar_schedule_html(response.text, year))
        except Exception as exc:
            print(f"[NewsPlanner] 地方重賞日程の取得に失敗 ({year}-{month:02d})。内蔵日程へフォールバック: {exc}")
    return entries


def available_race_demands(now: Optional[datetime] = None) -> Tuple[RaceDemand, ...]:
    base_now = now or current_jst()
    cache_key = (base_now.year, base_now.month)
    cached = _RACE_SCHEDULE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    merged: Dict[Tuple[str, int, int, int], RaceDemand] = {}
    for entry in RACE_DEMAND_CALENDAR:
        entry_year = entry.year or base_now.year
        if entry.year is not None and entry.year not in {base_now.year - 1, base_now.year, base_now.year + 1}:
            continue
        key = (schedule_identity(entry.name), entry_year, entry.month, entry.day)
        merged[key] = entry

    for entry in fetch_remote_race_schedule(base_now):
        identity = schedule_identity(entry.name)
        entry_year = entry.year or base_now.year
        for existing_key in list(merged):
            if existing_key[0] == identity and existing_key[1] == entry_year:
                merged.pop(existing_key, None)
        key = (identity, entry_year, entry.month, entry.day)
        merged[key] = entry

    schedule = tuple(merged.values())
    _RACE_SCHEDULE_CACHE[cache_key] = schedule
    return schedule


def race_demand_date(entry: RaceDemand, now: Optional[datetime] = None) -> date:
    base_now = now or current_jst()
    target = date(entry.year or base_now.year, entry.month, entry.day)
    if entry.year is not None:
        return target
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
    before = parse_positive_int(os.environ.get("KEIBA_NEWS_RACE_WINDOW_BEFORE_DAYS"), 7)
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


def find_race_demand(
    text: str,
    race_name: str = "",
    schedule: Optional[Sequence[RaceDemand]] = None,
) -> Optional[RaceDemand]:
    haystack = normalize_race_alias(f"{race_name} {text}")
    if not haystack:
        return None

    for entry in schedule or available_race_demands():
        for alias in (entry.name, *entry.aliases):
            alias_key = normalize_race_alias(alias)
            if alias_key and alias_key in haystack:
                return entry
    return None


def focus_races(
    now: Optional[datetime] = None,
    schedule: Optional[Sequence[RaceDemand]] = None,
) -> List[Tuple[RaceDemand, int]]:
    base_now = now or current_jst()
    entries: List[Tuple[RaceDemand, int]] = []
    for entry in schedule or available_race_demands(base_now):
        days = days_until_race(entry, base_now)
        if is_in_focus_window(days):
            entries.append((entry, days))
    entries.sort(
        key=lambda item: (
            -(item[0].base_score + race_window_score(item[1])),
            abs(item[1]),
            race_demand_date(item[0], base_now),
            item[0].name,
        )
    )
    return entries


def detect_search_intent(title: str, content: str = "", query: str = "") -> Tuple[str, str, int]:
    ranked: List[Tuple[float, str, str, int]] = []
    for key, label, pattern, score in SEARCH_INTENT_RULES:
        title_hits = len(pattern.findall(title))
        content_hits = len(pattern.findall(content))
        query_hits = len(pattern.findall(query))
        if title_hits + content_hits + query_hits == 0:
            continue

        # 検索クエリに含めた語だけで記事テーマを決めると、先頭クエリの
        # 「枠順」「追い切り」に全件が吸い寄せられる。タイトルと本文を重くする。
        weighted = score + title_hits * 9 + content_hits * 3 + query_hits * 0.5
        if title_hits + content_hits == 0:
            weighted -= 18
        ranked.append((weighted, key, label, score))

    if not ranked:
        return "race_profile", "レース条件・コース", 16
    ranked.sort(key=lambda item: (-item[0], -item[3], item[1]))
    _, key, label, score = ranked[0]
    return key, label, score


def race_phase(days_to_race: int) -> str:
    if days_to_race < 0:
        return "post_race"
    if days_to_race == 0:
        return "race_day"
    if days_to_race <= 2:
        return "final_48h"
    if days_to_race <= 5:
        return "race_week"
    if days_to_race <= 10:
        return "field_building"
    return "early_preview"


def query_intents_for_race(entry: RaceDemand, days_to_race: int) -> List[str]:
    phase = race_phase(days_to_race)
    is_local = entry.source_kind == "nar" or entry.venue in NAR_VENUES or entry.grade.startswith("Jpn")

    if phase == "post_race":
        return ["result_review"]
    if phase == "race_day":
        intents = ["field_analysis", "track_condition", "waku", "stable_comment"]
    elif phase == "final_48h":
        intents = ["field_analysis", "track_condition", "stable_comment", "waku", "training"]
    elif phase == "race_week":
        intents = ["field_analysis", "previous_run", "stable_comment", "track_condition", "training"]
    elif phase == "field_building":
        intents = ["field_analysis", "race_profile", "previous_run", "entries", "jockey_change"]
    else:
        intents = ["race_profile", "past_trends", "field_analysis", "entries", "previous_run"]

    if is_local and "local_matchup" not in intents:
        intents.insert(1, "local_matchup")
    return intents


def intent_has_source_evidence(intent: str, title: str, content: str) -> bool:
    for key, _label, pattern, _score in SEARCH_INTENT_RULES:
        if key == intent:
            return bool(pattern.search(f"{title} {content}"))
    return False


def normalize_intent_for_race_phase(
    intent: str,
    days_to_race: Optional[int],
    title: str,
    content: str,
) -> Optional[str]:
    if days_to_race is None:
        return intent

    if days_to_race < 0:
        return "result_review" if intent_has_source_evidence("result_review", title, content) else None

    # 枠順・追い切りは、検索クエリに語があるだけでは主題にしない。
    # 開催が近く、かつ取得ソース自体に明示された場合だけ採用する。
    if intent == "waku":
        if days_to_race > 4 or not intent_has_source_evidence("waku", title, content):
            return "field_analysis"
    if intent == "training":
        if days_to_race > 5 or not intent_has_source_evidence("training", title, content):
            return "previous_run"
    return intent


def infer_target_year(title: str, demand: Optional[RaceDemand]) -> str:
    year_match = re.search(r"20\d{2}", title)
    if year_match:
        return year_match.group(0)
    if demand:
        return str(race_demand_date(demand).year)
    return str(current_jst().year)


def detect_angle_label(search_intent: str, title: str, content: str = "", query: str = "") -> str:
    if search_intent == "waku":
        source_text = f"{title} {content}"
        if DRAW_PRE_ANNOUNCEMENT_PATTERN.search(source_text):
            return "枠順発表前"
        if DRAW_CONFIRMED_PATTERN.search(source_text):
            return "枠順発表後"
        return "枠順発表前"

    joined = f"{title} {content} {query}"
    for label, pattern in ANGLE_RULES_BY_INTENT.get(search_intent, []):
        if pattern.search(joined):
            return label
    return keyword_label_for_intent(search_intent, "")


def make_topic_key(
    race_name: str,
    title: str,
    search_intent: str,
    demand: Optional[RaceDemand],
    angle_label: str = "",
) -> str:
    year = infer_target_year(title, demand)
    base = race_name or (demand.name if demand else title)
    angle = angle_label or keyword_label_for_intent(search_intent, "")
    return normalize_key(f"{base}{year}:{search_intent}:{angle}")


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

    recent_history_days = parse_positive_int(os.environ.get("KEIBA_NEWS_RECENT_TOPIC_DEDUP_DAYS"), 2)
    for item in recent_news_history(recent_history_days):
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
    max_focus_races = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_FOCUS_RACES"), 4), 6)
    focus_entries = focus_races(now)[:max_focus_races]
    max_queries = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_QUERIES_PER_RUN"), 8), 12)
    intent_caps = {
        "waku": 1,
        "training": 1,
        "track_condition": 2,
        "result_review": 2,
    }
    intent_counts: Dict[str, int] = {}

    # 1巡目で各レースに1クエリずつ配り、2巡目以降で深掘りする。
    # これにより上位レースの枠順・追い切りだけで上限を使い切らない。
    for round_index in range(3):
        for race, days in focus_entries:
            available_intents = query_intents_for_race(race, days)
            chosen_intent = ""
            for intent in available_intents[round_index:]:
                cap = intent_caps.get(intent, max_queries)
                if intent_counts.get(intent, 0) >= cap:
                    continue
                chosen_intent = intent
                break
            if not chosen_intent:
                continue

            intent_counts[chosen_intent] = intent_counts.get(chosen_intent, 0) + 1
            primary_alias = race.aliases[0] if race.aliases else race.name
            intent_words = QUERY_TERMS_BY_INTENT[chosen_intent]
            source_hint = "地方競馬 公式 競馬ニュース" if race.source_kind == "nar" else "JRA 公式 競馬ニュース"
            queries.append(f"{primary_alias} {year} {intent_words} {source_hint}")
            if len(queries) >= max_queries:
                break
        if len(queries) >= max_queries:
            break

    queries.extend(template.format(year=year) for template in QUERY_TEMPLATES)

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
    intent_key, _intent_label, intent_score = detect_search_intent(title, content)

    if HIGH_VALUE_TOPIC_PATTERN.search(joined):
        score += 24
    if re.search(r"開催|日程|コース|距離|出走予定|出走馬|登録馬|前走|結果|回顧|交流重賞", joined):
        score += 16
    if re.search(r"枠順|追い切り|調教", joined):
        score += 5
    if re.search(r"G1|G2|G3|Ｇ１|Ｇ２|Ｇ３|重賞", joined):
        score += 12
    score += intent_score
    if demand:
        days = days_until_race(demand)
        score += demand.base_score + race_window_score(days)
        if days < 0 and intent_key != "result_review":
            score -= 55
        if intent_key == "waku" and days > 4:
            score -= 24
        if intent_key == "training" and days > 5:
            score -= 20
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


def keyword_label_for_intent(search_intent: str, search_intent_label: str) -> str:
    return KEYWORD_LABEL_BY_INTENT.get(search_intent, search_intent_label or "AI予想")


def make_target_keyword(
    card: SourceCard,
    race_name: str,
    search_intent: str,
    search_intent_label: str,
    search_angle_label: str,
    demand: Optional[RaceDemand],
) -> str:
    title = re.sub(r"【[^】]+】|\[[^\]]+]", "", card.title).strip()
    year = infer_target_year(title, demand)
    keyword_label = search_angle_label or keyword_label_for_intent(search_intent, search_intent_label)

    if race_name:
        if search_intent == "result_review":
            return f"{race_name}{year} 結果 回顧"
        if search_intent == "ai_prediction":
            return f"{race_name}{year} AI予想"
        if search_intent in {
            "waku",
            "entries",
            "training",
            "race_profile",
            "field_analysis",
            "past_trends",
            "local_matchup",
            "result_review",
            "previous_run",
            "stable_comment",
            "track_condition",
            "jockey_change",
            "sns_buzz",
            "schedule",
        }:
            return f"{race_name}{year} {keyword_label} 確認ポイント"
        return f"{race_name}{year} {keyword_label} AI予想"

    normalized_title = re.sub(r"\s+", " ", title)
    normalized_title = re.sub(r"https?://\S+", "", normalized_title)
    normalized_title = normalized_title[:30].strip(" 、。-_|｜")
    return f"{normalized_title} 競馬ニュース"


def cluster_topics_node(state: WorkflowState) -> WorkflowState:
    grouped: Dict[str, List[SourceCard]] = {}
    enforce_season_window = os.environ.get("KEIBA_NEWS_ENFORCE_SEASON_WINDOW", "true").lower() not in {"0", "false", "no"}
    require_schedule_match = os.environ.get("KEIBA_NEWS_REQUIRE_SCHEDULE_MATCH", "true").lower() not in {
        "0",
        "false",
        "no",
    }

    for card in state.source_cards:
        race_name = extract_race_name_from_text(card.title, card.content)
        demand = find_race_demand(f"{card.title} {card.content}", race_name)
        if race_name and not demand and require_schedule_match:
            continue
        if demand:
            race_name = demand.name
        if demand and enforce_season_window and not is_in_focus_window(days_until_race(demand)):
            continue

        search_intent, _label, _score = detect_search_intent(card.title, card.content, card.query)
        days_to_race = days_until_race(demand) if demand else None
        normalized_intent = normalize_intent_for_race_phase(
            search_intent,
            days_to_race,
            card.title,
            card.content,
        )
        if normalized_intent is None:
            continue
        search_intent = normalized_intent
        search_angle_label = detect_angle_label(search_intent, card.title, card.content, card.query)
        topic_key = make_topic_key(race_name, card.title, search_intent, demand, search_angle_label)
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
        if race_name and not demand and require_schedule_match:
            continue
        if demand:
            race_name = demand.name
        search_intent, search_intent_label, intent_score = detect_search_intent(primary.title, primary.content, primary.query)
        days_to_race = days_until_race(demand) if demand else None
        normalized_intent = normalize_intent_for_race_phase(
            search_intent,
            days_to_race,
            primary.title,
            primary.content,
        )
        if normalized_intent is None:
            continue
        search_intent = normalized_intent
        search_intent_label = KEYWORD_LABEL_BY_INTENT.get(search_intent, search_intent_label)
        search_angle_label = detect_angle_label(search_intent, primary.title, primary.content, primary.query)
        if demand and enforce_season_window and days_to_race is not None and not is_in_focus_window(days_to_race):
            continue

        target_keyword = make_target_keyword(primary, race_name, search_intent, search_intent_label, search_angle_label, demand)
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
        if search_angle_label and search_angle_label != search_intent_label:
            reason_bits.append(f"切り口: {search_angle_label}")
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
                search_angle_label=search_angle_label,
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


def display_course_type(course_type: str) -> str:
    if course_type == "ダ":
        return "ダート"
    return course_type or ""


def normalize_venue_name(venue_name: str) -> str:
    return re.sub(r"\s+", "", venue_name.strip().replace("競馬場", ""))


def venue_slug(venue_name: str) -> str:
    normalized = normalize_venue_name(venue_name)
    return VENUE_SLUGS.get(normalized, quote(normalized.lower()))


def race_date_to_string(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value or "")


def race_detail_path(race: Any) -> str:
    race_date = race_date_to_string(getattr(race, "race_date", ""))
    venue = getattr(race, "venue_name", "")
    race_number = getattr(race, "race_number", "")
    if not race_date or not venue or not race_number:
        return "/races/today"
    return f"/races/{race_date}/{venue_slug(str(venue))}/{race_number}"


def candidate_aliases(candidate: TopicCandidate) -> List[str]:
    aliases: List[str] = []
    for value in (candidate.race_name, candidate.calendar_race):
        if value and value not in aliases:
            aliases.append(value)

    demand = find_race_demand(
        f"{candidate.race_name} {candidate.calendar_race} {candidate.title_seed}",
        candidate.race_name,
    )
    if demand:
        for alias in (demand.name, *demand.aliases):
            if alias and alias not in aliases:
                aliases.append(alias)
    return aliases


def matching_race_score(race: Any, aliases: Sequence[str], target_date: date) -> float:
    race_key = normalize_race_alias(str(getattr(race, "race_name", "")))
    if not race_key:
        return -999

    name_score = 0.0
    for alias in aliases:
        alias_key = normalize_race_alias(alias)
        if not alias_key:
            continue
        if alias_key == race_key:
            name_score = max(name_score, 100)
        elif alias_key in race_key or race_key in alias_key:
            name_score = max(name_score, 76)

    if name_score <= 0:
        return -999

    race_date = getattr(race, "race_date", None)
    if isinstance(race_date, datetime):
        race_date = race_date.date()
    date_score = 0.0
    if isinstance(race_date, date):
        date_score = max(0, 36 - abs((race_date - target_date).days) * 6)

    horse_bonus = 4 if getattr(race, "total_horses", None) else 0
    return name_score + date_score + horse_bonus


def find_matching_race(db: Any, candidate: TopicCandidate) -> Optional[Any]:
    if models is None:
        return None

    aliases = candidate_aliases(candidate)
    if not aliases:
        return None

    now_date = current_jst().date()
    if candidate.days_to_race is not None:
        target_date = now_date + timedelta(days=candidate.days_to_race)
    else:
        demand = find_race_demand(
            f"{candidate.race_name} {candidate.calendar_race} {candidate.title_seed}",
            candidate.race_name,
        )
        target_date = race_demand_date(demand) if demand else now_date

    start_date = target_date - timedelta(days=5)
    end_date = target_date + timedelta(days=5)

    races = (
        db.query(models.Race)
        .filter(models.Race.race_date >= start_date)
        .filter(models.Race.race_date <= end_date)
        .all()
    )
    if not races:
        return None

    scored = [(matching_race_score(race, aliases, target_date), race) for race in races]
    scored.sort(key=lambda item: item[0], reverse=True)
    if scored[0][0] < 70:
        return None
    return scored[0][1]


def prediction_rows(db: Any, race_id: str) -> List[Dict[str, Any]]:
    if models is None:
        return []
    try:
        predictions = (
            db.query(models.Prediction)
            .filter(models.Prediction.race_id == race_id)
            .filter(models.Prediction.deviation_score.isnot(None))
            .order_by(models.Prediction.deviation_score.desc())
            .limit(5)
            .all()
        )
    except Exception:
        return []

    rows: List[Dict[str, Any]] = []
    for prediction in predictions:
        waku_number = getattr(prediction, "waku_number", None)
        horse_number = getattr(prediction, "horse_number", None)
        horse_label = f"{horse_number}番" if horse_number else ""
        if waku_number and horse_number:
            horse_label = f"{waku_number}枠{horse_number}番"

        row: Dict[str, Any] = {
            "馬番": horse_label,
            "馬名": getattr(prediction, "horse_name", ""),
            "AI偏差値": round(float(prediction.deviation_score), 2),
            "印": getattr(prediction, "mark", "") or "",
        }
        start_indicator = getattr(prediction, "start_1c_indicator", None)
        if start_indicator is not None:
            row["先行指標"] = round(float(start_indicator), 1)
        reason = getattr(prediction, "unpredictable_reason", None)
        if reason:
            row["補足"] = compact_text(str(reason), 80)
        rows.append(row)
    return rows


def course_stat_rows(db: Any, race: Any) -> List[Dict[str, Any]]:
    if text is None:
        return []

    venue = getattr(race, "venue_name", "") or ""
    course_type = getattr(race, "course_type", "") or ""
    distance = getattr(race, "distance", None)
    if not venue or not course_type or not distance:
        return []

    cutoff_date = (current_jst().date() - timedelta(days=365 * 3)).isoformat()
    try:
        result = db.execute(
            text(
                """
                SELECT
                  res.waku_number AS waku_number,
                  COUNT(res.id) AS runs,
                  SUM(CASE WHEN res.rank = 1 THEN 1 ELSE 0 END) AS wins,
                  SUM(CASE WHEN res.rank BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS places
                FROM results res
                JOIN races r ON res.race_id = r.id
                WHERE r.venue_name = :venue
                  AND r.course_type = :course_type
                  AND r.distance = :distance
                  AND r.race_date >= :cutoff_date
                  AND res.waku_number BETWEEN 1 AND 8
                GROUP BY res.waku_number
                ORDER BY res.waku_number
                """
            ),
            {
                "venue": venue,
                "course_type": course_type,
                "distance": int(distance),
                "cutoff_date": cutoff_date,
            },
        )
        rows = result.mappings().all()
    except Exception:
        return []

    stats: List[Dict[str, Any]] = []
    for row in rows:
        runs = int(row.get("runs") or 0)
        wins = int(row.get("wins") or 0)
        places = int(row.get("places") or 0)
        if runs <= 0:
            continue
        stats.append(
            {
                "枠番": f"{int(row.get('waku_number'))}枠",
                "出走数": runs,
                "勝率": f"{round(wins / runs * 100, 1)}%",
                "複勝率": f"{round(places / runs * 100, 1)}%",
            }
        )
    return stats


def horse_number_advantage_rows(db: Any, race: Any) -> List[Dict[str, Any]]:
    if models is None:
        return []

    venue = getattr(race, "venue_name", "") or ""
    course_type = getattr(race, "course_type", "") or ""
    distance = getattr(race, "distance", None)
    if not venue or not course_type or not distance:
        return []

    try:
        advantages = (
            db.query(models.HorseNumberAdvantage)
            .filter(models.HorseNumberAdvantage.venue_name == venue)
            .filter(models.HorseNumberAdvantage.course_type == course_type)
            .filter(models.HorseNumberAdvantage.distance == int(distance))
            .order_by(models.HorseNumberAdvantage.advantage_score.desc())
            .all()
        )
    except Exception:
        return []

    if not advantages:
        return []

    selected = advantages[:3]
    for item in advantages[-2:]:
        if item not in selected:
            selected.append(item)

    rows: List[Dict[str, Any]] = []
    for item in selected:
        score = float(getattr(item, "advantage_score", 0.0) or 0.0)
        if score > 0.05:
            note = "数値上はプラス"
        elif score < -0.05:
            note = "評価を下げたい馬番"
        else:
            note = "平均付近"
        rows.append(
            {
                "馬番": f"{getattr(item, 'horse_number', '')}番",
                "有利度スコア": round(score, 3),
                "見方": note,
            }
        )
    return rows


def build_internal_data_bundle(candidate: TopicCandidate) -> Dict[str, Any]:
    if os.environ.get("KEIBA_NEWS_DB_ENRICH_ENABLED", "true").lower() in {"0", "false", "no"}:
        return {}
    if not ensure_db_modules() or SessionLocal is None:
        return {"db_enrichment_error": DB_IMPORT_ERROR or "database module unavailable"}

    db = SessionLocal()
    try:
        race = find_matching_race(db, candidate)
        if race is None:
            return {"matched_race": None}

        race_id = getattr(race, "id", "")
        course_type = display_course_type(str(getattr(race, "course_type", "") or ""))
        distance = getattr(race, "distance", None)
        venue = getattr(race, "venue_name", "") or ""
        condition = f"{venue}競馬場 {course_type}{distance}m" if venue and course_type and distance else venue

        predictions = prediction_rows(db, race_id)
        course_stats = course_stat_rows(db, race)
        horse_number_advantages = horse_number_advantage_rows(db, race)
        ai_analysis_text = compact_text(str(getattr(race, "ai_analysis_text", "") or ""), 220)

        return {
            "matched_race": {
                "race_id": race_id,
                "race_name": getattr(race, "race_name", ""),
                "race_date": race_date_to_string(getattr(race, "race_date", "")),
                "venue_name": venue,
                "race_number": getattr(race, "race_number", None),
                "course_type": course_type,
                "distance": distance or 0,
                "total_horses": getattr(race, "total_horses", None) or 0,
                "weather": getattr(race, "weather", "") or "",
                "ground_condition": getattr(race, "ground_condition", "") or "",
                "condition": condition,
                "race_url": race_detail_path(race),
            },
            "predictions": predictions,
            "course_stats": course_stats,
            "horse_number_advantages": horse_number_advantages,
            "ai_analysis_text": ai_analysis_text,
            "source": "UMA-FREE DB: races / predictions / results / horse_number_advantages",
        }
    except Exception as exc:
        return {"db_enrichment_error": str(exc)}
    finally:
        db.close()


def internal_metric_rows(internal_data: Dict[str, Any]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    matched = internal_data.get("matched_race")
    if not isinstance(matched, dict):
        return rows

    rows.append(
        {
            "確認項目": "UMA-FREE該当レース",
            "内容": f"{matched.get('race_date', '')} {matched.get('venue_name', '')}{matched.get('race_number', '')}R {matched.get('race_name', '')}",
            "出典種別": "内部データ",
        }
    )

    predictions = internal_data.get("predictions")
    if isinstance(predictions, list) and predictions:
        top = predictions[0]
        rows.append(
            {
                "確認項目": "AI予想上位",
                "内容": f"{top.get('馬番', '')} {top.get('馬名', '')} AI偏差値{top.get('AI偏差値', '')}",
                "出典種別": "内部AI予想",
            }
        )

    course_stats = internal_data.get("course_stats")
    if isinstance(course_stats, list) and course_stats:
        best = max(course_stats, key=lambda row: float(str(row.get("複勝率", "0")).replace("%", "") or 0))
        rows.append(
            {
                "確認項目": "コース傾向",
                "内容": f"{matched.get('condition', '')}は{best.get('枠番', '')}の複勝率{best.get('複勝率', '')}を先に確認",
                "出典種別": "内部成績データ",
            }
        )

    advantages = internal_data.get("horse_number_advantages")
    if isinstance(advantages, list) and advantages:
        best_advantage = advantages[0]
        rows.append(
            {
                "確認項目": "馬番傾向",
                "内容": f"{best_advantage.get('馬番', '')}は有利度スコア{best_advantage.get('有利度スコア', '')}",
                "出典種別": "内部馬番傾向",
            }
        )
    return rows[:4]


def topic_bridge(candidate: TopicCandidate, internal_data: Dict[str, Any]) -> Dict[str, Any]:
    matched = internal_data.get("matched_race")
    has_internal = isinstance(matched, dict)
    data_bits: List[str] = []
    if internal_data.get("predictions"):
        data_bits.append("AI予想")
    if internal_data.get("course_stats"):
        data_bits.append("コース統計")
    if internal_data.get("horse_number_advantages"):
        data_bits.append("馬番傾向")
    if internal_data.get("ai_analysis_text"):
        data_bits.append("AI展望")

    angle_label = candidate.search_angle_label or candidate.search_intent_label
    guidance_by_intent = {
        "race_profile": (
            f"{angle_label}を起点に、開催場・距離・コース形態が求める適性を整理する",
            "開催条件とコース特性を主役にし、枠順や追い切りは未発表なら広げない",
        ),
        "field_analysis": (
            f"{angle_label}から、距離適性・相手関係・斤量・ローテーションの違いを整理する",
            "出走構成の比較を主役にし、個別馬の事実は入力済みデータの範囲だけで扱う",
        ),
        "past_trends": (
            f"{angle_label}を、今回も使える条件と今年は変わる条件に分ける",
            "過去傾向を機械的に当てはめず、開催条件と出走構成の違いを先に確認する",
        ),
        "local_matchup": (
            f"{angle_label}を、所属・コース経験・輸送・距離適性の観点で整理する",
            "交流重賞の条件差を主役にし、中央G1風の書き方へ寄せない",
        ),
        "result_review": (
            f"{angle_label}を、展開・馬場・位置取り・事前評価との差に分けて振り返る",
            "レース後の記事として書き、枠順発表前や追い切り確認のCTAへ戻さない",
        ),
        "training": (
            f"{angle_label}を状態面の一材料として扱い、入力済みの出走データと分けて確認する",
            "追い切りだけで評価を断定せず、同じ調教表現を複数見出しへ繰り返さない",
        ),
        "waku": (
            f"{angle_label}を、コース形態と位置取りの関係に限定して確認する",
            "枠順を主題にするのは発表済みの事実がある場合だけとし、他テーマへ横展開しない",
        ),
        "previous_run": (
            f"{angle_label}を、今回の距離・コース・相手関係の変化と照合する",
            "前走の着順だけでなく、条件替わりで評価が変わる理由を整理する",
        ),
        "stable_comment": (
            f"{angle_label}を確認済み事実と見解に分け、出走条件との接点を整理する",
            "コメントを結論にせず、入力済みデータと矛盾しない範囲で扱う",
        ),
        "track_condition": (
            f"{angle_label}がコース適性と位置取りへ与える影響を整理する",
            "天気予報を断定せず、良馬場と道悪で変わる確認項目を分ける",
        ),
    }
    angle, writer_focus = guidance_by_intent.get(
        candidate.search_intent,
        (
            f"{angle_label}を、出馬表とUMA-FREEの入力済みデータで確認する",
            f"{angle_label}を主役にし、関係の薄い枠順・追い切り・馬場を定型的に足さない",
        ),
    )

    return {
        "source_count": len(candidate.source_cards),
        "primary_angle": angle,
        "merge_policy": "外部ニュースは話題の入口、勝率・AI偏差値・傾向はUMA-FREE内部データだけを根拠にする",
        "internal_data_available": data_bits,
        "matched_race_id": matched.get("race_id") if isinstance(matched, dict) else "",
        "matched_race_url": matched.get("race_url") if isinstance(matched, dict) else "/races/today",
        "writer_focus": writer_focus,
        "primary_search_intent": candidate.search_intent,
        "avoid_overuse": ["枠順", "追い切り"] if candidate.search_intent not in {"waku", "training"} else [],
        "has_internal_data": has_internal,
    }


def topic_bridge_rows(candidate: TopicCandidate, internal_data: Dict[str, Any]) -> List[Dict[str, str]]:
    bridge = topic_bridge(candidate, internal_data)
    rows = [
        {
            "確認項目": "記事の切り口",
            "内容": str(bridge["primary_angle"]),
            "出典種別": "複数ソース整理",
        },
        {
            "確認項目": "データの使い分け",
            "内容": str(bridge["merge_policy"]),
            "出典種別": "編集ルール",
        },
    ]
    available = bridge.get("internal_data_available")
    if isinstance(available, list) and available:
        rows.append(
            {
                "確認項目": "内部データ",
                "内容": " / ".join(str(item) for item in available),
                "出典種別": "UMA-FREE",
            }
        )
    return rows


def build_competing_structure(candidate: TopicCandidate) -> List[str]:
    angle_label = candidate.search_angle_label or candidate.search_intent_label
    structures_by_intent = {
        "race_profile": [
            "公式日程と開催条件",
            "コース形態と距離が求める適性",
            "今年の出走構成で変わる論点",
            "入力済みデータから確認できる材料",
            "レース当日までに更新する項目",
        ],
        "field_analysis": [
            "出走予定馬とメンバー構成",
            "距離・コース適性の比較軸",
            "前走から変わる条件",
            "斤量・所属・相手関係の見方",
            "UMA-FREEの出馬表で確認する順番",
        ],
        "past_trends": [
            "過去結果から残る傾向",
            "今年も使える条件と使いにくい条件",
            "開催場・距離・出走構成の違い",
            "入力済みデータとの照合",
            "当日に更新する判断材料",
        ],
        "local_matchup": [
            "交流重賞の開催条件",
            "中央馬と地方馬で異なる比較軸",
            "コース経験・輸送・距離適性",
            "所属だけで評価を決めない条件",
            "当日の出馬表で確認する順番",
        ],
        "result_review": [
            "確定した結果とレース条件",
            "展開・位置取り・馬場の振り返り",
            "事前評価と実戦のずれ",
            "評価を上げたい内容と慎重に見る内容",
            "次走で条件が変わる馬の見方",
        ],
        "previous_run": [
            "前走内容を事実ベースで整理",
            "今回の距離・コース・相手関係との差",
            "上積みと反動を分ける材料",
            "出走構成の中での位置付け",
            "当日の出馬表で確認する順番",
        ],
        "training": [
            "追い切りで確認された事実",
            "時計・負荷・併せ方を分ける見方",
            "調教評価と実戦条件を混同しない線引き",
            "入力済みデータとの照合",
            "追い切り以外で残す確認項目",
        ],
        "waku": [
            "枠順発表で確定した事実",
            "コース形態と位置取りの関係",
            "内外だけで評価を決めない条件",
            "出走構成と脚質の組み合わせ",
            "当日の馬場で更新する項目",
        ],
    }
    intent_structure = structures_by_intent.get(candidate.search_intent)
    if intent_structure:
        return intent_structure
    if candidate.article_type == "race_update":
        return [
            "複数ニュースで確認された事実",
            f"{angle_label}の話題とUMA-FREEデータの結び付け",
            f"{angle_label}を出馬表で確認する順番",
            "同レースで先に見るべき開催条件と出走構成",
            "UMA-FREEの出馬表で確認する順番",
            "確認・相手候補・慎重に見る条件",
        ]
    return [
        "複数ニュースで確認された事実",
        f"{angle_label}の話題とUMA-FREEデータの結び付け",
        f"{angle_label}として見るべき論点",
        "出馬表や開催情報で確認する順番",
        "確認・相手候補・慎重に見る条件",
    ]


def build_write_orders_node(state: WorkflowState) -> WorkflowState:
    max_orders = min(parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_ORDERS_PER_RUN"), 3), 5)
    max_topics_per_race = parse_positive_int(os.environ.get("KEIBA_NEWS_MAX_TOPICS_PER_RACE_PER_RUN"), 1)
    min_topic_score = float(os.environ.get("KEIBA_NEWS_MIN_TOPIC_SCORE", "45"))
    selected: List[TopicCandidate] = []
    selected_angle_keys: Set[str] = set()
    selected_race_counts: Dict[str, int] = {}
    narrow_topic_count = 0

    for item in state.topic_candidates:
        if item.score < min_topic_score:
            continue

        race_key = normalize_key(item.race_name or item.calendar_race or item.target_keyword)
        angle_key = normalize_key(f"{race_key}:{item.search_intent}:{item.search_angle_label or item.search_intent_label}")
        if angle_key in selected_angle_keys:
            continue
        if race_key and selected_race_counts.get(race_key, 0) >= max_topics_per_race:
            continue
        if item.search_intent in {"waku", "training"} and narrow_topic_count >= 1:
            continue

        selected.append(item)
        selected_angle_keys.add(angle_key)
        if race_key:
            selected_race_counts[race_key] = selected_race_counts.get(race_key, 0) + 1
        if item.search_intent in {"waku", "training"}:
            narrow_topic_count += 1
        if len(selected) >= max_orders:
            break

    state.selected_topics = selected

    for candidate in selected:
        race_name = candidate.race_name or ""
        calendar_race = candidate.calendar_race or ""
        title_seed = candidate.title_seed or ""
        joined_text = f"{race_name} {calendar_race} {title_seed}"
        is_overseas = bool(OVERSEAS_KEYWORDS.search(joined_text))

        internal_data = build_internal_data_bundle(candidate)
        source_urls = [card.url for card in candidate.source_cards]
        key_metrics = (
            topic_bridge_rows(candidate, internal_data)
            + source_cards_to_claim_rows(candidate.source_cards)
            + internal_metric_rows(internal_data)
        )
        if not key_metrics:
            continue

        matched_race = internal_data.get("matched_race")
        race_url = "/races/today"
        if isinstance(matched_race, dict) and matched_race.get("race_url"):
            race_url = str(matched_race["race_url"])

        draw_status = ""
        if candidate.search_intent == "waku":
            draw_status = "confirmed" if candidate.search_angle_label == "枠順発表後" else "pre_draw"

        schedule_entry = find_race_demand(joined_text, race_name)
        scheduled_date = race_demand_date(schedule_entry).isoformat() if schedule_entry else ""
        phase = race_phase(candidate.days_to_race) if candidate.days_to_race is not None else ""

        order = {
            "target_keyword": candidate.target_keyword,
            "theme_cluster": candidate.theme_cluster,
            "priority": int(min(99, max(35, candidate.score))),
            "has_external_research": True,
            "has_predictions": bool(internal_data.get("predictions")),
            "is_overseas": is_overseas,
            "category": "海外競馬" if is_overseas else "競馬ニュース",
            "reference_data": {
                "period": current_jst().strftime("%Y年%m月%d日取得"),
                "condition": "競馬ニュース起点の確認テーマ",
                "sample_size": len(candidate.source_cards) + len(internal_data.get("predictions") or []),
                "key_metrics": key_metrics,
                "source": "Tavily Search + 公式・信頼媒体フィルタ + UMA-FREE DB",
                "article_type": candidate.article_type,
                "is_overseas": is_overseas,
                "category": "海外競馬" if is_overseas else "競馬ニュース",
                "news_topic": candidate.title_seed,
                "news_topic_key": candidate.topic_key,
                "news_reason": candidate.reason,
                "race_name": candidate.race_name,
                "calendar_race": candidate.calendar_race,
                "days_to_race": candidate.days_to_race,
                "race_phase": phase,
                "scheduled_race_date": scheduled_date,
                "scheduled_venue": schedule_entry.venue if schedule_entry else "",
                "scheduled_distance": schedule_entry.distance if schedule_entry else "",
                "scheduled_conditions": schedule_entry.conditions if schedule_entry else "",
                "schedule_source_url": schedule_entry.source_url if schedule_entry else "",
                "search_intent": candidate.search_intent,
                "search_intent_label": candidate.search_intent_label,
                "search_angle_label": candidate.search_angle_label,
                "draw_status": draw_status,
                "topic_bridge": topic_bridge(candidate, internal_data),
                "matched_race": matched_race,
                "predictions": internal_data.get("predictions") or [],
                "course_stats": internal_data.get("course_stats") or [],
                "horse_number_advantages": internal_data.get("horse_number_advantages") or [],
                "ai_analysis_text": internal_data.get("ai_analysis_text") or "",
                "db_enrichment_error": internal_data.get("db_enrichment_error", ""),
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
                "race_url": race_url,
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
                "search_angle_label": ref.get("search_angle_label"),
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
