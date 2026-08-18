#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# --- 先にプロジェクトルートを推定して sys.path を伸ばす（database モジュール検出用） ---
def get_project_root_default():
    """CI環境とローカル環境の両方で正しくプロジェクトルートを取得"""
    try:
        # __file__ が存在する場合はその親の親をルートとする（元のコードの意図に合わせる）
        script_dir = os.path.dirname(os.path.abspath(__file__))
        return os.path.dirname(os.path.dirname(script_dir))
    except NameError:
        return os.getcwd()

PROJECT_ROOT = get_project_root_default()

# 候補ディレクトリを sys.path に追加（存在するものだけ）
_possible_roots = [
    PROJECT_ROOT,
    os.path.join(PROJECT_ROOT, "backend"),
    os.path.join(PROJECT_ROOT, "app"),
    os.path.join(PROJECT_ROOT, "src"),
    os.path.join(PROJECT_ROOT, "services"),
]
for p in _possible_roots:
    if p and os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

# --- ここまで：database パッケージがあるディレクトリを優先して読み込むための準備 ---


import requests
import tweepy
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import random
import time
import re
import argparse
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import traceback
from PIL import Image, ImageDraw, ImageFont
import psycopg2
from contextlib import contextmanager
import hashlib
import importlib
import importlib.util
from types import ModuleType
import unicodedata
from urllib.parse import parse_qsl, quote as url_quote, urlencode, urlsplit, urlunsplit

# --- attempt to import database.*; if fails, try dynamic import from common candidate paths ---
def dynamic_module_from_path(module_name: str, candidate_paths: List[str]) -> Optional[ModuleType]:
    """
    Try to dynamically import a module by searching for its .py file in candidate_paths.
    Returns the imported module or None.
    """
    for base in candidate_paths:
        if not base:
            continue
        # Try module as package (directory)
        pkg_path = os.path.join(base, module_name.replace(".", os.sep))
        # Try file path
        file_candidates = [
            pkg_path + ".py",
            os.path.join(pkg_path, "__init__.py"),
        ]
        for file_path in file_candidates:
            if os.path.exists(file_path):
                try:
                    spec = importlib.util.spec_from_file_location(module_name, file_path)
                    if spec and spec.loader:
                        mod = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(mod)
                        sys.modules[module_name] = mod
                        return mod
                except Exception:
                    continue
    return None

# Candidate base dirs to search for database package files
_candidate_bases = [
    PROJECT_ROOT,
    os.path.join(PROJECT_ROOT, "backend"),
    os.path.join(PROJECT_ROOT, "app"),
    os.path.join(PROJECT_ROOT, "src"),
]

# Try normal import first
models = None
SessionLocal = None
try:
    from database import models as models  # type: ignore
    from database.database import SessionLocal  # type: ignore
except Exception as e_import:
    # Try dynamic import fallback
    _log_msg = f"database package import failed: {e_import}. Trying dynamic import fallback..."
    print(_log_msg)
    mod_models = dynamic_module_from_path("database.models", _candidate_bases)
    mod_database = dynamic_module_from_path("database.database", _candidate_bases)
    if mod_models:
        models = mod_models
    if mod_database and hasattr(mod_database, "SessionLocal"):
        SessionLocal = getattr(mod_database, "SessionLocal")
    # If still missing, attempt to import package-level database (if found)
    if not models:
        try:
            import database  # type: ignore
            models = getattr(database, "models", None)
            SessionLocal = getattr(database, "database", None)  # unlikely
        except Exception:
            pass

# --- 1. 基本設定とパス解決（Render対応版）---
# NOTE: PROJECT_ROOT は既に設定済み（上で推定）

# .envファイルの読み込み
dotenv_path = os.path.join(PROJECT_ROOT, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    print(f"INFO: .envファイルを読み込みました: {dotenv_path}")
else:
    dotenv_path_alt = os.path.join(PROJECT_ROOT, 'backend', '.env')
    if os.path.exists(dotenv_path_alt):
        load_dotenv(dotenv_path_alt)
        print(f"INFO: .envファイルを読み込みました: {dotenv_path_alt}")
    else:
        if not os.getenv("GITHUB_ACTIONS") and not os.getenv("K_SERVICE"):
            print(f"警告: .envファイルが見つかりません。")

# --- 2. 環境変数と定数の定義 ---
def _env_value(*names: str, default: Optional[str] = None) -> Optional[str]:
    """複数の環境変数名から、最初に設定されている値を返す。"""
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return default


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, minimum: int = 0) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        parsed = int(value.strip())
        return max(parsed, minimum)
    except ValueError:
        return default


DATABASE_URL = _env_value("DATABASE_URL")
TWITTER_CONSUMER_KEY = _env_value("TWITTER_CONSUMER_KEY", "TWITTER_API_KEY")
TWITTER_CONSUMER_SECRET = _env_value("TWITTER_CONSUMER_SECRET", "TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN = _env_value("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = _env_value("TWITTER_ACCESS_TOKEN_SECRET")
IMAGE_OUTPUT_DIR = os.path.join(PROJECT_ROOT, "sns_images_dist")
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)
SITE_BASE_URL = "https://uma-free.com"
API_BASE_URL = (_env_value("API_BASE_URL", "NEXT_PUBLIC_API_URL") or "https://keiba-site-v1-761440273070.us-west1.run.app").rstrip("/")
X_ACCOUNT_HANDLE = (_env_value("X_ACCOUNT_HANDLE", "TWITTER_SCREEN_NAME", default="umafree_ai") or "umafree_ai").lstrip("@")
DRY_RUN = _env_flag("DRY_RUN", False)
ENABLE_TWITTER = _env_flag("ENABLE_TWITTER", True)
ENABLE_THREADS = _env_flag("ENABLE_THREADS", True)
THREADS_EVENING_VIDEO_REPLACES_TEXT = _env_flag(
    "THREADS_EVENING_VIDEO_REPLACES_TEXT",
    False,
)
FAIL_ON_SNS_ERROR = _env_flag("FAIL_ON_SNS_ERROR", False)
TWITTER_POST_MAX_RETRIES = _env_int("TWITTER_POST_MAX_RETRIES", 3, minimum=1)
TWITTER_POST_RETRY_BASE_SECONDS = _env_int("TWITTER_POST_RETRY_BASE_SECONDS", 30, minimum=1)
ALLOW_X_TRANSIENT_FAILURE_WITH_THREADS = _env_flag("ALLOW_X_TRANSIENT_FAILURE_WITH_THREADS", True)
THREADS_POST_MAX_RETRIES = _env_int("THREADS_POST_MAX_RETRIES", 3, minimum=1)
THREADS_POST_RETRY_BASE_SECONDS = _env_int("THREADS_POST_RETRY_BASE_SECONDS", 30, minimum=1)
ALLOW_THREADS_TRANSIENT_FAILURE_WITH_X = _env_flag("ALLOW_THREADS_TRANSIENT_FAILURE_WITH_X", True)

# ===== Threads API設定 =====
THREADS_USER_ID = os.getenv("THREADS_USER_ID")
THREADS_ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN")
THREADS_TOKEN_EXPIRY = os.getenv("THREADS_TOKEN_EXPIRY")
THREADS_MAX_CHARS = 480


@dataclass
class ThreadsPostResult:
    ok: bool
    attempted: bool = True
    post_id: Optional[str] = None
    transient: bool = False
    reason: str = ""

    def __bool__(self) -> bool:
        return self.ok


def build_race_url(date_str: str, race_number: Any = None, venue_name: Any = None) -> str:
    """レースページURLを正規のクエリ形式で生成する。"""
    base_url = f"{SITE_BASE_URL}/races/{date_str}"
    race = str(race_number or "").strip()
    venue = str(venue_name or "").strip()
    params = []
    if race:
        params.append(f"race={url_quote(race)}")
    if venue and venue != "?":
        params.append(f"venue={url_quote(venue)}")
    return f"{base_url}?{'&'.join(params)}" if params else base_url


def build_social_content_key(content: str, post_type: str, target_date: str) -> str:
    """投稿種別・対象日・元本文から、媒体間で照合できる短いキーを作る。"""
    normalized_post_type = re.sub(r"[^a-z0-9_-]+", "-", str(post_type or "post").lower()).strip("-_") or "post"
    normalized_date = re.sub(r"[^0-9]+", "", str(target_date or "")) or "undated"
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
    return f"{normalized_post_type}-{normalized_date}-{content_hash}"


def add_social_attribution_to_text(
    text: str,
    platform: str,
    post_type: str,
    target_date: str,
) -> str:
    """UMA-FREEへのリンクだけへ媒体別UTMを付け、外部URLと表示文は維持する。

    Xはリンクを貼らない方針のため対象外。X本文は post_to_twitter が
    prepare_short_social_text(remove_urls=True) でURL行を落としてから投稿するので、
    この関数を通しても置換対象が残らない。実際に使うのはThreads経路だけ。
    """
    normalized_platform = str(platform or "").strip().lower()
    if normalized_platform != "threads":
        raise ValueError(f"未対応のSNS帰属媒体です: {platform}")
    content_key = build_social_content_key(text, post_type, target_date)

    def replace_url(match: re.Match[str]) -> str:
        raw_url = match.group(0)
        trailing = ""
        while raw_url and raw_url[-1] in "。、）)]":
            trailing = raw_url[-1] + trailing
            raw_url = raw_url[:-1]
        parsed = urlsplit(raw_url)
        if parsed.scheme != "https" or parsed.netloc.lower() != "uma-free.com":
            return match.group(0)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query.update({
            "utm_source": normalized_platform,
            "utm_medium": "organic_social",
            "utm_campaign": "race_post_v2",
            "utm_content": content_key,
            "utm_term": str(post_type or "post"),
        })
        attributed = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
        return f"{attributed}{trailing}"

    return re.sub(r"https://uma-free\.com/[^\s<>\"']*", replace_url, text)


def build_x_status_url(tweet_id: Any) -> str:
    """投稿IDから正しいXステータスURLを生成する。"""
    return f"https://x.com/{X_ACCOUNT_HANDLE}/status/{tweet_id}"

# 重賞レース判定リスト (リスト判定フォールバック用)
JRA_GRADE_RACE_NAMES = {
    "フェブラリーS", "フェブラリーステークス", "高松宮記念", "大阪杯", "桜花賞", "皐月賞", "天皇賞（春）",
    "NHKマイルC", "NHKマイルカップ", "ヴィクトリアマイル", "オークス", "優駿牝馬", "日本ダービー", "東京優駿",
    "安田記念", "宝塚記念", "スプリンターズS", "スプリンターズステークス", "秋華賞", "菊花賞", "天皇賞（秋）",
    "エリザベス女王杯", "マイルCS", "マイルチャンピオンシップ", "ジャパンC", "ジャパンカップ", "チャンピオンズC", "チャンピオンズカップ",
    "阪神JF", "阪神ジュベナイルフィリーズ", "朝日杯FS", "朝日杯フューチュリティステークス", "有馬記念", "ホープフルS", "ホープフルステークス",
    "中山グランドジャンプ", "中山大障害",
    "日経新春杯", "AJCC", "アメリカジョッキークラブカップ", "プロキオンS", "プロキオンステークス", "京都記念", "中山記念",
    "チューリップ賞", "フィリーズレビュー", "弥生賞", "弥生賞ディープインパクト記念", "スプリングS", "スプリングステークス",
    "金鯱賞", "阪神大賞典", "日経賞", "NZT", "ニュージーランドトロフィー", "阪神牝馬S", "阪神牝馬ステークス",
    "青葉賞", "フローラS", "フローラステークス", "マイラーズC", "マイラーズカップ", "京王杯SC", "京王杯スプリングカップ", "京都新聞杯",
    "目黒記念", "札幌記念", "紫苑S", "紫苑ステークス", "セントウルS", "セントウルステークス", "ローズS", "ローズステークス",
    "セントライト記念", "オールカマー", "神戸新聞杯", "毎日王冠", "京都大賞典",
    "アイルランドT", "アイルランドトロフィー", "スワンS", "スワンステークス", "富士S", "富士ステークス", "京王杯2歳S", "京王杯2歳ステークス",
    "アルゼンチン共和国杯", "デイリー杯2歳S", "デイリー杯2歳ステークス", "東スポ杯2歳S", "東京スポーツ杯2歳ステークス",
    "ステイヤーズS", "ステイヤーズステークス", "阪神C", "阪神カップ",
    "阪神スプリングJ", "阪神スプリングジャンプ", "京都ハイJ", "京都ハイジャンプ", "東京ハイJ", "東京ハイジャンプ",
    "中山金杯", "京都金杯", "フェアリーS", "フェアリーステークス", "シンザン記念", "京成杯",
    "根岸S", "根岸ステークス", "シルクロードS", "シルクロードステークス", "東京新聞杯",
    "きさらぎ賞", "クイーンC", "クイーンカップ", "共同通信杯", "ダイヤモンドS", "ダイヤモンドステークス", "阪急杯",
    "小倉大賞典", "オーシャンS", "オーシャンステークス", "中山牝馬S", "中山牝馬ステークス", "愛知杯", "フラワーC", "フラワーカップ",
    "ファルコンS", "ファルコンステークス", "毎日杯", "マーチS", "マーチステークス", "ダービー卿CT", "ダービー卿チャレンジトロフィー",
    "アンタレスS", "アンタレスステークス", "福島牝馬S", "福島牝馬ステークス",
    "ユニコーンS", "ユニコーンステークス", "エプソムC", "エプソムカップ", "新潟大賞典", "平安S", "平安ステークス", "葵S", "葵ステークス",
    "函館スプリントS", "函館スプリントステークス", "ラジオNIKKEI賞",
    "函館記念", "北九州記念", "七夕賞", "小倉記念", "函館2歳S", "函館2歳ステークス", "関屋記念",
    "東海S", "東海ステークス", "アイビスSD", "アイビスサマーダッシュ", "クイーンS", "クイーンステークス", "エルムS", "エルムステークス",
    "レパードS", "レパードステークス", "CBC賞", "中京記念", "新潟2歳S", "新潟2歳ステークス", "キーンランドC", "キーンランドカップ",
    "新潟記念", "京成杯AH", "京成杯オータムハンデキャップ", "札幌2歳S", "札幌2歳ステークス",
    "チャレンジC", "チャレンジカップ", "シリウスS", "シリウスステークス", "サウジアラビアRC", "サウジアラビアロイヤルカップ", "アルテミスS", "アルテミスステークス",
    "ファンタジーS", "ファンタジステークス", "みやこS", "みやこステークス", "武蔵野S", "武蔵野ステークス", "福島記念", "京都2歳S", "京都2歳ステークース",
    "京阪杯", "鳴尾記念", "中日新聞杯", "カペラS", "カペラステークス", "ターコイズS", "ターコイズステークス"
}

