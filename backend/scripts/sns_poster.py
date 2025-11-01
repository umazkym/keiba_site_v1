#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# --- 先にプロジェクトルートを推定して sys.path を伸ばす（database モジュール検出用） ---
def get_project_root_default():
    """Render環境とローカル環境の両方で正しくプロジェクトルートを取得"""
    if os.getenv("RENDER"):
        return "/app"
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
from typing import Optional, List, Dict, Any
import traceback
from PIL import Image, ImageDraw, ImageFont
import psycopg2
from contextlib import contextmanager
import hashlib
import importlib
import importlib.util
from types import ModuleType

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
        if not os.getenv("RENDER"):
            print(f"警告: .envファイルが見つかりません。")

# --- 2. 環境変数と定数の定義 ---
DATABASE_URL = os.getenv("DATABASE_URL")
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
IMAGE_OUTPUT_DIR = "/tmp" if os.getenv("RENDER") else os.path.join(PROJECT_ROOT, "sns_images_dist")
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)
SITE_BASE_URL = "https://uma-free.com"
API_BASE_URL = "https://keiba-site-v1.onrender.com"
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

# 重賞レース判定リスト (変更なし)
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
    """Render環境とローカル環境の両方で正しくフォントパスを取得"""
    if os.getenv("RENDER"):
        font_dir = "/app/fonts"
    else:
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

def record_post(content: str, post_type: str, target_date: str) -> None:
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
        new_post = models.SnsPost(
            content_hash=content_hash,
            post_type=post_type,
            posted_at=datetime.now(timezone(timedelta(hours=9))),
            target_date=target_date
        )
        db.add(new_post)
        db.commit()
        _log(f"✅ 投稿記録を保存: {post_type} ({target_date})")
    except Exception as e:
        _log(f"⚠️ 投稿記録の保存に失敗: {e}")
        db.rollback()
    finally:
        db.close()

# --- 5. API連携関数 (変更なし) ---
def get_api_data(endpoint: str, retries: int = 3, delay: int = 5) -> Optional[Any]:
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
                    _log("-> データなし (空のレスポンス)")
                    return None
            elif res.status_code == 404:
                _log("-> データなし (404 Not Found)")
                return None
            else:
                _log(f"-> データ取得失敗 (Status: {res.status_code})")
        except requests.RequestException as e:
            _log(f"-> API接続エラー (試行 {attempt + 1}/{retries}): {e}")
        if attempt < retries - 1:
            time.sleep(delay)
    return None

# --- 6. OGP画像生成関数群 (変更なし) ---
def generate_hit_og_image(hit_data: dict, date_str: str) -> Optional[str]:
    """的中報告用の画像を生成する"""
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
        race_info_text = f"{hit_data['venue_name']} {hit_data['race_number']}R"
        draw_centered_text(draw, race_info_text, ImageFont.truetype(font_regular, 32), TEXT_COLOR_LIGHT, 1200, 240)

        # 馬券種類
        draw_centered_text(draw, hit_data['bet_type'], ImageFont.truetype(font_bold, 48), TEXT_COLOR_LIGHT, 1200, 290)

        # 配当金額
        payout_text = f"¥{hit_data['payout']:,}"
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
        race_info_text = f"{data['venue_name']} {data['race_number']}R"
        draw_centered_text(draw, race_info_text, ImageFont.truetype(font_regular, 28), TEXT_COLOR_LIGHT, 1200, 220)
        draw_centered_text(draw, data['race_name'], ImageFont.truetype(font_light, 24), TEXT_COLOR_MUTED, 1200, 260)

        # 馬名
        draw_centered_text(draw, data['horse_name'], ImageFont.truetype(font_black, 84), TEXT_COLOR_LIGHT, 1200, 320)

        # AI偏差値
        draw.line([(450, 450), (750, 450)], fill=TEXT_COLOR_MUTED, width=1)
        deviation_score_text = f"{data['deviation_score']:.1f}"
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
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race['id']}_{random.randint(1000,9999)}.png")
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
        draw_centered_text(draw, race['race_name'], ImageFont.truetype(font_black, 64), TEXT_COLOR_LIGHT, 1200, 150)
        
        # 開催情報
        venue_info = f"{race['venue_name']} {datetime.strptime(race['race_date'], '%Y-%m-%d').strftime('%m/%d')}"
        draw_centered_text(draw, venue_info, ImageFont.truetype(font_light, 28), TEXT_COLOR_MUTED, 1200, 240)

        # 予測リスト
        y_start, y_step = 320, 80
        marks, colors = ["◎", "○", "▲"], [COLOR_GOLD, COLOR_SILVER, COLOR_BRONZE]
        mark_font = ImageFont.truetype(font_black, 40)
        horse_font = ImageFont.truetype(font_bold, 36)
        score_font = ImageFont.truetype(font_regular, 32)
        
        for i, p in enumerate(top_preds):
            y_pos = y_start + i * y_step
            # Mark
            draw.text((350, y_pos), marks[i], font=mark_font, fill=colors[i], anchor="lm")
            # Horse Name
            draw.text((420, y_pos), p['horse_name'], font=horse_font, fill=TEXT_COLOR_LIGHT, anchor="lm")
            # Score
            score_text = f"{p.get('deviation_score', 0):.1f}"
            draw.text((850, y_pos), score_text, font=score_font, fill=TEXT_COLOR_MUTED, anchor="rm")
        
        # フッター情報
        date_str = race['race_date']
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y.%m.%d')
        draw.text((50, 580), date_formatted, font=ImageFont.truetype(font_light, 22), fill=TEXT_COLOR_LIGHT, anchor="ls")

        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Reminder OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

