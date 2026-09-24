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
import psycopg2
from contextlib import contextmanager

from core.race_name import display_race_name
from pathlib import Path
import hashlib
import importlib
import importlib.util
from types import ModuleType
import unicodedata

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

# 投稿文と画像（デザイン改修 2026-09。絵文字を使わない・Xの文字数はXの数え方）
from scripts import sns_content as SC  # noqa: E402
from scripts import sns_images as SI  # noqa: E402

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
# Threads に画像を付けるか（off：文字だけ／public：非公開GCSに一時配置した画像の署名URLを渡す）。
# 署名には、Workflowのサービスアカウントが自分自身に「サービス アカウント トークン作成者」を持つ必要がある。
THREADS_IMAGE_MODE = (_env_value("SNS_THREADS_IMAGE_MODE", default="off") or "off").strip().lower()
THREADS_IMAGE_SIGNED_URL_DURATION = "2h"


@dataclass
class ThreadsPostResult:
    ok: bool
    attempted: bool = True
    post_id: Optional[str] = None
    transient: bool = False
    reason: str = ""

    def __bool__(self) -> bool:
        return self.ok


def build_race_url(date_str: str) -> str:
    """その日のレース一覧ページURLを返す。

    クエリは付けない。/races/ 配下はクエリが1つでもあると
    ミドルウェアが301でクエリごと落とすため、付けても届かない。
    """
    return SC.build_race_url(date_str)


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
def display_name(raw_name: Any) -> str:
    """投稿本文と画像に出すレース名を返す。

    DBのレース名は末尾にグレード表記（重賞 / OP / Jpn3）が貼り付いていたり、
    netkeiba側の打ち切りで閉じ括弧を欠いていたりする。
    表示に使う場所はすべてこれを通す。
    """
    return display_race_name(str(raw_name or ""))


def hashtag_race_name(raw_name: Any) -> str:
    """ハッシュタグに使うレース名を返す。

    表示名から補足の括弧書きを外す。整形前の名前に対して括弧を外そうとすると
    「スパーキングサマーカップ【地方交重賞」のように閉じ括弧が無い場合に
    何も除去されず、壊れたタグがそのまま投稿されてしまう。
    """
    name = display_name(raw_name)
    if not name or name == "?":
        return ""
    return re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', name).strip()


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


def threads_images_enabled() -> bool:
    return THREADS_IMAGE_MODE == "public"


def _stage_threads_image(image_path: Optional[str]):
    """画像を非公開GCSへ一時配置し、(stager, 署名URL) を返す。失敗したら (stager, None)。"""
    if not image_path or not threads_images_enabled() or not os.path.exists(image_path):
        return None, None
    try:
        from scripts.social_video.gcs_staging import GcsMediaStager

        stager = GcsMediaStager(duration=THREADS_IMAGE_SIGNED_URL_DURATION)
        digest = hashlib.sha256(Path(image_path).read_bytes()).hexdigest()[:16]
        day = datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
        staged = stager.stage(Path(image_path), f"sns/{day}/threads-{digest}{Path(image_path).suffix}")
        return stager, staged.signed_url
    except Exception as error:
        # 署名URLはログに出さない
        _log(f"⚠️ Threads用の画像を一時配置できなかったため、文字だけで投稿します: {str(error)[:300]}")
        return None, None


def _wait_threads_container(base_headers: Dict[str, str], container_id: str, attempts: int = 10, delay: int = 3) -> bool:
    """画像のコンテナが公開できる状態になるまで待つ。"""
    for _ in range(attempts):
        try:
            res = requests.get(
                f"https://graph.threads.net/v1.0/{container_id}",
                headers=base_headers,
                params={"fields": "status,error_message"},
                timeout=15,
            )
            if res.status_code == 200:
                status = str(res.json().get("status") or "").upper()
                if status in {"FINISHED", "PUBLISHED"}:
                    return True
                if status in {"ERROR", "EXPIRED"}:
                    _log(f"⚠️ Threadsの画像コンテナが処理できませんでした: {res.json().get('error_message') or status}")
                    return False
        except Exception as error:
            _log(f"⚠️ Threadsの画像コンテナの状態確認に失敗しました: {error}")
        time.sleep(delay)
    return False


