import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont
import tweepy
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import random
import time
import json
from typing import Optional, List, Dict, Any
import traceback
import re

# --- 基本設定 ---
# スクリプトのパスを解決
try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    SCRIPT_DIR = os.getcwd()

PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
dotenv_path = os.path.join(PROJECT_ROOT, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

# 環境変数
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

# 待機時間の上限を秒単位で設定 (例: 600秒 = 10分)
MAX_WAIT_SECONDS = 600

IMAGE_OUTPUT_DIR = "/tmp" if os.getenv("RENDER") else os.path.join(PROJECT_ROOT, "sns_images_dist")
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)

SITE_BASE_URL = "https://uma-free.com"
API_BASE_URL = "https://keiba-site-v1.onrender.com"
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

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
    "小倉牝馬S", "小倉牝馬ステークス", "根岸S", "根岸ステークス", "シルクロードS", "シルクロードステークス", "東京新聞杯",
    "きさらぎ賞", "クイーンC", "クイーンカップ", "共同通信杯", "ダイヤモンドS", "ダイヤモンドステークス", "阪急杯",
    "小倉大賞典", "オーシャンS", "オーシャンステークス", "中山牝馬S", "中山牝馬ステークス", "愛知杯", "フラワーC", "フラワーカップ",
    "ファルコンS", "ファルコンステークス", "毎日杯", "マーチS", "マーチステークス", "ダービー卿CT", "ダービー卿チャレンジトロフィー",
    "チャーチルダウンズC", "チャーチルダウンズカップ", "アンタレスS", "アンタレスステークス", "福島牝馬S", "福島牝馬ステークス",
    "ユニコーンS", "ユニコーンステークス", "エプソムC", "エプソムカップ", "新潟大賞典", "平安S", "平安ステークス", "葵S", "葵ステークス",
    "函館スプリントS", "函館スプリントステークス", "府中牝馬S", "府中牝馬ステークス", "しらさぎS", "しらさぎステークス", "ラジオNIKKEI賞",
    "函館記念", "北九州記念", "七夕賞", "小倉記念", "函館2歳S", "函館2歳ステークス", "関屋記念",
    "東海S", "東海ステークス", "アイビスSD", "アイビスサマーダッシュ", "クイーンS", "クイーンステークス", "エルムS", "エルムステークス",
    "レパードS", "レパードステークス", "CBC賞", "中京記念", "新潟2歳S", "新潟2歳ステークス", "キーンランドC", "キーンランドカップ",
    "新潟記念", "中京2歳S", "中京2歳ステークス", "京成杯AH", "京成杯オータムハンデキャップ", "札幌2歳S", "札幌2歳ステークス",
    "チャレンジC", "チャレンジカップ", "シリウスS", "シリウスステークス", "サウジアラビアRC", "サウジアラビアロイヤルカップ", "アルテミスS", "アルテミスステークス",
    "ファンタジーS", "ファンタジステークス", "みやこS", "みやこステークス", "武蔵野S", "武蔵野ステークス", "福島記念", "京都2歳S", "京都2歳ステークス",
    "京阪杯", "鳴尾記念", "中日新聞杯", "カペラS", "カペラステークス", "ターコイズS", "ターコイズステークス",
    "小倉サマーJ", "小倉サマージャンプ", "東京ジャンプS", "東京ジャンプステークス", "新潟ジャンプS", "新潟ジャンプステークス", "阪神ジャンプS", "阪神ジャンプステークス",
    "京都ジャンプS", "京都ジャンプステークス"
}

# --- ヘルパー関数 ---
def _now_str():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")

def _log(msg: str):
    print(f"{_now_str()} {msg}")

def _get_font_path(font_name: str) -> str:
    font_path = os.path.join(PROJECT_ROOT, "fonts", font_name)
    if os.path.exists(font_path):
        return font_path
    raise FileNotFoundError(f"Font not found at '{font_path}'. Place fonts in the 'PROJECT_ROOT/fonts' directory.")

def draw_centered_text(draw, text, font, fill_color, image_width, y_position, **kwargs):
    if hasattr(draw, 'textbbox'):
        bbox = draw.textbbox((0, y_position), text, font=font, **kwargs)
        text_width = bbox[2] - bbox[0]
        x_position = (image_width - text_width) / 2
        draw.text((x_position, y_position), text, fill=fill_color, font=font, **kwargs)
    else:
        text_width, _ = draw.textsize(text, font=font)
        x_position = (image_width - text_width) / 2
        draw.text((x_position, y_position), text, fill=fill_color, font=font, **kwargs)