# --- 7. テキスト生成関数群 ---
def create_hit_report_and_summary_tweet(hit: Dict[str, Any], summary: dict, date_str: str) -> str:
    _log("-> 的中報告＋成績サマリーのテキストを生成...")
    hashtags = ["#競馬", "#AI予想", "#万馬券" if hit['payout'] >= 10000 else "#的中", f"#{hit['venue_name']}競馬"]
    return f"""🎯昨日のAI的中速報 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})

【{hit['venue_name']}{hit['race_number']}R {hit['bet_type']}】で

🎉 {hit['payout']:,}円 の高配当を的中しました！

📈昨日のAI本命馬(◎)成績

[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}]

勝率: {summary['win_rate']:.1f}% / 複勝率: {summary['in_money_rate']:.1f}%

▼レース結果とAIの印はこちらから

{SITE_BASE_URL}

{' '.join(hashtags)}

"""

def create_pick_tweet(pick: Dict[str, Any], date_str: str) -> str:
    _log("-> 注目馬のテキストを生成...")
    is_jra = int(pick['race_id'][4:6]) < 30
    hashtags = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬", f"#{pick['horse_name']}"]
    return f"""🏇本日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})

AIが今日のレースで最も高く評価した一頭はこちら！

【{pick['venue_name']}{pick['race_number']}R {pick['race_name']}】

◎ {pick['horse_name']} (AI偏差値: {pick['deviation_score']:.2f})

▼全レースの無料予測

{SITE_BASE_URL}

{' '.join(hashtags)}

"""

def create_reminder_tweet(race: dict, top_preds: List[dict]) -> str:
    _log("-> 重賞レースのテキストを生成...")
    # ★★修正★★: 'date' ではなく 'race_date' を参照する
    date_str = race['race_date']
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race['race_name']).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    lines = [f"🏇本日の重賞 ({race['race_name']}) AI予測\n"]
    for i, p in enumerate(top_preds):
        lines.append(f"{['◎','○','▲'][i]} {p['horse_name']} (AI偏差値: {p.get('deviation_score', 0):.2f})")
    lines.append(f"\n▼詳細なデータはこちら\n{SITE_BASE_URL}")
    lines.append(f"\n{' '.join(hashtags)}")
    return "\n".join(lines)

# --- 8. X (Twitter) 投稿関数 (文字数制限対応版) ---
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
            # 2番目のハッシュタグの前で分割（1番目のハッシュタグはツイート1に含める）
            split_point = hashtag_indices[1]
        else:
            # ハッシュタグがない場合は中点で分割
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

