# backend/scripts/sns_poster.py (Render環境対応版)

import os
import sys
import requests
import tweepy
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import random
import time
import re
from typing import Optional, List, Dict, Any
import traceback
from PIL import Image, ImageDraw, ImageFont

# --- 1. 基本設定とパス解決（Render対応版）---
def get_project_root():
    """Render環境とローカル環境の両方で正しくプロジェクトルートを取得"""
    # Render環境の場合
    if os.getenv("RENDER"):
        # Renderでは /app がプロジェクトルート
        return "/app"
    
    # ローカル環境の場合
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # backend/scripts から プロジェクトルートへ
        return os.path.dirname(os.path.dirname(script_dir))
    except:
        # フォールバック
        return os.getcwd()

PROJECT_ROOT = get_project_root()

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
        # Render環境では環境変数が直接設定されるため警告は不要
        if not os.getenv("RENDER"):
            print(f"警告: .envファイルが見つかりません。")

# --- 2. 環境変数と定数の定義 ---
# .envファイルから読み込んだAPIキーを変数に格納します。
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

# 生成した画像の保存先ディレクトリです。
IMAGE_OUTPUT_DIR = "/tmp" if os.getenv("RENDER") else os.path.join(PROJECT_ROOT, "sns_images_dist")
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)

# 投稿に含めるサイトURLや、データ取得元のAPIサーバーのURLです。
SITE_BASE_URL = "https://uma-free.com"
API_BASE_URL = "https://keiba-site-v1.onrender.com" # ローカルテスト時は "http://127.0.0.1:8000" に変更

# ドライランモード。Trueにすると、実際にXには投稿せず、コンソールに内容を表示するだけで終了します。テスト時に便利です。
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

# 重賞レースを判定するためのリスト。ここに記載された名前がレース名に含まれていると重賞投稿の対象になります。
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
    "ファンタジーS", "ファンタジステークス", "みやこS", "みやこステークス", "武蔵野S", "武蔵野ステークス", "福島記念", "京都2歳S", "京都2歳ステークークス",
    "京阪杯", "鳴尾記念", "中日新聞杯", "カペラS", "カペラステークス", "ターコイズS", "ターコイズステークス"
}

# --- 3. ヘルパー関数群 ---
def _now_str():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")

def _log(msg: str):
    print(f"{_now_str()} {msg}")

def _get_font_path(font_name: str) -> str:
    """Render環境とローカル環境の両方で正しくフォントパスを取得"""
    # Render環境の場合
    if os.getenv("RENDER"):
        font_path = os.path.join("/app", "fonts", font_name)
    else:
        # ローカル環境の場合
        font_path = os.path.join(PROJECT_ROOT, "backend", "fonts", font_name)
    
    if os.path.exists(font_path):
        return font_path
    
    # デバッグ情報を出力
    print(f"[DEBUG] Font not found at: {font_path}")
    print(f"[DEBUG] Current working directory: {os.getcwd()}")
    print(f"[DEBUG] PROJECT_ROOT: {PROJECT_ROOT}")
    print(f"[DEBUG] RENDER env: {os.getenv('RENDER')}")
    
    # フォントディレクトリの内容を確認
    font_dir = os.path.dirname(font_path)
    if os.path.exists(font_dir):
        print(f"[DEBUG] Files in {font_dir}: {os.listdir(font_dir)}")
    else:
        print(f"[DEBUG] Font directory not found: {font_dir}")
    
    raise FileNotFoundError(f"フォントファイルが見つかりません: '{font_path}'")

def draw_centered_text(draw, text, font, fill_color, image_width, y_position, **kwargs):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
    except AttributeError:
        text_width, _ = draw.textsize(text, font=font)
    x_position = (image_width - text_width) / 2
    draw.text((x_position, y_position), text, fill=fill_color, font=font, **kwargs)

def load_logo() -> Optional[Image.Image]:
    try:
        logo_path = _get_font_path("new-logo.png")
        logo = Image.open(logo_path)
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        aspect_ratio = logo.width / logo.height
        new_height = 40
        new_width = int(new_height * aspect_ratio)
        resample_filter = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
        return logo.resize((new_width, new_height), resample_filter)
    except Exception as e:
        _log(f"ロゴ読み込みエラー: {e}")
        return None