def load_logo() -> Optional[Image.Image]:
    try:
        logo_path = os.path.join(PROJECT_ROOT, "fonts", "new-logo.png")
        if os.path.exists(logo_path):
            logo = Image.open(logo_path)
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            aspect_ratio = logo.width / logo.height
            new_height = 40
            new_width = int(new_height * aspect_ratio)
            resample_filter = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
            logo = logo.resize((new_width, new_height), resample_filter)
            return logo
    except Exception as e:
        _log(f"ロゴ読み込みエラー: {e}")
    return None

# --- API連携関数 ---
def get_api_data(endpoint: str, retries: int = 3, delay: int = 5) -> Optional[Any]:
    _log(f"APIにアクセス中: {endpoint}")
    for attempt in range(retries):
        try:
            url = f"{API_BASE_URL}/api/v1/predictions/{endpoint}"
            res = requests.get(url, timeout=90)
            if res.status_code == 200:
                data = res.json()
                if data:
                    _log(f"-> データ取得成功")
                    return data
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

# --- OGP画像生成関数 ---
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
        color_start = (129, 140, 248)
        color_end = (55, 48, 163)
        for y in range(630):
            ratio = y / 629
            r, g, b = int(color_start[0] * (1-ratio) + color_end[0] * ratio), int(color_start[1] * (1-ratio) + color_end[1] * ratio), int(color_start[2] * (1-ratio) + color_end[2] * ratio)
            draw.line([(0, y), (1200, y)], fill=(r, g, b))
        logo = load_logo()
        if logo: img.paste(logo, (50, 40), logo)
        card_x, card_y, card_w, card_h = 150, 180, 900, 320
        draw.rounded_rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)], radius=20, fill=(255, 255, 255, 230))
        label_y = card_y - 25
        draw.rounded_rectangle([(500, label_y), (700, label_y + 50)], radius=25, fill=(79, 70, 229), outline=(255, 255, 255), width=2)
        draw_centered_text(draw, "的中速報", ImageFont.truetype(font_bold, 24), (255, 255, 255), img.width, label_y + 12)
        race_text = f"{hit_data['venue_name']} {hit_data['race_number']}R"
        draw_centered_text(draw, race_text, ImageFont.truetype(font_regular, 32), (80, 80, 80), img.width, card_y + 50)
        draw_centered_text(draw, hit_data['bet_type'], ImageFont.truetype(font_bold, 36), (100, 100, 100), img.width, card_y + 100)
        payout_text = f"¥{hit_data['payout']:,}"
        draw_centered_text(draw, payout_text, ImageFont.truetype(font_black, 90), (79, 70, 229), img.width, card_y + 180)
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y/%m/%d')
        draw.text((50, img.height - 80), date_formatted, font=ImageFont.truetype(font_light, 18), fill=(220, 220, 255))
        draw.text((img.width - 250, img.height - 80), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(220, 220, 255))
        img.convert('RGB').save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Hit OGP生成エラー: {e}\n{traceback.format_exc()}"); return None

def generate_pick_og_image(data: dict, date_str: str) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_pick_{date_str}.png")
    _log(f"-> 注目馬用のOGP画像を生成: {filename}")
    try:
        font_jp_bold_path, font_jp_black_path = _get_font_path("MPLUSRounded1c-Bold.ttf"), _get_font_path("MPLUSRounded1c-Black.ttf")
        img = Image.new('RGB', (1200, 630), (79, 70, 229)); draw = ImageDraw.Draw(img)
        font_title, font_horse, font_info = ImageFont.truetype(font_jp_bold_path, 60), ImageFont.truetype(font_jp_black_path, 80), ImageFont.truetype(font_jp_bold_path, 40)
        draw.text((100, 80), "🏇 今日のAI注目馬 🏇", fill="white", font=font_title)
        draw.text((100, 200), data['horse_name'], fill="white", font=font_horse)
        draw.text((100, 300), f"{data['venue_name']} {data['race_number']}R {data['race_name']}", fill="#dddddd", font=font_info)
        draw.text((100, 360), f"AI偏差値: {data['deviation_score']:.2f}", fill="white", font=font_info)
        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Pick OGP生成エラー: {e}\n{traceback.format_exc()}"); return None