def post_to_twitter_with_dual_images(tweet_text_1: str, tweet_text_2: str, image_path_1: Optional[str] = None, image_path_2: Optional[str] = None, post_type: str = "", target_date: str = "") -> bool:
    """
    2つのツイートテキストを受け取り、各投稿に異なる画像を添付して投稿する。
    ツイート1に image_path_1、ツイート2に image_path_2 を使用。
    """
    _log("-> X (Twitter) への投稿を実行...")

    tweet_texts = [tweet_text_1, tweet_text_2]
    _log(f"{len(tweet_texts)} 個のツイートを投稿します")

    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません。")
        for i, tweet_text in enumerate(tweet_texts, 1):
            _log(f"--- ツイート {i}/{len(tweet_texts)} プレビュー ---\n{tweet_text}\n--- /プレビュー ---")
        if image_path_1:
            _log(f"画像1パス: {image_path_1}")
        if image_path_2:
            _log(f"画像2パス: {image_path_2}")
        return True

    try:
        auth_v1 = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth_v1)
        client_v2 = tweepy.Client(consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET,
                                    access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)

        # 画像パスのリスト
        image_paths = [image_path_1, image_path_2]

        for idx, tweet_text in enumerate(tweet_texts, 1):
            media_ids = []

            # 対応する画像を添付
            image_path = image_paths[idx - 1] if idx - 1 < len(image_paths) else None
            if image_path and os.path.exists(image_path):
                try:
                    _log(f"画像をアップロードしています (ツイート {idx}): {image_path}")
                    media = api_v1.media_upload(filename=image_path)
                    media_ids.append(media.media_id)
                except Exception as img_error:
                    _log(f"⚠️ 画像アップロードに失敗しました: {img_error}。テキストのみで投稿します。")

            _log(f"ツイート {idx}/{len(tweet_texts)} を投稿しています...")

            # 独立した投稿として投稿
            response = client_v2.create_tweet(
                text=tweet_text,
                media_ids=media_ids if media_ids else None
            )

            _log(f"✅ ツイート {idx} の投稿に成功しました！")
            _log(f" - URL: https://x.com/anyuser/status/{response.data['id']}")

            # API呼び出しの間隔を設けて制限を回避
            if idx < len(tweet_texts):
                time.sleep(1)

        return True
    except tweepy.errors.TweepyException as e:
        _log(f"\n❌エラー: Twitter APIでエラーが発生しました。詳細: {e}")
        return False
    except Exception as e:
        _log(f"\n❌予期せぬエラーが発生しました: {e}\n{traceback.format_exc()}")
        return False

def post_to_twitter(text: str, image_path: Optional[str] = None, post_type: str = "", target_date: str = "", split_mode: bool = True) -> bool:
    """
    テキストと画像をツイートする。
    split_mode=True の場合、テキストを必ず2つに分割して投稿する。
    split_mode=False の場合、テキストをそのまま1つのツイートで投稿する。
    各投稿に同じ画像を添付する（スレッド形式ではなく独立した投稿）。
    """
    _log("-> X (Twitter) への投稿を実行...")

    # テキストを分割（split_mode=Trueの場合のみ）
    if split_mode:
        tweet_texts = split_tweet_text(text, max_length=280, force_split=True)
        _log(f"テキストを {len(tweet_texts)} 個のツイートに分割します")
    else:
        tweet_texts = [text]
        _log(f"テキストを1個のツイートとして投稿します")

    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません。")
        for i, tweet_text in enumerate(tweet_texts, 1):
            _log(f"--- ツイート {i}/{len(tweet_texts)} プレビュー ---\n{tweet_text}\n--- /プレビュー ---")
        if image_path:
            _log(f"画像パス: {image_path}")
        return True

    try:
        auth_v1 = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth_v1)
        client_v2 = tweepy.Client(consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET,
                                    access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)

        for idx, tweet_text in enumerate(tweet_texts, 1):
            media_ids = []

            # すべてのツイートに画像を添付
            if image_path and os.path.exists(image_path):
                try:
                    _log(f"画像をアップロードしています (ツイート {idx}): {image_path}")
                    media = api_v1.media_upload(filename=image_path)
                    media_ids.append(media.media_id)
                except Exception as img_error:
                    _log(f"⚠️ 画像アップロードに失敗しました: {img_error}。テキストのみで投稿します。")

            _log(f"ツイート {idx}/{len(tweet_texts)} を投稿しています...")

            # 独立した投稿として投稿（スレッド形式ではない）
            response = client_v2.create_tweet(
                text=tweet_text,
                media_ids=media_ids if media_ids else None
            )

            _log(f"✅ ツイート {idx} の投稿に成功しました！")
            _log(f" - URL: https://x.com/anyuser/status/{response.data['id']}")

            # API呼び出しの間隔を設けて制限を回避
            if idx < len(tweet_texts):
                time.sleep(1)

        return True
    except tweepy.errors.TweepyException as e:
        _log(f"\n❌エラー: Twitter APIでエラーが発生しました。詳細: {e}")
        return False
    except Exception as e:
        _log(f"\n❌予期せぬエラーが発生しました: {e}\n{traceback.format_exc()}")
        return False