# --- 4. API連携関数（修正版）---
def get_api_data(endpoint: str, retries: int = 3, delay: int = 5) -> Optional[Any]:
    _log(f"APIにアクセス中: {endpoint}")
    for attempt in range(retries):
        try:
            url = f"{API_BASE_URL}/api/v1/predictions/{endpoint}"
            res = requests.get(url, timeout=90)
            
            # ステータスコードが200でも、空のリストや空の辞書の場合はNoneとして扱う
            if res.status_code == 200:
                data = res.json()
                # 空でないデータの場合のみ成功とする
                if data and (isinstance(data, list) and len(data) > 0 or 
                           isinstance(data, dict) and data != {}):
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

# --- 5. OGP画像生成関数群 ---
def generate_hit_og_image(hit_data: dict, date_str: str) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_hit_{date_str}_{random.randint(1000,9999)}.png")
    _log(f"-> 的中報告用のOGP画像を生成: {filename}")
    try:
        font_light = _get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = _get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = _get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = _get_font_path("MPLUSRounded1c-Black.ttf")
        
        img = Image.new('RGB', (1200, 630), (79, 70, 229))
        draw = ImageDraw.Draw(img, 'RGBA')
        color_start, color_end = (129, 140, 248), (55, 48, 163)
        
        for y in range(630):
            ratio = y / 629
            r = int(color_start[0] * (1 - ratio) + color_end[0] * ratio)
            g = int(color_start[1] * (1 - ratio) + color_end[1] * ratio)
            b = int(color_start[2] * (1 - ratio) + color_end[2] * ratio)
            draw.line([(0, y), (1200, y)], fill=(r, g, b))
        
        logo = load_logo()
        if logo:
            img.paste(logo, (50, 40), logo)
        
        card_x, card_y, card_w, card_h = 150, 180, 900, 320
        draw.rounded_rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)], radius=20, fill=(255, 255, 255, 230))
        
        label_y = card_y - 25
        draw.rounded_rectangle([(500, label_y), (700, label_y + 50)], radius=25, fill=(79, 70, 229), outline=(255, 255, 255), width=2)
        draw_centered_text(draw, "的中速報", ImageFont.truetype(font_bold, 24), (255, 255, 255), 1200, label_y + 12)
        
        race_text = f"{hit_data['venue_name']} {hit_data['race_number']}R"
        draw_centered_text(draw, race_text, ImageFont.truetype(font_regular, 32), (80, 80, 80), 1200, card_y + 50)
        draw_centered_text(draw, hit_data['bet_type'], ImageFont.truetype(font_bold, 36), (100, 100, 100), 1200, card_y + 100)
        
        payout_text = f"¥{hit_data['payout']:,}"
        draw_centered_text(draw, payout_text, ImageFont.truetype(font_black, 90), (79, 70, 229), 1200, card_y + 180)
        
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y/%m/%d')
        draw.text((50, 550), date_formatted, font=ImageFont.truetype(font_light, 18), fill=(220, 220, 255))
        draw.text((950, 550), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(220, 220, 255))
        
        img.convert('RGB').save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Hit OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_pick_og_image(data: dict, date_str: str) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_pick_{date_str}.png")
    _log(f"-> 注目馬用のOGP画像を生成: {filename}")
    try:
        font_jp_bold_path = _get_font_path("MPLUSRounded1c-Bold.ttf")
        font_jp_black_path = _get_font_path("MPLUSRounded1c-Black.ttf")
        
        img = Image.new('RGB', (1200, 630), (79, 70, 229))
        draw = ImageDraw.Draw(img)
        
        font_title = ImageFont.truetype(font_jp_bold_path, 60)
        font_horse = ImageFont.truetype(font_jp_black_path, 80)
        font_info = ImageFont.truetype(font_jp_bold_path, 40)
        
        draw.text((100, 80), "🏇 今日のAI注目馬 🏇", fill="white", font=font_title)
        draw.text((100, 200), data['horse_name'], fill="white", font=font_horse)
        draw.text((100, 300), f"{data['venue_name']} {data['race_number']}R {data['race_name']}", fill="#dddddd", font=font_info)
        draw.text((100, 360), f"AI偏差値: {data['deviation_score']:.2f}", fill="white", font=font_info)
        
        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Pick OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_reminder_og_image(race: dict, top_preds: list) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race['id']}_{random.randint(1000,9999)}.png")
    _log(f"-> 重賞レース用のOGP画像を生成: {filename}")
    try:
        font_light = _get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = _get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = _get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = _get_font_path("MPLUSRounded1c-Black.ttf")
        
        img = Image.new('RGB', (1200, 630), (30, 40, 80))
        draw = ImageDraw.Draw(img)
        
        for y in range(630):
            ratio = y / 629
            r = int(30 + 20 * ratio)
            g = int(40 + 30 * ratio)
            b = int(80 + 40 * ratio)
            draw.line([(0, y), (1200, y)], fill=(r, g, b))
        
        draw.rectangle([(0, 0), (1200, 4)], fill=(192, 192, 192, 128))
        logo = load_logo()
        if logo:
            img.paste(logo, (50, 40), logo)
        
        draw.text((60, 100), "重賞", font=ImageFont.truetype(font_black, 24), fill=(192, 192, 192))
        draw_centered_text(draw, race['race_name'], ImageFont.truetype(font_black, 60), (255, 255, 255), 1200, 150)
        
        venue_info = f"{race['venue_name']} {datetime.strptime(race['race_date'], '%Y-%m-%d').strftime('%m/%d')}"
        draw_centered_text(draw, venue_info, ImageFont.truetype(font_light, 24), (200, 200, 200), 1200, 230)
        
        y_start, colors, marks = 320, [(255, 255, 100), (200, 200, 255), (255, 200, 200)], ["◎", "○", "▲"]
        for i, p in enumerate(top_preds):
            y_pos = y_start + i * 70
            draw.text((350, y_pos), marks[i], font=ImageFont.truetype(font_black, 36), fill=colors[i])
            draw.text((420, y_pos + 5), p['horse_name'], font=ImageFont.truetype(font_bold, 30), fill=(255, 255, 255))
            score_text = f"{p.get('deviation_score', 0):.1f}"
            draw.text((800, y_pos + 5), score_text, font=ImageFont.truetype(font_regular, 28), fill=(200, 200, 200))
        
        draw.text((950, 550), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(200, 200, 200))
        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Reminder OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

