# backend/scripts/debug_preview.py
"""
SNS画像生成のデバッグ・プレビューツール
画像の確認と問題検出機能を提供
"""

import os
import sys
import time
from datetime import datetime, timedelta
from PIL import Image
import json
import hashlib
from typing import List, Dict, Any
import base64

# パス設定 (sns_poster.pyを正しくインポートするため)
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
# `backend/scripts`から`backend`へ移動
PROJECT_ROOT_FOR_IMPORT = os.path.dirname(THIS_DIR)
# `backend`を`sys.path`に追加
sys.path.insert(0, PROJECT_ROOT_FOR_IMPORT)

try:
    # `scripts.sns_poster`としてインポート
    from scripts import sns_poster as sp
except Exception as e:
    print(f"❌ sns_poster の読み込みに失敗しました: {e}")
    print("   パス設定を確認してください。")
    sys.exit(1)

# カラーコード（ターミナル出力用）
class Colors:
    HEADER = '\033[95m'; OKBLUE = '\033[94m'; OKGREEN = '\033[92m'
    WARNING = '\033[93m'; FAIL = '\033[91m'; ENDC = '\033[0m'
    BOLD = '\033[1m'; UNDERLINE = '\033[4m'

# --- テストデータ生成 ---
def get_test_data():
    """様々なケースのテストデータを生成"""
    return {
        'hit_normal': {
            "venue_name": "東京", "race_number": "11",
            "bet_type": "3連複", "payout": 152300
        },
        'hit_high': {
            "venue_name": "阪神", "race_number": "12",
            "bet_type": "3連単", "payout": 9876543
        },
        'pick_short': {
            "horse_name": "シンザン", "venue_name": "中山", "race_number": "7",
            "race_name": "弥生賞", "deviation_score": 78.45, "race_id": "000001001"
        },
        'pick_medium': {
            "horse_name": "ディープインパクト", "venue_name": "東京", "race_number": "10",
            "race_name": "日本ダービー", "deviation_score": 92.33, "race_id": "000002001"
        },
        'pick_long': {
            "horse_name": "スーパークリーク", # 8文字 -> 9文字以上で省略テスト
            "venue_name": "京都", "race_number": "11",
            "race_name": "菊花賞", "deviation_score": 82.12, "race_id": "000003001"
        },
        'race_normal': {
            "id": "race001", "race_name": "有馬記念", "venue_name": "中山",
            "race_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "race_number": "11",
            "predictions": [
                {"horse_name": "イクイノックス", "deviation_score": 95.1},
                {"horse_name": "ドウデュース", "deviation_score": 88.2},
                {"horse_name": "ジャスティンパレス", "deviation_score": 82.3},
            ]
        },
        'race_long_names': {
            "id": "race002", "race_name": "天皇賞（春）", "venue_name": "京都",
            "race_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "race_number": "11",
            "predictions": [
                {"horse_name": "タイトルホルダー", "deviation_score": 91.5},
                {"horse_name": "ディープボンド", "deviation_score": 87.8},
                {"horse_name": "メロディーレーン", "deviation_score": 81.2},
            ]
        }
    }

# --- 画像検証関数 ---
def verify_image(image_path: str, test_name: str) -> Dict[str, Any]:
    """画像の検証と問題検出"""
    results = {'test_name': test_name, 'path': image_path, 'exists': False, 'size_ok': False,
               'dimensions': None, 'file_size': None, 'warnings': [], 'errors': [] }
    if not image_path or not os.path.exists(image_path):
        results['errors'].append('画像ファイルが存在しません')
        return results
    results['exists'] = True
    try:
        file_size = os.path.getsize(image_path) / 1024
        results['file_size'] = f"{file_size:.1f} KB"
        if file_size > 1000: results['warnings'].append(f'ファイルサイズが大きい: {file_size:.1f} KB')
        
        img = Image.open(image_path)
        results['dimensions'] = f"{img.width} x {img.height}"
        if img.width == 1200 and img.height == 630: results['size_ok'] = True
        else: results['errors'].append(f'想定外のサイズ: {img.width}x{img.height} (期待値: 1200x630)')
    except Exception as e: results['errors'].append(f'画像読み込みエラー: {str(e)}')
    return results

# --- レポート生成 ---
def generate_report(all_results: List[Dict[str, Any]]):
    print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}📊 画像生成テストレポート{Colors.ENDC}")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    
    total = len(all_results)
    success = sum(1 for r in all_results if r['exists'] and r['size_ok'] and not r['errors'])
    warnings_count = sum(len(r['warnings']) for r in all_results)
    errors_count = sum(len(r['errors']) for r in all_results)
    
    print(f"{Colors.OKBLUE}📈 サマリー:{Colors.ENDC}")
    print(f"  • 総テスト数: {total}")
    print(f"  • {Colors.OKGREEN}成功: {success}{Colors.ENDC}")
    print(f"  • {Colors.WARNING}警告: {warnings_count}{Colors.ENDC}")
    print(f"  • {Colors.FAIL}エラー: {errors_count}{Colors.ENDC}\n")
    
    for result in all_results:
        status = "✅" if (result['exists'] and result['size_ok'] and not result['errors']) else "❌"
        print(f"{status} {Colors.BOLD}{result['test_name']}{Colors.ENDC}")
        if result['exists']:
            print(f"   📁 パス: {result['path']}")
            print(f"   📐 サイズ: {result['dimensions']} ({result['file_size']})")
            for warning in result['warnings']: print(f"   {Colors.WARNING}⚠️  {warning}{Colors.ENDC}")
            for error in result['errors']: print(f"   {Colors.FAIL}❌ {error}{Colors.ENDC}")
        else:
            print(f"   {Colors.FAIL}❌ 画像が生成されませんでした{Colors.ENDC}")
        print()