# --- 7.5 新しい投稿用テキスト生成関数 ---
def create_morning_hit_tweet(hit: Dict[str, Any], summary: dict, date_str: str) -> str:
    """朝投稿ツイート1: 昨日の的中報告 + 本命馬成績"""
    _log("-> 朝投稿ツイート1: 的中報告＋本命馬成績のテキストを生成...")

    date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')
    in_money_rate = ((summary['win'] + summary['second'] + summary['third']) / summary['total'] * 100) if summary['total'] > 0 else 0.0

    # ハッシュタグを構築（ツイート1用）
    hashtags_1 = ["#競馬", "#AI予想", "#万馬券" if hit['payout'] >= 10000 else "#的中"]
    venue_name = hit.get('venue_name', '')
    if venue_name:
        hashtags_1.append(f"#{venue_name}競馬")

    lines = [f"🎯昨日のAI的中速報 ({date_formatted})"]
    lines.append(f"\n【{hit['venue_name']}{hit['race_number']}R {hit['bet_type']}】で")
    lines.append(f"\n🎉 {hit['payout']:,}円 の高配当を的中しました！")
    lines.append(f"\n📈昨日のAI本命馬(◎)成績")
    lines.append(f"\n[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}]")
    lines.append(f"\n勝率: {summary['win_rate']:.1f}% / 複勝率: {in_money_rate:.1f}%")
    lines.append(f"\n▼レース結果とAIの印はこちらから")
    lines.append(f"\n{SITE_BASE_URL}")
    lines.append(f"\n{' '.join(hashtags_1)}")

    return "\n".join(lines)

def create_morning_pick_tweet(pick: Dict[str, Any], date_str: str) -> str:
    """朝投稿ツイート2: 本日のAI注目馬"""
    _log("-> 朝投稿ツイート2: 本日のAI注目馬のテキストを生成...")

    date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')

    # 競馬タイプを判定（JRA中央競馬 vs NAR地方競馬）
    # venue_name で直接判定する方がより確実
    venue_name = pick.get('venue_name', '')

    # JRA中央競馬場: 札幌、函館、福島、新潟、東京、中山、京都、阪神
    jra_venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '京都', '阪神']
    is_jra = any(jra_venue in venue_name for jra_venue in jra_venues)

    # ハッシュタグを構築（ツイート2用）- ツイート1とは異なるハッシュタグ
    hashtags_2 = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬"]
    pick_horse_name = pick.get('horse_name', '')
    if pick_horse_name:
        hashtags_2.append(f"#{pick_horse_name}")

    lines = [f"🐎本日のAI注目馬 ({date_formatted})"]
    lines.append(f"\nAIが今日のレースで最も高く評価した一頭はこちら！")
    lines.append(f"\n【{pick['venue_name']}{pick['race_number']}R {pick.get('race_name', '')}】")
    lines.append(f"\n◎ {pick['horse_name']} (AI偏差値: {pick['deviation_score']:.2f})")
    lines.append(f"\n▼全レースの無料予測")
    lines.append(f"\n{SITE_BASE_URL}")
    lines.append(f"\n{' '.join(hashtags_2)}")

    return "\n".join(lines)

