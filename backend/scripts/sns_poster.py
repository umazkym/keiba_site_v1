# backend/scripts/sns_poster.py
# 画像デザイン最終版（明るい配色・ロゴ安全領域・馬名最大10文字対応）
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
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# --- 基本パスと .env 読み込み ---
try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
except NameError:
    PROJECT_ROOT = os.path.abspath(os.path.join(os.getcwd(), os.pardir, os.pardir))

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
        print("警告: .envファイルが見つかりません。環境変数を確認してください。")

# --- 環境変数 / 定数 ---
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

IMAGE_OUTPUT_DIR = "/tmp" if os.getenv("RENDER") else os.path.join(PROJECT_ROOT, "sns_images_dist")
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)

SITE_BASE_URL = "https://uma-free.com"
API_BASE_URL = "https://keiba-site-v1.onrender.com"

# --- デザイン定数（明るめの配色） ---
CANVAS_W, CANVAS_H = 1200, 630
CANVAS_SIZE = (CANVAS_W, CANVAS_H)
PADDING = 64
# 明るめのブルー→コバルトのグラデーション
BG_START = (110, 170, 255)    # 修正: より明るい空色
BG_END = (50, 110, 240)       # 修正: より深いコバルト
ACCENT = (255, 120, 0)        # 修正: 鮮やかなオレンジ
CARD_FILL = (255, 255, 255, 245) # 修正: カードの不透明度を少し上げる
TEXT_ON_CARD = (25, 25, 30)   # 修正: カード上のテキストを濃くして視認性向上
TEXT_LIGHT = (255, 255, 255, 240) # 修正: 背景上のテキストを白に近づけ、不透明度調整
TEXT_SUBTLE = (200, 200, 205) # 新規: 副次的な情報のテキストカラー
WATERMARK_COLOR = (255,255,255,200)
LOGO_H = 56
LOGO_SAFE_MARGIN = 140    # ロゴの周辺は何も置かない安全領域（px）
FALLBACK_LOGO_TEXT = "UMA-FREE"

# --- ログ ---
def _now_str(): return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")
def _log(msg: str): print(f"{_now_str()} {msg}")

# --- フォント / ユーティリティ ---
def _get_font_path(font_name: str) -> str:
    path = os.path.join(PROJECT_ROOT, "backend", "fonts", font_name)
    if os.path.exists(path): return path
    raise FileNotFoundError(f"フォントが見つかりません: {path}")

def _load_font(font_name: str, size: int):
    try:
        return ImageFont.truetype(_get_font_path(font_name), size)
    except Exception:
        return ImageFont.load_default()

# テキスト測定（互換性対応）
def measure_text(draw: ImageDraw.Draw, text: str, font: ImageFont.ImageFont):
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        return (bbox[2]-bbox[0], bbox[3]-bbox[1])
    except Exception:
        pass
    try:
        ts = draw.textsize(text, font=font)
        return (ts[0], ts[1])
    except Exception:
        pass
    try:
        return font.getsize(text)
    except Exception:
        return (len(text)*8, getattr(font, "size", 16))

def draw_centered_within(draw: ImageDraw.Draw, text: str, font: ImageFont.ImageFont, left: int, right: int, y: int, fill):
    w, h = measure_text(draw, text, font)
    cx = left + (right - left - w) / 2
    draw.text((cx, y), text, font=font, fill=fill)
    return cx, w, h

# 馬名に対して最大10文字制限＋自動フォント縮小
def fit_horse_name(draw: ImageDraw.Draw, name: str, font_name: str, max_width: int, max_font_size: int, min_font_size: int = 20):
    # enforce max 10 characters visually: if >10 truncate with ellipsis
    original_name = name
    if len(name) > 10:
        name = name[:10] + "…"
    
    # try decreasing font size until fits
    size = max_font_size
    while size >= min_font_size:
        font = _load_font(font_name, size)
        w,h = measure_text(draw, name, font)
        if w <= max_width:
            return name, font, w, h
        size -= 2
    # fallback: smallest font
    font = _load_font(font_name, min_font_size)
    w,h = measure_text(draw, name, font)
    return name, font, w, h

# --- ロゴ・ウォーターマーク（安全領域確保） ---
def load_logo_image() -> Optional[Image.Image]:
    try:
        path = os.path.join(PROJECT_ROOT, "backend", "fonts", "new-logo.png")
        if not os.path.exists(path):
            return None
        logo = Image.open(path)
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        aspect = logo.width / logo.height
        new_h = LOGO_H
        new_w = int(new_h * aspect)
        resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
        return logo.resize((new_w, new_h), resample)
    except Exception as e:
        _log(f"ロゴ読み込み失敗: {e}")
        return None