# グレードキーワード判定 (race_crud.py get_heavy_stakes_race_urls と同一キーワードセット)
GRADE_KEYWORDS = ['G1', 'G2', 'G3', 'GI', 'GII', 'GIII',
                  'Ｇ１', 'Ｇ２', 'Ｇ３', 'GⅠ', 'GⅡ', 'GⅢ',
                  'ＧⅠ', 'ＧⅡ', 'ＧⅢ', 'J・G']

# --- レース名正規化ユーティリティ（追加） ---
def canonicalize_race_name(s: str) -> str:
    """
    レース名を正規化して比較可能にする。
    - NFKC 正規化（全角→半角・全角英数字統一）
    - 中点(・)、中黒、点類、空白を除去
    - 各種括弧を取り除いて中身を保持（天皇賞（秋）-> 天皇賞秋）
    """
    if not s:
        return ""
    # 1) 幅の正規化
    s = unicodedata.normalize("NFKC", s)
    # 2) 中点、点記号、空白類を削除
    s = re.sub(r'[\s\u3000・·•･・･・]', '', s)
    # 3) 全角括弧を半角にし、括弧類を削除（中身は残す）
    s = s.replace('（', '(').replace('）', ')').replace('【', '(').replace('】', ')')
    s = re.sub(r'[\(\)\[\]\{\}<>]', '', s)
    # 4) トリム
    s = s.strip()
    return s

# 正規化済みの重賞レース名集合（モジュールロード時に一度作成）
NORMALIZED_GRADE_RACES = set(canonicalize_race_name(r) for r in JRA_GRADE_RACE_NAMES if r)

def _has_grade_keyword(race_name: str) -> bool:
    """レース名にグレード表記キーワード（G1/G2/G3等）が含まれるか判定"""
    if not race_name:
        return False
    return any(kw in race_name for kw in GRADE_KEYWORDS)

def get_grade_priority(race_name: str) -> int:
    """重賞のグレード優先度を返す (1=G1, 2=G2, 3=G3, 4=その他)"""
    if not race_name:
        return 99
    if any(kw in race_name for kw in ['G1', 'GI', 'Ｇ１', 'GⅠ', 'ＧⅠ']):
        return 1
    if any(kw in race_name for kw in ['G2', 'GII', 'Ｇ２', 'GⅡ', 'ＧⅡ']):
        return 2
    if any(kw in race_name for kw in ['G3', 'GIII', 'Ｇ３', 'GⅢ', 'ＧⅢ']):
        return 3
    return 4

def is_grade_race(race_name: str) -> bool:
    """
    重賞判定（二段階方式）:
      1. グレードキーワード判定: レース名に G1/G2/G3 等の表記があるか
      2. リスト判定フォールバック: 正規化したレース名が既知の重賞名に一致するか
      3. 補助ルール: '天皇賞' + '秋'/'春' の組み合わせなど
    """
    if not race_name:
        return False
    # 1. グレードキーワード判定（最も信頼性が高い）
    if _has_grade_keyword(race_name):
        return True
    # 2. リスト判定フォールバック
    norm = canonicalize_race_name(race_name)
    for gr in NORMALIZED_GRADE_RACES:
        if gr and gr in norm:
            return True
    # 3. 補助的キーワード判定
    if '天皇賞' in norm and ('秋' in norm or '春' in norm):
        return True
    return False

# --- 3. データベースロック機構 (変更なし) ---
@contextmanager
def database_lock(lock_name: str, timeout_seconds: int = 60):
    if not DATABASE_URL:
        yield True
        return
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        import hashlib
        lock_key = f"{lock_name}_{datetime.now().strftime('%Y%m%d')}"
        lock_id = int(hashlib.md5(lock_key.encode()).hexdigest()[:8], 16) % 2147483647
        cur.execute("SET lock_timeout = %s", (f"{timeout_seconds}s",))
        try:
            cur.execute("SELECT pg_advisory_lock(%s)", (lock_id,))
            _log(f"ロック取得成功: {lock_name} (ID: {lock_id})")
            cur.execute("SELECT COUNT(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = %s AND pid != pg_backend_pid()", (lock_id,))
            if cur.fetchone()[0] > 0:
                _log("警告: 別のインスタンスが既に実行中です")
                yield False
                return
            yield True
        except psycopg2.errors.LockNotAvailable:
            _log(f"ロック取得失敗: 別のインスタンスが実行中です")
            yield False
        finally:
            try:
                cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
                _log(f"ロック解放: {lock_name}")
            except:
                pass
    except Exception as e:
        _log(f"データベースロックエラー: {e}")
        yield False
    finally:
        if conn:
            conn.close()

# --- 4. ヘルパー関数群 (変更なし) ---
def _now_str():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")

def _log(msg: str):
    print(f"{_now_str()} {msg}")

def get_font_path(font_name: str) -> str:
    """CI環境とローカル環境の両方で正しくフォントパスを取得"""
    font_dir = os.path.join(PROJECT_ROOT, "backend", "fonts")
    
    font_path = os.path.join(font_dir, font_name)
    if os.path.exists(font_path):
        return font_path
    
    # フォールバック (デバッグ用)
    alt_font_path = os.path.join(os.getcwd(), "fonts", font_name)
    if os.path.exists(alt_font_path):
        return alt_font_path

    raise FileNotFoundError(f"フォントファイルが見つかりません: '{font_path}'")

def draw_centered_text(draw, text, font, fill_color, image_width, y_position, **kwargs):
    """テキストを画像の中央に描画する"""
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
    except AttributeError: # 古いPillowバージョン対応
        text_width, _ = draw.textsize(text, font=font)
    x_position = (image_width - text_width) / 2
    draw.text((x_position, y_position), text, fill=fill_color, font=font, **kwargs)

# ===== Threads API関数群 =====

def truncate_for_threads(text: str) -> str:
    if len(text) <= THREADS_MAX_CHARS:
        return text
    lines = text.split('\n')
    result = []
    current_len = 0
    for line in lines:
        if current_len + len(line) + 1 > THREADS_MAX_CHARS - 30:
            result.append('...')
            break
        result.append(line)
        current_len += len(line) + 1
    return '\n'.join(result)


