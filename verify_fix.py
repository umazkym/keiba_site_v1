"""
修正後のスクレイパー＋パーサーをローカルで事前検証する。
戦績ページ(/horse/result/{id}/)のHTMLを取得し、既存パーサーでパースできるか確認。
"""
import sys
import os

# backendディレクトリをパスに追加（ローカル実行用）
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import requests
from bs4 import BeautifulSoup
from backend.scripts.parser import parse_horse_results_page

def fetch_horse_result_page(horse_id: str) -> str:
    """戦績ページのHTMLをrequestsで取得"""
    url = f"https://db.netkeiba.com/horse/result/{horse_id}/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    response = requests.get(url, headers=headers, timeout=30)
    response.encoding = 'EUC-JP'
    return response.text

def verify_horse(horse_id: str, horse_name: str):
    """1頭の馬をパースして結果を表示"""
    print(f"\n{'='*60}")
    print(f"馬: {horse_name} (ID: {horse_id})")
    print(f"URL: https://db.netkeiba.com/horse/result/{horse_id}/")
    print(f"{'='*60}")
    
    html = fetch_horse_result_page(horse_id)
    print(f"HTML取得: {len(html)} bytes")
    
    result = parse_horse_results_page(html)
    
    if result is None:
        print("❌ パース失敗: Noneが返されました")
        return False
    
    horse_name_parsed = result.get('horse_name', '不明')
    results = result.get('results', [])
    print(f"✅ パース成功!")
    print(f"  馬名: {horse_name_parsed}")
    print(f"  成績件数: {len(results)}")
    
    if results:
        # 最新3件を表示
        print(f"\n  最新3件の成績:")
        for r in results[:3]:
            date = r.get('race_date', '?')
            venue = r.get('venue_name', '?')
            race = r.get('race_name', '?')
            rank = r.get('rank', '?')
            time_sec = r.get('finish_time_sec')
            time_str = f"{time_sec:.1f}秒" if time_sec else "NULL"
            distance = r.get('distance', '?')
            course = r.get('course_type', '?')
            print(f"    {date} {venue} {race} {rank}着 {course}{distance}m タイム:{time_str}")
        
        # finish_time_secの有効率
        valid_times = sum(1 for r in results if r.get('finish_time_sec') is not None)
        print(f"\n  finish_time_sec有効率: {valid_times}/{len(results)} ({100*valid_times/len(results):.1f}%)")
    
    return True

def main():
    test_horses = [
        ("2021102790", "カラーオブワンダー (NAR/地方)"),
        ("2019104038", "ドウデュース (JRA/中央)"),
        ("2022101496", "トラストユー (NAR)"),
    ]
    
    success_count = 0
    for horse_id, name in test_horses:
        try:
            if verify_horse(horse_id, name):
                success_count += 1
        except Exception as e:
            print(f"❌ エラー: {e}")
    
    print(f"\n{'='*60}")
    print(f"結果: {success_count}/{len(test_horses)} 成功")
    if success_count == len(test_horses):
        print("🎉 全馬のパースに成功！修正は正常に機能しています。")
    else:
        print("⚠️ 一部の馬でパースに失敗しました。追加調査が必要です。")

if __name__ == "__main__":
    main()
