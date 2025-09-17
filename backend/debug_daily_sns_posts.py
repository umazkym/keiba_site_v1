import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import random
import time
import json
from typing import Optional, List, Dict, Any
import traceback
import argparse
import re

# --- 基本設定 ---
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
SITE_BASE_URL = "https://uma-free.com"
IMAGE_OUTPUT_DIR = "debug_sns_images"
os.makedirs(IMAGE_OUTPUT_DIR, exist_ok=True)

# JRA重賞リスト (変更なし - 省略)
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

# --- ヘルパー関数群 ---
def _now_str():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")

def _log(msg: str):
    print(f"{_now_str()} {msg}")

def _get_font_path(font_name):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, "fonts")
    font_path = os.path.join(font_dir, font_name)
    if not os.path.exists(font_path):
        raise FileNotFoundError(f"フォントファイルが見つかりません: {font_path}")
    return font_path

def get_api_data(endpoint: str, retries: int = 3, delay: int = 5) -> Optional[Any]:
    _log(f"APIにアクセス中: {endpoint}")
    for attempt in range(retries):
        try:
            url = f"{API_BASE_URL}/api/v1/predictions/{endpoint}"
            res = requests.get(url, timeout=90)
            if res.status_code == 200 and res.json():
                _log("-> データ取得成功")
                return res.json()
            if res.status_code == 404:
                _log("-> データなし (404 Not Found)")
                return None
            _log(f"-> データ取得失敗 (Status: {res.status_code})")
        except requests.RequestException as e:
            _log(f"-> API接続エラー (試行 {attempt + 1}/{retries}): {e}")
        if attempt < retries - 1:
            time.sleep(delay)
    return None

def draw_centered_text(draw, text, font, fill_color, image_width, y_position, **kwargs):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
    except AttributeError:
        text_width, _ = draw.textsize(text, font=font)
    x_position = (image_width - text_width) / 2
    draw.text((x_position, y_position), text, fill=fill_color, font=font, **kwargs)