def _threads_error_payload(response: requests.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _classify_threads_response(response: requests.Response, phase: str) -> tuple[bool, str]:
    """Threads APIのレスポンスを一時障害か恒久的な問題かに分ける。"""
    status = response.status_code
    payload = _threads_error_payload(response)
    error_payload = payload.get("error") if isinstance(payload.get("error"), dict) else {}
    message = str(error_payload.get("message") or "").strip()
    code = error_payload.get("code")
    code_text = str(code) if code is not None else ""
    is_transient = bool(error_payload.get("is_transient"))

    if status == 401 or code_text in {"102", "190"}:
        return False, f"Threads{phase}の認証エラー({status})"
    if is_transient:
        return True, f"Threads{phase}の一時エラー(is_transient=true, code={code_text or '?'})"
    if status == 429:
        return True, f"Threads{phase}のレート制限"
    if 500 <= status <= 599:
        return True, f"Threads{phase}の一時的なサーバーエラー({status})"
    if status in {408, 409, 425}:
        return True, f"Threads{phase}の一時的な受付エラー({status})"

    detail = message or response.text[:120]
    return False, f"Threads{phase} APIエラー({status}: {detail})"


def _sleep_before_threads_retry(attempt: int) -> None:
    delay = THREADS_POST_RETRY_BASE_SECONDS * attempt + random.randint(0, 10)
    _log(f"  → {delay}秒後にThreads投稿を再試行します。")
    time.sleep(delay)


def post_to_threads(
    text: str,
    post_type: str = "",
    target_date: str = "",
) -> ThreadsPostResult:
    """Threadsにテキスト投稿を行う。トークン失効時は明確な警告を出力する。"""
    global THREADS_ACCESS_TOKEN
    if not ENABLE_THREADS:
        _log("Threads投稿は ENABLE_THREADS=false のためスキップします。")
        return ThreadsPostResult(ok=False, attempted=False, reason="Threads投稿無効")

    if not THREADS_USER_ID or not THREADS_ACCESS_TOKEN:
        _log("⚠️ Threads認証情報未設定。スキップします。")
        return ThreadsPostResult(ok=False, attempted=False, reason="Threads認証情報不足")

    text = prepare_short_social_text(
        text,
        "Threads",
        remove_urls=False,
        max_chars=THREADS_MAX_CHARS,
    )
    if post_type and target_date:
        text = add_social_attribution_to_text(text, "threads", post_type, target_date)
    text = truncate_for_threads(text)

    if DRY_RUN:
        _log(f"[DRY_RUN] Threads投稿スキップ:\n{text[:80]}...")
        return ThreadsPostResult(ok=True, post_id="dry_run_threads_id", reason="DRY_RUN")

    base_url = f"https://graph.threads.net/v1.0/{THREADS_USER_ID}"
    headers = {"Authorization": f"Bearer {THREADS_ACCESS_TOKEN}"}
    last_result = ThreadsPostResult(ok=False, reason="Threads投稿が完了しませんでした")

    for attempt in range(1, THREADS_POST_MAX_RETRIES + 1):
        try:
            res = requests.post(
                f"{base_url}/threads",
                headers=headers,
                data={"media_type": "TEXT", "text": text},
                timeout=30
            )
            if res.status_code == 401:
                _log("❌ Threadsコンテナ作成失敗: 401 Unauthorized")
                _log("  → アクセストークンが失効している可能性があります。")
                _log("  → Meta for Developers で新しいトークンを生成し、GitHub Secrets の THREADS_ACCESS_TOKEN を更新してください")
                _log(f"  → レスポンス: {res.text[:300]}")
                return ThreadsPostResult(ok=False, transient=False, reason="Threads認証エラー")
            if res.status_code != 200:
                transient, reason = _classify_threads_response(res, "コンテナ作成")
                _log(f"❌ Threadsコンテナ作成失敗: {res.status_code} - {res.text[:200]} (試行 {attempt}/{THREADS_POST_MAX_RETRIES})")
                last_result = ThreadsPostResult(ok=False, transient=transient, reason=reason)
                if transient and attempt < THREADS_POST_MAX_RETRIES:
                    _sleep_before_threads_retry(attempt)
                    continue
                return last_result

            container_id = res.json().get("id")
            if not container_id:
                _log("❌ Threadsコンテナ作成: レスポンスにIDが含まれていません")
                return ThreadsPostResult(ok=False, transient=False, reason="ThreadsコンテナIDなし")

            time.sleep(3)

            pub_res = requests.post(
                f"{base_url}/threads_publish",
                headers=headers,
                data={"creation_id": container_id},
                timeout=30
            )
            if pub_res.status_code != 200:
                transient, reason = _classify_threads_response(pub_res, "公開")
                _log(f"❌ Threads公開失敗: {pub_res.status_code} - {pub_res.text[:200]}")
                if transient:
                    _log("  → 公開段階の一時エラーは重複投稿防止のため、同一実行内では再公開しません。")
                return ThreadsPostResult(ok=False, transient=transient, reason=reason)

            post_id = pub_res.json().get("id")
            if not post_id:
                _log("❌ Threads公開: レスポンスにIDが含まれていません")
                return ThreadsPostResult(ok=False, transient=False, reason="Threads投稿IDなし")
            _log(f"✅ Threads投稿成功! ID: {post_id}")
            return ThreadsPostResult(ok=True, post_id=str(post_id), reason="投稿成功")

        except Exception as e:
            transient = isinstance(e, (requests.Timeout, requests.ConnectionError))
            reason = "Threads APIへのネットワーク接続エラー" if transient else f"Threads投稿エラー: {e}"
            _log(f"❌ Threads投稿エラー: {e} (試行 {attempt}/{THREADS_POST_MAX_RETRIES})")
            last_result = ThreadsPostResult(ok=False, transient=transient, reason=reason)
            if transient and attempt < THREADS_POST_MAX_RETRIES:
                _sleep_before_threads_retry(attempt)
                continue
            return last_result

    return last_result


def post_texts_to_threads_results(
    texts: List[str],
    delay_seconds: int = 3,
    post_type: str = "",
    target_date: str = "",
) -> List[ThreadsPostResult]:
    """複数テキストをThreadsへ独立投稿し、各投稿の結果を返す。"""
    results: List[ThreadsPostResult] = []
    for idx, text in enumerate(texts, 1):
        _log(f"Threads投稿 {idx}/{len(texts)} を実行します。")
        result = post_to_threads(text, post_type=post_type, target_date=target_date)
        results.append(result)
        if idx < len(texts) and delay_seconds > 0:
            time.sleep(delay_seconds)
    return results


def post_texts_to_threads(
    texts: List[str],
    delay_seconds: int = 3,
    post_type: str = "",
    target_date: str = "",
) -> int:
    """複数テキストをThreadsへ独立投稿し、成功件数を返す。"""
    results = post_texts_to_threads_results(
        texts,
        delay_seconds=delay_seconds,
        post_type=post_type,
        target_date=target_date,
    )
    posted_count = sum(1 for result in results if result.ok)
    return posted_count


def _probe_threads_token() -> Optional[bool]:
    """Threadsトークンを軽量APIで確認する。

    Trueは有効、FalseはAPIが認証情報を拒否、Noneはレート制限や通信障害など
    有効・無効を判断できない状態を表す。
    """
    try:
        check_res = requests.get(
            "https://graph.threads.net/v1.0/me",
            params={"access_token": THREADS_ACCESS_TOKEN},
            timeout=15,
        )
        if check_res.status_code == 200:
            user_data = check_res.json()
            _log(f"✅ Threadsトークン有効確認: ユーザーID={user_data.get('id', '?')}")
            return True
        if 400 <= check_res.status_code <= 499 and check_res.status_code != 429:
            _log(
                f"❌ Threads APIがトークンを拒否しました: "
                f"{check_res.status_code} - {check_res.text[:200]}"
            )
            _log("  → Meta for Developers で新しいトークンを生成し、GitHub Secrets を更新してください")
            return False
        _log(
            f"⚠️ Threadsトークンの有効性を判定できませんでした: "
            f"{check_res.status_code} - {check_res.text[:200]}"
        )
        return None
    except (requests.Timeout, requests.ConnectionError) as error:
        _log(f"⚠️ Threadsトークン確認は通信エラーのため保留します: {error}")
        return None
    except Exception as error:
        _log(f"⚠️ Threadsトークン確認エラー: {error}")
        return None


def refresh_threads_token_if_needed() -> None:
    """Threadsトークンの有効期限を確認し、期限が近い場合はリフレッシュを試みる。
    THREADS_TOKEN_EXPIRY未設定時はトークン有効性を軽量APIで確認する。
    リフレッシュ成功時はグローバル変数を更新し、同一実行内で新トークンを使用する。
    """
    global THREADS_ACCESS_TOKEN
    if not ENABLE_THREADS:
        _log("Threads投稿は ENABLE_THREADS=false のためトークン確認をスキップします。")
        return

    if not THREADS_ACCESS_TOKEN:
        _log("⚠️ THREADS_ACCESS_TOKEN が未設定です。Threads投稿はスキップされます。")
        return

    # THREADS_TOKEN_EXPIRY が未設定の場合、APIでトークンの有効性を確認
    if not THREADS_TOKEN_EXPIRY:
        _log("⚠️ THREADS_TOKEN_EXPIRY が未設定です。トークンの有効性をAPIで確認します...")
        _probe_threads_token()
        return

    try:
        expiry = datetime.fromisoformat(THREADS_TOKEN_EXPIRY)
        now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
        days_left = (expiry - now).days
        _log(f"ℹ️ Threadsトークン残り{days_left}日 (期限: {THREADS_TOKEN_EXPIRY})")

        if days_left <= 0:
            _log("⚠️ THREADS_TOKEN_EXPIRYは期限切れ表示です。実トークンをAPIで確認します...")
            token_state = _probe_threads_token()
            if token_state is False:
                return
            if token_state is True:
                _log("⚠️ 実トークンは有効です。THREADS_TOKEN_EXPIRYメタデータが古い可能性があります。")
            else:
                _log("⚠️ 実トークンは拒否されていないため、更新APIを試します。")

        if days_left > 10:
            return

        _log(f"🔄 Threadsトークン残り{days_left}日。更新を試みます...")
        res = requests.get(
            "https://graph.threads.net/refresh_access_token",
            params={"grant_type": "th_refresh_token", "access_token": THREADS_ACCESS_TOKEN},
            timeout=30
        )
        if res.status_code == 200:
            data = res.json()
            new_token = data.get("access_token", "")
            new_expiry = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d')
            if new_token:
                # グローバル変数を更新して同一実行内で新トークンを使用
                THREADS_ACCESS_TOKEN = new_token
                _log("✅ Threadsトークン更新成功! (今回の実行から新トークンを使用)")
            _log("=" * 50)
            _log("⚠️ 更新後のトークンをログへ表示せず、GitHub Secretsを手動更新してください。")
            _log(f"  THREADS_TOKEN_EXPIRY = {new_expiry}")
            _log("=" * 50)
        else:
            _log(f"❌ トークン更新失敗: {res.status_code} - {res.text[:200]}")
            _log("  → Meta for Developers で新しいトークンを手動で生成してください")
    except Exception as e:
        _log(f"❌ トークン更新エラー: {e}")


def load_logo(size: int = 50) -> Optional[Image.Image]:
    """ロゴ画像を読み込み、指定されたサイズにリサイズする"""
    try:
        logo_path = get_font_path("new-logo.png")
        logo = Image.open(logo_path).convert('RGBA')
        resample_filter = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
        logo.thumbnail((size, size), resample_filter)
        return logo
    except Exception as e:
        _log(f"ロゴ読み込みエラー: {e}")
        return None

def create_base_image(width: int = 1200, height: int = 630):
    """全画像で共通のベース（背景・ロゴ・フッター）を生成する"""
    # カラーパレット
    BG_COLOR_DARK = (24, 30, 54)
    BG_COLOR_LIGHT = (45, 55, 95)
    TEXT_COLOR_LIGHT = (230, 230, 245)
    TEXT_COLOR_MUTED = (150, 160, 180)

    # フォント
    font_regular = ImageFont.truetype(get_font_path("MPLUSRounded1c-Regular.ttf"), 22)
    font_bold = ImageFont.truetype(get_font_path("MPLUSRounded1c-Bold.ttf"), 24)

    # ベース作成
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)

    # 背景グラデーション
    for y in range(height):
        ratio = y / (height - 1)
        r = int(BG_COLOR_DARK[0] * (1 - ratio) + BG_COLOR_LIGHT[0] * ratio)
        g = int(BG_COLOR_DARK[1] * (1 - ratio) + BG_COLOR_LIGHT[1] * ratio)
        b = int(BG_COLOR_DARK[2] * (1 - ratio) + BG_COLOR_LIGHT[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # 星空のようなテクスチャを追加
    # 小さな星（ノイズベース）
    for _ in range(5000):
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        brightness = random.randint(50, 120) # 暗めの星
        draw.point((x, y), fill=(brightness, brightness, brightness))
    # 大きめの明るい星
    for _ in range(200):
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        size = random.uniform(1, 2)
        brightness = random.randint(150, 220) # 明るい星
        draw.ellipse([(x, y), (x + size, y + size)], fill=(brightness, brightness, brightness))

    # ロゴ配置
    logo = load_logo(size=55)
    if logo:
        img.paste(logo, (50, 45), logo)
        draw.text((120, 58), "UMA-FREE", font=font_bold, fill=TEXT_COLOR_LIGHT)

    # フッター
    draw.text((width - 50, height - 55), "uma-free.com", font=font_regular, fill=TEXT_COLOR_MUTED, anchor="rm")
    
    return img, draw

def is_already_posted(content: str, post_type: str, target_date: str) -> bool:
    """
    同じ内容の投稿が既に行われているかチェックする
    """
    content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    if not DATABASE_URL:
        _log("⚠️ DATABASE_URLが設定されていないため、重複チェックをスキップします")
        return False
    
    if SessionLocal is None or models is None:
        _log("⚠️ データベース接続用モジュールが読み込まれていないため、重複チェックをスキップします")
        return False

    db = SessionLocal()
    try:
        existing_post = db.query(models.SnsPost).filter(
            models.SnsPost.content_hash == content_hash,
            models.SnsPost.target_date == target_date
        ).first()
        
        if existing_post:
            _log(f"⚠️ 重複投稿検出: {post_type} ({target_date}) は既に投稿済みです")
            return True
        return False
    finally:
        db.close()

def record_post(content: str, post_type: str, target_date: str, tweet_id: Optional[str] = None) -> None:
    """
    投稿記録をデータベースに保存する
    """
    content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    if not DATABASE_URL:
        _log("⚠️ DATABASE_URLが設定されていないため、投稿記録をスキップします")
        return
    
    if SessionLocal is None or models is None:
        _log("⚠️ データベース接続用モジュールが読み込まれていないため、投稿記録をスキップします")
        return

    db = SessionLocal()
    try:
        existing_post = db.query(models.SnsPost).filter(
            models.SnsPost.content_hash == content_hash,
            models.SnsPost.target_date == target_date
        ).first()

        if existing_post:
            updated = False
            if tweet_id and not existing_post.tweet_id:
                existing_post.tweet_id = str(tweet_id)
                updated = True
            if post_type and existing_post.post_type != post_type:
                existing_post.post_type = post_type
                updated = True
            if updated:
                db.commit()
                _log(f"✅ 投稿記録を更新: {post_type} ({target_date})")
            else:
                _log(f"-> 投稿記録は既に存在: {post_type} ({target_date})")
            return

        new_post = models.SnsPost(
            content_hash=content_hash,
            post_type=post_type,
            posted_at=datetime.now(timezone(timedelta(hours=9))),
            target_date=target_date,
            tweet_id=tweet_id
        )
        db.add(new_post)
        db.commit()
        _log(f"✅ 投稿記録を保存: {post_type} ({target_date})")
    except Exception as e:
        _log(f"⚠️ 投稿記録の保存に失敗: {e}")
        db.rollback()
    finally:
        db.close()

# --- 5. API連携関数 (リトライ強化版) ---
_api_warmed_up = False

def warmup_api() -> None:
    """APIサーバをスリープから起こすための軽量リクエスト"""
    global _api_warmed_up
    if _api_warmed_up:
        return
    try:
        _log("APIサーバのウォームアップリクエストを送信中...")
        res = requests.get(f"{API_BASE_URL}/api/v1/predictions/health", timeout=30)
        if res.status_code < 500:
            _log(f"-> ウォームアップ成功 (Status: {res.status_code})")
        else:
            _log(f"-> ウォームアップ応答待ち (Status: {res.status_code})、10秒待機...")
            time.sleep(10)
    except requests.RequestException:
        _log("-> ウォームアップ応答なし、15秒待機してから本リクエストを開始...")
        time.sleep(15)
    _api_warmed_up = True

def get_api_data(endpoint: str, retries: int = 3, delay: int = 15) -> Optional[Any]:
    warmup_api()
    _log(f"APIにアクセス中: {endpoint}")
    for attempt in range(retries):
        try:
            url = f"{API_BASE_URL}/api/v1/predictions/{endpoint}"
            res = requests.get(url, timeout=90)
            if res.status_code == 200:
                data = res.json()
                if data and (isinstance(data, list) and len(data) > 0 or isinstance(data, dict) and data):
                    _log("-> データ取得成功")
                    return data
                else:
                    _log(f"-> 空のレスポンス (試行 {attempt + 1}/{retries}), リトライします...")
            elif res.status_code == 404:
                _log("-> データなし (404 Not Found)")
                return None
            else:
                _log(f"-> データ取得失敗 (Status: {res.status_code}), 試行 {attempt + 1}/{retries}")
        except requests.RequestException as e:
            _log(f"-> API接続エラー (試行 {attempt + 1}/{retries}): {e}")
        if attempt < retries - 1:
            _log(f"-> {delay}秒後にリトライします...")
            time.sleep(delay)
    _log(f"⚠️ APIデータ取得に全 {retries} 回失敗しました: {endpoint}")
    return None


def _empty_honmei_summary() -> Dict[str, Any]:
    return {'win': 0, 'second': 0, 'third': 0, 'other': 0, 'total': 0, 'win_rate': 0.0, 'in_money_rate': 0.0}


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        text = str(value).strip()
        if not text or not re.match(r"^-?\d+$", text):
            return None
        return int(text)
    except Exception:
        return None


def _normalize_horse_name(value: Any) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).replace(" ", "").replace("　", "").strip()


def _finalize_honmei_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    total = summary.get('total', 0) or 0
    if total > 0:
        summary['win_rate'] = summary.get('win', 0) / total * 100
        summary['in_money_rate'] = (
            (summary.get('win', 0) + summary.get('second', 0) + summary.get('third', 0)) / total * 100
        )
    return summary


def _add_rank_to_honmei_summary(summary: Dict[str, Any], rank: Any) -> bool:
    rank_int = _safe_int(rank)
    if rank_int is None or rank_int <= 0:
        return False
    summary['total'] += 1
    if rank_int == 1:
        summary['win'] += 1
    elif rank_int == 2:
        summary['second'] += 1
    elif rank_int == 3:
        summary['third'] += 1
    else:
        summary['other'] += 1
    return True


def summarize_honmei_results_from_db(target_date_str: str) -> Optional[Dict[str, Any]]:
    """SNS向けに、DBから昨日のAI本命馬(◎)成績を直接集計する。"""
    if not DATABASE_URL or SessionLocal is None or models is None:
        _log("-> DB集計は利用できません。APIレスポンスから集計します。")
        return None

    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        _log(f"⚠️ 日付形式が不正なためDB集計をスキップします: {target_date_str}")
        return None

    db = SessionLocal()
    try:
        rows = db.query(models.Result.rank).select_from(models.Prediction)\
            .join(models.Race, models.Race.id == models.Prediction.race_id)\
            .join(
                models.Result,
                (models.Result.race_id == models.Prediction.race_id) &
                (models.Result.horse_id == models.Prediction.horse_id)
            )\
            .filter(
                models.Race.race_date == target_date,
                models.Prediction.mark == '◎',
                models.Result.rank.isnot(None),
            )\
            .all()

        if not rows:
            rows = db.query(models.Result.rank).select_from(models.Prediction)\
                .join(models.Race, models.Race.id == models.Prediction.race_id)\
                .join(
                    models.Result,
                    (models.Result.race_id == models.Prediction.race_id) &
                    (models.Result.horse_number == models.Prediction.horse_number)
                )\
                .filter(
                    models.Race.race_date == target_date,
                    models.Prediction.mark == '◎',
                    models.Result.rank.isnot(None),
                )\
                .all()

        summary = _empty_honmei_summary()
        for row in rows:
            _add_rank_to_honmei_summary(summary, row.rank)

        if summary['total'] <= 0:
            _log("-> DBでは昨日のAI本命馬成績を集計できませんでした。APIレスポンスから再集計します。")
            return None

        _finalize_honmei_summary(summary)
        _log(
            "-> DB集計成功: AI本命馬(◎)成績 "
            f"[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}] "
            f"対象{summary['total']}頭"
        )
        return summary
    except Exception as e:
        _log(f"⚠️ DB集計に失敗しました。APIレスポンスから再集計します: {e}")
        return None
    finally:
        db.close()


def _find_honmei_prediction(predictions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    honmei = next((p for p in predictions if p.get('mark') == '◎'), None)
    if honmei:
        return honmei

    scored = [
        p for p in predictions
        if p.get('deviation_score') is not None
    ]
    if not scored:
        return None

    return sorted(scored, key=lambda p: p.get('deviation_score') or 0, reverse=True)[0]


def _find_result_for_prediction(prediction: Dict[str, Any], results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    pred_horse_id = str(prediction.get('horse_id') or '').strip()
    if pred_horse_id:
        matched = next((r for r in results if str(r.get('horse_id') or '').strip() == pred_horse_id), None)
        if matched:
            return matched

    pred_number = _safe_int(prediction.get('horse_number'))
    if pred_number is not None:
        matched = next((r for r in results if _safe_int(r.get('horse_number')) == pred_number), None)
        if matched:
            return matched

    pred_name = _normalize_horse_name(prediction.get('horse_name'))
    if pred_name:
        return next((r for r in results if _normalize_horse_name(r.get('horse_name')) == pred_name), None)

    return None


def summarize_honmei_results_from_api(all_races_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    summary = _empty_honmei_summary()
    if not all_races_data:
        return summary

    venues = all_races_data.get('jra', []) + all_races_data.get('nar', [])
    for venue in venues:
        for race in venue.get('races', []):
            predictions = race.get('predictions') or []
            results = race.get('results') or []
            if not predictions or not results:
                continue

            honmei = _find_honmei_prediction(predictions)
            if not honmei:
                continue

            result = _find_result_for_prediction(honmei, results)
            if result:
                _add_rank_to_honmei_summary(summary, result.get('rank'))

    if summary['total'] <= 0:
        _log("⚠️ APIレスポンスからAI本命馬成績を1件も集計できませんでした。投稿では0件として扱います。")
    return _finalize_honmei_summary(summary)

# --- 6. OGP画像生成関数群 (改良: 安全な .get 使用、None ハンドリング) ---
def generate_hit_og_image(hit_data: dict, date_str: str) -> Optional[str]:
    """的中報告用の画像を生成する"""
    safe_venue = hit_data.get('venue_name', '')
    safe_race_num = hit_data.get('race_number', '')
    safe_bet_type = hit_data.get('bet_type', '')
    payout_val = hit_data.get('payout', 0) or 0

    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_hit_{date_str}_{random.randint(1000,9999)}.png")
    _log(f"-> 的中報告用の画像を生成: {filename}")
    try:
        # カラーとフォント
        COLOR_GOLD = (250, 204, 21) # Amber 400
        TEXT_COLOR_LIGHT = (230, 230, 245)
        font_light = get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = get_font_path("MPLUSRounded1c-Black.ttf")

        # ベース画像生成
        img, draw = create_base_image()

        # ヘッダー (昨日の最高配当)
        header_text = "昨日の最高配当"
        header_font = ImageFont.truetype(font_bold, 42)
        draw_centered_text(draw, header_text, header_font, COLOR_GOLD, 1200, 150)

        # レース情報
        race_info_text = f"{safe_venue} {safe_race_num}R"
        draw_centered_text(draw, race_info_text, ImageFont.truetype(font_regular, 32), TEXT_COLOR_LIGHT, 1200, 240)

        # 馬券種類
        draw_centered_text(draw, safe_bet_type, ImageFont.truetype(font_bold, 48), TEXT_COLOR_LIGHT, 1200, 290)

        # 配当金額
        payout_text = f"¥{int(payout_val):,}"
        draw_centered_text(draw, payout_text, ImageFont.truetype(font_black, 110), COLOR_GOLD, 1200, 370)

        # フッター情報
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y.%m.%d')
        draw.text((50, 580), date_formatted, font=ImageFont.truetype(font_light, 22), fill=TEXT_COLOR_LIGHT, anchor="ls")

        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Hit OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_pick_og_image(data: dict, date_str: str) -> Optional[str]:
    """注目馬用の画像を生成する"""
    safe_venue = data.get('venue_name', '')
    safe_race_num = data.get('race_number', '')
    safe_race_name = data.get('race_name', '')
    safe_horse_name = data.get('horse_name', '')
    ds = data.get('deviation_score', 0)
    try:
        ds_val = float(ds) if ds is not None else 0.0
    except Exception:
        ds_val = 0.0

    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_pick_{date_str}.png")
    _log(f"-> 注目馬用の画像を生成: {filename}")
    try:
        # カラーとフォント
        COLOR_CYAN = (34, 211, 238) # Cyan 400
        TEXT_COLOR_LIGHT = (230, 230, 245)
        TEXT_COLOR_MUTED = (150, 160, 180)
        font_light = get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = get_font_path("MPLUSRounded1c-Black.ttf")
        
        # ベース画像生成
        img, draw = create_base_image()

        # ヘッダー (本日の注目馬)
        draw_centered_text(draw, "本日のAI注目馬", ImageFont.truetype(font_bold, 32), COLOR_CYAN, 1200, 150)

        # レース情報
        race_info_text = f"{safe_venue} {safe_race_num}R"
        draw_centered_text(draw, race_info_text, ImageFont.truetype(font_regular, 28), TEXT_COLOR_LIGHT, 1200, 220)
        draw_centered_text(draw, safe_race_name, ImageFont.truetype(font_light, 24), TEXT_COLOR_MUTED, 1200, 260)

        # 馬名
        draw_centered_text(draw, safe_horse_name, ImageFont.truetype(font_black, 84), TEXT_COLOR_LIGHT, 1200, 320)

        # AI偏差値
        draw.line([(450, 450), (750, 450)], fill=TEXT_COLOR_MUTED, width=1)
        deviation_score_text = f"{ds_val:.1f}"
        score_font = ImageFont.truetype(font_black, 56)
        label_font = ImageFont.truetype(font_regular, 28)

        draw_centered_text(draw, "AI偏差値", label_font, TEXT_COLOR_MUTED, 1200, 470)
        draw_centered_text(draw, deviation_score_text, score_font, COLOR_CYAN, 1200, 505)

        # フッター情報
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y.%m.%d')
        draw.text((50, 580), date_formatted, font=ImageFont.truetype(font_light, 22), fill=TEXT_COLOR_LIGHT, anchor="ls")

        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Pick OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_reminder_og_image(race: dict, top_preds: list) -> Optional[str]:
    """重賞レース用の画像を生成する"""
    race_id_safe = race.get('id', 'unknown')
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race_id_safe}_{random.randint(1000,9999)}.png")
    _log(f"-> 重賞レース用の画像を生成: {filename}")
    try:
        # カラーとフォント
        COLOR_GOLD = (250, 204, 21)
        COLOR_SILVER = (209, 213, 219)
        COLOR_BRONZE = (205, 151, 104)
        TEXT_COLOR_LIGHT = (230, 230, 245)
        TEXT_COLOR_MUTED = (150, 160, 180)
        font_light = get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = get_font_path("MPLUSRounded1c-Black.ttf")

        # ベース画像生成
        img, draw = create_base_image()

        # ヘッダー (重賞) とレース名
        draw_centered_text(draw, race.get('race_name', ''), ImageFont.truetype(font_black, 64), TEXT_COLOR_LIGHT, 1200, 150)
        
        # 開催情報
        race_date_safe = race.get('race_date', '1970-01-01')
        try:
            date_str_for_v = datetime.strptime(race_date_safe, '%Y-%m-%d').strftime('%m/%d')
        except Exception:
            date_str_for_v = race_date_safe
        venue_info = f"{race.get('venue_name','')} {date_str_for_v}"
        draw_centered_text(draw, venue_info, ImageFont.truetype(font_light, 28), TEXT_COLOR_MUTED, 1200, 240)

        # 予測リスト
        y_start, y_step = 320, 80
        marks, colors = ["◎", "○", "▲"], [COLOR_GOLD, COLOR_SILVER, COLOR_BRONZE]
        mark_font = ImageFont.truetype(font_black, 40)
        horse_font = ImageFont.truetype(font_bold, 36)
        score_font = ImageFont.truetype(font_regular, 32)
        
        for i, p in enumerate(top_preds):
            if i >= 3:
                break
            y_pos = y_start + i * y_step
            # Mark
            draw.text((350, y_pos), marks[i], font=mark_font, fill=colors[i], anchor="lm")
            # Horse Name
            horse_name = p.get('horse_name', '')
            draw.text((420, y_pos), horse_name, font=horse_font, fill=TEXT_COLOR_LIGHT, anchor="lm")
            # Score (safe)
            ds_p = p.get('deviation_score', 0)
            try:
                ds_p_val = float(ds_p) if ds_p is not None else 0.0
            except Exception:
                ds_p_val = 0.0
            score_text = f"偏差値: {ds_p_val:.1f}"
            draw.text((850, y_pos), score_text, font=score_font, fill=TEXT_COLOR_MUTED, anchor="rm")
        
        # フッター情報
        date_str = race_date_safe
        try:
            date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y.%m.%d')
        except Exception:
            date_formatted = date_str
        draw.text((50, 580), date_formatted, font=ImageFont.truetype(font_light, 22), fill=TEXT_COLOR_LIGHT, anchor="ls")

        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Reminder OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

# --- 7. テキスト生成関数群 (安全に .get を使い None を扱う) ---
def get_past_tweet_id_for_race(target_date_str: str, post_type_prefix: str = "evening_race") -> Optional[str]:
    """
    指定した日付に関する過去の投稿（例：前日の evening_race または 本日の morning_pick_only）
    の tweet_id を取得し、引用RT用のURLを生成するために使用する。
    """
    if not DATABASE_URL or SessionLocal is None or models is None:
        return None

    db = SessionLocal()
    try:
        # target_date_str の日付に対する投稿を探す
        # 例えば今日が2023-10-15で、昨日の的中(10-14)を報告する場合、
        # 探したいのは「10-14のレース」に向けて投稿されたtweet_id。
        # evening_race は前日(10-13)に target_date=10-14 として保存されている。
        past_post = db.query(models.SnsPost).filter(
            models.SnsPost.target_date == target_date_str,
            models.SnsPost.post_type.like(f"{post_type_prefix}%"),
            models.SnsPost.tweet_id.isnot(None)
        ).order_by(models.SnsPost.posted_at.desc()).first()
        
        if past_post and past_post.tweet_id:
            return past_post.tweet_id
        return None
    except Exception as e:
        _log(f"⚠️ 過去のtweet_id取得に失敗しました: {e}")
        return None
    finally:
        db.close()

def create_hit_report_and_summary_tweet(hit: Dict[str, Any], summary: dict, date_str: str, quote_tweet_id: Optional[str] = None) -> str:
    _log("-> 的中報告＋成績サマリーのテキストを生成...")
    payout_val = hit.get('payout', 0) or 0
    hashtags = ["#競馬", "#AI予想", "#万馬券" if payout_val >= 10000 else "#的中"]
    venue_name = hit.get('venue_name', '')
    if venue_name:
        hashtags.append(f"#{venue_name}競馬")
    return f"""🎯昨日のAI的中速報 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})

【{venue_name}{hit.get('race_number','')}R {hit.get('bet_type','')}】で

🎉 {int(payout_val):,}円 の高配当を的中しました！

📈昨日のAI本命馬(◎)成績

[{summary.get('win',0)}-{summary.get('second',0)}-{summary.get('third',0)}-{summary.get('other',0)}]

勝率: {summary.get('win_rate',0.0):.1f}% / 複勝率: {summary.get('in_money_rate',0.0):.1f}%

▼レース結果とAIの印はこちらから

{build_race_url(date_str, hit.get('race_number', ''), venue_name)}

{' '.join(hashtags)}
{build_x_status_url(quote_tweet_id) if quote_tweet_id else ''}
"""

def create_pick_tweet(pick: Dict[str, Any], date_str: str) -> str:
    _log("-> 注目馬のテキストを生成...")
    # JRA判定（race_id 形式を利用する既存ロジックを維持）
    is_jra = False
    race_id_val = pick.get('race_id', '')
    if isinstance(race_id_val, str) and len(race_id_val) >= 6:
        try:
            is_jra = int(race_id_val[4:6]) < 30
        except Exception:
            is_jra = False

    hashtags = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬"]
    venue_name = pick.get('venue_name', '')
    if venue_name:
        hashtags.append(f"#{venue_name}競馬")
    
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', pick.get('race_name', '')).strip()
    if clean_race_name and clean_race_name != "?":
        hashtags.append(f"#{clean_race_name}")

    pick_horse_name = pick.get('horse_name', '')
    if pick_horse_name:
        hashtags.append(f"#{pick_horse_name}")

    return f"""🏇本日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})

AIが今日のレースで最も高く評価した一頭はこちら！

【{pick.get('venue_name','')}{pick.get('race_number','')}R {pick.get('race_name','')}】

◎ {pick_horse_name} (AI偏差値: {float(pick.get('deviation_score') or 0):.2f})

▼全レースの無料予測

{build_race_url(date_str, pick.get('race_number', ''), pick.get('venue_name', ''))}

{' '.join(hashtags)}

"""

def create_reminder_tweet(race: dict, top_preds: List[dict]) -> str:
    _log("-> 重賞レースのテキストを生成...")
    # ★★修正済み: 'race_date' を参照
    date_str = race.get('race_date', '')
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race.get('race_name', '')).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    lines = [f"🏇本日の重賞 ({race.get('race_name','')}) AI予測\n"]
    for i, p in enumerate(top_preds[:3]):
        lines.append(f"{['◎','○','▲'][i]} {p.get('horse_name','?')} (AI偏差値: {float(p.get('deviation_score') or 0):.2f})")
    race_num = race.get('race_number', '')
    venue = race.get('venue_name', '')
    lines.append(f"\n▼詳細なデータはこちら\n{build_race_url(date_str, race_num, venue)}")
    lines.append(f"\n{' '.join(hashtags)}")
    return "\n".join(lines)

# --- 8. X (Twitter) 投稿関数 (文字数制限対応版) ---
X_URL_PATTERN = re.compile(r'https?://\S+')
SHORT_SOCIAL_MAX_CHARS = 280


def sanitize_text_for_short_social_post(text: str, channel_name: str, remove_urls: bool = True) -> str:
    """SNS本文の空行を整え、必要な場合だけURL行と直前の誘導文を除外する。"""
    cleaned_lines: List[str] = []
    removed_url = False

    for line in text.splitlines():
        if remove_urls and X_URL_PATTERN.search(line):
            removed_url = True
            # URL行を消すと直前の誘導文がリンク先のない案内として残るため一緒に落とす。
            # テンプレートは誘導文とURLの間に空行を挟むので、空行を読み飛ばして遡る。
            lookback = len(cleaned_lines) - 1
            while lookback >= 0 and not cleaned_lines[lookback].strip():
                lookback -= 1
            if lookback >= 0:
                previous = cleaned_lines[lookback].strip()
                if previous.startswith("▼") or "こちら" in previous or "無料予測" in previous:
                    del cleaned_lines[lookback:]
            continue
        cleaned_lines.append(line.rstrip())

    compact_lines: List[str] = []
    previous_blank = False
    for line in cleaned_lines:
        is_blank = not line.strip()
        if is_blank and previous_blank:
            continue
        compact_lines.append(line)
        previous_blank = is_blank

    sanitized = "\n".join(compact_lines).strip()
    if removed_url:
        _log(f"{channel_name}投稿用にURL行を除外しました。")
    return sanitized or text


def fit_text_for_short_social_post(
    text: str,
    channel_name: str,
    max_chars: int = SHORT_SOCIAL_MAX_CHARS,
    preserve_urls: bool = False,
) -> str:
    """XとThreadsで同じ印象になるよう、短いSNS本文に丸める。"""
    if len(text) <= max_chars:
        return text

    lines = [line.rstrip() for line in text.splitlines()]
    hashtag_lines = [line for line in lines if line.strip().startswith("#")]
    hashtag_line = hashtag_lines[-1].strip() if hashtag_lines else ""
    url_lines = []
    for line in lines:
        stripped = line.strip()
        if preserve_urls and X_URL_PATTERN.search(stripped) and stripped not in url_lines:
            url_lines.append(stripped)

    content_lines = [
        line
        for line in lines
        if line.strip()
        and not line.strip().startswith("#")
        and not (preserve_urls and X_URL_PATTERN.search(line.strip()))
    ]

    suffix = "..."
    reserved = len("\n") + len(suffix)
    trailing_blocks = []
    if url_lines:
        trailing_blocks.append("\n".join(url_lines))
    if hashtag_line:
        trailing_blocks.append(hashtag_line)

    while trailing_blocks and reserved + sum(len("\n\n") + len(block) for block in trailing_blocks) > max_chars:
        if hashtag_line and trailing_blocks[-1] == hashtag_line:
            trailing_blocks.pop()
            hashtag_line = ""
        elif len(url_lines) > 1:
            url_lines = url_lines[:1]
            trailing_blocks = ["\n".join(url_lines)] + ([hashtag_line] if hashtag_line else [])
        else:
            break

    reserved += sum(len("\n\n") + len(block) for block in trailing_blocks)

    fitted_lines: List[str] = []
    current_len = 0
    for line in content_lines:
        next_len = len(line) if not fitted_lines else current_len + 1 + len(line)
        if next_len + reserved > max_chars:
            break
        fitted_lines.append(line)
        current_len = next_len

    if not fitted_lines:
        base_limit = max_chars - reserved
        fitted_lines = [content_lines[0][:max(base_limit, 1)].rstrip()] if content_lines else []

    fitted = "\n".join(fitted_lines).rstrip()
    if fitted and not fitted.endswith(suffix):
        fitted = f"{fitted}\n{suffix}"
    for block in trailing_blocks:
        if block and len(f"{fitted}\n\n{block}") <= max_chars:
            fitted = f"{fitted}\n\n{block}"

    _log(f"{channel_name}投稿用に本文を{max_chars}文字以内へ調整しました。")
    return fitted.strip() or text[:max_chars]


def prepare_short_social_text(
    text: str,
    channel_name: str,
    remove_urls: bool = True,
    max_chars: int = SHORT_SOCIAL_MAX_CHARS,
) -> str:
    sanitized = sanitize_text_for_short_social_post(text, channel_name, remove_urls=remove_urls)
    return fit_text_for_short_social_post(
        sanitized,
        channel_name,
        max_chars=max_chars,
        preserve_urls=not remove_urls,
    )


def split_tweet_text(text: str, max_length: int = 280, force_split: bool = True) -> List[str]:
    """
    テキストを2つのツイートに分割する（force_split=Trueの場合）
    force_split=Trueの場合、文字数に関わらず必ず2分割する
    force_split=Falseの場合、文字数制限内で分割する

    ハッシュタグが含まれる場合、それを考慮して分割する
    """
    if not force_split and len(text) <= max_length:
        return [text]

    tweets = []
    lines = text.split('\n')

    if force_split:
        # ハッシュタグ行を検出
        hashtag_indices = []
        for i, line in enumerate(lines):
            if line.strip().startswith('#'):
                hashtag_indices.append(i)

        # ハッシュタグが2つ以上ある場合、2番目のハッシュタグの前で分割
        if len(hashtag_indices) >= 2:
            split_point = hashtag_indices[1]
        else:
            split_point = len(lines) // 2
            if split_point == 0:
                split_point = 1

        first_tweet = '\n'.join(lines[:split_point])
        second_tweet = '\n'.join(lines[split_point:])

        # 両方が空でないことを確認
        if first_tweet.strip():
            tweets.append(first_tweet)
        if second_tweet.strip():
            tweets.append(second_tweet)

        # どちらかが空の場合は元のテキストを2回返す
        if len(tweets) < 2:
            tweets = [text, text]
    else:
        # 文字数制限で分割する場合
        current_tweet = ""

        for line in lines:
            # 行を追加した場合の長さをチェック
            test_text = current_tweet + ('\n' if current_tweet else '') + line

            if len(test_text) <= max_length:
                current_tweet = test_text
            else:
                # 現在のツイートを保存して新しいツイートを開始
                if current_tweet:
                    tweets.append(current_tweet)
                current_tweet = line

        # 最後のツイートを追加
        if current_tweet:
            tweets.append(current_tweet)

    return tweets if tweets else [text, text]


def twitter_credentials_ready() -> bool:
    return all([
        TWITTER_CONSUMER_KEY,
        TWITTER_CONSUMER_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET,
    ])


def threads_credentials_ready() -> bool:
    return bool(THREADS_USER_ID and THREADS_ACCESS_TOKEN)


def track_sns_result(failures: List[str], channel: str, context: str, ok: bool) -> None:
    if not ok:
        failures.append(f"{channel}: {context}")


@dataclass
class TwitterPostResult:
    ok: bool
    attempted: bool = True
    posted_ids: List[str] = field(default_factory=list)
    transient: bool = False
    reason: str = ""

    def __bool__(self) -> bool:
        return self.ok


def _response_body_from_exception(error: Exception) -> str:
    response = getattr(error, "response", None)
    if response is None:
        return ""
    try:
        return getattr(response, "text", "") or ""
    except Exception:
        return ""


def _status_from_exception(error: Exception) -> Optional[int]:
    response = getattr(error, "response", None)
    if response is None:
        return None
    status_code = getattr(response, "status_code", None)
    try:
        return int(status_code) if status_code is not None else None
    except Exception:
        return None


def _classify_twitter_exception(error: Exception) -> tuple[bool, str]:
    """X API例外を、一時的な外部要因か恒久的な設定問題かに分ける。"""
    body = _response_body_from_exception(error)
    status = _status_from_exception(error)
    body_lower = body.lower()

    if "just a moment" in body_lower or "challenges.cloudflare.com" in body_lower:
        return True, "X側のCloudflareチャレンジによる一時的な403"
    if status == 403 and "you are not permitted to perform this action" in body_lower:
        return True, "X APIが個別投稿を拒否した外部要因(403)"
    if status == 429:
        return True, "X APIのレート制限"
    if status is not None and 500 <= status <= 599:
        return True, f"X APIの一時的なサーバーエラー({status})"
    if isinstance(error, (requests.Timeout, requests.ConnectionError)):
        return True, "X APIへのネットワーク接続エラー"
    return False, f"X APIエラー({status or 'status不明'})"


def _log_twitter_exception(error: Exception, reason: str, attempt: int, max_retries: int) -> None:
    status = _status_from_exception(error)
    _log(f"\n❌ Twitter APIエラー: {reason} (試行 {attempt}/{max_retries})")
    if status:
        _log(f"  → HTTPステータス: {status}")
    body = _response_body_from_exception(error)
    if body:
        _log(f"  → レスポンス詳細: {body[:500]}")


def _sleep_before_twitter_retry(attempt: int) -> None:
    delay = TWITTER_POST_RETRY_BASE_SECONDS * attempt + random.randint(0, 10)
    _log(f"  → {delay}秒後にX投稿を再試行します。")
    time.sleep(delay)


def _create_twitter_clients():
    auth_v1 = tweepy.OAuth1UserHandler(
        TWITTER_CONSUMER_KEY,
        TWITTER_CONSUMER_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET,
    )
    api_v1 = tweepy.API(auth_v1)
    client_v2 = tweepy.Client(
        consumer_key=TWITTER_CONSUMER_KEY,
        consumer_secret=TWITTER_CONSUMER_SECRET,
        access_token=TWITTER_ACCESS_TOKEN,
        access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
    )
    return api_v1, client_v2


def _post_single_tweet_to_x(tweet_text: str, image_path: Optional[str], idx: int, total: int) -> TwitterPostResult:
    last_result = TwitterPostResult(ok=False, reason="X投稿が完了しませんでした")

    for attempt in range(1, TWITTER_POST_MAX_RETRIES + 1):
        try:
            api_v1, client_v2 = _create_twitter_clients()
            media_ids = []

            if image_path and os.path.exists(image_path):
                try:
                    _log(f"画像をアップロードしています (ツイート {idx}): {image_path}")
                    media = api_v1.media_upload(filename=image_path)
                    media_ids.append(media.media_id)
                except tweepy.errors.Forbidden as img_403:
                    transient, reason = _classify_twitter_exception(img_403)
                    _log(f"⚠️ 画像アップロードが403 Forbiddenで拒否されました: {reason}")
                    _log("  → 画像なしのテキスト投稿へ切り替えます。")
                    if transient:
                        last_result = TwitterPostResult(ok=False, transient=True, reason=reason)
                except Exception as img_error:
                    _log(f"⚠️ 画像アップロードに失敗しました: {img_error}。テキストのみで投稿します。")

            _log(f"ツイート {idx}/{total} を投稿しています...")
            response = client_v2.create_tweet(
                text=tweet_text,
                media_ids=media_ids if media_ids else None,
            )

            tweet_id = response.data.get('id') if response and response.data else None
            _log(f"✅ ツイート {idx} の投稿に成功しました！")
            if tweet_id:
                _log(f" - URL: {build_x_status_url(tweet_id)}")
            return TwitterPostResult(
                ok=True,
                posted_ids=[str(tweet_id)] if tweet_id else [],
                reason="投稿成功",
            )
        except tweepy.errors.TweepyException as error:
            transient, reason = _classify_twitter_exception(error)
            _log_twitter_exception(error, reason, attempt, TWITTER_POST_MAX_RETRIES)
            last_result = TwitterPostResult(ok=False, transient=transient, reason=reason)
            if transient and attempt < TWITTER_POST_MAX_RETRIES:
                _sleep_before_twitter_retry(attempt)
                continue
            return last_result
        except Exception as error:
            transient, reason = _classify_twitter_exception(error)
            if not transient:
                reason = f"予期せぬエラー: {error}"
            _log(f"\n❌予期せぬエラーが発生しました: {error}\n{traceback.format_exc()}")
            last_result = TwitterPostResult(ok=False, transient=transient, reason=reason)
            if transient and attempt < TWITTER_POST_MAX_RETRIES:
                _sleep_before_twitter_retry(attempt)
                continue
            return last_result

    return last_result


def track_x_result(failures: List[str], context: str, result: TwitterPostResult, threads_ok: bool = False) -> None:
    if result.ok:
        return
    if not result.attempted:
        failures.append(f"X(Twitter): {context}")
        return
    if (
        result.transient
        and threads_ok
        and ALLOW_X_TRANSIENT_FAILURE_WITH_THREADS
    ):
        _log(
            "⚠️ X投稿は一時的な外部要因で失敗しましたが、Threads投稿が成功したため、"
            "今回のジョブは失敗扱いにしません。"
        )
        _log(f"  → X失敗理由: {result.reason}")
        return
    failures.append(f"X(Twitter): {context}")


def track_threads_result(failures: List[str], context: str, result: ThreadsPostResult, x_ok: bool = False) -> None:
    if result.ok:
        return
    if not result.attempted:
        failures.append(f"Threads: {context}")
        return
    if (
        result.transient
        and x_ok
        and ALLOW_THREADS_TRANSIENT_FAILURE_WITH_X
    ):
        _log(
            "⚠️ Threads投稿は一時的な外部要因で失敗しましたが、X投稿が成功したため、"
            "今回のジョブは失敗扱いにしません。"
        )
        _log(f"  → Threads失敗理由: {result.reason}")
        return
    failures.append(f"Threads: {context}")


def record_post_if_delivered(
    content: str,
    post_type: str,
    target_date: str,
    x_result: Optional[TwitterPostResult] = None,
    threads_ok: bool = False,
) -> None:
    """いずれかのSNSで配信できた内容を、元本文のハッシュで記録する。"""
    x_ok = bool(x_result) if x_result is not None else False
    if not x_ok and not threads_ok:
        return
    tweet_id = x_result.posted_ids[0] if x_result and x_result.posted_ids else None
    record_post(content, post_type, target_date, tweet_id=tweet_id)


def post_to_twitter_with_dual_images(tweet_text_1: str, tweet_text_2: str, image_path_1: Optional[str] = None, image_path_2: Optional[str] = None, post_type: str = "", target_date: str = "") -> TwitterPostResult:
    """
    2つのツイートテキストを受け取り、各投稿に異なる画像を添付して投稿する。
    ツイート1に image_path_1、ツイート2に image_path_2 を使用。
    """
    _log("-> X (Twitter) への投稿を実行...")

    # X本文はURL行を落として投稿する（リンクを貼らない方針）。
    # URLが残らないためUTM付与も行わない。
    tweet_texts = [
        prepare_short_social_text(tweet_text_1, "X"),
        prepare_short_social_text(tweet_text_2, "X"),
    ]
    _log(f"{len(tweet_texts)} 個のツイートを投稿します")

    if not ENABLE_TWITTER:
        _log("X投稿は ENABLE_TWITTER=false のためスキップします。")
        return TwitterPostResult(ok=False, attempted=False, reason="X投稿無効")

    if not twitter_credentials_ready():
        _log("⚠️ X API認証情報が不足しているため、X投稿をスキップします。")
        return TwitterPostResult(ok=False, attempted=False, reason="X API認証情報不足")

    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません。")
        for i, tweet_text in enumerate(tweet_texts, 1):
            _log(f"--- ツイート {i}/{len(tweet_texts)} プレビュー ---\n{tweet_text}\n--- /プレビュー ---")
        if image_path_1:
            _log(f"画像1パス: {image_path_1}")
        if image_path_2:
            _log(f"画像2パス: {image_path_2}")
        return TwitterPostResult(ok=True, reason="DRY_RUN")

    posted_ids: List[str] = []
    image_paths = [image_path_1, image_path_2]

    for idx, tweet_text in enumerate(tweet_texts, 1):
        if is_already_posted(tweet_text, post_type, target_date):
            _log(f"-> ツイート {idx}/{len(tweet_texts)} は既に投稿済みのためスキップします。")
            continue

        image_path = image_paths[idx - 1] if idx - 1 < len(image_paths) else None
        result = _post_single_tweet_to_x(tweet_text, image_path, idx, len(tweet_texts))
        posted_ids.extend(result.posted_ids)
        if result.ok:
            record_post(tweet_text, post_type, target_date, tweet_id=result.posted_ids[0] if result.posted_ids else None)
        else:
            return TwitterPostResult(
                ok=False,
                posted_ids=posted_ids,
                transient=result.transient,
                reason=result.reason,
            )

        if idx < len(tweet_texts):
            _log("-> スレッド化防止のため120秒待機...")
            time.sleep(120)

    return TwitterPostResult(ok=True, posted_ids=posted_ids, reason="投稿成功")


def post_to_twitter(text: str, image_path: Optional[str] = None, post_type: str = "", target_date: str = "", split_mode: bool = True) -> TwitterPostResult:
    """
    テキストと画像をツイートする。
    split_mode=True の場合、テキストを必ず2つに分割して投稿する。
    split_mode=False の場合、テキストをそのまま1つのツイートで投稿する。
    各投稿に同じ画像を添付する（スレッド形式ではなく独立した投稿）。
    """
    _log("-> X (Twitter) への投稿を実行...")
    # X本文はURL行を落として投稿する（リンクを貼らない方針）。
    # URLが残らないためUTM付与も行わない。
    text = prepare_short_social_text(text, "X")

    if split_mode:
        tweet_texts = split_tweet_text(text, max_length=280, force_split=True)
        _log(f"テキストを {len(tweet_texts)} 個のツイートに分割します")
    else:
        tweet_texts = [text]
        _log(f"テキストを1個のツイートとして投稿します")

    if not ENABLE_TWITTER:
        _log("X投稿は ENABLE_TWITTER=false のためスキップします。")
        return TwitterPostResult(ok=False, attempted=False, reason="X投稿無効")

    if not twitter_credentials_ready():
        _log("⚠️ X API認証情報が不足しているため、X投稿をスキップします。")
        return TwitterPostResult(ok=False, attempted=False, reason="X API認証情報不足")

    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません。")
        for i, tweet_text in enumerate(tweet_texts, 1):
            _log(f"--- ツイート {i}/{len(tweet_texts)} プレビュー ---\n{tweet_text}\n--- /プレビュー ---")
        if image_path:
            _log(f"画像パス: {image_path}")
        return TwitterPostResult(ok=True, reason="DRY_RUN")

    posted_ids: List[str] = []
    for idx, tweet_text in enumerate(tweet_texts, 1):
        if is_already_posted(tweet_text, post_type, target_date):
            _log(f"-> ツイート {idx}/{len(tweet_texts)} は既に投稿済みのためスキップします。")
            continue

        result = _post_single_tweet_to_x(tweet_text, image_path, idx, len(tweet_texts))
        posted_ids.extend(result.posted_ids)
        if result.ok:
            record_post(tweet_text, post_type, target_date, tweet_id=result.posted_ids[0] if result.posted_ids else None)
        else:
            return TwitterPostResult(
                ok=False,
                posted_ids=posted_ids,
                transient=result.transient,
                reason=result.reason,
            )

        if idx < len(tweet_texts):
            time.sleep(1)

    return TwitterPostResult(ok=True, posted_ids=posted_ids, reason="投稿成功")

# --- 7.5 新しい投稿用テキスト生成関数 ---
def create_morning_hit_tweet(hit: Dict[str, Any], summary: dict, date_str: str, quote_tweet_id: Optional[str] = None) -> str:
    """朝投稿ツイート1: 昨日の的中報告 + 本命馬成績"""
    _log("-> 朝投稿ツイート1: 的中報告＋本命馬成績のテキストを生成...")

    date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')
    total = max(summary.get('total',0), 1)
    in_money_rate = ((summary.get('win',0) + summary.get('second',0) + summary.get('third',0)) / total * 100) if summary.get('total',0) > 0 else 0.0

    hashtags_1 = ["#競馬", "#AI予想", "#万馬券" if (hit.get('payout',0) or 0) >= 10000 else "#的中"]
    venue_name = hit.get('venue_name', '')
    if venue_name:
        hashtags_1.append(f"#{venue_name}競馬")

    lines = [f"🎯昨日のAI的中速報 ({date_formatted})"]
    lines.append(f"\n【{venue_name}{hit.get('race_number','')}R {hit.get('bet_type','')}】で")
    lines.append(f"\n🎉 {int(hit.get('payout',0) or 0):,}円 の高配当を的中しました！")
    lines.append(f"\n📈昨日のAI本命馬(◎)成績")
    lines.append(f"\n[{summary.get('win',0)}-{summary.get('second',0)}-{summary.get('third',0)}-{summary.get('other',0)}]")
    lines.append(f"\n勝率: {summary.get('win_rate',0.0):.1f}% / 複勝率: {in_money_rate:.1f}%")
    lines.append(f"\n▼レース結果とAIの印はこちらから")
    lines.append(f"\n{build_race_url(date_str, hit.get('race_number', ''), venue_name)}")
    lines.append(f"\n{' '.join(hashtags_1)}")
    
    if quote_tweet_id:
        lines.append(f"\n{build_x_status_url(quote_tweet_id)}")

    # engagements = [
    #     "皆さんの本命馬と同じでしたか？👇",
    #     "この結果に驚いた方は『いいね』で教えてください🐴",
    #     "AIの印が参考になったら『いいね/ブックマーク』をぜひ！🔖",
    #     "今後も高配当を狙うならお見逃しなく！🏇"
    # ]
    # lines.append(f"\n\n{random.choice(engagements)}")

    return "\n".join(lines)

def create_morning_pick_tweet(pick: Dict[str, Any], date_str: str) -> str:
    """朝投稿ツイート2: 本日のAI注目馬"""
    _log("-> 朝投稿ツイート2: 本日のAI注目馬のテキストを生成...")

    date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')

    venue_name = pick.get('venue_name', '')

    jra_venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '京都', '阪神']
    is_jra = any(jra_venue in venue_name for jra_venue in jra_venues)

    hashtags_2 = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬"]
    if venue_name:
        hashtags_2.append(f"#{venue_name}競馬")
    
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', pick.get('race_name', '')).strip()
    if clean_race_name and clean_race_name != "?":
        hashtags_2.append(f"#{clean_race_name}")

    pick_horse_name = pick.get('horse_name', '')
    if pick_horse_name:
        hashtags_2.append(f"#{pick_horse_name}")

    lines = [f"🐎本日のAI注目馬 ({date_formatted})"]
    lines.append(f"\nAIが今日のレースで最も高く評価した一頭はこちら！")
    lines.append(f"\n【{pick.get('venue_name','')}{pick.get('race_number','')}R {pick.get('race_name','')}】")
    lines.append(f"\n◎ {pick_horse_name} (AI偏差値: {float(pick.get('deviation_score') or 0):.2f})")
    lines.append(f"\n▼全レースの無料予測")
    race_num = pick.get('race_number', '')
    venue = pick.get('venue_name', '')
    lines.append(f"\n{build_race_url(date_str, race_num, venue)}")
    lines.append(f"\n{' '.join(hashtags_2)}")

    # engagements = [
    #     "波乱の予感がする方は『いいね/ブックマーク』で保存！🔖",
    #     "この馬鹿にならないAI偏差値、ぜひ参考に！🐴",
    #     "皆さんの予想はどうですか？👇",
    #     "発走前にオッズと一緒にチェック！🏇"
    # ]
    # lines.append(f"\n\n{random.choice(engagements)}")

    return "\n".join(lines)

def create_afternoon_race_summary_tweet(all_races_today: dict, yesterday_hits: List[Dict], date_str: str) -> str:
    """昼投稿: 本日のレース一覧 + 昨日の的中ランキング"""
    _log("-> 昼投稿: 本日のレース一覧テキストを生成...")

    total_races = 0
    venue_info = []
    jra_races = 0
    nar_races = 0
    venues = all_races_today.get('jra', []) + all_races_today.get('nar', [])

    for venue in venues:
        races = venue.get('races', [])
        race_count = len(races)
        if race_count > 0:
            total_races += race_count
            venue_info.append((venue.get('venue_name', '?'), race_count))
            venue_name = venue.get('venue_name', '')
            jra_venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '京都', '阪神']
            if any(jra_venue in venue_name for jra_venue in jra_venues):
                jra_races += race_count
            else:
                nar_races += race_count

    hit_summary = "昨日の的中実績: 予測あり"
    if yesterday_hits and len(yesterday_hits) > 0:
        hit_summary = f"昨日の最高配当: {yesterday_hits[0].get('venue_name','?')}{yesterday_hits[0].get('race_number','?')}R {yesterday_hits[0].get('bet_type','?')} ¥{int(yesterday_hits[0].get('payout',0) or 0):,}"

    lines = [f"📊本日のレース情報 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})"]
    lines.append(f"\n{hit_summary}")
    lines.append(f"\n✅ 本日は 全{total_races}レース 無料予想公開中！\n")
    lines.append("【本日の開催場】")

    for venue_name, count in sorted(venue_info, key=lambda x: x[1], reverse=True)[:5]:
        lines.append(f"• {venue_name}:全{count}R")

    hashtags = ["#競馬予想", "#AI予想"]
    if jra_races > 0:
        hashtags.append("#中央競馬")
    if nar_races > 0:
        hashtags.append("#地方競馬")

    lines.append(f"\n▼詳細データはこちら\n{build_race_url(date_str)}\n")
    lines.append(" ".join(hashtags))

    return "\n".join(lines)