def create_afternoon_race_summary_tweet(all_races_today: dict, yesterday_hits: List[Dict], date_str: str) -> str:
    """昼投稿: 本日のレース一覧 + 昨日の的中ランキング"""
    _log("-> 昼投稿: 本日のレース一覧テキストを生成...")

    # 本日のレース情報
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
            # JRA/NAR判定
            venue_name = venue.get('venue_name', '')
            jra_venues = ['札幌', '函館', '福島', '新潟', '東京', '中山', '京都', '阪神']
            if any(jra_venue in venue_name for jra_venue in jra_venues):
                jra_races += race_count
            else:
                nar_races += race_count

    # 昨日の高配当を集計
    hit_summary = "昨日の的中実績: 予測あり"
    if yesterday_hits and len(yesterday_hits) > 0:
        hit_summary = f"昨日の最高配当: {yesterday_hits[0].get('venue_name', '?')}{yesterday_hits[0].get('race_number', '?')}R {yesterday_hits[0].get('bet_type', '?')} ¥{yesterday_hits[0].get('payout', 0):,}"

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

    lines.append(f"\n▼詳細データはこちら\n{SITE_BASE_URL}\n")
    lines.append(" ".join(hashtags))

    return "\n".join(lines)

def create_evening_tomorrow_race_tweet(tomorrow_date: str) -> Optional[tuple]:
    """
    夜投稿: 明日の重賞/注目レース分析

    Returns:
        tuple: (tweet_text: str, race_data: dict, top_preds: list) if found, None if not found
    """
    _log("-> 夜投稿: 明日の重賞レース分析テキストを生成...")

    tomorrow_races = get_api_data(tomorrow_date)
    if not tomorrow_races:
        _log("-> APIから明日のレースデータが取得できませんでした")
        return None

    # 重賞レースを検索
    venues = tomorrow_races.get('jra', []) + tomorrow_races.get('nar', [])

    _log(f"-> 明日のレースデータ: JRA {len(tomorrow_races.get('jra', []))}会場, NAR {len(tomorrow_races.get('nar', []))}会場")

    for venue in venues:
        for race in venue.get('races', []):
            race_name = race.get('race_name', '').strip()

            # 重賞レース判定
            is_grade_race = any(grade_race in race_name for grade_race in JRA_GRADE_RACE_NAMES)

            if is_grade_race:
                _log(f"-> 重賞レース発見: {race_name} ({venue.get('venue_name')})")

                preds = sorted([p for p in race.get('predictions', []) if p.get('deviation_score')],
                              key=lambda p: p['deviation_score'], reverse=True)
                top_preds = preds[:3]

                if len(top_preds) >= 3:
                    _log(f"-> 予測データあり (トップ3頭: {', '.join([p.get('horse_name', '?') for p in top_preds])})")

                    lines = [f"🎯明日のレース AI予想"]
                    lines.append(f"\n【{race_name}】")
                    lines.append(f"{race.get('venue_name', '?')}   {datetime.strptime(tomorrow_date, '%Y-%m-%d').strftime('%m/%d')}\n")

                    marks = ['◎', '○', '▲']
                    horse_names = []
                    for i, pred in enumerate(top_preds):
                        horse_name = pred.get('horse_name', '?')
                        horse_names.append(horse_name)
                        lines.append(f"{marks[i]} {horse_name} (AI偏差値: {pred.get('deviation_score', 0):.1f})")

                    # 重賞名を削除（括弧内を削除）してハッシュタグ化
                    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race_name).strip()

                    hashtags = ["#競馬予想", "#AI予想", f"#{clean_race_name}"]
                    # 馬名もハッシュタグに追加
                    for horse_name in horse_names:
                        hashtags.append(f"#{horse_name}")

                    lines.append(f"\n▼詳細はこちら\n{SITE_BASE_URL}\n")
                    lines.append(" ".join(hashtags))

                    tweet_text = "\n".join(lines)

                    # レースデータとトップ予測を一緒に返す
                    return (tweet_text, race, top_preds)
                else:
                    _log(f"-> 重賞レース {race_name} の予測データが不足 (予測数: {len(top_preds)})")
            else:
                # デバッグ用: 重賞以外のレース名をログに出力（最初の5レースのみ）
                pass

    _log("-> 明日の重賞レースが見つかりませんでした")
    return None