# --- HTMLプレビュー生成 ---
def generate_html_preview(image_paths: List[tuple]):
    """ブラウザで確認できるHTMLプレビューを生成"""
    html_template = """
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>SNS画像プレビュー</title><style>
body { font-family: sans-serif; background-color: #f0f2f5; padding: 20px; }
h1 { text-align: center; color: #1c1e21; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(600px, 1fr)); gap: 20px; }
.card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.card h2 { font-size: 1.2rem; padding: 12px 16px; margin: 0; border-bottom: 1px solid #ddd; }
.card img { max-width: 100%; display: block; }
.card p { padding: 0 16px 12px; margin: 0; font-size: 0.9rem; color: #606770; }
</style></head><body><h1>SNS画像プレビュー</h1><div class="grid">
{image_cards}
</div></body></html>"""
    
    cards_html = ""
    for test_name, path in image_paths:
        if path and os.path.exists(path):
            with open(path, 'rb') as f:
                img_data = base64.b64encode(f.read()).decode()
            file_size = os.path.getsize(path) / 1024
            cards_html += f"""<div class="card"><h2>{test_name}</h2>
<img src="data:image/png;base64,{img_data}" alt="{test_name}">
<p>PATH: {os.path.basename(path)} | SIZE: {file_size:.1f} KB</p></div>"""

    html_content = html_template.replace("{image_cards}", cards_html)
    html_path = os.path.join(sp.IMAGE_OUTPUT_DIR, "preview.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    return html_path

# --- メイン実行 ---
def run():
    print(f"\n{Colors.BOLD}{Colors.OKBLUE}🚀 SNS画像生成デバッグツール 起動{Colors.ENDC}\n")
    
    test_data = get_test_data()
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    generated_images, test_results = [], []
    
    tests = [
        ('的中（通常）', 'hit_normal', sp.generate_hit_og_image),
        ('的中（高額）', 'hit_high', sp.generate_hit_og_image),
        ('注目馬（短名）', 'pick_short', sp.generate_pick_og_image),
        ('注目馬（中名）', 'pick_medium', sp.generate_pick_og_image),
        ('注目馬（長名）', 'pick_long', sp.generate_pick_og_image),
        ('重賞（通常）', 'race_normal', lambda d, ds: sp.generate_reminder_og_image(d, d['predictions'])),
        ('重賞（長名）', 'race_long_names', lambda d, ds: sp.generate_reminder_og_image(d, d['predictions'])),
    ]
    
    print(f"{Colors.HEADER}📝 テスト実行中...{Colors.ENDC}\n")
    
    for test_name, data_key, generate_func in tests:
        print(f"  • {test_name} ... ", end='', flush=True)
        try:
            data = test_data[data_key]
            # 修正点: ラムダ関数を統一的に扱う
            image_path = generate_func(data, date_str if 'predictions' not in data else None)
            
            if image_path:
                print(f"{Colors.OKGREEN}✅{Colors.ENDC}")
                generated_images.append((test_name, image_path))
                verification = verify_image(image_path, test_name)
                test_results.append(verification)
                
                # 修正点: 自動で画像を開く処理を削除。HTMLプレビューに一本化。
                
            else:
                print(f"{Colors.FAIL}❌ 生成失敗{Colors.ENDC}")
                test_results.append({'test_name': test_name, 'path': None, 'exists': False, 'size_ok': False,
                                     'errors': ['画像生成関数がNoneを返しました'], 'warnings': []})
        except Exception as e:
            print(f"{Colors.FAIL}❌ エラー: {e}{Colors.ENDC}")
            test_results.append({'test_name': test_name, 'path': None, 'exists': False, 'size_ok': False,
                                 'errors': [f'実行エラー: {str(e)}'], 'warnings': []})
        time.sleep(0.1)
    
    generate_report(test_results)
    
    if generated_images:
        html_path = generate_html_preview(generated_images)
        print(f"\n{Colors.OKGREEN}🌐 HTMLプレビューを生成しました:{Colors.ENDC}")
        print(f"   {html_path}\n")
        print(f"   ブラウザで開いて全画像を確認できます。")
    
    print(f"\n{Colors.BOLD}{Colors.OKGREEN}✨ デバッグ完了{Colors.ENDC}\n")

if __name__ == "__main__":
    run()