def find_all_grade_races_for_date(target_date: str) -> List[tuple]:
    """
    指定日の全重賞レースを検索し、投稿用データのリストを返す。
    戻り値: [(tweet_text, race_data, top_preds), ...] (グレード優先度順)
    """
    _log(f"-> 重賞レース検索: {target_date} のレースデータを取得中...")

    races_data = get_api_data(target_date)
    if not races_data:
        _log("-> APIからレースデータが取得できませんでした")
        return []

    venues = races_data.get('jra', []) + races_data.get('nar', [])
    _log(f"-> レースデータ: JRA {len(races_data.get('jra', []))}会場, NAR {len(races_data.get('nar', []))}会場")

    grade_results = []

    for venue in venues:
        for race in venue.get('races', []):
            race_name = (race.get('race_name') or '').strip()
            if not race_name:
                continue

            if not is_grade_race(race_name):
                continue

            norm_race = canonicalize_race_name(race_name)
            _log(f"-> 重賞レース発見: {race_name} (normalized: {norm_race})")

            preds_raw = race.get('predictions', []) or []
            preds = [p for p in preds_raw if p and p.get('deviation_score') is not None]
            preds = sorted(preds, key=lambda p: p['deviation_score'], reverse=True)
            top_preds = preds[:3]

            if len(top_preds) < 3:
                _log(f"-> 重賞 {race_name} の予測データが不足しています (取得: {len(preds_raw)}件, deviation_score を持つ: {len(preds)}件, トップ取得: {len(top_preds)}件).")
                for i, p in enumerate(preds_raw[:10]):
                    ds = p.get('deviation_score', None)
                    _log(f"  pred[{i}]: horse_name={p.get('horse_name','?')}, deviation_score={ds}")
                continue

            _log(f"-> 予測データあり (トップ3頭: {', '.join([p.get('horse_name', '?') for p in top_preds])})")

            lines = [f"🎯明日のレース AI予想"]
            lines.append(f"\n【{race_name}】")
            lines.append(f"{race.get('venue_name', '?')}   {datetime.strptime(target_date, '%Y-%m-%d').strftime('%m/%d')}\n")

            marks = ['◎', '○', '▲']
            horse_names = []
            for i, pred in enumerate(top_preds):
                horse_name = pred.get('horse_name', '?')
                horse_names.append(horse_name)
                ds_val = pred.get('deviation_score')
                try:
                    ds_val_f = float(ds_val) if ds_val is not None else 0.0
                except Exception:
                    ds_val_f = 0.0
                lines.append(f"{marks[i]} {horse_name} (AI偏差値: {ds_val_f:.1f})")

            clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race_name).strip()

            hashtags = ["#競馬予想", "#AI予想", f"#{clean_race_name}"]
            venue_name = race.get('venue_name', '')
            if venue_name and venue_name != '?':
                hashtags.append(f"#{venue_name}競馬")

            for horse_name in horse_names:
                hashtags.append(f"#{horse_name}")

            race_num = race.get('race_number', '')
            lines.append(f"\n▼詳細はこちら\n{build_race_url(target_date, race_num, venue_name)}\n")
            lines.append(" ".join(hashtags))

            tweet_text = "\n".join(lines)
            priority = get_grade_priority(race_name)
            grade_results.append((tweet_text, race, top_preds, priority))

    if not grade_results:
        _log("-> 重賞レースが見つかりませんでした")
        return []

    # グレード優先度順にソート (G1 -> G2 -> G3)
    grade_results.sort(key=lambda x: x[3])
    _log(f"-> {len(grade_results)}件の重賞レースを検出")
    return [(text, race, preds) for text, race, preds, _ in grade_results]

