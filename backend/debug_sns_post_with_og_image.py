import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont
import tweepy
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from urllib.parse import urlencode
import random
import time

# --- 設定 ---
load_dotenv()
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN")

OG_IMAGE_FILENAME = "debug_og_image.png"
SITE_BASE_URL = "https://uma-free.com"
LOCAL_API_BASE_URL = "http://127.0.0.1:8000"

# --- API連携関数 (変更なし) ---
def get_special_pick_from_api(date_str: str):
    print(f"1. APIにアクセスして {date_str} の「注目馬」を取得...")
    try:
        url = f"{LOCAL_API_BASE_URL}/api/v1/predictions/special-pick/{date_str}"
        res = requests.get(url, timeout=30)
        if res.status_code == 200 and res.json():
            data = res.json()
            if data and data.get('horse_id'):
                print(f"✅ 注目馬「{data['horse_name']}」のデータを取得しました。")
                return data
        print(f"⚠️ 注目馬データは見つかりませんでした (Status: {res.status_code})")
        return None
    except requests.ConnectionError:
        print("❌ APIサーバー接続エラー。`uvicorn`が起動しているか確認してください。")
        return None
    except Exception as e:
        print(f"❌ APIデータ取得エラー: {e}")
        return None

def get_high_payout_hits_from_api(date_str: str):
    print(f"1. APIにアクセスして {date_str} の「的中報告」を取得...")
    try:
        url = f"{LOCAL_API_BASE_URL}/api/v1/predictions/hits/high-payouts/{date_str}"
        res = requests.get(url, timeout=30)
        if res.status_code == 200 and res.json():
            hits = res.json()
            print(f"✅ {len(hits)}件の高配当的中データを取得しました。")
            return hits
        print(f"⚠️ 高配当的中データは見つかりませんでした (Status: {res.status_code})")
        return None
    except requests.ConnectionError:
        print("❌ APIサーバー接続エラー。`uvicorn`が起動しているか確認してください。")
        return None
    except Exception as e:
        print(f"❌ APIデータ取得エラー: {e}")
        return None

# --- OGP画像生成関数 (変更なし) ---
def generate_pick_og_image(data: dict, date_str: str):
    print("2. 注目馬用のOGP画像を生成しています...")
    try:
        font_en_bold_path = "Inter-Bold.ttf"
        font_en_black_path = "Inter-Black.ttf"
        font_jp_bold_path = "MPLUSRounded1c-Bold.ttf"
        font_jp_black_path = "MPLUSRounded1c-Black.ttf"
        logo_path = "new-logo.png"

        font_en_xxl = ImageFont.truetype(font_en_black_path, 48)
        font_jp_s = ImageFont.truetype(font_jp_bold_path, 20)
        font_jp_m = ImageFont.truetype(font_jp_bold_path, 28)
        font_jp_l = ImageFont.truetype(font_jp_bold_path, 36)
        font_jp_xl = ImageFont.truetype(font_jp_black_path, 72)
        font_score = ImageFont.truetype(font_en_bold_path, 32)
        
        width, height = 1200, 630
        img = Image.new('RGB', (width, height), (243, 244, 246))
        draw = ImageDraw.Draw(img)
        for i in range(height):
            ratio = i / height
            r, g, b = int(224 + (243 - 224) * ratio), int(231 + (244 - 231) * ratio), int(255 + (246 - 255) * ratio)
            draw.line([(0, i), (width, i)], fill=(r, g, b))

        logo = Image.open(logo_path).convert("RGBA").resize((80, 80))
        img.paste(logo, (200, 80), logo)
        draw.text((300, 85), "UMA-FREE", font=font_en_xxl, fill=(55, 48, 163))
        draw.text((300, 140), "無料AI競馬予測", font=font_jp_s, fill=(107, 114, 128))

        card_x, card_y, card_w, card_h = 150, 220, 900, 350
        draw.rounded_rectangle((card_x, card_y, card_x + card_w, card_y + card_h), radius=16, fill=(255, 255, 255), outline=(229, 231, 235), width=1)
        
        formatted_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y年%m月%d日')
        draw.text((width / 2, 250), f"{formatted_date} のAI注目馬", font=font_jp_m, fill=(79, 70, 229), anchor="mm")
        
        race_info = f"{data['venue_name']} {data['race_number']}R {data['race_name']}"
        draw.text((width / 2, 305), race_info, font=font_jp_l, fill=(31, 41, 55), anchor="mm")
        
        draw.text((width / 2, 380), data['horse_name'], font=font_jp_xl, fill=(17, 24, 39), anchor="mm")
        
        score_bbox = draw.textbbox((0,0), "AI偏差値: 00.00", font=font_jp_m) 
        score_w, score_h = score_bbox[2] - score_bbox[0] + 40, score_bbox[3] - score_bbox[1] + 10
        
        score_bg_x, score_bg_y = (width - score_w) / 2, 450
        draw.rounded_rectangle((score_bg_x, score_bg_y, score_bg_x + score_w, score_bg_y + score_h), radius=99, fill=(238, 242, 255))
        
        draw.text((width/2 - 25, score_bg_y + score_h/2), "AI偏差値: ", font=font_jp_m, fill=(67, 56, 202), anchor="rm")
        draw.text((width/2 - 25, score_bg_y + score_h/2), f"{data['deviation_score']:.2f}", font=font_score, fill=(67, 56, 202), anchor="lm")

        img.save(OG_IMAGE_FILENAME)
        print(f"✅ OGP画像 '{OG_IMAGE_FILENAME}' を正常に生成しました。")
        return OG_IMAGE_FILENAME
    except FileNotFoundError as e:
        print(f"❌ エラー: 必要なファイルが見つかりません: {e.filename}")
        return None
    except Exception as e:
        print(f"❌ OGP画像の生成中にエラーが発生しました: {e}")
        return None