# --- ロゴ読み込み関数 ---
def load_logo():
    """ロゴ画像を読み込んでリサイズする"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        logo_path = os.path.join(base_dir, "fonts", "new-logo.png")
        if os.path.exists(logo_path):
            logo = Image.open(logo_path)
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            # ロゴサイズ調整（高さ40pxを基準）
            aspect_ratio = logo.width / logo.height
            new_height = 40
            new_width = int(new_height * aspect_ratio)
            logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
            return logo
    except Exception as e:
        _log(f"ロゴ読み込みエラー: {e}")
    return None

# ==============================================================================
# ▼▼▼ パターンA: 的中＋注目馬 - デザイン1 (#4f46e5系に修正) ▼▼▼
# ==============================================================================

def generate_hit_og_image_design1(hit_data: dict, date_str: str) -> Optional[str]:
    """的中報告デザイン1: 斜めグラデーション＋カード (紫系)"""
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_hit_{date_str}_d1.png")
    _log(f"-> 的中報告用のOGP画像を生成: {filename} [Design 1]")
    
    try:
        font_light = _get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = _get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = _get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = _get_font_path("MPLUSRounded1c-Black.ttf")
        
        # 背景（紫系のグラデーション）
        img = Image.new('RGB', (1200, 630), (79, 70, 229)) # #4f46e5
        draw = ImageDraw.Draw(img)
        
        # 斜めグラデーション
        color_start = (129, 140, 248) # #818cf8 (indigo-400)
        color_end = (55, 48, 163)   # #3730a3 (indigo-800)
        for y in range(630):
            for x in range(1200):
                ratio = (x + y) / (1200 + 630)
                r = int(color_start[0] * (1 - ratio) + color_end[0] * ratio)
                g = int(color_start[1] * (1 - ratio) + color_end[1] * ratio)
                b = int(color_start[2] * (1 - ratio) + color_end[2] * ratio)
                if x % 10 == 0 and y % 10 == 0:
                    draw.rectangle([(x, y), (x+10, y+10)], fill=(r, g, b))
        
        # ロゴ配置（左上）
        logo = load_logo()
        if logo:
            img.paste(logo, (50, 40), logo)
        
        # メインカード（白半透明）
        card_x, card_y, card_w, card_h = 150, 180, 900, 320
        draw.rounded_rectangle(
            [(card_x, card_y), (card_x + card_w, card_y + card_h)],
            radius=20,
            fill=(255, 255, 255, 230),
            outline=(255, 255, 255),
            width=2
        )
        
        # カテゴリラベル
        label_y = card_y - 30
        draw.rounded_rectangle(
            [(500, label_y), (700, label_y + 50)],
            radius=25,
            fill=(79, 70, 229), # #4f46e5
            outline=(255, 255, 255),
            width=2
        )
        draw_centered_text(draw, "的中速報", ImageFont.truetype(font_bold, 24), (255, 255, 255), img.width, label_y + 12)
        
        # レース情報
        race_text = f"{hit_data['venue_name']} {hit_data['race_number']}R"
        draw_centered_text(draw, race_text, ImageFont.truetype(font_regular, 32), (80, 80, 80), img.width, card_y + 50)
        
        # ベットタイプ
        draw_centered_text(draw, hit_data['bet_type'], ImageFont.truetype(font_bold, 36), (100, 100, 100), img.width, card_y + 100)
        
        # 配当金額
        payout_text = f"¥{hit_data['payout']:,}"
        draw_centered_text(draw, payout_text, ImageFont.truetype(font_black, 90), (79, 70, 229), img.width, card_y + 180)
        
        # 日付
        date_formatted = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y/%m/%d')
        draw.text((50, img.height - 80), date_formatted, font=ImageFont.truetype(font_light, 18), fill=(220, 220, 255))
        
        # URL（右下）
        draw.text((img.width - 200, img.height - 80), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(220, 220, 255))
        
        img.save(filename, quality=95, optimize=True)
        return filename
        
    except Exception as e:
        _log(f"❌ Hit OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None


# ==============================================================================
# ▼▼▼ パターンC: 重賞 - 配色2（紺色）のみ ▼▼▼
# ==============================================================================

def generate_reminder_og_image_color2(race: dict, top_preds: list) -> Optional[str]:
    """重賞デザイン配色2: 紺色グラデーション"""
    random_suffix = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
    filename = os.path.join(IMAGE_OUTPUT_DIR, f"og_reminder_{race['id']}_{random_suffix}_c2.png")
    _log(f"-> 重賞レース用のOGP画像を生成: {filename} [Color 2]")
    
    try:
        font_light = _get_font_path("MPLUSRounded1c-Light.ttf")
        font_regular = _get_font_path("MPLUSRounded1c-Regular.ttf")
        font_bold = _get_font_path("MPLUSRounded1c-Bold.ttf")
        font_black = _get_font_path("MPLUSRounded1c-Black.ttf")
        
        # 背景（紺色グラデーション）
        img = Image.new('RGB', (1200, 630), (30, 40, 80))
        draw = ImageDraw.Draw(img)
        
        for y in range(630):
            ratio = y / 630
            r = int(30 + 20 * ratio)
            g = int(40 + 30 * ratio)
            b = int(80 + 40 * ratio)
            draw.line([(0, y), (1200, y)], fill=(r, g, b))
        
        # アクセントライン（シルバー）
        draw.rectangle([(0, 0), (1200, 4)], fill=(192, 192, 192))
        
        # ロゴ配置
        logo = load_logo()
        if logo:
            img.paste(logo, (50, 40), logo)
        
        # 重賞ラベル
        draw.text((60, 100), "重賞", font=ImageFont.truetype(font_black, 24), fill=(192, 192, 192))
        
        # レース名
        draw_centered_text(draw, race['race_name'], ImageFont.truetype(font_black, 60), (255, 255, 255), img.width, 150)
        
        # 開催情報
        venue_info = f"{race['venue_name']} {datetime.strptime(race['race_date'], '%Y-%m-%d').strftime('%m/%d')}"
        draw_centered_text(draw, venue_info, ImageFont.truetype(font_light, 24), (200, 200, 200), img.width, 230)
        
        # 予想馬
        y_start = 320
        colors = [(255, 255, 100), (200, 200, 255), (255, 200, 200)]
        marks = ["◎", "○", "▲"]
        
        for i, p in enumerate(top_preds):
            y_pos = y_start + i * 70
            
            # マーク
            draw.text((350, y_pos), marks[i], font=ImageFont.truetype(font_black, 36), fill=colors[i])
            
            # 馬名
            draw.text((420, y_pos + 5), p['horse_name'], font=ImageFont.truetype(font_bold, 30), fill=(255, 255, 255))
            
            # スコア
            score_text = f"{p.get('deviation_score', 0):.1f}"
            draw.text((800, y_pos + 5), score_text, font=ImageFont.truetype(font_regular, 28), fill=(200, 200, 200))
        
        # URL
        draw.text((img.width - 200, img.height - 80), "uma-free.com", font=ImageFont.truetype(font_regular, 20), fill=(200, 200, 200))
        
        img.save(filename, quality=95, optimize=True)
        return filename
        
    except Exception as e:
        _log(f"❌ Reminder OGP生成エラー: {e}\n{traceback.format_exc()}")
        return None

# --- テキスト生成関数群 (変更なし) ---
def create_combined_tweet_text(hits, summary, pick_data, date_str):
    _log("-> 的中報告＋注目馬の投稿テキストを生成...")
    top_hit = hits[0]
    hashtags = ["#競馬", "#AI予想", "#万馬券" if top_hit['payout'] >= 10000 else "#的中"]
    
    hit_texts = [
        f"🎯昨日のAI的中ハイライト ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🎯",
        f"\n昨日の最高配当は【{top_hit['payout']:,}円】でした！({top_hit['venue_name']}{top_hit['race_number']}R {top_hit['bet_type']})"
    ]
    
    other_hits = [h for h in hits[1:3] if h['payout'] >= 10000]
    if other_hits:
        hit_texts.append("\n\n他にも万馬券が…")
        for hit in other_hits:
            hit_texts.append(f"\n・{hit['venue_name']}{hit['race_number']}R: {hit['payout']:,}円")
    
    summary_text = f"\n\n📈昨日のAI本命馬(◎)成績\n[{summary['win']}-{summary['second']}-{summary['third']}-{summary['other']}]\n勝率: {summary['win_rate']:.1f}% / 複勝率: {summary['in_money_rate']:.1f}%"
    
    pick_text = ""
    if pick_data:
        hashtags.append(f"#{pick_data['horse_name']}")
        pick_text = f"\n---\n🏇本日のAI注目馬🏇\n【{pick_data['venue_name']}{pick_data['race_number']}R】\n◎ {pick_data['horse_name']} (AI偏差値: {pick_data['deviation_score']:.2f})"
    
    return f"{''.join(hit_texts)}\n{summary_text}\n{pick_text}\n\n▼全レースのAI印と詳細データはこちら\n{SITE_BASE_URL}\n\n{' '.join(hashtags)}"

def create_pick_tweet_text(data, date_str):
    _log("-> 注目馬（単独）の投稿テキストを生成...")
    race_type = data.get('race_type', '地方')
    is_jra = race_type == '中央'
    hashtags = ["#競馬", "#AI予想", "#中央競馬" if is_jra else "#地方競馬", f"#{data['venue_name']}競馬", f"#{data['horse_name']}"]
    
    return f"🏇本日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🏇\n\nAIが選んだ今日の鉄板候補はこちら！\n【{data['venue_name']}{data['race_number']}R {data['race_name']}】\n◎ {data['horse_name']} (AI偏差値: {data['deviation_score']:.2f})\n\nあなたの本命は？リプライで教えて！\n\n▼全レースのAI印と詳細データはこちら\n{SITE_BASE_URL}/races/{date_str}?venue={data['venue_name']}&race={data['race_number']}\n\n{' '.join(hashtags)}"

def create_reminder_tweet_text(race, top_preds):
    _log("-> 重賞レースの投稿テキストを生成...")
    date_str = race['race_date']
    clean_race_name = re.sub(r'\(.+?\)|\[.+?\]|【.+?】', '', race['race_name']).strip()
    hashtags = ["#競馬", "#競馬予想", "#AI予想", f"#{clean_race_name}"]
    
    lines = [f"🏇本日の重賞 ({race['race_name']})🏇\n"]
    for p in top_preds:
        lines.append(f"{p['mark']} {p['horse_name']} (AI偏差値: {p.get('deviation_score', 0):.2f})")
    
    lines.append(f"\n\n▼詳細な予測・全レースのAI印はこちらから\n{SITE_BASE_URL}/races/{date_str}?venue={race['venue_name']}&race={race['race_number']}")
    lines.append(f"\n\n{' '.join(hashtags)}")
    
    return "\n".join(lines)

# --- メイン処理を修正して複数デザインを生成 ---
def main(target_date_str: str):
    _log(f"ターゲット日付: {target_date_str} のSNS投稿プレビューを生成します。")
    _log(f"デザインパターン: 的中報告 d1(新配色)、重賞 c2")
    
    target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    previous_date = target_date - timedelta(days=1)
    previous_date_str = previous_date.strftime('%Y-%m-%d')
    
    generated_posts = []
    
    _log("\n--- [1/2] 昨日の結果に応じた投稿を生成 ---")
    hits_data = get_api_data(f"hits/high-payouts/{previous_date_str}")
    
    if hits_data and hits_data[0]['payout'] >= 10000:
        _log("-> [パターンA] 高配当的中があったため、複合投稿を作成します。")
        
        # 的中報告のデザインを design 1 に絞り込む
        image_path = generate_hit_og_image_design1(hits_data[0], previous_date_str)
        if image_path:
            generated_posts.append({
                "type": f"A: 的中＋注目馬 (デザイン1, 新配色)",
                "image_path": image_path
            })

    _log("\n--- [2/2] 今日の重賞投稿を生成 ---")
    all_races_data_today = get_api_data(target_date_str)
    
    if all_races_data_today:
        venues = all_races_data_today.get('jra', [])
        for venue in venues:
            for race in venue.get('races', []):
                if any(grade_race in race.get('race_name', '') for grade_race in JRA_GRADE_RACE_NAMES):
                    _log(f"-> [パターンC] JRA重賞レース発見: {race['venue_name']} {race.get('race_name')}")
                    preds = sorted([p for p in race.get('predictions', []) if p.get('deviation_score')], 
                                   key=lambda p: p['deviation_score'], reverse=True)
                    top_preds = preds[:3]
                    
                    if len(top_preds) == 3:
                        # 重賞の配色を color 2 に絞り込む
                        image_path = generate_reminder_og_image_color2(race, top_preds)
                        if image_path:
                            generated_posts.append({
                                "type": f"C: 重賞 ({race.get('race_name')}) (配色2)",
                                "image_path": image_path
                            })
                        break # 最初の重賞だけ処理
            if any(post['type'].startswith("C:") for post in generated_posts):
                break
    
    print("\n" + "="*80)
    print(f"✅ {target_date_str} に関連する投稿画像の生成が完了しました。")
    print("="*80)
    
    if not generated_posts:
        print("\n生成された投稿はありませんでした。")
        return
    
    print("\n【生成された画像】")
    print("\n◆ 的中報告デザイン:")
    print("  デザイン1: 斜めグラデーション＋カード (紫系)")
    print("\n◆ 重賞配色:")
    print("  配色2: 紺色グラデーション")
    
    for i, post in enumerate(generated_posts):
        print(f"\n--- {i+1}. {post['type']} ---")
        print(f"画像パス: {post['image_path']}")
    
    print("\n" + "="*80)
    _log("画像生成完了。ご確認ください。")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="指定した日付のSNS投稿内容をまとめて確認するデバッグツール")
    parser.add_argument("date", type=str, help="対象の日付 (YYYY-MM-DD形式)")
    args = parser.parse_args()
    
    try:
        datetime.strptime(args.date, '%Y-%m-%d')
        main(args.date)
    except ValueError:
        print("エラー: 日付は YYYY-MM-DD 形式で指定してください。")
    except Exception as e:
        print(f"\n予期せぬエラーが発生しました: {e}")
        traceback.print_exc()