def create_pre_race_tweet(race: dict, top_preds: List[dict]) -> str:
    """直前リマインド: レース直前の予想リマインド"""
    _log("-> 直前リマインドテキストを生成...")
    date_str = race.get('race_date', '')
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race.get('race_name', '')).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    venue_name = race.get('venue_name', '')
    if venue_name and venue_name != '?':
        hashtags.append(f"#{venue_name}競馬")

    lines = [f"⏰まもなく発走！ ({race.get('race_name','')}) AI予想\n"]
    for i, p in enumerate(top_preds[:3]):
        ds_val = p.get('deviation_score')
        ds_val_f = float(ds_val) if ds_val is not None else 0.0
        horse_name = p.get('horse_name','?')
        lines.append(f"{['◎','○','▲'][i]} {horse_name} (AI偏差値: {ds_val_f:.1f})")
        hashtags.append(f"#{horse_name}")
        
    race_num = race.get('race_number', '')
    lines.append(f"\n▼詳細なデータはこちら\n{build_race_url(date_str, race_num, venue_name)}")
    lines.append(f"\n{' '.join(hashtags)}")
    
    engagements = [
        "馬券購入の参考にどうぞ！🐴",
        "皆さんの本命は決まりましたか？👇",
        "発走前に『いいね/ブックマーク』で保存！🔖",
        "AIが高配当を狙います！🏇"
    ]
    lines.append(f"\n\n{random.choice(engagements)}")
    
    return "\n".join(lines)

