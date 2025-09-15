import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import tweepy
from datetime import datetime
from dotenv import load_dotenv
from urllib.parse import urlencode

# --- 設定 ---

# .envファイルから認証情報を読み込み
load_dotenv()
TWITTER_CONSUMER_KEY = os.getenv("TWITTER_CONSUMER_KEY")
TWITTER_CONSUMER_SECRET = os.getenv("TWITTER_CONSUMER_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN") # v2 API用に必要

# 投稿内容を自由に設定してテスト
SAMPLE_DATA = {
    "date": "2025-09-16",
    "venue_name": "大井",
    "race_number": 11,
    "race_name": "トワイライトカップ",
    "horse_name": "ギャラクシーダッシュ",
    "deviation_score": 68.45,
    "race_id": "202544091611" # 中央なら01-10, 地方なら30-
}

# 生成するOGP画像のファイル名
OG_IMAGE_FILENAME = "debug_og_image.png"
SITE_BASE_URL = "https://uma-free.com"

# --- OGP画像生成関数 (日本語対応版) ---

def generate_og_image(data: dict):
    """Pillowを使って日本語対応のOGP画像をローカルに生成する"""
    print("1. OGP画像を生成しています...")
    try:
        # --- ▼▼▼ フォントファイルのパスを修正 ▼▼▼ ---
        font_en_bold_path = "Inter-Bold.ttf"
        font_en_black_path = "Inter-Black.ttf"
        font_jp_bold_path = "MPLUSRounded1c-Bold.ttf"
        font_jp_black_path = "MPLUSRounded1c-Black.ttf"
        logo_path = "new-logo.png"

        # フォントを読み込み (英語用と日本語用)
        font_en_xxl = ImageFont.truetype(font_en_black_path, 48)
        font_jp_s = ImageFont.truetype(font_jp_bold_path, 20)
        font_jp_m = ImageFont.truetype(font_jp_bold_path, 28)
        font_jp_l = ImageFont.truetype(font_jp_bold_path, 36)
        font_jp_xl = ImageFont.truetype(font_jp_black_path, 72)
        font_score = ImageFont.truetype(font_en_bold_path, 32)
        # --- ▲▲▲ 修正ここまで ▲▲▲ ---
        
        # 画像の土台を作成
        width, height = 1200, 630
        img = Image.new('RGB', (width, height), (243, 244, 246))

        # 背景グラデーションを描画
        draw = ImageDraw.Draw(img)
        for i in range(height):
            ratio = i / height
            r = int(224 + (243 - 224) * ratio)
            g = int(231 + (244 - 231) * ratio)
            b = int(255 + (246 - 255) * ratio)
            draw.line([(0, i), (width, i)], fill=(r, g, b))

        # サイトロゴとタイトル
        logo = Image.open(logo_path).convert("RGBA").resize((80, 80))
        img.paste(logo, (200, 80), logo)
        draw.text((300, 85), "UMA-FREE", font=font_en_xxl, fill=(55, 48, 163))
        draw.text((300, 140), "無料AI競馬予測", font=font_jp_s, fill=(107, 114, 128))

        # メインコンテンツの白いカード
        card_x, card_y, card_w, card_h = 150, 220, 900, 350
        draw.rounded_rectangle((card_x, card_y, card_x + card_w, card_y + card_h), radius=16, fill=(255, 255, 255), outline=(229, 231, 235), width=1)
        
        # 注目馬情報
        formatted_date = datetime.strptime(data['date'], '%Y-%m-%d').strftime('%Y年%m月%d日')
        draw.text((width / 2, 250), f"{formatted_date} のAI注目馬", font=font_jp_m, fill=(79, 70, 229), anchor="mm")
        
        race_info = f"{data['venue_name']} {data['race_number']}R {data['race_name']}"
        draw.text((width / 2, 305), race_info, font=font_jp_l, fill=(31, 41, 55), anchor="mm")
        
        draw.text((width / 2, 380), data['horse_name'], font=font_jp_xl, fill=(17, 24, 39), anchor="mm")
        
        # AI偏差値
        score_text = f"AI偏差値: {data['deviation_score']:.2f}"
        # 日本語と英語が混在するため、日本語フォントでbboxを計算
        score_bbox = draw.textbbox((0,0), "AI偏差値: 00.00", font=font_jp_m) 
        score_w = score_bbox[2] - score_bbox[0] + 40 # 少し余裕を持たせる
        score_h = score_bbox[3] - score_bbox[1] + 10
        
        score_bg_x = (width - score_w) / 2
        score_bg_y = 450
        draw.rounded_rectangle((score_bg_x, score_bg_y, score_bg_x + score_w, score_bg_y + score_h), radius=99, fill=(238, 242, 255))
        
        # 日本語と英語でフォントを使い分けて描画
        draw.text((width/2 - 25, score_bg_y + score_h/2), "AI偏差値: ", font=font_jp_m, fill=(67, 56, 202), anchor="rm")
        draw.text((width/2 - 25, score_bg_y + score_h/2), f"{data['deviation_score']:.2f}", font=font_score, fill=(67, 56, 202), anchor="lm")


        img.save(OG_IMAGE_FILENAME)
        print(f"✅ OGP画像 '{OG_IMAGE_FILENAME}' を正常に生成しました。")
        return OG_IMAGE_FILENAME
    except FileNotFoundError as e:
        print(f"❌ エラー: 必要なファイルが見つかりません: {e.filename}")
        print("👉 事前準備セクションを確認し、フォントとロゴ画像をスクリプトと同じ場所に配置してください。")
        return None
    except Exception as e:
        print(f"❌ OGP画像の生成中にエラーが発生しました: {e}")
        return None


# --- 投稿テキスト生成関数 (変更なし) ---
def create_tweet_text(data: dict) -> str:
    print("2. 投稿用テキストを生成しています...")
    date_str = data['date']
    query_params = urlencode({'venue': data['venue_name'], 'race': data['race_number']})
    race_url = f"{SITE_BASE_URL}/races/{date_str}?{query_params}"
    is_jra = int(data['race_id'][4:6]) < 30
    hashtags = ["#競馬", "#競馬予想", "#AI予想", "#中央競馬" if is_jra else "#地方競馬", f"#{data['venue_name']}"]
    text = f"""🏇今日のAI注目馬 ({datetime.strptime(date_str, '%Y-%m-%d').strftime('%m/%d')})🏇

【{data['venue_name']}{data['race_number']}R {data['race_name']}】
◎ {data['horse_name']} (AI偏差値: {data['deviation_score']:.2f})

▼詳細な予測・全レースのAI印はこちらから
{race_url}

{' '.join(hashtags)}
"""
    print("✅ 投稿用テキストを正常に生成しました。")
    return text


# --- X (Twitter) 投稿関数 (変更なし) ---
def post_to_twitter(text: str, image_path: str):
    print("3. X (Twitter) への投稿を試みています...")
    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET, TWITTER_BEARER_TOKEN]):
        print("⚠️ Twitter APIの認証情報が不足しています。.envファイルを確認してください。")
        print("--- 投稿プレビュー ---")
        print(text)
        print(f"画像: {image_path}")
        print("---------------------")
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

# --- メイン処理 (変更なし) ---
if __name__ == "__main__":
    print("="*50)
    print("SNS自動投稿 デバッグスクリプト")
    print("="*50)
    
    image_file = generate_og_image(SAMPLE_DATA)
    
    if image_file:
        tweet_text = create_tweet_text(SAMPLE_DATA)
        post_to_twitter(tweet_text, image_file)
        
    print("\nデバッグ処理が完了しました。")