def post_to_threads(text: str, image_path: Optional[str] = None) -> ThreadsPostResult:
    """Threadsへ投稿する。SNS_THREADS_IMAGE_MODE=public のときだけ画像を付け、画像の準備に失敗したら文字だけで投稿する。"""
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
    text = truncate_for_threads(text)

    if DRY_RUN:
        attach = "画像つき" if image_path and threads_images_enabled() else "文字だけ"
        _log(f"[DRY_RUN] Threads投稿スキップ（{attach}）:\n{text}")
        if image_path:
            _log(f"  画像: {image_path}")
        return ThreadsPostResult(ok=True, post_id="dry_run_threads_id", reason="DRY_RUN")

    base_url = f"https://graph.threads.net/v1.0/{THREADS_USER_ID}"
    headers = {"Authorization": f"Bearer {THREADS_ACCESS_TOKEN}"}
    last_result = ThreadsPostResult(ok=False, reason="Threads投稿が完了しませんでした")
    stager, image_url = _stage_threads_image(image_path)

    try:
        for attempt in range(1, THREADS_POST_MAX_RETRIES + 1):
            try:
                payload = (
                    {"media_type": "IMAGE", "image_url": image_url, "text": text}
                    if image_url
                    else {"media_type": "TEXT", "text": text}
                )
                res = requests.post(
                    f"{base_url}/threads",
                    headers=headers,
                    data=payload,
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
                    if image_url and not transient:
                        # 画像を受け付けなかったときは、まだ何も公開していないので文字だけでやり直す
                        _log("  → 画像を外して文字だけで投稿し直します。")
                        image_url = None
                        continue
                    last_result = ThreadsPostResult(ok=False, transient=transient, reason=reason)
                    if transient and attempt < THREADS_POST_MAX_RETRIES:
                        _sleep_before_threads_retry(attempt)
                        continue
                    return last_result

                container_id = res.json().get("id")
                if not container_id:
                    _log("❌ Threadsコンテナ作成: レスポンスにIDが含まれていません")
                    return ThreadsPostResult(ok=False, transient=False, reason="ThreadsコンテナIDなし")

                if image_url:
                    if not _wait_threads_container(headers, str(container_id)):
                        _log("  → 画像の処理が終わらないため、文字だけで投稿し直します。")
                        image_url = None
                        continue
                else:
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
                _log(f"✅ Threads投稿成功{'（画像つき）' if image_url else ''}! ID: {post_id}")
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
    finally:
        if stager is not None:
            for failure in stager.cleanup():
                _log(f"⚠️ Threads用の一時画像を削除できませんでした（2日後に自動で消えます）: {failure[:200]}")


def post_texts_to_threads_results(
    texts: List[str],
    delay_seconds: int = 3,
) -> List[ThreadsPostResult]:
    """複数テキストをThreadsへ独立投稿し、各投稿の結果を返す。"""
    results: List[ThreadsPostResult] = []
    for idx, text in enumerate(texts, 1):
        _log(f"Threads投稿 {idx}/{len(texts)} を実行します。")
        result = post_to_threads(text)
        results.append(result)
        if idx < len(texts) and delay_seconds > 0:
            time.sleep(delay_seconds)
    return results


def post_texts_to_threads(
    texts: List[str],
    delay_seconds: int = 3,
) -> int:
    """複数テキストをThreadsへ独立投稿し、成功件数を返す。"""
    results = post_texts_to_threads_results(texts, delay_seconds=delay_seconds)
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
# --- 6. 画像（sns_images.py）---
def _image_path(prefix: str, key: str, suffix: str) -> str:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:10]
    return os.path.join(IMAGE_OUTPUT_DIR, f"{prefix}_{digest}{suffix}")


def render_sns_image(renderer, data: Any, prefix: str, key: str, suffix: str = ".png", **kwargs: Any) -> Optional[str]:
    """画像を作る。失敗しても投稿は文字だけで続けられるよう、例外は記録して None を返す。"""
    path = _image_path(prefix, key, suffix)
    try:
        result = renderer(data, path, **kwargs)
        _log(f"-> 画像を生成: {result}")
        return result
    except Exception as error:
        _log(f"❌ 画像の生成に失敗しました（{prefix}）: {error}\n{traceback.format_exc()}")
        return None


def render_threads_image(renderer, data: Any, prefix: str, key: str, **kwargs: Any) -> Optional[str]:
    """Threads用の縦長の画像。画像を付けない設定のときは作らない。"""
    if not threads_images_enabled():
        return None
    return render_sns_image(renderer, data, prefix, key, ".jpg", **kwargs)