def overlay_logo_and_watermark(img: Image.Image, draw: ImageDraw.Draw):
    try:
        margin = 28
        logo = load_logo_image()
        if logo:
            img.paste(logo, (margin, margin), logo)
            # optional: draw subtle white patch behind if background too light (not necessary now)
        else:
            font_logo = _load_font("MPLUSRounded1c-Bold.ttf", 30)
            draw.text((margin, margin+6), FALLBACK_LOGO_TEXT, font=font_logo, fill=(255,255,255))

        # watermark right-bottom
        wm_font = _load_font("MPLUSRounded1c-Regular.ttf", 16)
        wm_text = SITE_BASE_URL.replace("https://", "").replace("http://", "")
        tw, th = measure_text(draw, wm_text, wm_font)
        x = img.width - tw - margin - 12
        y = img.height - th - margin - 6
        pad = 8
        draw.rounded_rectangle([(x-pad,y-pad),(x+tw+pad,y+th+pad)], radius=8, fill=(0,0,0,140))
        draw.text((x,y), wm_text, font=wm_font, fill=WATERMARK_COLOR)
    except Exception as e:
        _log(f"overlay error: {e}")

# --- グラデーション / カード描画 ---
def draw_vertical_gradient(img: Image.Image, start_color, end_color):
    w,h = img.size
    base = Image.new('RGB', (w,h), start_color)
    top = Image.new('RGB', (w,h), end_color)
    mask = Image.new('L', (w,h))
    mask_data = []
    for y in range(h):
        mask_data.extend([int(255 * (y / (h - 1)))] * w)
    mask.putdata(mask_data)
    blended = Image.composite(top, base, mask)
    img.paste(blended)

def draw_rounded_card(img: Image.Image, draw: ImageDraw.Draw, x, y, w, h, radius=18, fill=(255,255,255,230), shadow=True):
    if shadow:
        shadow_layer = Image.new('RGBA', img.size, (0,0,0,0))
        sd = ImageDraw.Draw(shadow_layer)
        sd.rounded_rectangle([(x+8,y+10),(x+w+8,y+h+10)], radius=radius, fill=(0,0,0,110))
        blurred = shadow_layer.filter(ImageFilter.GaussianBlur(8))
        img.paste(blurred, (0,0), blurred)
    draw.rounded_rectangle([(x,y),(x+w,y+h)], radius=radius, fill=fill)

# --- レイアウト helpers（ロゴ安全領域考慮） ---
def safe_left():
    """左側の安全開始 x（ロゴ領域を避ける）"""
    return max(PADDING, LOGO_SAFE_MARGIN + 16)

def center_area():
    """中央に配置する際の左右マージン（ロゴ領域を避けてセンタリング）"""
    left = safe_left()
    right = CANVAS_W - PADDING
    return left, right