def generate_reminder_og_image(race: dict, top_preds: list) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race['id']}_{random.randint(1000,9999)}.png")
    _log(f"-> 重賞レース用のOGP画像を生成: {filename}")
    try:
        font_light, font_regular, font_bold, font_black = _get_font_path("MPLUSRounded1c-Light.ttf"), _get_font_path("MPLUSRounded1c-Regular.ttf"), _get_font_path("MPLUSRounded1c-Bold.ttf"), _get_font_path("MPLUSRounded1c-Black.ttf")
        img = Image.new('RGB', (1200, 630), (30, 40, 80)); draw = ImageDraw.Draw(img)
        for y in range(630):
            ratio = y / 629
            r, g, b = int(30+20*ratio), int(40+30*ratio), int(80+40*ratio)
            draw.line([(0, y), (1200, y)], fill=(r, g, b))
        draw.rectangle([(0, 0), (1200, 4)], fill=(192, 192, 192, 128))
        logo = load_logo()
        if logo: img.paste(logo, (50, 40), logo)
        draw.text((60, 100), "重賞", font=ImageFont.truetype(font_black, 24), fill=(192, 192, 192))
        draw_centered_text(draw, race['race_name'], ImageFont.truetype(font_black, 60), (255, 255, 255), img.width, 150)
        venue_info = f"{race['venue_name']} {datetime.strptime(race['race_date'], '%Y-%m-%d').strftime('%m/%d')}"
        draw_centered_text(draw, venue_info, ImageFont.truetype(font_light, 24), (200, 200, 200), img.width, 230)
        y_start, colors, marks = 320, [(255, 255, 100), (200, 200, 255), (255, 200, 200)], ["◎", "○", "▲"]
        for i, p in enumerate(top_preds):
            y_pos = y_start + i * 70
            draw.text((350, y_pos), marks[i], font=ImageFont.truetype(font_black, 36), fill=colors[i])
            draw.text((420, y_pos + 5), p['horse_name'], font=ImageFont.truetype(font_bold, 30), fill=(255, 255, 255))
            score_text = f"{p.get('deviation_score', 0):.1f}"
            draw.text((800, y_pos + 5), score_text, font=ImageFont.truetype(font_regular, 28), fill=(200, 200, 200))
        draw.text((img.width - 250, img.height - 80), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(200, 200, 200))
        img.save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"❌ Reminder OGP生成エラー: {e}\n{traceback.format_exc()}"); return None

# --- テキスト生成 & 投稿関数 ---
def create_combined_tweet_text(hits: List[dict], summary: dict, pick_data: Optional[dict], date_str: str) -> str:
    _log("-> 的中報告＋注目馬の投稿テキストを生成...")
    top_hit = hits[0]
    hashtags = ["#競馬", "#AI予想", "#万馬券" if top_hit['payout'] >= 10000 else "#的中"]
    hit_texts = [f"🎯昨日のAI的中ハイライト ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🎯", f"\n昨日の最高配当は【{top_hit['payout']:,}円】でした！", f"({top_hit['venue_name']}{top_hit['race_number']}R {top_hit['bet_type']})"]
    other_hits = [h for h in hits[1:3] if h['payout'] >= 10000]
    if other_hits:
        hit_texts.append("\n\n他にも万馬券が…")
        for hit in other_hits: hit_texts.append(f"・{hit['venue_name']}{hit['race_number']}R: {hit['payout']:,}円")
    summary_text = f"\n📈昨日のAI本命馬(◎)成績\n[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}]\n勝率: {summary['win_rate']:.1f}% / 複勝率: {summary['in_money_rate']:.1f}%"
    pick_text = ""
    if pick_data:
        hashtags.append(f"#{pick_data['horse_name']}")
        pick_text = f"\n---\n🏇本日のAI注目馬🏇\n【{pick_data['venue_name']}{pick_data['race_number']}R】\n◎ {pick_data['horse_name']} (AI偏差値: {pick_data['deviation_score']:.2f})"
    return f"{''.join(hit_texts)}{summary_text}{pick_text}\n\n▼全レースのAI印と詳細データはこちら\n{SITE_BASE_URL}\n\n{' '.join(hashtags)}"