# --- 6. テキスト生成関数群 ---
def create_hit_report_and_summary_tweet(hit: Dict[str, Any], summary: dict, date_str: str) -> str:
    _log("-> 的中報告＋成績サマリーのテキストを生成...")
    hashtags = ["#競馬", "#AI予想", "#万馬券" if hit['payout'] >= 10000 else "#的中", f"#{hit['venue_name']}競馬"]
    return f"""🎯昨日のAI的中速報 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})

【{hit['venue_name']}{hit['race_number']}R {hit['bet_type']}】で
🎉 **{hit['payout']:,}円** の高配当を的中しました！

📈昨日のAI本命馬(◎)成績
[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}]
勝率: {summary['win_rate']:.1f}% / 複勝率: {summary['in_money_rate']:.1f}%

▼レース結果とAIの印はこちら
{SITE_BASE_URL}/races/{date_str}

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
    date_str = race['race_date']
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race['race_name']).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    lines = [f"🏇本日の重賞 ({race['race_name']}) AI予測\n"]
    for i, p in enumerate(top_preds):
        lines.append(f"{['◎','○','▲'][i]} {p['horse_name']} (AI偏差値: {p.get('deviation_score', 0):.2f})")
    lines.append(f"\n▼詳細なデータはこちら\n{SITE_BASE_URL}/races/{date_str}?venue={race['venue_name']}&race={race['race_number']}")
    lines.append(f"\n{' '.join(hashtags)}")
    return "\n".join(lines)

# --- 7. X (Twitter) 投稿関数 ---
def post_to_twitter(text: str, image_path: Optional[str] = None) -> bool:
    _log("-> X (Twitter) への投稿を実行...")
    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません。")
        _log(f"--- 投稿テキストプレビュー ---\n{text}\n--- /プレビュー ---")
        if image_path:
            _log(f"画像パス: {image_path}")
        return True
    try:
        # v1.1 API認証 (メディアアップロード用)
        auth_v1 = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth_v1)

        # v2 API認証 (ツイート投稿用)
        client_v2 = tweepy.Client(consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET, 
                                   access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)

        media_ids = []
        if image_path and os.path.exists(image_path):
            _log(f"画像をアップロードしています: {image_path}")
            media = api_v1.media_upload(filename=image_path)
            media_ids.append(media.media_id)
        
        _log("ツイートを投稿しています...")
        response = client_v2.create_tweet(text=text, media_ids=media_ids if media_ids else None)

        _log("\n🎉 ツイートの投稿に成功しました！")
        _log(f" - URL: https://x.com/anyuser/status/{response.data['id']}")
        return True
    except tweepy.errors.TweepyException as e:
        _log(f"\n❌エラー: Twitter APIでエラーが発生しました。詳細: {e}")
        return False
    except Exception as e:
        _log(f"\n❌予期せぬエラーが発生しました: {e}\n{traceback.format_exc()}")
        return False

# --- 8. メイン処理（Render環境対応版）---
if __name__ == "__main__":
    _log("="*50)
    _log("SNS自動投稿ジョブを開始します (Render環境対応版)")
    _log("="*50)

    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        _log("⚠️ Twitter API認証情報が読み込めませんでした。処理を終了します。")
        sys.exit(1)

    jst = timezone(timedelta(hours=9))
    today, yesterday = datetime.now(jst), datetime.now(jst) - timedelta(days=1)
    today_str, yesterday_str = today.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')
    
    _log("\n--- [フェーズ1/3] 昨日の的中報告と成績サマリーを投稿 ---")
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
                                if rank == 1:
                                    summary['win'] += 1
                                elif rank == 2:
                                    summary['second'] += 1
                                elif rank == 3:
                                    summary['third'] += 1
                                else:
                                    summary['other'] += 1
            if summary['total'] > 0:
                summary['win_rate'] = (summary['win'] / summary['total'] * 100)
                summary['in_money_rate'] = ((summary['win'] + summary['second'] + summary['third']) / summary['total'] * 100)
        
        image_file = generate_hit_og_image(hits_data[0], yesterday_str)
        if image_file:
            tweet_text = create_hit_report_and_summary_tweet(hits_data[0], summary, yesterday_str)
            post_to_twitter(tweet_text, image_file)
    else:
        _log("-> 昨日は1万円以上の高配当的中がなかったため、投稿をスキップします。")

    # Render環境では待機時間を短縮
    if os.getenv("RENDER"):
        delay = random.uniform(30, 60)  # 30-60秒
    else:
        delay = random.uniform(180, 420)  # 180-420秒（従来通り）
    _log(f"\n--- 次の投稿まで {delay:.0f}秒間 待機します ---")
    time.sleep(delay)
    
    _log("\n--- [フェーズ2/3] 今日の注目馬を投稿 ---")
    pick_data = get_api_data(f"special-pick/{today_str}")
    if pick_data:
        image_file = generate_pick_og_image(pick_data, today_str)
        if image_file:
            tweet_text = create_pick_tweet(pick_data, today_str)
            post_to_twitter(tweet_text, image_file)
    else:
        _log("-> 今日の注目馬データがなかったため、投稿をスキップします。")

    # Render環境では待機時間を短縮
    if os.getenv("RENDER"):
        delay = random.uniform(30, 60)  # 30-60秒
    else:
        delay = random.uniform(180, 420)  # 180-420秒（従来通り）
    _log(f"\n--- 次の投稿まで {delay:.0f}秒間 待機します ---")
    time.sleep(delay)

    _log("\n--- [フェーズ3/3] 今日の重賞レースを投稿 ---")
    all_races_data_today = get_api_data(today_str)
    if all_races_data_today:
        venues = all_races_data_today.get('jra', [])
        posted_count = 0
        for venue in venues:
            for race in venue.get('races', []):
                if any(grade_race in race.get('race_name', '') for grade_race in JRA_GRADE_RACE_NAMES):
                    if posted_count >= 1:
                        continue
                    _log(f"-> JRA重賞レース発見: {race['venue_name']} {race.get('race_name')}")
                    preds = sorted([p for p in race.get('predictions', []) if p.get('deviation_score')], 
                                   key=lambda p: p['deviation_score'], reverse=True)
                    top_preds = preds[:3]
                    if len(top_preds) == 3:
                        image_file = generate_reminder_og_image(race, top_preds)
                        if image_file:
                            text = create_reminder_tweet(race, top_preds)
                            post_to_twitter(text, image_file)
                            posted_count += 1
        if posted_count == 0:
            _log("-> 本日は対象のJRA重賞レースがありませんでした。")
    
    _log("\nSNS自動投稿ジョブが完了しました。")