# --- 9. メイン処理 ---
def main():
    """SNS投稿のメイン処理（投稿タイプに応じて処理を分岐）"""
    _log("="*50)
    _log("SNS自動投稿ジョブを開始します (3投稿体制対応版)")
    _log("="*50)

    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        _log("⚠️ Twitter API認証情報が読み込めませんでした。処理を終了します。")
        sys.exit(1)

    # コマンドライン引数で投稿タイプを取得
    parser = argparse.ArgumentParser(description='SNS投稿スクリプト')
    parser.add_argument('--post-type', type=str, default='morning', choices=['morning', 'afternoon', 'evening'],
                       help='投稿タイプ: morning(朝), afternoon(昼), evening(夜)')
    args = parser.parse_args()
    post_type = args.post_type

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

            if hits_data and hits_data[0].get('payout', 0) >= 10000:
                summary = {'win': 0, 'second': 0, 'third': 0, 'other': 0, 'total': 0, 'win_rate': 0.0, 'in_money_rate': 0.0}
                all_races_data_yesterday = get_api_data(yesterday_str)

                if all_races_data_yesterday:
                    _log("-> 昨日の本命馬成績を集計中...")
                    venues = all_races_data_yesterday.get('jra', []) + all_races_data_yesterday.get('nar', [])
                    for venue in venues:
                        for race in venue.get('races', []):
                            if race.get('predictions') and race.get('results'):
                                honmei = next((p for p in race['predictions'] if p.get('mark') == '◎'), None)
                                if honmei and honmei.get('horse_number') is not None:
                                    result = next((r for r in race['results'] if r.get('horse_number') == honmei.get('horse_number')), None)
                                    if result and isinstance(result.get('rank'), int) and result.get('rank') > 0:
                                        summary['total'] += 1
                                        rank = result['rank']
                                        if rank == 1: summary['win'] += 1
                                        elif rank == 2: summary['second'] += 1
                                        elif rank == 3: summary['third'] += 1
                                        else: summary['other'] += 1
                    if summary['total'] > 0:
                        summary['win_rate'] = (summary['win'] / summary['total'] * 100)
                        summary['in_money_rate'] = ((summary['win'] + summary['second'] + summary['third']) / summary['total'] * 100)

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
                                sorted_preds = sorted([p for p in preds if p.get('deviation_score')],
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

                    # ツイート1と2を個別に生成
                    tweet_text_1 = create_morning_hit_tweet(hits_data[0], summary, yesterday_str)
                    tweet_text_2 = create_morning_pick_tweet(pick_data, today_str)

                    # 2つのツイートテキストを直接渡して投稿（分割なし）
                    post_to_twitter_with_dual_images(tweet_text_1, tweet_text_2, image_file_1, image_file_2, post_type="morning_combined", target_date=today_str)
            else:
                _log("-> 昨日は1万円以上の高配当的中がなかったため、投稿をスキップします。")

        # ========== 昼12時投稿 ==========
        elif post_type == 'afternoon':
            _log("\n--- 昼投稿: 本日のレース一覧 + 昨日のAI的中ランキング ---")
            all_races_today = get_api_data(today_str)
            yesterday_hits = get_api_data(f"hits/high-payouts/{yesterday_str}")

            if all_races_today:
                tweet_text = create_afternoon_race_summary_tweet(all_races_today, yesterday_hits if yesterday_hits else [], today_str)
                post_to_twitter(tweet_text, image_path=None, post_type="afternoon_summary", target_date=today_str, split_mode=False)
            else:
                _log("-> 本日のレース情報が取得できませんでした。")

        # ========== 夜20時投稿 ==========
        elif post_type == 'evening':
            _log("\n--- 夜投稿: 明日の重賞/注目レース分析 ---")
            result = create_evening_tomorrow_race_tweet(tomorrow_str)

            if result:
                # resultがtupleの場合、展開して使用
                tweet_text, race_data, top_preds = result

                _log(f"-> 重賞レースの投稿準備完了: {race_data.get('race_name', '?')}")

                # 画像生成
                image_file = generate_reminder_og_image(race_data, top_preds)

                if image_file:
                    _log(f"-> 画像生成成功: {image_file}")
                    # 投稿実行
                    post_to_twitter(tweet_text, image_file, post_type="evening_race", target_date=tomorrow_str, split_mode=False)
                else:
                    _log("-> 画像生成に失敗しましたが、テキストのみで投稿します")
                    # 画像なしで投稿
                    post_to_twitter(tweet_text, None, post_type="evening_race", target_date=tomorrow_str, split_mode=False)
            else:
                _log("-> 明日は対象の重賞レースがありませんでした。")

        _log("\nSNS自動投稿ジョブが完了しました。")

if __name__ == "__main__":
    main()