def generate_hit_og_image(hit_data: dict):
    """的中報告用のOGP画像を生成する (変更なし)"""
    print("2. 的中報告用のOGP画像を生成しています...")
    try:
        font_en_black_path = "Inter-Black.ttf"
        font_jp_bold_path = "MPLUSRounded1c-Bold.ttf"
        logo_path = "new-logo.png"

        font_en_xxl = ImageFont.truetype(font_en_black_path, 48)
        font_jp_s = ImageFont.truetype(font_jp_bold_path, 20)
        font_jp_m = ImageFont.truetype(font_jp_bold_path, 28)
        font_jp_l = ImageFont.truetype(font_jp_bold_path, 36)
        font_payout = ImageFont.truetype(font_en_black_path, 100)
        font_payout_yen = ImageFont.truetype(font_jp_bold_path, 80)

        width, height = 1200, 630
        img = Image.new('RGB', (width, height), '#059669')
        draw = ImageDraw.Draw(img)

        for _ in range(100):
            x, y = random.uniform(0, width), random.uniform(0, height)
            r = random.uniform(10, 40)
            color = random.choice([(252, 211, 77, 50), (248, 113, 113, 50), (59, 130, 246, 50)])
            draw.ellipse((x-r, y-r, x+r, y+r), fill=color)

        logo = Image.open(logo_path).convert("RGBA").resize((60, 60))
        img.paste(logo, (50, 50), logo)
        draw.text((120, 55), "UMA-FREE", font=font_en_xxl, fill=(255, 255, 255))

        draw.text((width/2, 150), "🎉 AI高配当的中報告 🎉", font=font_jp_l, fill='#fde047', anchor="mm", stroke_width=2, stroke_fill='#ca8a04')
        
        race_info = f"{hit_data['venue_name']} {hit_data['race_number']}R {hit_data['race_name']}"
        draw.text((width/2, 210), race_info, font=font_jp_m, fill=(255, 255, 255), anchor="mm")
        
        bet_info = f"{hit_data['bet_type']} {hit_data['winning_numbers']}"
        draw.text((width/2, 260), bet_info, font=font_jp_l, fill=(255, 255, 255), anchor="mm")

        payout_text = f"{hit_data['payout']:,}"
        payout_bbox = draw.textbbox((0,0), payout_text, font=font_payout)
        yen_bbox = draw.textbbox((0,0), "円", font=font_payout_yen)
        
        total_width = (payout_bbox[2] - payout_bbox[0]) + (yen_bbox[2] - yen_bbox[0]) + 10
        start_x = (width - total_width) / 2

        draw.text((start_x, 380), payout_text, font=font_payout, fill='#facc15', anchor="ls", stroke_width=3, stroke_fill='#b45309')
        draw.text((start_x + (payout_bbox[2] - payout_bbox[0]) + 10, 380), "円", font=font_payout_yen, fill='#facc15', anchor="ls", stroke_width=3, stroke_fill='#b45309')
        
        draw.text((width/2, 580), "https://uma-free.com", font=font_jp_s, fill=(209, 213, 219, 200), anchor="mm")

        img.save(OG_IMAGE_FILENAME)
        print(f"✅ OGP画像 '{OG_IMAGE_FILENAME}' を正常に生成しました。")
        return OG_IMAGE_FILENAME
    except Exception as e:
        print(f"❌ OGP画像の生成中にエラーが発生しました: {e}")
        return None

