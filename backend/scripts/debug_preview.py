# debug_preview.py
# 画像生成の確認スクリプト（sns_poster.generate_* を呼び出す）
import os
import sys
import time
from datetime import datetime, timedelta
from PIL import Image

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(THIS_DIR)
SCRIPT_DIR = os.path.join(PROJECT_ROOT, "backend", "scripts")
sys.path.insert(0, SCRIPT_DIR)

try:
    import sns_poster as sp
except Exception as e:
    print("sns_poster の読み込みに失敗しました:", e)
    sys.exit(1)

def sample_hit():
    return {"venue_name":"東京","race_number":"11","bet_type":"3連複","payout":152300}

def sample_pick_short():
    return {"horse_name":"サンプル","venue_name":"中山","race_number":"7","race_name":"サンプルS","deviation_score":78.45,"race_id":"000001001"}

def sample_pick_long():
    # 11文字を超えるサンプル（切り詰め確認）
    return {"horse_name":"ロングネームサンプル馬11","venue_name":"中山","race_number":"7","race_name":"サンプルステークス","deviation_score":82.12,"race_id":"000001002"}

def sample_race():
    return {
        "id":"race123",
        "race_name":"サンプル記念",
        "venue_name":"阪神",
        "race_date":(datetime.now()+timedelta(days=1)).strftime("%Y-%m-%d"),
        "race_number":"10",
        "predictions":[
            {"horse_name":"Aホース","deviation_score":85.1},
            {"horse_name":"Bホース","deviation_score":80.2},
            {"horse_name":"Cホース","deviation_score":78.3},
        ]
    }

def show_image(path):
    try:
        img = Image.open(path)
        img.show()
    except Exception as e:
        print("画像表示エラー:", e)

def run():
    print("=== debug_preview: 画像生成 ===")
    ds = datetime.now().strftime("%Y-%m-%d")

    # 的中
    hit_path = sp.generate_hit_og_image(sample_hit(), ds)
    print("hit:", hit_path)
    if hit_path: show_image(hit_path)
    time.sleep(0.6)

    # 注目（短い名前）
    pick_path = sp.generate_pick_og_image(sample_pick_short(), ds)
    print("pick (short):", pick_path)
    if pick_path: show_image(pick_path)
    time.sleep(0.6)

    # 注目（長い名前 → 切り詰め）
    pick2_path = sp.generate_pick_og_image(sample_pick_long(), ds)
    print("pick (long):", pick2_path)
    if pick2_path: show_image(pick2_path)
    time.sleep(0.6)

    # 重賞
    rem_path = sp.generate_reminder_og_image(sample_race(), sample_race()['predictions'])
    print("reminder:", rem_path)
    if rem_path: show_image(rem_path)

    print("=== 完了 ===")
    for p in (hit_path, pick_path, pick2_path, rem_path):
        if p: print(" -", p)

if __name__ == "__main__":
    run()
