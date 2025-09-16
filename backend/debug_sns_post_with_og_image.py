# debug_sns_post_with_og_image.py
import os
import sys
import requests
from PIL import Image, ImageDraw, ImageFont
import tweepy
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import random
import time
import traceback
import json
from typing import Optional

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

# 表示モード（環境変数で切替可能）
MODE = os.getenv("MODE", "PRODUCTION")
# テスト時に実際にTwitterへ投稿したくない場合は DRY_RUN=1 を .env に入れてください
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
# pending 処理モード: 起動時にキューを処理したい場合は PROCESS_PENDING=1 を .env に入れるか CLI で設定
PROCESS_PENDING = os.getenv("PROCESS_PENDING", "0") == "1"

# pending file path
PENDING_POSTS_PATH = os.getenv("PENDING_POSTS_PATH", "pending_posts.json")

# レート制限で「長すぎる待ち時間」と見なしてキュー登録する閾値（秒）
MAX_WAIT_BEFORE_QUEUE = float(os.getenv("MAX_WAIT_BEFORE_QUEUE", "120.0"))
# 個々の待機を最大何秒まで行うか（長時間ブロックを避けるため）
MAX_SINGLE_SLEEP = float(os.getenv("MAX_SINGLE_SLEEP", "60.0"))

# --- ログユーティリティ ---
def now_str():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M:%S")

def log(msg: str, prefix: str = ""):
    print(f"{now_str()} {prefix}{msg}")

def notify_block(title: str, body_lines: list):
    print("\n[NOTIFICATION]")
    print(f"✅ {title}")
    for line in body_lines:
        print(line)
    print()

def divider():
    print("=" * 50)

def format_seconds(sec: float) -> str:
    return f"{sec:.2f} 秒"

# --- API functions (unchanged) ---
def get_special_pick_from_api(date_str: str):
    log(f"1. APIにアクセスして {date_str} の「注目馬」を取得...", prefix="")
    try:
        url = f"{LOCAL_API_BASE_URL}/api/v1/predictions/special-pick/{date_str}"
        res = requests.get(url, timeout=30)
        if res.status_code == 200 and res.json():
            data = res.json()
            if data and data.get('horse_id'):
                log(f"✅ 注目馬「{data['horse_name']}」のデータを取得しました。")
                return data
        log(f"⚠️ 注目馬データは見つかりませんでした (Status: {res.status_code})")
        return None
    except requests.ConnectionError:
        log("❌ APIサーバー接続エラー。`uvicorn`が起動しているか確認してください。")
        return None
    except Exception as e:
        log(f"❌ APIデータ取得エラー: {e}")
        return None

def get_high_payout_hits_from_api(date_str: str):
    log(f"1. APIにアクセスして {date_str} の「的中報告」を取得...", prefix="")
    try:
        url = f"{LOCAL_API_BASE_URL}/api/v1/predictions/hits/high-payouts/{date_str}"
        res = requests.get(url, timeout=30)
        if res.status_code == 200 and res.json():
            hits = res.json()
            log(f"✅ {len(hits)}件の高配当的中データを取得しました。")
            return hits
        log(f"⚠️ 高配当的中データは見つかりませんでした (Status: {res.status_code})")
        return None
    except requests.ConnectionError:
        log("❌ APIサーバー接続エラー。`uvicorn`が起動しているか確認してください。")
        return None
    except Exception as e:
        log(f"❌ APIデータ取得エラー: {e}")
        return None

# --- OGP 生成（unchanged） ---
def generate_pick_og_image(data: dict, date_str: str):
    log("2. 注目馬用のOGP画像を生成しています...")
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
        log(f"✅ OGP画像 '{OG_IMAGE_FILENAME}' を正常に生成しました。")
        return OG_IMAGE_FILENAME
    except FileNotFoundError as e:
        log(f"❌ エラー: 必要なファイルが見つかりません: {e.filename}")
        return None
    except Exception as e:
        log(f"❌ OGP画像の生成中にエラーが発生しました: {e}")
        return None

def generate_hit_og_image(hit_data: dict):
    log("2. 的中報告用のOGP画像を生成しています...")
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
        log(f"✅ OGP画像 '{OG_IMAGE_FILENAME}' を正常に生成しました。")
        return OG_IMAGE_FILENAME
    except Exception as e:
        log(f"❌ OGP画像の生成中にエラーが発生しました: {e}")
        return None

