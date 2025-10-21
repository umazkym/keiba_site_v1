#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DBに保存されている空のrace_nameを修復するスクリプト

処理内容：
1. race_nameが空または NULL のレースを抽出
2. 各レースのHTMLを取得してパース
3. 正しいrace_nameを再度DBに保存
"""

import sys
import os
from datetime import datetime

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from database.database import SessionLocal
from database import models
from scripts import scraper, parser
import time
import random

def repair_race_names():
    """空のrace_nameを修復"""

    db = SessionLocal()
    try:
        # 空のrace_nameを持つレースを取得
        empty_races = db.query(models.Race).filter(
            (models.Race.race_name == '') | (models.Race.race_name.is_(None))
        ).all()

        if not empty_races:
            print("[*] 修復対象のレースはありません")
            return

        print("=" * 100)
        print(f"空のrace_nameを持つ {len(empty_races)} レースを修復します")
        print("=" * 100)
        print()

        success_count = 0
        fail_count = 0

        for idx, race in enumerate(empty_races, 1):
            race_id = race.id
            is_nar = race.race_type == '地方'

            print(f"[{idx}/{len(empty_races)}] race_id={race_id}, venue={race.venue_name}")

            try:
                # HTMLを取得
                shutuba_html, _ = scraper.get_shutuba_html(race_id, is_nar=is_nar)
                if not shutuba_html:
                    print(f"       [!] HTMLを取得できませんでした")
                    fail_count += 1
                    continue

                # パース
                shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                if not shutuba_data:
                    print(f"       [!] パース失敗")
                    fail_count += 1
                    continue

                race_info = shutuba_data.get('race_info', {})
                extracted_name = race_info.get('race_name', '')

                if extracted_name:
                    # DBを更新
                    race.race_name = extracted_name
                    db.commit()
                    print(f"       [✓] 修復完了: '{extracted_name}'")
                    success_count += 1
                else:
                    print(f"       [!] race_nameが抽出できませんでした")
                    fail_count += 1

            except Exception as e:
                print(f"       [✗] エラー: {e}")
                db.rollback()
                fail_count += 1

            # APIのスロットル対策
            if idx % 10 == 0:
                print(f"\n[*] 10秒スリープ...\n")
                time.sleep(10)
            else:
                time.sleep(random.uniform(0.5, 1.5))

        print()
        print("=" * 100)
        print(f"修復完了: {success_count} 成功, {fail_count} 失敗")
        print("=" * 100)

    except Exception as e:
        print(f"[✗] エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print(f"修復開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    repair_race_names()
    print()
    print(f"修復終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