# --- テキスト生成 & 投稿関数 ---
def create_pick_tweet_text(data: dict, date_str: str) -> str:
    """注目馬用の投稿テキストを生成する (URLとハッシュタグを修正)"""
    print("3. 注目馬の投稿テキストを生成...")
    is_jra = int(data['race_id'][4:6]) < 30
    hashtags = [
        "#競馬", "#競馬予想", "#AI予想",
        "#中央競馬" if is_jra else "#地方競馬",
        f"#{data['venue_name']}",
        f"#{data['horse_name']}" # 馬名をハッシュタグに追加
    ]
    text = f"""🏇本日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🏇

【{data['venue_name']}{data['race_number']}R {data['race_name']}】
◎ {data['horse_name']} (AI偏差値: {data['deviation_score']:.2f})

▼全レースのAI印・詳細データはこちら
{SITE_BASE_URL}

{' '.join(hashtags)}
"""
    return text

def create_hit_tweet_text(all_hits: list) -> str:
    """的中報告用の投稿テキストを生成する (複数的中とURL、ハッシュタグを修正)"""
    print("3. 的中報告の投稿テキストを生成...")
    if not all_hits: return ""
    
    top_hit = all_hits[0]
    date_str = top_hit['race_date']
    
    # レース名からスペースを除去してハッシュタグを作成
    race_name_hashtag = f"#{top_hit['race_name'].replace(' ', '')}"
    
    hashtags = [
        "#競馬", "#AI予想", "#万馬券",
        f"#{top_hit['venue_name']}",
        race_name_hashtag
    ]
    
    text = f"""🎉 AI高配当的中！ 🎉

【{datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')} {top_hit['venue_name']}{top_hit['race_number']}R】
{top_hit['bet_type']} {top_hit['winning_numbers']}
💰 **{top_hit['payout']:,}円** の払い戻し！
"""
    
    # 2件目以降の的中を追加（最大4件まで）
    other_hits = all_hits[1:5]
    if other_hits:
        text += "\nその他にも万馬券的中🎯\n"
        for hit in other_hits:
            text += f"・{hit['venue_name']}{hit['race_number']}R ({hit['bet_type']}): {hit['payout']:,}円\n"

    text += f"""
▼レース結果とAIの印はこちら
{SITE_BASE_URL}

{' '.join(hashtags)}
"""
    return text

def post_to_twitter(text: str, image_path: str):
    print("4. X (Twitter) への投稿を試みています...")
    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET, TWITTER_BEARER_TOKEN]):
        print("⚠️ Twitter APIの認証情報が不足しています。.envファイルを確認してください。")
        return
    try:
        auth = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
        api_v1 = tweepy.API(auth)
        client_v2 = tweepy.Client(bearer_token=TWITTER_BEARER_TOKEN, consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET, access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)
        media = api_v1.media_upload(filename=image_path)
        response = client_v2.create_tweet(text=text, media_ids=[media.media_id])
        tweet_id = response.data['id']
        print("🎉 投稿に成功しました！")
        print(f"🔗 https://twitter.com/user/status/{tweet_id}")
    except Exception as e:
        print(f"❌ Xへの投稿中にエラーが発生しました: {e}")

# --- メイン処理 ---
if __name__ == "__main__":
    print("="*50)
    print("【cron動作シミュレーション】SNS自動投稿スクリプト")
    print("="*50)

    jst = timezone(timedelta(hours=9))
    
    # --- 1. 的中報告 (昨日のデータ) ---
    print("\n--- [フェーズ1/2] 昨日の的中報告を実行 ---")
    yesterday = datetime.now(jst) - timedelta(days=1)
    yesterday_str = yesterday.strftime('%Y-%m-%d')
    
    hits_data = get_high_payout_hits_from_api(yesterday_str)
    if hits_data:
        top_hit = hits_data[0]
        print(f"最高配当の的中を発見: {top_hit['payout']:,}円")
        image_file = generate_hit_og_image(top_hit)
        if image_file:
            tweet_text = create_hit_tweet_text(hits_data)
            post_to_twitter(tweet_text, image_file)
    else:
        print("昨日は高配当的中がなかったため、投稿をスキップします。")

    # 投稿間のクールダウン
    print("\n--- 連続投稿を避けるため5秒間待機します ---")
    time.sleep(5)

    # --- 2. 注目馬 (今日のデータ) ---
    print("\n--- [フェーズ2/2] 今日の注目馬投稿を実行 ---")
    today = datetime.now(jst)
    today_str = today.strftime('%Y-%m-%d')

    pick_data = get_special_pick_from_api(today_str)
    if pick_data:
        image_file = generate_pick_og_image(pick_data, today_str)
        if image_file:
            tweet_text = create_pick_tweet_text(pick_data, today_str)
            post_to_twitter(tweet_text, image_file)
    else:
        print("本日の注目馬は見つからなかったため、投稿をスキップします。")

    print("\ncronジョブのシミュレーションが完了しました。")