def create_pick_tweet_text(data: dict, date_str: str) -> str:
    _log("-> 注目馬（単独）の投稿テキストを生成...")
    is_jra = data.get('race_type', '地方') == '中央'
    hashtags = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬", f"#{data['venue_name']}競馬", f"#{data['horse_name']}"]
    intros = ["AIが選んだ今日の鉄板候補はこちら！", "今日のレースで特に注目したい一頭！", "AIの分析によると、この馬が抜けているようです！"]
    outros = ["あなたの本命は？リプライで教えて！", "この馬、どう思いますか？", "皆さんの予想もぜひ聞かせてください！"]
    return f"🏇本日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🏇\n\n{random.choice(intros)}\n【{data['venue_name']}{data['race_number']}R {data['race_name']}】\n◎ {data['horse_name']} (AI偏差値: {data['deviation_score']:.2f})\n\n{random.choice(outros)}\n\n▼全レースのAI印と詳細データはこちら\n{SITE_BASE_URL}/races/{date_str}?venue={data['venue_name']}&race={data['race_number']}\n\n{' '.join(hashtags)}"

def create_reminder_tweet_text(race: dict, top_preds: List[dict]) -> str:
    _log("-> 重賞レースの投稿テキストを生成...")
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race['race_name']).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    marks = ["◎", "○", "▲"]; [p.update({'mark': marks[i] if i < 3 else "△"}) for i, p in enumerate(top_preds)]
    lines = [f"🏇本日の重賞 ({race['race_name']})🏇\n"] + [f"{p['mark']} {p['horse_name']} (AI偏差値: {p.get('deviation_score', 0):.2f})" for p in top_preds]
    lines.extend([f"\n▼詳細な予測・全レースのAI印はこちらから\n{SITE_BASE_URL}/races/{race['race_date']}?venue={race['venue_name']}&race={race['race_number']}", f"\n{' '.join(hashtags)}"])
    return "\n".join(lines)

def post_to_twitter(text: str, image_path: str):
    _log(f"-> X (Twitter) への投稿を実行: {image_path}")
    if DRY_RUN:
        _log("⚠️ DRY_RUN=1 のため投稿は実行しません（テストモード）。"); return
    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        _log("⚠️ Twitter APIの認証情報が不足しています。"); return
        
    try:
        auth_v1 = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth_v1)
        client_v2 = tweepy.Client(consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET, access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)
        
        media = api_v1.media_upload(filename=image_path)
        response = client_v2.create_tweet(text=text, media_ids=[media.media_id])
        
        tweet_id = response.data['id']
        _log(f"🎉 投稿成功！ https://twitter.com/user/status/{tweet_id}")

    except tweepy.errors.TooManyRequests as e:
        # --- ★★★ここからがレートリミット情報表示の修正箇所★★★ ---
        _log(f"❌ レートリミット超過エラー (429) が発生しました。")
        headers = e.response.headers
        
        limit = headers.get('x-rate-limit-limit', 'N/A')
        remaining = headers.get('x-rate-limit-remaining', 'N/A')
        reset_time_unix = headers.get('x-rate-limit-reset')

        _log("--- API Rate Limit Info ---")
        _log(f"  [15分枠] 上限回数: {limit}")
        _log(f"  [15分枠] 残り回数: {remaining}")
        _log(f"  [24時間枠] 投稿上限: 2,400 ツイート (リツイート含む)")
        
        if reset_time_unix:
            now_unix = time.time()
            wait_seconds = int(reset_time_unix) - now_unix
            
            reset_time_jst = datetime.fromtimestamp(int(reset_time_unix), tz=timezone(timedelta(hours=9)))
            _log(f"  [15分枠] リセット時刻: {reset_time_jst.strftime('%H:%M:%S')} JST")
            
            if wait_seconds > 0:
                if wait_seconds > MAX_WAIT_SECONDS:
                    _log(f"  待機時間が上限 ({MAX_WAIT_SECONDS}秒) を超えているため ({wait_seconds:.0f}秒)、処理を中断します。")
                    sys.exit(1)
                else:
                    _log(f"  リセットまで {wait_seconds:.0f}秒 待機します...")
                    time.sleep(wait_seconds + 1)
                    _log("  待機完了。処理を継続します。")
            else:
                 _log("  リセット時刻を過ぎているため、待機せずに処理を継続します。")
        else:
            _log("  リセット時刻が取得できませんでした。デフォルトの15分待機します。")
            time.sleep(901)
        # --- ★★★修正ここまで★★★
        
    except tweepy.errors.TweepyException as e:
        _log(f"❌ Xへの投稿中にAPIエラーが発生しました: {e}"); _log(f"\n{traceback.format_exc()}")
        
    except Exception as e:
        _log(f"❌ Xへの投稿中に予期せぬエラー: {e}\n{traceback.format_exc()}")

