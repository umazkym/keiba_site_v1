#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正が複数の空race_nameレースで機能するかテスト
"""

import sys
import os

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from scripts import scraper, parser
from database.database import SessionLocal
from database import models

def test_race_names():
    """複数の空race_nameレースをテスト"""

    # DB から空のrace_nameを持つレースを取得
    db = SessionLocal()
    try:
        empty_races = db.query(models.Race).filter(
            (models.Race.race_name == '') | (models.Race.race_name.is_(None))
        ).limit(10).all()

        if not empty_races:
            print("[!] 空のrace_nameを持つレースがありません")
            return

        print("=" * 100)
        print(f"空のrace_nameを持つ {len(empty_races)} レースでテスト")
        print("=" * 100)
        print()

        passed = 0
        failed = 0

        for race in empty_races:
            race_id = race.id
            # race_type が '地方' の場合 is_nar=True
            is_nar = race.race_type == '地方'

            print(f"[*] テスト: race_id={race_id}, venue={race.venue_name}, race_type={race.race_type}")

            try:
                # HTMLを取得
                shutuba_html, _ = scraper.get_shutuba_html(race_id, is_nar=is_nar)
                if not shutuba_html:
                    print(f"    [!] HTMLを取得できませんでした")
                    failed += 1
                    continue

                # パース
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if not shutuba_data:
                    print(f"    [!] パース失敗")
                    failed += 1
                    continue

                race_info = shutuba_data.get('race_info', {})
                extracted_name = race_info.get('race_name', '')

                if extracted_name:
                    print(f"    [✓] PASS: '{extracted_name}'")
                    passed += 1
                else:
                    print(f"    [✗] FAIL: race_nameが空です")
                    failed += 1

            except Exception as e:
                print(f"    [✗] ERROR: {e}")
                failed += 1

            print()

        print("=" * 100)
        print(f"結果: {passed}/{len(empty_races)} 成功, {failed} 失敗")
        print("=" * 100)

    finally:
        db.close()

if __name__ == "__main__":
    test_race_names()