# --- テキスト生成 ---
def create_pick_tweet_text(data: dict, date_str: str) -> str:
    log("3. 注目馬の投稿テキストを生成...")
    is_jra = int(data['race_id'][4:6]) < 30
    hashtags = [
        "#競馬", "#競馬予想", "#AI予想",
        "#中央競馬" if is_jra else "#地方競馬",
        f"#{data['venue_name']}",
        f"#{data['horse_name']}"
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
    log("3. 的中報告の投稿テキストを生成...")
    if not all_hits: return ""
    
    top_hit = all_hits[0]
    date_str = top_hit['race_date']
    
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

# --- pending 保存/処理ユーティリティ ---
def load_pending() -> list:
    if not os.path.exists(PENDING_POSTS_PATH):
        return []
    try:
        with open(PENDING_POSTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log(f"pending_posts の読み込みエラー: {e}")
        return []

def save_pending_list(lst: list):
    tmp = PENDING_POSTS_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(lst, f, ensure_ascii=False, indent=2)
        os.replace(tmp, PENDING_POSTS_PATH)
    except Exception as e:
        log(f"pending_posts の保存エラー: {e}")

def queue_post(text: str, image_path: str, reason: Optional[str] = None):
    pending = load_pending()
    entry = {
        "queued_at": datetime.now(timezone(timedelta(hours=9))).isoformat(),
        "text": text,
        "image_path": image_path,
        "reason": reason or "rate_limited"
    }
    pending.append(entry)
    save_pending_list(pending)
    log(f"⚠️ 投稿をキューに保存しました (pending_posts.json に追加)。 reason={entry['reason']}")

# --- レスポンスから推奨待機秒を取得 ---
def _get_wait_seconds_from_response(response):
    if response is None:
        return None
    headers = {}
    try:
        headers = response.headers or {}
    except Exception:
        try:
            headers = dict(getattr(response, "headers", {}) or {})
        except Exception:
            headers = {}
    ra = headers.get("Retry-After") or headers.get("retry-after")
    if ra:
        try:
            return float(ra)
        except Exception:
            pass
    xrl = headers.get("x-rate-limit-reset") or headers.get("X-Rate-Limit-Reset")
    if xrl:
        try:
            reset_ts = float(xrl)
            now_ts = time.time()
            wait = max(0, reset_ts - now_ts)
            return wait
        except Exception:
            pass
    return None

# --- 投稿関数（改良） ---
def post_to_twitter(text: str, image_path: str, max_retries: int = 5, backoff_factor: float = 2.0):
    log("4. X (Twitter) への投稿を試みています...")
    if DRY_RUN:
        log("⚠️ DRY_RUN=1 のため投稿は実行しません（テストモード）。")
        log(f"--- 投稿テキストプレビュー ---\n{text}\n--- /プレビュー ---")
        return True, None

    if not all([TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET, TWITTER_BEARER_TOKEN]):
        log("⚠️ Twitter APIの認証情報が不足しています。.envファイルを確認してください。")
        return False, "認証情報不足"

    auth = tweepy.OAuth1UserHandler(TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
    api_v1 = tweepy.API(auth)
    client_v2 = tweepy.Client(bearer_token=TWITTER_BEARER_TOKEN, consumer_key=TWITTER_CONSUMER_KEY, consumer_secret=TWITTER_CONSUMER_SECRET, access_token=TWITTER_ACCESS_TOKEN, access_token_secret=TWITTER_ACCESS_TOKEN_SECRET)

    media_obj = None
    last_err = None

    for attempt in range(1, max_retries + 1):
        try:
            if media_obj is None:
                log(f"投稿準備: メディアをアップロードします（試行 {attempt}/{max_retries}）...")
                media_obj = api_v1.media_upload(filename=image_path)
                log(f"メディアアップロード成功: media_id={getattr(media_obj, 'media_id', 'unknown')}")

            log(f"ツイート送信（試行 {attempt}/{max_retries}）...")
            response = client_v2.create_tweet(text=text, media_ids=[media_obj.media_id])
            tweet_id = None
            try:
                tweet_id = response.data['id']
            except Exception:
                try:
                    tweet_id = response.data.id
                except Exception:
                    tweet_id = None
            if tweet_id:
                log("🎉 投稿に成功しました！")
                log(f"🔗 https://twitter.com/user/status/{tweet_id}")
            else:
                log("🎉 投稿に成功しました（Tweet ID を取得できませんでした）。")
            return True, None

        except Exception as e:
            last_err = e
            err_message = str(e)
            response_attr = getattr(e, "response", None)
            status_code = None
            try:
                status_code = getattr(response_attr, "status_code", None)
            except Exception:
                status_code = None

            log(f"⚠️ 投稿エラー（試行 {attempt}/{max_retries}）: {err_message}")

            # --- デバッグ: レスポンスヘッダと本文を詳細ログ出力 ---
            if response_attr is not None:
                try:
                    # headers が dict で取れる前提で処理
                    headers = dict(response_attr.headers or {})
                except Exception:
                    try:
                        headers = dict(getattr(response_attr, "headers", {}) or {})
                    except Exception:
                        headers = {}

                if headers:
                    log("--- レスポンスヘッダ (debug) ---")
                    # 主要ヘッダを先に出すが、全て出力しておく
                    for k, v in headers.items():
                        log(f"{k}: {v}")
                else:
                    log("レスポンスヘッダは空です。")

                # 可能なら本文もログ
                try:
                    body = getattr(response_attr, "text", None)
                    if body:
                        # 長くなる可能性があるので先頭を切り出すか、そのまま表示してもOK
                        log(f"レスポンス本文 (先頭1kB): {body[:1024]}")
                    else:
                        log("レスポンス本文は空です。")
                except Exception:
                    log("レスポンス本文の読み取りに失敗しました。")
            else:
                log("例外に response 属性がありません（低レベルエラーの可能性）。")

            # --- レート判定 ---
            is_rate_limit = False
            try:
                if "TooManyRequests" in type(e).__name__ or status_code == 429:
                    is_rate_limit = True
            except Exception:
                is_rate_limit = False

            if is_rate_limit:
                wait_seconds = _get_wait_seconds_from_response(response_attr)
                # サーバーが推奨する待機時間が閾値を超える場合はキュー登録して終了
                if wait_seconds is not None and wait_seconds > MAX_WAIT_BEFORE_QUEUE:
                    log(f"429 レスポンス検知: サーバー推奨待機時間 = {wait_seconds:.1f}s が閾値 {MAX_WAIT_BEFORE_QUEUE}s を超えています。")
                    queue_post(text, image_path, reason=f"rate_limit_wait_{int(wait_seconds)}s")
                    return False, f"queued_due_to_rate_limit_{int(wait_seconds)}s"
                # それ以外は短めに待機（最大 MAX_SINGLE_SLEEP）
                wait = min((wait_seconds if wait_seconds is not None else backoff_factor * (2 ** (attempt - 1))) + random.uniform(0, 1.0), MAX_SINGLE_SLEEP)
                log(f"429 レスポンス検知: 待機してリトライします (待機: {wait:.1f}s)...")
                try:
                    time.sleep(wait)
                except KeyboardInterrupt:
                    log("待機が中断されました（KeyboardInterrupt）。投稿処理を中止します。")
                    return False, "Interrupted"
                continue
            else:
                # 400系のクライアントエラーはリトライしない
                if status_code and 400 <= status_code < 500:
                    log(f"クライアントエラー (status {status_code}) のためリトライしません。詳細: {getattr(response_attr, 'text', '')}")
                    tb = traceback.format_exc()
                    log(tb)
                    return False, err_message
                # 一時エラーは短めに待ってリトライ
                wait = min(backoff_factor * (2 ** (attempt - 1)) + random.uniform(0, 1.0), MAX_SINGLE_SLEEP)
                log(f"一時エラーのため待機してリトライします: {wait:.1f}s")
                try:
                    time.sleep(wait)
                except KeyboardInterrupt:
                    log("待機が中断されました（KeyboardInterrupt）。投稿処理を中止します。")
                    return False, "Interrupted"
                continue


    tb = traceback.format_exc()
    log("❌ すべての投稿試行が失敗しました。最後の例外を返します。")
    log(tb)
    return False, str(last_err)

# --- pending を処理する関数 ---
def process_pending_posts():
    pending = load_pending()
    if not pending:
        log("pending_posts.json に処理対象はありません。")
        return
    log(f"pending_posts.json に {len(pending)} 件の投稿があります。順番に処理します。")
    remaining = []
    for idx, entry in enumerate(pending, start=1):
        log(f"pending {idx}/{len(pending)} を処理します。queued_at={entry.get('queued_at')}, reason={entry.get('reason')}")
        text = entry.get("text")
        image_path = entry.get("image_path")
        # 画像ファイルが存在するか確認
        if not image_path or not os.path.exists(image_path):
            log(f"画像が見つかりません: {image_path} → スキップして記録に残します。")
            remaining.append(entry)
            continue
        success, err = post_to_twitter(text, image_path, max_retries=3)
        if not success:
            log(f"pending の投稿に失敗しました: {err} → 再キュー化")
            remaining.append(entry)
        else:
            log("pending 投稿 成功。キューから削除します。")
    save_pending_list(remaining)
    log(f"pending 処理完了。残件数: {len(remaining)}")

# --- メイン処理 ---
if __name__ == "__main__":
    divider()
    log("【cron動作シミュレーション】SNS自動投稿スクリプト")
    divider()

    overall_start = time.perf_counter()

    notify_block("パイプライン処理が正常に完了しました。", [
        f"**モード**: `{MODE}`",
        f"**処理時間**: `{format_seconds(0)}`"
    ])
    log("--- [SNS POST] SNSへの自動投稿を開始します... ---")
    log("--- SNS投稿スクリプト ログ ---")
    divider()
    log("SNS自動投稿ジョブを開始します")
    divider()

    # もし PROCESS_PENDING=1 が指定されていれば先にキュー処理
    if PROCESS_PENDING:
        log("PROCESS_PENDING=1 のため pending 投稿を先に処理します。")
        process_pending_posts()

    jst = timezone(timedelta(hours=9))
    
    # --- 1. 的中報告 (昨日のデータ) ---
    phase1_start = time.perf_counter()
    log("\n--- [フェーズ1/2] 昨日の的中報告を実行 ---")
    yesterday = datetime.now(jst) - timedelta(days=1)
    yesterday_str = yesterday.strftime('%Y-%m-%d')
    
    hits_data = get_high_payout_hits_from_api(yesterday_str)
    if hits_data:
        top_hit = hits_data[0]
        log(f"最高配当の的中を発見: {top_hit['payout']:,}円")
        image_file = generate_hit_og_image(top_hit)
        if image_file:
            tweet_text = create_hit_tweet_text(hits_data)
            success, err = post_to_twitter(tweet_text, image_file)
            if not success:
                log(f"的中報告の投稿は失敗しました: {err}")
    else:
        log("昨日は高配当的中がなかったため、投稿をスキップします。")
    phase1_end = time.perf_counter()
    log(f"--- フェーズ1 経過時間: {format_seconds(phase1_end - phase1_start)} ---")

    # 投稿間のクールダウン
    log("\n--- 連続投稿を避けるため60秒間待機します ---")
    try:
        time.sleep(60)
    except KeyboardInterrupt:
        log("待機がユーザーにより中断されました。")

    # --- 2. 注目馬 (今日のデータ) ---
    phase2_start = time.perf_counter()
    log("\n--- [フェーズ2/2] 今日の注目馬投稿を実行 ---")
    today = datetime.now(jst)
    today_str = today.strftime('%Y-%m-%d')

    pick_data = get_special_pick_from_api(today_str)
    if pick_data:
        image_file = generate_pick_og_image(pick_data, today_str)
        if image_file:
            tweet_text = create_pick_tweet_text(pick_data, today_str)
            success, err = post_to_twitter(tweet_text, image_file)
            if not success:
                log(f"注目馬投稿は失敗しました: {err}")
    else:
        log("本日の注目馬は見つからなかったため、投稿をスキップします。")
    phase2_end = time.perf_counter()
    log(f"--- フェーズ2 経過時間: {format_seconds(phase2_end - phase2_start)} ---")

    overall_end = time.perf_counter()
    total_sec = overall_end - overall_start

    log("\nSNS自動投稿ジョブが完了しました。")
    divider()

    notify_block("SNSへの自動投稿が完了しました。", [
        f"**モード**: `{MODE}`",
        f"**処理時間**: `{format_seconds(total_sec)}`"
    ])

    log("全ての処理が完了しました。")