# --- メイン処理 ---
if __name__ == "__main__":
    _log("="*50)
    _log("SNS自動投稿ジョブを開始します")
    _log("="*50)

    jst = timezone(timedelta(hours=9))
    if len(sys.argv) > 1:
        try:
            base_date_str = sys.argv[1]
            today = datetime.strptime(base_date_str, '%Y-%m-%d').replace(tzinfo=jst)
            _log(f"指定された日付で実行します: {base_date_str}")
        except ValueError:
            _log(f"日付フォーマットエラー: {sys.argv[1]}。YYYY-MM-DD形式で指定してください。")
            sys.exit(1)
    else:
        today = datetime.now(jst)
        _log("現在の日付で実行します。")

    yesterday = today - timedelta(days=1)
    today_str = today.strftime('%Y-%m-%d')
    yesterday_str = yesterday.strftime('%Y-%m-%d')
    
    _log(f"\n--- [フェーズ1/2] {yesterday_str} の結果に応じた投稿を実行 ---")
    hits_data = get_api_data(f"hits/high-payouts/{yesterday_str}")
    
    if hits_data and hits_data[0].get('payout', 0) >= 10000:
        _log("-> 高配当的中があったため、複合投稿を作成します。")
        summary = {'win': 0, 'second': 0, 'third': 0, 'other': 0, 'total': 0, 'win_rate': 0.0, 'in_money_rate': 0.0}
        all_races_data_yesterday = get_api_data(yesterday_str)
        if all_races_data_yesterday:
            venues = all_races_data_yesterday.get('jra', []) + all_races_data_yesterday.get('nar', [])
            for venue in venues:
                for race in venue.get('races', []):
                    honmei = next((p for p in race.get('predictions', []) if p.get('mark') == '◎'), None)
                    if honmei and honmei.get('horse_number') is not None:
                        result = next((r for r in race.get('results', []) if r.get('horse_number') == honmei.get('horse_number')), None)
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
        pick_data = get_api_data(f"special-pick/{today_str}")
        image_file = generate_hit_og_image(hits_data[0], yesterday_str)
        if image_file:
            tweet_text = create_combined_tweet_text(hits_data, summary, pick_data, yesterday_str)
            post_to_twitter(tweet_text, image_file)
    else:
        _log("-> 高配当的中がなかったため、注目馬の単独投稿を試みます。")
        pick_data = get_api_data(f"special-pick/{today_str}")
        if pick_data:
            image_file = generate_pick_og_image(pick_data, today_str)
            if image_file:
                tweet_text = create_pick_tweet_text(pick_data, today_str)
                post_to_twitter(tweet_text, image_file)
        else:
            _log(f"-> {today_str} の注目馬データもありませんでした。投稿をスキップします。")
    
    _log("\n--- 連続投稿を避けるため15秒間待機します ---")
    time.sleep(15)

    _log(f"\n--- [フェーズ2/2] {today_str} の重賞投稿を実行 ---")
    all_races_data_today = get_api_data(today_str)
    if all_races_data_today:
        venues = all_races_data_today.get('jra', [])
        posted_count = 0
        for venue in venues:
            for race in venue.get('races', []):
                if any(grade_race in race.get('race_name', '') for grade_race in JRA_GRADE_RACE_NAMES):
                    _log(f"-> JRA重賞レース発見: {race['venue_name']} {race.get('race_name')}")
                    preds = sorted([p for p in race.get('predictions', []) if p.get('deviation_score')], key=lambda p: p['deviation_score'], reverse=True)
                    top_preds = preds[:3]
                    if len(top_preds) == 3:
                        image_file = generate_reminder_og_image(race, top_preds)
                        if image_file:
                            text = create_reminder_tweet_text(race, top_preds)
                            post_to_twitter(text, image_file)
                            posted_count += 1
                            if posted_count > 0:
                                _log("\n--- 連続投稿を避けるため15秒間待機します ---")
                                time.sleep(15)
        if posted_count == 0:
            _log("-> 本日は対象のJRA重賞レースがありませんでした。")
    else:
        _log(f"-> {today_str} のレースデータが取得できなかったため、重賞投稿をスキップします。")

    _log("\nSNS自動投稿ジョブが完了しました。")