# --- 画像テンプレート（的中 / 注目 / 重賞） ---
def generate_hit_og_image(hit_data: dict, date_str: str) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_hit_{date_str}_{random.randint(1000,9999)}.png")
    _log(f"-> 的中画像生成: {filename}")
    try:
        img = Image.new("RGBA", CANVAS_SIZE, BG_START)
        draw_vertical_gradient(img, BG_START, BG_END)
        draw = ImageDraw.Draw(img, "RGBA")

        left, right = center_area()
        card_w = right - left
        card_h = 320 # 修正: カードの高さを少し増やす
        card_x = left
        card_y = (CANVAS_H - card_h) // 2 # 修正: 垂直方向の中央揃えを微調整
        draw_rounded_card(img, draw, card_x, card_y, card_w, card_h, radius=22, fill=CARD_FILL, shadow=True)

        # label (pill) centered in center_area
        label_text = "的中速報"
        label_font = _load_font("MPLUSRounded1c-Bold.ttf", 24) # 修正: フォントサイズを少し上げる
        label_w, label_h = measure_text(draw, label_text, label_font)
        
        # 修正: ラベルの配置とサイズを調整
        label_card_w = 200 # ラベルカードの幅を固定
        label_card_h = 48 # ラベルカードの高さを固定
        label_x = left + (card_w - label_card_w) / 2 # カードの中央に配置
        label_y = card_y - label_card_h // 2 - 20 # カードの上部に少し重ねる
        draw.rounded_rectangle([(label_x, label_y),(label_x+label_card_w, label_y+label_card_h)], radius=label_card_h // 2, fill=ACCENT)
        draw.text((label_x + (label_card_w-label_w)/2, label_y+(label_card_h-label_h)/2 - 2), label_text, font=label_font, fill=(255,255,255)) # 垂直方向の中央揃えを微調整

        # race / bet
        race_text = f"{hit_data.get('venue_name','')} {hit_data.get('race_number','')}R"
        race_font = _load_font("MPLUSRounded1c-Regular.ttf", 28) # 修正: フォントサイズを調整
        draw_centered_within(draw, race_text, race_font, left, right, card_y + 60, TEXT_ON_CARD) # 修正: 縦位置調整

        bet_font = _load_font("MPLUSRounded1c-Bold.ttf", 36) # 修正: フォントサイズを調整
        draw_centered_within(draw, hit_data.get('bet_type',''), bet_font, left, right, card_y + 105, TEXT_ON_CARD) # 修正: 縦位置調整

        # payout large
        payout = int(hit_data.get('payout',0))
        payout_text = f"¥{payout:,}"
        payout_font = _load_font("MPLUSRounded1c-Black.ttf", 90) # 修正: フォントサイズを少し大きく
        draw_centered_within(draw, payout_text, payout_font, left, right, card_y + 160, ACCENT) # 修正: 縦位置調整

        # bottom row: date (left safe) & CTA (centered within center_area)
        date_font = _load_font("MPLUSRounded1c-Light.ttf", 18) # 修正: フォントサイズを調整
        try:
            date_display = datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y/%m/%d")
        except Exception:
            date_display = date_str
        draw.text((left, CANVAS_H - PADDING + 12), date_display, font=date_font, fill=TEXT_LIGHT) # 修正: 縦位置調整

        cta_font = _load_font("MPLUSRounded1c-Regular.ttf", 18) # 修正: フォントサイズを調整
        cta_text = "今日のAI予想を無料で確認する"
        # 修正: CTAテキストの位置を微調整
        cta_w, cta_h = measure_text(draw, cta_text, cta_font)
        draw.text((right - cta_w, CANVAS_H - PADDING + 12), cta_text, font=cta_font, fill=TEXT_LIGHT)


        overlay_logo_and_watermark(img, draw)
        img.convert("RGB").save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"的中画像生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_pick_og_image(data: dict, date_str: str) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_pick_{date_str}_{random.randint(1000,9999)}.png")
    _log(f"-> 注目馬画像生成: {filename}")
    try:
        img = Image.new("RGBA", CANVAS_SIZE, BG_START)
        draw_vertical_gradient(img, BG_START, BG_END)
        draw = ImageDraw.Draw(img, "RGBA")

        left = safe_left()
        right = CANVAS_W - PADDING

        # heading (left)
        header_font = _load_font("MPLUSRounded1c-Bold.ttf", 36) # 修正: フォントサイズを上げる
        title_text = "本日の注目馬"
        draw.text((left, PADDING - 10), title_text, font=header_font, fill=TEXT_LIGHT) # 修正: 縦位置を微調整

        # horse name: fit to width (reserve space for CTA card on right)
        max_name_width = right - left - 460  # CTAカードの右側スペースを確保
        horse_name_raw = data.get('horse_name','—')
        horse_name, horse_font, w, h = fit_horse_name(draw, horse_name_raw, "MPLUSRounded1c-Black.ttf", max_name_width, max_font_size=96, min_font_size=32) # 修正: フォントサイズ調整
        name_x = left
        name_y = PADDING + 58 # 修正: 縦位置調整
        draw.text((name_x, name_y), horse_name, font=horse_font, fill=(255,255,255))

        # race info
        info_font = _load_font("MPLUSRounded1c-Regular.ttf", 24) # 修正: フォントサイズを調整
        info_text = f"{data.get('venue_name','')} {data.get('race_number','')}R  {data.get('race_name','')}"
        draw.text((left, name_y + h + 20), info_text, font=info_font, fill=TEXT_SUBTLE) # 修正: 縦位置調整、色変更

        # AI score
        score_text = f"AI偏差値: {data.get('deviation_score', 0):.2f}"
        draw.text((left, name_y + h + 56), score_text, font=info_font, fill=TEXT_SUBTLE) # 修正: 縦位置調整、色変更

        # CTA card (right-bottom) inside safe canvas (do not overlap logo zone)
        card_w, card_h = 480, 160 # 修正: カードサイズを調整
        card_x = CANVAS_W - PADDING - card_w # 修正: 右端からの配置
        card_y = CANVAS_H - PADDING - card_h + 10 # 修正: 縦位置調整
        
        # CTAカードがロゴ安全領域と重ならないことを確認（ただし現状ロゴは左上なので、右下なら気にしなくて良いが、念のため）
        if card_x < LOGO_SAFE_MARGIN:
            card_x = LOGO_SAFE_MARGIN + 20 # これでも重なる可能性があるので、中央寄りに調整
            
        draw_rounded_card(img, draw, card_x, card_y, card_w, card_h, radius=22, fill=CARD_FILL, shadow=True) # 修正: radiusを大きく
        card_font = _load_font("MPLUSRounded1c-Bold.ttf", 22) # 修正: フォントサイズを上げる
        cta_inside = "全馬のAI偏差値を今すぐチェック"
        tw, th = measure_text(draw, cta_inside, card_font)
        draw.text((card_x + (card_w - tw)/2, card_y + (card_h - th)/2), cta_inside, font=card_font, fill=TEXT_ON_CARD) # 修正: センタリング維持

        overlay_logo_and_watermark(img, draw)
        img.convert("RGB").save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"注目馬画像生成エラー: {e}\n{traceback.format_exc()}")
        return None

