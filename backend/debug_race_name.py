#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レース名取得のデバッグスクリプト

目的：
1. 実際のレース情報ページからHTMLを取得
2. HTMLパースロジックを実行してrace_nameが正しく取得されるか確認
3. 空文字列になる原因を特定
"""

import sys
import os
import datetime
from pathlib import Path

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from scripts import scraper, parser
from bs4 import BeautifulSoup

def debug_parse_shutuba_page():
    """実際のレース情報ページをパースしてrace_nameを確認"""

    print("=" * 80)
    print("レース情報ページのパースデバッグ")
    print("=" * 80)
    print()

    # テスト対象のレースID（複数試す）
    test_race_ids = [
        ("202410050101", False),  # 中央競馬の例
        ("202410050301", False),  # 別の中央競馬
    ]

    for race_id, is_nar in test_race_ids:
        print(f"\n{'='*80}")
        print(f"レースID: {race_id} (是否NAR: {is_nar})")
        print(f"{'='*80}")

        try:
            # HTMLを取得
            print(f"[*] HTMLを取得中...")
            shutuba_html, was_cached = scraper.get_shutuba_html(race_id, is_nar=is_nar)

            if not shutuba_html:
                print(f"[!] HTMLを取得できませんでした")
                continue

            print(f"[✓] HTML取得完了 (キャッシュ: {was_cached}, サイズ: {len(shutuba_html)} bytes)")

            # HTMLをファイルに保存（確認用）
            debug_file = f"debug_html/race_{race_id}.html"
            Path("debug_html").mkdir(exist_ok=True)
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(shutuba_html)
            print(f"[✓] HTMLをデバッグファイルに保存: {debug_file}")

            # パース実行
            print(f"[*] HTMLをパース中...")
            shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)

            if not shutuba_data:
                print(f"[!] パースに失敗しました")
                continue

            race_info = shutuba_data.get('race_info', {})

            # 結果表示
            print(f"[✓] パース完了")
            print()
            print(f"--- 抽出されたレース情報 ---")
            print(f"race_name: {repr(race_info.get('race_name'))}")
            print(f"race_date: {repr(race_info.get('race_date'))}")
            print(f"race_number: {repr(race_info.get('race_number'))}")
            print(f"course_type: {repr(race_info.get('course_type'))}")
            print(f"distance: {repr(race_info.get('distance'))}")
            print(f"weather: {repr(race_info.get('weather'))}")
            print(f"ground_condition: {repr(race_info.get('ground_condition'))}")
            print(f"total_horses: {repr(race_info.get('total_horses'))}")

            horses = shutuba_data.get('horses', [])
            print(f"\n抽出された馬数: {len(horses)}")
            if horses:
                print(f"最初の馬: {horses[0]}")

            # race_nameが空文字列の場合、HTMLを詳しく確認
            if not race_info.get('race_name'):
                print(f"\n[!] race_nameが取得されていません。HTMLを詳しく確認します...")
                soup = BeautifulSoup(shutuba_html, 'lxml')

                # h1タグを探す
                h1_tags = soup.find_all('h1')
                print(f"[*] h1タグ数: {len(h1_tags)}")
                for i, h1 in enumerate(h1_tags[:3]):
                    text = h1.get_text(strip=True)
                    print(f"    h1[{i}]: {repr(text[:100])}")

                # 特定のクラス名を持つ要素を探す
                for class_name in ['RaceName', 'race_name', 'db_h_title', 'diary_main']:
                    elms = soup.find_all(class_=class_name)
                    if elms:
                        print(f"[*] .{class_name} の要素数: {len(elms)}")
                        for i, elm in enumerate(elms[:2]):
                            text = elm.get_text(strip=True)
                            print(f"    {class_name}[{i}]: {repr(text[:100])}")

                # 「第XX回」パターンを探す
                import re
                matches = re.findall(r'第\d+回\s+(.+?)(?:\s*\(|$|【)', shutuba_html)
                if matches:
                    print(f"[*] 「第XX回」パターンマッチ: {matches[:3]}")

        except Exception as e:
            print(f"[✗] エラーが発生しました: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    debug_parse_shutuba_page()