# --- 9. メイン処理 ---
def main():
    """SNS投稿のメイン処理（投稿タイプに応じて処理を分岐）"""
    _log("="*50)
    _log("SNS自動投稿ジョブを開始します (3投稿体制対応版)")
    _log("="*50)

    sns_failures: List[str] = []
    twitter_ready = twitter_credentials_ready()
    threads_ready = threads_credentials_ready()

    if ENABLE_TWITTER and not twitter_ready:
        _log("⚠️ X API認証情報が不足しています。X投稿は失敗扱いにし、他SNSの投稿は続行します。")
        track_sns_result(sns_failures, "X(Twitter)", "認証情報未設定", False)
    elif not ENABLE_TWITTER:
        _log("X投稿は ENABLE_TWITTER=false のため無効です。")

    if ENABLE_THREADS and not threads_ready:
        _log("⚠️ Threads認証情報が不足しています。Threads投稿は失敗扱いにし、他SNSの投稿は続行します。")
        track_sns_result(sns_failures, "Threads", "認証情報未設定", False)
    elif not ENABLE_THREADS:
        _log("Threads投稿は ENABLE_THREADS=false のため無効です。")

    if not (ENABLE_TWITTER and twitter_ready) and not (ENABLE_THREADS and threads_ready):
        _log("投稿可能なSNS認証情報がありません。処理を終了します。")
        sys.exit(1)

    # コマンドライン引数で投稿タイプを取得
    parser = argparse.ArgumentParser(description='SNS投稿スクリプト')
    parser.add_argument('--post-type', type=str, default='morning',
                       choices=['morning', 'afternoon', 'evening', 'pre_race', 'hit_immediate'],
                       help='投稿タイプ: morning(朝), afternoon(昼), evening(夜), pre_race(直前), hit_immediate(的中速報)')
    args = parser.parse_args()
    post_type = args.post_type

    refresh_threads_token_if_needed()

    with database_lock("sns_poster_lock", timeout_seconds=300) as lock_acquired:
        if not lock_acquired:
            _log("別のインスタンスが実行中のため、このインスタンスは終了します。")
            sys.exit(0)

        jst = timezone(timedelta(hours=9))
        today = datetime.now(jst)
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        today_str = today.strftime('%Y-%m-%d')
        yesterday_str = yesterday.strftime('%Y-%m-%d')
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')

        # ========== 朝7時投稿 ==========
        if post_type == 'morning':
            _log("\n--- 朝投稿: 的中報告 + 本命馬成績 + 本日のAI注目馬 ---")
            hits_data = get_api_data(f"hits/high-payouts/{yesterday_str}")

            if hits_data and isinstance(hits_data, list) and len(hits_data) > 0 and (hits_data[0].get('payout', 0) or 0) >= 10000:
                _log("-> 昨日の本命馬成績を集計中...")
                summary = summarize_honmei_results_from_db(yesterday_str)
                if summary is None:
                    all_races_data_yesterday = get_api_data(yesterday_str)
                    summary = summarize_honmei_results_from_api(all_races_data_yesterday)

                # 本日のレース情報を取得
                all_races_today = get_api_data(today_str)

                # 本日のAI注目馬を取得
                pick_data = None
                if all_races_today:
                    _log("-> 本日のAI注目馬を検索中...")
                    venues = all_races_today.get('jra', []) + all_races_today.get('nar', [])
                    for venue in venues:
                        for race in venue.get('races', []):
                            preds = race.get('predictions', [])
                            if preds:
                                # AI偏差値が最も高い馬を取得
                                sorted_preds = sorted([p for p in preds if p.get('deviation_score') is not None],
                                                     key=lambda p: p['deviation_score'], reverse=True)
                                if sorted_preds:
                                    pick_data = sorted_preds[0]
                                    pick_data['venue_name'] = venue.get('venue_name', '?')
                                    pick_data['race_name'] = race.get('race_name', '?')
                                    pick_data['race_number'] = race.get('race_number', '?')
                                    _log(f"-> AI注目馬を検出: {pick_data.get('horse_name', '?')} (AI偏差値: {pick_data.get('deviation_score', 0):.2f})")
                                    break
                        if pick_data:
                            break

                if all_races_today and pick_data:
                    # 画像を生成（ツイート1用と2用で別の画像）
                    image_file_1 = generate_hit_og_image(hits_data[0], yesterday_str)
                    image_file_2 = generate_pick_og_image(pick_data, today_str)

                    # 過去の重賞予想などの tweet_id を取得 (的中したレースの昨日の日付に対応)
                    quote_tweet_id = get_past_tweet_id_for_race(yesterday_str, post_type_prefix="evening_race")
                    if not quote_tweet_id:
                        # 見つからない場合は当日の予想などを探す
                        quote_tweet_id = get_past_tweet_id_for_race(yesterday_str, post_type_prefix="morning_pick")
                    
                    # ツイート1と2を個別に生成
                    tweet_text_1 = create_morning_hit_tweet(hits_data[0], summary, yesterday_str, quote_tweet_id=quote_tweet_id)
                    tweet_text_2 = create_morning_pick_tweet(pick_data, today_str)

                    # 重複チェック: morning_combined として既に投稿済みか確認
                    # ※テキスト1を代表してハッシュ化の基準とするか、結合文字列でチェックする。
                    # post_to_twitter_with_dual_images は内部で各ツイートを記録するが、
                    # target_date と post_type("morning_combined") で判定すれば全体として1回のみ実行される
                    combined_check_text = tweet_text_1 + "\n---\n" + tweet_text_2
                    if is_already_posted(combined_check_text, "morning_combined", today_str):
                        _log(f"-> 既に投稿済み: morning_combined")
                    else:
                        # 2つのツイートテキストを直接渡して投稿（分割なし、スレッド化防止済み）
                        x_result = post_to_twitter_with_dual_images(tweet_text_1, tweet_text_2, image_file_1, image_file_2, post_type="morning_combined", target_date=today_str)
                        threads_results = post_texts_to_threads_results(
                            [tweet_text_1, tweet_text_2],
                            post_type="morning_combined",
                            target_date=today_str,
                        )
                        threads_ok = len(threads_results) == 2 and all(result.ok for result in threads_results)
                        if ENABLE_TWITTER:
                            track_x_result(sns_failures, "morning_combined", x_result, threads_ok=threads_ok)
                        if ENABLE_THREADS:
                            for result_idx, threads_result in enumerate(threads_results, 1):
                                track_threads_result(
                                    sns_failures,
                                    f"morning_combined:{result_idx}",
                                    threads_result,
                                    x_ok=bool(x_result),
                                )
                        record_post_if_delivered(
                            combined_check_text,
                            "morning_combined",
                            today_str,
                            x_result=x_result,
                            threads_ok=threads_ok,
                        )
                        if not x_result and not threads_ok:
                            _log("⚠️ X投稿とThreads投稿の両方が失敗したため、投稿記録を保存しません。")
                        elif not x_result:
                            _log("⚠️ X投稿は失敗しましたが、Threads投稿は完了したため投稿記録を保存しました。")
                        else:
                            _log("-> 朝投稿の配信記録を保存しました。")
            else:
                _log("-> 昨日は1万円以上の高配当的中がありませんでした。本日のAI注目馬のみ投稿します。")
                # フォールバック: 高配当的中がなくても、本日のAI注目馬を画像付きで投稿する
                all_races_today = get_api_data(today_str)
                pick_data = None
                if all_races_today:
                    _log("-> 本日のAI注目馬を検索中（フォールバック）...")
                    venues = all_races_today.get('jra', []) + all_races_today.get('nar', [])
                    best_score = -1
                    for venue in venues:
                        for race in venue.get('races', []):
                            preds = race.get('predictions', [])
                            if preds:
                                sorted_preds = sorted(
                                    [p for p in preds if p.get('deviation_score') is not None],
                                    key=lambda p: p['deviation_score'], reverse=True
                                )
                                if sorted_preds and sorted_preds[0]['deviation_score'] > best_score:
                                    best_score = sorted_preds[0]['deviation_score']
                                    pick_data = sorted_preds[0]
                                    pick_data['venue_name'] = venue.get('venue_name', '?')
                                    pick_data['race_name'] = race.get('race_name', '?')
                                    pick_data['race_number'] = race.get('race_number', '?')

                if pick_data:
                    _log(f"-> AI注目馬を検出（フォールバック）: {pick_data.get('horse_name', '?')} (AI偏差値: {pick_data.get('deviation_score', 0):.2f})")
                    image_file = generate_pick_og_image(pick_data, today_str)
                    tweet_text = create_morning_pick_tweet(pick_data, today_str)
                    
                    if is_already_posted(tweet_text, "morning_pick_only", today_str):
                        _log(f"-> 既に投稿済み: morning_pick_only")
                    else:
                        x_result = post_to_twitter(tweet_text, image_file, post_type="morning_pick_only", target_date=today_str, split_mode=False)
                        threads_result = post_to_threads(
                            tweet_text,
                            post_type="morning_pick_only",
                            target_date=today_str,
                        )
                        threads_ok = bool(threads_result)
                        if ENABLE_TWITTER:
                            track_x_result(sns_failures, "morning_pick_only", x_result, threads_ok=threads_ok)
                        if ENABLE_THREADS:
                            track_threads_result(sns_failures, "morning_pick_only", threads_result, x_ok=bool(x_result))
                        record_post_if_delivered(tweet_text, "morning_pick_only", today_str, x_result=x_result, threads_ok=threads_ok)
                        if not x_result:
                            _log("⚠️ X投稿は失敗しましたが、Threads投稿は試行済みです")
                else:
                    _log("-> 本日のレースデータも取得できなかったため、投稿をスキップします。")

        # ========== 昼12時投稿 ==========
        elif post_type == 'afternoon':
            _log("\n--- 昼投稿: 本日のレース一覧 + 昨日のAI的中ランキング ---")
            all_races_today = get_api_data(today_str)
            yesterday_hits = get_api_data(f"hits/high-payouts/{yesterday_str}")

            if all_races_today:
                tweet_text = create_afternoon_race_summary_tweet(all_races_today, yesterday_hits if yesterday_hits else [], today_str)
                if is_already_posted(tweet_text, "afternoon_summary", today_str):
                    _log(f"-> 既に投稿済み: afternoon_summary")
                else:
                    x_result = post_to_twitter(tweet_text, image_path=None, post_type="afternoon_summary", target_date=today_str, split_mode=False)
                    threads_result = (
                        ThreadsPostResult(
                            ok=False,
                            attempted=False,
                            reason="夕方の動画投稿へ置換",
                        )
                        if THREADS_EVENING_VIDEO_REPLACES_TEXT
                        else post_to_threads(
                            tweet_text,
                            post_type="afternoon_summary",
                            target_date=today_str,
                        )
                    )
                    threads_ok = bool(threads_result)
                    if ENABLE_TWITTER:
                        track_x_result(sns_failures, "afternoon_summary", x_result, threads_ok=threads_ok)
                    if ENABLE_THREADS:
                        track_threads_result(sns_failures, "afternoon_summary", threads_result, x_ok=bool(x_result))
                    record_post_if_delivered(tweet_text, "afternoon_summary", today_str, x_result=x_result, threads_ok=threads_ok)
                    if not x_result:
                        _log("⚠️ X投稿は失敗しましたが、Threads投稿は試行済みです")
            else:
                _log("-> 本日のレース情報が取得できませんでした。")

        # ========== 夜20時投稿 ==========
        elif post_type == 'evening':
            _log("\n--- 夜投稿: 明日の全重賞レース分析 ---")
            grade_races = find_all_grade_races_for_date(tomorrow_str)

            if grade_races:
                _log(f"-> {len(grade_races)}件の重賞レースを投稿します")
                for idx, (tweet_text, race_data, top_preds) in enumerate(grade_races):
                    race_name = race_data.get('race_name', '?')
                    _log(f"\n-> [{idx+1}/{len(grade_races)}] 重賞レースの投稿準備: {race_name}")

                    # 重複チェック
                    if is_already_posted(tweet_text, 'evening_race', tomorrow_str):
                        _log(f"-> 既に投稿済み: {race_name}")
                        continue

                    image_file = generate_reminder_og_image(race_data, top_preds)

                    if image_file:
                        _log(f"-> 画像生成成功: {image_file}")
                        x_result = post_to_twitter(tweet_text, image_file, post_type="evening_race", target_date=tomorrow_str, split_mode=False)
                    else:
                        _log("-> 画像生成に失敗しましたが、テキストのみで投稿します")
                        x_result = post_to_twitter(tweet_text, None, post_type="evening_race", target_date=tomorrow_str, split_mode=False)
                    threads_result = post_to_threads(
                        tweet_text,
                        post_type="evening_race",
                        target_date=tomorrow_str,
                    )
                    threads_ok = bool(threads_result)
                    if ENABLE_TWITTER:
                        track_x_result(sns_failures, f"evening_race:{race_name}", x_result, threads_ok=threads_ok)
                    if ENABLE_THREADS and not THREADS_EVENING_VIDEO_REPLACES_TEXT:
                        track_threads_result(sns_failures, f"evening_race:{race_name}", threads_result, x_ok=bool(x_result))
                    record_post_if_delivered(tweet_text, "evening_race", tomorrow_str, x_result=x_result, threads_ok=threads_ok)

                    # 次の重賞投稿まで120秒待機（スレッド化防止 + レート制限対策）
                    if idx < len(grade_races) - 1:
                        _log("-> 次の重賞投稿まで120秒待機...")
                        time.sleep(120)
            else:
                _log("-> 明日は対象の重賞レースがありませんでした。")

        # ========== 週末直前(14:00)投稿 ==========
        elif post_type == 'pre_race':
            _log("\n--- 直前リマインド: 本日のメインレース分析 ---")
            all_races_today = get_api_data(today_str)
            target_race = None
            target_preds = None

            if all_races_today:
                venues = all_races_today.get('jra', []) + all_races_today.get('nar', [])
                for venue in venues:
                    for race in venue.get('races', []):
                        race_name = (race.get('race_name') or '').strip()
                        # 11Rなどメインレース、または特別戦などを対象とする
                        # シンプルにするため、本日の一番注目度が高い（AI偏差値トップがいる、あるいは重賞）レースを選ぶ
                        # 今回は11Rを優先的に探すロジックを採用
                        if race.get('race_number') == 11 or is_grade_race(race_name):
                            preds_raw = race.get('predictions', []) or []
                            preds = [p for p in preds_raw if p and p.get('deviation_score') is not None]
                            preds = sorted(preds, key=lambda p: p['deviation_score'], reverse=True)
                            if len(preds) >= 3:
                                target_race = race
                                target_preds = preds[:3]
                                break
                    if target_race:
                        break

            if target_race and target_preds:
                _log(f"-> 直前リマインダー投稿準備完了: {target_race.get('race_name', '?')}")
                tweet_text = create_pre_race_tweet(target_race, target_preds)
                image_file = generate_reminder_og_image(target_race, target_preds)
                
                if image_file:
                    _log(f"-> 画像生成成功: {image_file}")
                    x_result = post_to_twitter(tweet_text, image_file, post_type="pre_race_remind", target_date=today_str, split_mode=False)
                else:
                    x_result = post_to_twitter(tweet_text, None, post_type="pre_race_remind", target_date=today_str, split_mode=False)
                threads_result = post_to_threads(
                    tweet_text,
                    post_type="pre_race_remind",
                    target_date=today_str,
                )
                threads_ok = bool(threads_result)
                if ENABLE_TWITTER:
                    track_x_result(sns_failures, "pre_race_remind", x_result, threads_ok=threads_ok)
                if ENABLE_THREADS:
                    track_threads_result(sns_failures, "pre_race_remind", threads_result, x_ok=bool(x_result))
                record_post_if_delivered(tweet_text, "pre_race_remind", today_str, x_result=x_result, threads_ok=threads_ok)
            else:
                _log("-> 本日の適切な直前リマインダー対象レースがありませんでした。")

        # ========== 的中速報（即時投稿）==========
        elif post_type == 'hit_immediate':
            _log("\n--- 的中速報（即時投稿）---")

            high_payout_hits = get_api_data(f"hits/high-payouts/{today_str}")

            if not high_payout_hits:
                _log("-> 本日の高配当的中データが取得できませんでした。")
                sys.exit(0)

            big_hits = [h for h in high_payout_hits if (h.get('payout') or 0) >= 10000]

            if not big_hits:
                _log("-> 1万円以上の的中はありません。スキップします。")
                sys.exit(0)

            _log(f"-> {len(big_hits)}件の高配当的中を発見！")

            posted_count = 0
            for hit in big_hits[:3]:
                payout = hit.get('payout') or 0
                venue = hit.get('venue_name', '')
                race_num = hit.get('race_number', '')
                bet_type = hit.get('bet_type', '')
                race_name = hit.get('race_name', '')
                winning_numbers = hit.get('winning_numbers', '')
                date_formatted = datetime.strptime(today_str, '%Y-%m-%d').strftime('%m/%d')

                tweet_text = f"""🎯AI的中速報！({date_formatted})

{venue}{race_num}R {race_name}
{bet_type}（{winning_numbers}）

💰 {int(payout):,}円 的中！

▼今日の全レース無料予測
{build_race_url(today_str, race_num, venue)}

#競馬 #AI予想 #{'万馬券' if payout >= 100000 else '高配当的中'} #{venue}競馬"""

                if is_already_posted(tweet_text, 'hit_immediate', today_str):
                    _log(f"-> 既に投稿済み: {venue}{race_num}R")
                    continue

                image_file = generate_hit_og_image(hit, today_str)
                x_result = post_to_twitter(
                    tweet_text, image_file,
                    post_type='hit_immediate',
                    target_date=today_str,
                    split_mode=False
                )
                threads_result = post_to_threads(
                    tweet_text,
                    post_type="hit_immediate",
                    target_date=today_str,
                )
                threads_ok = bool(threads_result)
                if ENABLE_TWITTER:
                    track_x_result(sns_failures, f"hit_immediate:{venue}{race_num}R", x_result, threads_ok=threads_ok)
                if ENABLE_THREADS:
                    track_threads_result(sns_failures, f"hit_immediate:{venue}{race_num}R", threads_result, x_ok=bool(x_result))
                record_post_if_delivered(tweet_text, "hit_immediate", today_str, x_result=x_result, threads_ok=threads_ok)
                posted_count += 1

                if posted_count < len(big_hits):
                    time.sleep(10)

            _log(f"-> 的中速報 {posted_count}件投稿完了")

        if sns_failures:
            _log("\nSNS投稿で失敗または未設定の項目があります。")
            reported_failures = set()
            for failure in sns_failures:
                if failure in reported_failures:
                    continue
                reported_failures.add(failure)
                _log(f" - {failure}")
            if FAIL_ON_SNS_ERROR:
                _log("FAIL_ON_SNS_ERROR=true のため、ジョブを失敗として終了します。")
                sys.exit(1)

        _log("\nSNS自動投稿ジョブが完了しました。")

if __name__ == "__main__":
    main()