def generate_reminder_og_image(race: dict, top_preds: list) -> Optional[str]:
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race.get('id','')}_{random.randint(1000,9999)}.png")
    _log(f"-> 重賞画像生成: {filename}")
    try:
        img = Image.new("RGBA", CANVAS_SIZE, BG_START)
        draw_vertical_gradient(img, BG_START, BG_END)
        draw = ImageDraw.Draw(img, "RGBA")

        left, right = center_area()
        # header center-area
        small_font = _load_font("MPLUSRounded1c-Regular.ttf", 22) # 修正: フォントサイズを調整
        draw_centered_within(draw, "重賞", small_font, left, right, PADDING + 10, TEXT_SUBTLE) # 修正: 縦位置と色調整
        
        title_font = _load_font("MPLUSRounded1c-Black.ttf", 56) # 修正: フォントサイズを上げる
        race_name = race.get('race_name', '重賞レース')
        draw_centered_within(draw, race_name, title_font, left, right, PADDING + 50, (255,255,255)) # 修正: 縦位置調整
        
        # venue/date
        try:
            dt_str = datetime.strptime(race.get('race_date','1970-01-01'), "%Y-%m-%d").strftime("%m/%d")
        except Exception:
            dt_str = race.get('race_date','')
        venue_info = f"{race.get('venue_name','')} {dt_str}"
        draw_centered_within(draw, venue_info, small_font, left, right, PADDING + 115, TEXT_SUBTLE) # 修正: 縦位置と色調整

        # list left side within center_area but respecting logo safe margin
        list_padding_x = 80 # 修正: リストの左右パディングを調整
        list_x = left + list_padding_x
        list_right = right - list_padding_x
        
        y0 = PADDING + 200 # 修正: リスト開始Y座標を調整
        line_h = 72 # 修正: 各行の高さを調整

        mark_font = _load_font("MPLUSRounded1c-Black.ttf", 38) # 修正: フォントサイズを調整
        name_font = _load_font("MPLUSRounded1c-Bold.ttf", 32) # 修正: フォントサイズを調整
        score_font = _load_font("MPLUSRounded1c-Regular.ttf", 30) # 修正: フォントサイズを調整
        
        marks_colors = [
            (255, 190, 80), # ◎ - 明るいオレンジ
            (200, 200, 200), # ○ - 明るいグレー
            (255, 160, 160)  # ▲ - 少し赤みがかったグレー
        ]
        marks = ["◎","○","▲"]
        for i, p in enumerate(top_preds[:3]):
            y = y0 + i * line_h
            
            # マーク
            draw.text((list_x, y), marks[i], font=mark_font, fill=marks_colors[i])
            
            # 馬名
            horse_raw = p.get('horse_name','')
            max_name_w = (list_right - list_x) - 180 # マークとスコアのスペースを確保
            horse_name, horse_font_fitted, w, h = fit_horse_name(draw, horse_raw, "MPLUSRounded1c-Bold.ttf", int(max_name_w), max_font_size=32, min_font_size=20)
            draw.text((list_x + 70, y + 8), horse_name, font=horse_font_fitted, fill=(255,255,255)) # 修正: 縦位置調整、色変更
            
            # スコア
            score_text = f"{p.get('deviation_score', 0):.1f}"
            sw, sh = measure_text(draw, score_text, score_font)
            draw.text((list_right - sw, y + 8), score_text, font=score_font, fill=(240,240,245)) # 修正: 縦位置調整、色変更

        overlay_logo_and_watermark(img, draw)
        img.convert("RGB").save(filename, quality=95, optimize=True)
        return filename
    except Exception as e:
        _log(f"重賞画像生成エラー: {e}\n{traceback.format_exc()}")
        return None

