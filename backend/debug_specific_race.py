#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
特定のレースIDを指定して、レース名取得のデバッグを行う
"""

import sys
import os
from pathlib import Path

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from scripts import scraper, parser
from bs4 import BeautifulSoup
import re

def debug_specific_race(race_id, is_nar=True):
    """特定のレースのHTMLをパースしてrace_nameを確認"""

    print("=" * 100)
    print(f"レース {race_id} (NAR={is_nar}) のデバッグ")
    print("=" * 100)
    print()

    try:
        # HTMLを取得
        print(f"[*] レース情報ページのHTMLを取得中...")
        shutuba_html, was_cached = scraper.get_shutuba_html(race_id, is_nar=is_nar)

        if not shutuba_html:
            print(f"[!] HTMLを取得できませんでした")
            return

        print(f"[✓] HTML取得完了 (キャッシュ: {was_cached}, サイズ: {len(shutuba_html)} bytes)")

        # HTMLをファイルに保存
        debug_dir = Path("debug_html")
        debug_dir.mkdir(exist_ok=True)
        debug_file = debug_dir / f"race_{race_id}_shutuba.html"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(shutuba_html)
        print(f"[✓] HTMLを保存: {debug_file}")
        print()

        # === パースロジックのステップバイステップ実行 ===
        print("=" * 100)
        print("HTMLパース詳細")
        print("=" * 100)

        soup = BeautifulSoup(shutuba_html, 'lxml')

        # 方法1: h1タグを探す
        print("\n[1] h1タグの探索")
        h1_tags = soup.find_all('h1')
        print(f"    h1タグ数: {len(h1_tags)}")
        for i, h1 in enumerate(h1_tags[:5]):
            text = h1.get_text(strip=True)
            print(f"    h1[{i}]: {repr(text[:100])}")

        # 方法2: 特定のクラス名を持つ要素を探す
        print("\n[2] 特定のクラス名を持つ要素の探索")
        for class_name in ['RaceName', 'race_name', 'db_h_title', 'diary_main', 'race_title']:
            elms = soup.find_all(class_=class_name)
            if elms:
                print(f"    .{class_name}: {len(elms)}個見つかった")
                for i, elm in enumerate(elms[:3]):
                    text = elm.get_text(strip=True)
                    tag_name = elm.name
                    print(f"      [{i}] <{tag_name}>: {repr(text[:100])}")

        # 方法3: divタグで探す
        print("\n[3] div タグの探索")
        div_tags = soup.find_all('div', recursive=True)[:20]
        print(f"    div タグ数（最初20個）: {len(div_tags)}")
        for div in div_tags:
            text = div.get_text(strip=True)
            if text and len(text) > 10 and len(text) < 100:
                attrs = ' '.join([f'{k}="{v}"' for k, v in div.attrs.items() if isinstance(v, str)])
                print(f"    <div {attrs}>: {repr(text[:80])}")

        # 方法4: spanタグで探す
        print("\n[4] span タグの探索")
        span_tags = soup.find_all('span', recursive=True)[:20]
        print(f"    span タグ数（最初20個）: {len(span_tags)}")
        for span in span_tags:
            text = span.get_text(strip=True)
            if text and len(text) > 5 and len(text) < 100:
                print(f"    <span>: {repr(text[:80])}")

        # 方法5: 正規表現で「第XX回」を探す
        print("\n[5] 正規表現パターン「第XX回」の探索")
        matches = re.findall(r'第\d+回\s+(.+?)(?:\s*\(|$|【)', shutuba_html)
        if matches:
            print(f"    マッチ数: {len(matches)}")
            for i, match in enumerate(matches[:5]):
                print(f"    [{i}]: {repr(match[:100])}")
        else:
            print(f"    マッチなし")

        # === 公式のparse_shutuba_pageを実行 ===
        print()
        print("=" * 100)
        print("parser.parse_shutuba_page() の実行結果")
        print("=" * 100)

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
        race_info = shutuba_data.get('race_info', {})

        print(f"\n[✓] パース完了")
        print(f"    race_name: {repr(race_info.get('race_name'))}")
        print(f"    race_date: {repr(race_info.get('race_date'))}")
        print(f"    race_number: {repr(race_info.get('race_number'))}")
        print(f"    course_type: {repr(race_info.get('course_type'))}")
        print(f"    distance: {repr(race_info.get('distance'))}")
        print(f"    weather: {repr(race_info.get('weather'))}")
        print(f"    ground_condition: {repr(race_info.get('ground_condition'))}")
        print(f"    total_horses: {repr(race_info.get('total_horses'))}")
        print(f"    馬数: {len(shutuba_data.get('horses', []))}")

        # race_nameが空の場合、より詳しく調査
        if not race_info.get('race_name'):
            print()
            print("=" * 100)
            print("[!] race_name が取得されていません！")
            print("=" * 100)

            # HTMLの先頭部分を表示
            print("\nHTML先頭 (1000文字):")
            print("-" * 50)
            print(shutuba_html[:1000])
            print("-" * 50)

            # titleタグを確認
            title = soup.find('title')
            if title:
                print(f"\n<title>: {title.get_text(strip=True)}")

            # metaタグを確認
            og_title = soup.find('meta', property='og:title')
            if og_title:
                print(f"<meta property='og:title'>: {og_title.get('content')}")

    except Exception as e:
        print(f"[✗] エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 空のrace_nameを持つレースをデバッグ
    debug_specific_race("202530102212", is_nar=True)