def same_race_hits(hits: List[Dict[str, Any]], top: Dict[str, Any], fallback_date: str) -> List[SC.HitCard]:
    race_id = top.get("race_id")
    return [
        SC.hit_card_from_api(hit, fallback_date)
        for hit in hits
        if hit is not top and race_id and hit.get("race_id") == race_id
    ]


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
                if (
                    previous.startswith("▼")
                    or previous in SC.LINK_LABELS
                    or "こちら" in previous
                    or "無料予測" in previous
                ):
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
    length_fn=len,
) -> str:
    """XとThreadsで同じ印象になるよう、短いSNS本文に丸める。長さは length_fn で数える（XはXの数え方）。"""
    measure = length_fn
    if measure(text) <= max_chars:
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
    reserved = measure("\n") + measure(suffix)
    trailing_blocks = []
    if url_lines:
        trailing_blocks.append("\n".join(url_lines))
    if hashtag_line:
        trailing_blocks.append(hashtag_line)

    while trailing_blocks and reserved + sum(measure("\n\n") + measure(block) for block in trailing_blocks) > max_chars:
        if hashtag_line and trailing_blocks[-1] == hashtag_line:
            trailing_blocks.pop()
            hashtag_line = ""
        elif len(url_lines) > 1:
            url_lines = url_lines[:1]
            trailing_blocks = ["\n".join(url_lines)] + ([hashtag_line] if hashtag_line else [])
        else:
            break

    reserved += sum(measure("\n\n") + measure(block) for block in trailing_blocks)

    fitted_lines: List[str] = []
    current_len = 0
    for line in content_lines:
        next_len = measure(line) if not fitted_lines else current_len + 1 + measure(line)
        if next_len + reserved > max_chars:
            break
        fitted_lines.append(line)
        current_len = next_len

    if not fitted_lines:
        base_limit = max_chars - reserved
        first_line = content_lines[0] if content_lines else ""
        while first_line and measure(first_line) > max(base_limit, 1):
            first_line = first_line[:-1]
        fitted_lines = [first_line.rstrip()] if first_line else []

    fitted = "\n".join(fitted_lines).rstrip()
    if fitted and not fitted.endswith(suffix):
        fitted = f"{fitted}\n{suffix}"
    for block in trailing_blocks:
        if block and measure(f"{fitted}\n\n{block}") <= max_chars:
            fitted = f"{fitted}\n\n{block}"

    _log(f"{channel_name}投稿用に本文を{max_chars}文字以内へ調整しました。")
    return fitted.strip() or text[:max_chars // 2]


def prepare_short_social_text(
    text: str,
    channel_name: str,
    remove_urls: bool = True,
    max_chars: int = SHORT_SOCIAL_MAX_CHARS,
) -> str:
    """投稿先に合わせて本文を整える。Xは日本語を2文字・URLを23文字と数える（Xの数え方）。"""
    sanitized = sanitize_text_for_short_social_post(text, channel_name, remove_urls=remove_urls)
    length_fn = SC.x_weighted_length if channel_name == "X" else len
    return fit_text_for_short_social_post(
        sanitized,
        channel_name,
        max_chars=max_chars,
        preserve_urls=not remove_urls,
        length_fn=length_fn,
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

# --- 7.5 SNSごとの投稿 ---
def post_to_threads_with_images(
    items: List[tuple[str, Optional[str]]],
    delay_seconds: int = 3,
) -> List[ThreadsPostResult]:
    """(本文, 画像) の組を順にThreadsへ投稿する。"""
    results: List[ThreadsPostResult] = []
    for idx, (text, image_path) in enumerate(items, 1):
        _log(f"Threads投稿 {idx}/{len(items)} を実行します。")
        results.append(post_to_threads(text, image_path))
        if idx < len(items) and delay_seconds > 0:
            time.sleep(delay_seconds)
    return results


def post_single(
    sns_failures: List[str],
    text: str,
    post_type: str,
    target_date: str,
    *,
    x_image: Optional[str] = None,
    threads_image: Optional[str] = None,
    context: str = "",
    post_threads: bool = True,
) -> None:
    """1つの本文をXとThreadsへ投稿し、結果を記録する。"""
    context = context or post_type
    if is_already_posted(text, post_type, target_date):
        _log(f"-> 既に投稿済み: {context}")
        return
    x_result = post_to_twitter(text, x_image, post_type=post_type, target_date=target_date, split_mode=False)
    if post_threads:
        threads_result = post_to_threads(text, threads_image)
    else:
        threads_result = ThreadsPostResult(ok=False, attempted=False, reason="夜のThreadsは動画投稿へ置換")
        _log("-> Threadsのこの投稿は、夜の動画投稿に置き換えているため送りません。")
    threads_ok = bool(threads_result)
    if ENABLE_TWITTER:
        track_x_result(sns_failures, context, x_result, threads_ok=threads_ok)
    if ENABLE_THREADS and post_threads:
        track_threads_result(sns_failures, context, threads_result, x_ok=bool(x_result))
    record_post_if_delivered(text, post_type, target_date, x_result=x_result, threads_ok=threads_ok)
    if not x_result:
        _log("⚠️ X投稿は失敗しましたが、Threads投稿は試行済みです")


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
            _log("\n--- 朝投稿: 前日の的中 + AI本命(◎)の成績 + 本日のAI注目馬 ---")
            hits_data = get_api_data(f"hits/high-payouts/{yesterday_str}")
            top_hit = (
                hits_data[0]
                if isinstance(hits_data, list) and hits_data and (hits_data[0].get('payout', 0) or 0) >= 10000
                else None
            )
            all_races_today = get_api_data(today_str)
            pick_card = SC.find_best_pick(all_races_today, today_str)
            if pick_card:
                _log(f"-> AI注目馬: {pick_card.pick.name} (AI偏差値: {pick_card.pick.score:.1f}、全{pick_card.total_races}レース)")

            if top_hit and pick_card:
                _log("-> 前日のAI本命(◎)の成績を集計中...")
                summary = summarize_honmei_results_from_db(yesterday_str)
                if summary is None:
                    summary = summarize_honmei_results_from_api(get_api_data(yesterday_str))
                hit_card = SC.hit_card_from_api(top_hit, yesterday_str)
                others = same_race_hits(hits_data, top_hit, yesterday_str)
                tweet_text_1 = SC.build_hit_text(hit_card, summary)
                tweet_text_2 = SC.build_pick_text(pick_card)
                key_1, key_2 = f"hit:{yesterday_str}:{top_hit.get('race_id')}", f"pick:{today_str}"
                image_file_1 = render_sns_image(SI.render_x_hit, hit_card, "x_hit", key_1, others=others[:2])
                image_file_2 = render_sns_image(SI.render_x_pick, pick_card, "x_pick", key_2)
                threads_image_1 = render_threads_image(SI.render_threads_hit, hit_card, "th_hit", key_1, others=others[:3])
                threads_image_2 = render_threads_image(SI.render_threads_pick, pick_card, "th_pick", key_2)

                # 朝の2投稿は、結合した本文で1回だけ実行する
                combined_check_text = tweet_text_1 + "\n---\n" + tweet_text_2
                if is_already_posted(combined_check_text, "morning_combined", today_str):
                    _log("-> 既に投稿済み: morning_combined")
                else:
                    x_result = post_to_twitter_with_dual_images(tweet_text_1, tweet_text_2, image_file_1, image_file_2, post_type="morning_combined", target_date=today_str)
                    threads_results = post_to_threads_with_images(
                        [(tweet_text_1, threads_image_1), (tweet_text_2, threads_image_2)],
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
            elif pick_card:
                _log("-> 前日は1万円以上の高配当的中がありませんでした。本日のAI注目馬だけを投稿します。")
                key = f"pick:{today_str}"
                post_single(
                    sns_failures,
                    SC.build_pick_text(pick_card),
                    "morning_pick_only",
                    today_str,
                    x_image=render_sns_image(SI.render_x_pick, pick_card, "x_pick", key),
                    threads_image=render_threads_image(SI.render_threads_pick, pick_card, "th_pick", key),
                )
            elif top_hit:
                _log("-> 本日のレースデータが無いため、前日の的中だけを投稿します。")
                hit_card = SC.hit_card_from_api(top_hit, yesterday_str)
                others = same_race_hits(hits_data, top_hit, yesterday_str)
                key = f"hit:{yesterday_str}:{top_hit.get('race_id')}"
                post_single(
                    sns_failures,
                    SC.build_hit_text(hit_card),
                    "morning_hit_only",
                    today_str,
                    x_image=render_sns_image(SI.render_x_hit, hit_card, "x_hit", key, others=others[:2]),
                    threads_image=render_threads_image(SI.render_threads_hit, hit_card, "th_hit", key, others=others[:3]),
                )
            else:
                _log("-> 前日の的中も本日のレースデータも無いため、投稿をスキップします。")

        # ========== 昼12時投稿 ==========
        elif post_type == 'afternoon':
            _log("\n--- 昼投稿: 本日の開催 + 前日の最高配当 ---")
            all_races_today = get_api_data(today_str)
            yesterday_hits = get_api_data(f"hits/high-payouts/{yesterday_str}")
            top_hit = (
                SC.hit_card_from_api(yesterday_hits[0], yesterday_str)
                if isinstance(yesterday_hits, list) and yesterday_hits
                else None
            )
            tweet_text = SC.build_day_summary_text(today_str, all_races_today, top_hit)
            if tweet_text:
                # 昼の投稿は文字だけ。Threadsも従来どおり投稿する（夜の動画への置き換えは20時だけ）
                post_single(sns_failures, tweet_text, "afternoon_summary", today_str)
            else:
                _log("-> 本日のレース情報が取得できませんでした。")

        # ========== 夜20時投稿 ==========
        elif post_type == 'evening':
            _log("\n--- 夜投稿: 明日の全重賞レース分析 ---")
            grade_cards = SC.find_grade_races(get_api_data(tomorrow_str), tomorrow_str, min_scored=3)

            if grade_cards:
                _log(f"-> {len(grade_cards)}件の重賞レースを投稿します")
                if THREADS_EVENING_VIDEO_REPLACES_TEXT:
                    _log("-> SOCIAL_VIDEO_THREADS_MODE=public のため、Threadsへは送らず動画投稿に任せます（Xは投稿します）。")
                headline = f"{SC.date_label(tomorrow_str)}の重賞"
                for idx, card in enumerate(grade_cards):
                    _log(f"\n-> [{idx+1}/{len(grade_cards)}] 重賞レースの投稿準備: {card.race_name}")
                    key = f"race:{tomorrow_str}:{card.race_id or card.venue + str(card.race_number)}"
                    post_single(
                        sns_failures,
                        SC.build_race_text(card, headline),
                        "evening_race",
                        tomorrow_str,
                        x_image=render_sns_image(SI.render_x_race, card, "x_race", key),
                        threads_image=None if THREADS_EVENING_VIDEO_REPLACES_TEXT else render_threads_image(SI.render_threads_race, card, "th_race", key),
                        context=f"evening_race:{card.race_name}",
                        post_threads=not THREADS_EVENING_VIDEO_REPLACES_TEXT,
                    )

                    # 次の重賞投稿まで120秒待機（スレッド化防止 + レート制限対策）
                    if idx < len(grade_cards) - 1:
                        _log("-> 次の重賞投稿まで120秒待機...")
                        time.sleep(120)
            else:
                _log("-> 明日は対象の重賞レースがありませんでした。")

        # ========== 週末直前(14:00)投稿 ==========
        elif post_type == 'pre_race':
            _log("\n--- 直前: 本日の重賞またはメインレース ---")
            cards = [
                card
                for card in SC.iter_race_cards(get_api_data(today_str), today_str)
                if len(card.scored_rows) >= 3
            ]
            grade_cards = sorted((card for card in cards if card.grade), key=lambda card: SC.grade_priority(card.grade))
            target = grade_cards[0] if grade_cards else next((card for card in cards if card.race_number == 11), None)

            if target:
                _log(f"-> 直前の投稿準備: {target.venue}{target.race_number}R {target.race_name}")
                headline = f"{SC.date_label(today_str)} 本日の{'重賞' if target.grade else 'メインレース'}"
                key = f"pre:{today_str}:{target.race_id or target.venue + str(target.race_number)}"
                post_single(
                    sns_failures,
                    SC.build_race_text(target, headline),
                    "pre_race_remind",
                    today_str,
                    x_image=render_sns_image(SI.render_x_race, target, "x_race", key),
                    threads_image=render_threads_image(SI.render_threads_race, target, "th_race", key),
                )
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

            _log(f"-> {len(big_hits)}件の高配当的中を発見")

            for posted_count, hit in enumerate(big_hits[:3], 1):
                hit_card = SC.hit_card_from_api(hit, today_str)
                key = f"hit:{today_str}:{hit.get('race_id')}:{hit_card.bet_type}:{hit_card.winning_numbers}"
                post_single(
                    sns_failures,
                    SC.build_hit_text(hit_card),
                    "hit_immediate",
                    today_str,
                    x_image=render_sns_image(SI.render_x_hit, hit_card, "x_hit", key),
                    threads_image=render_threads_image(SI.render_threads_hit, hit_card, "th_hit", key),
                    context=f"hit_immediate:{hit_card.venue}{hit_card.race_number}R",
                )
                if posted_count < min(len(big_hits), 3):
                    time.sleep(10)

            _log(f"-> 的中速報 {min(len(big_hits), 3)}件の処理を完了")

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