# --- ツイート文（**変更なし**。ここは触れていません） ---
def create_hit_report_and_summary_tweet(hit: Dict[str, Any], summary: dict, date_str: str) -> str:
    date_fmt = datetime.strptime(date_str, "%Y-%m-%d").strftime("%m/%d")
    hashtags = ["#競馬", "#AI予想", "#的中", "#UMA_FREE"]
    lines = [
        f"{date_fmt} の AI 的中報告",
        "",
        f"【{hit.get('venue_name','')}{hit.get('race_number','')}R】",
        f"{hit.get('bet_type','')} を的中しました（払戻: {hit.get('payout',0):,} 円）",
        "",
        f"昨日の本命(◎)成績: [{summary.get('win',0)}-{summary.get('second',0)}-{summary.get('third',0)}-{summary.get('other',0)}]",
        f"勝率: {summary.get('win_rate',0.0):.1f}% / 複勝率: {summary.get('in_money_rate',0.0):.1f}%",
        "",
        "詳細・全予想はこちら:",
        SITE_BASE_URL,
        "",
        " ".join(hashtags)
    ]
    return "\n".join(lines)

def create_pick_tweet(pick: Dict[str, Any], date_str: str) -> str:
    date_fmt = datetime.strptime(date_str, "%Y-%m-%d").strftime("%m/%d")
    is_jra = False
    try:
        is_jra = int(pick.get('race_id','000000')[4:6]) < 30
    except Exception:
        is_jra = False
    hashtags = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬", "#UMA_FREE"]
    lines = [
        f"{date_fmt} の注目馬（AI）",
        "",
        f"【{pick.get('venue_name','')}{pick.get('race_number','')}R {pick.get('race_name','')}】",
        f"◎ {pick.get('horse_name','')}  偏差値: {pick.get('deviation_score',0.0):.2f}",
        "",
        "全馬のAI偏差値は下記で公開中:",
        SITE_BASE_URL,
        "",
        " ".join(hashtags)
    ]
    return "\n".join(lines)

def create_reminder_tweet(race: dict, top_preds: List[dict]) -> str:
    date_fmt = ""
    try:
        date_fmt = datetime.strptime(race.get('race_date',''), "%Y-%m-%d").strftime("%m/%d")
    except Exception:
        date_fmt = race.get('race_date','')
    clean_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】','', race.get('race_name','')).strip()
    hashtags = ["#競馬", "#AI予想", "#重賞", "#UMA_FREE"]
    lines = [
        f"{date_fmt} の重賞 AI 予想",
        f"【{race.get('venue_name','')}{race.get('race_number','')}R {race.get('race_name','')}】",
        ""
    ]
    marks = ['◎','○','▲']
    for i, p in enumerate(top_preds[:3]):
        lines.append(f"{marks[i]} {p.get('horse_name','')}  (AI偏差値: {p.get('deviation_score',0):.1f})")
    lines += ["", "全予想はこちら:", SITE_BASE_URL, "", " ".join(hashtags)]
    return "\n".join(lines)

# --- Twitter 投稿（DRY_RUN 対応） ---
def post_to_twitter(text: str, image_path: Optional[str] = None) -> bool:
    _log("-> X (Twitter) へ投稿を試行します...")
    if DRY_RUN:
        _log("DRY_RUN=1 のため投稿は行いません（プレビュー表示）。")
        _log("--- 投稿テキスト ---\n" + text + "\n--- /テキスト ---")
        if image_path:
            _log(f"画像パス: {image_path}")
        return True

    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        _log("Twitter 認証情報が .env に見つかりません。投稿を中止します。")
        return False

    try:
        auth_v1 = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth_v1)
        client_v2 = tweepy.Client(consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET, access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)
        media_ids = []
        if image_path and os.path.exists(image_path):
            _log(f"画像アップロード: {image_path}")
            media = api_v1.media_upload(filename=image_path)
            media_ids.append(media.media_id)
        _log("ツイート投稿中...")
        response = client_v2.create_tweet(text=text, media_ids=media_ids if media_ids else None)
        _log("ツイート投稿完了。")
        try:
            tid = response.data['id']
            _log(f"投稿URL例: https://x.com/anyuser/status/{tid}")
        except Exception:
            pass
        return True
    except Exception as e:
        _log(f"Twitter投稿エラー: {e}\n{traceback.format_exc()}")
        return False

# --- 実行案内 ---
if __name__ == "__main__":
    _log("画像は debug_preview.py で生成して確認してください。")