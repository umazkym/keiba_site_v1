#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DBに保存されているレースのrace_nameを確認し、
空文字列になっているケースを抽出
"""

import sys
import os

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from database.database import SessionLocal
from database import models
from sqlalchemy import func

def check_race_name_status():
    """DBに保存されているrace_nameの状態を確認"""

    db = SessionLocal()
    try:
        print("=" * 80)
        print("DBに保存されているレース名の状態を確認")
        print("=" * 80)
        print()

        # 全体統計
        total_races = db.query(func.count(models.Race.id)).scalar()
        empty_race_names = db.query(func.count(models.Race.id)).filter(
            (models.Race.race_name == '') | (models.Race.race_name.is_(None))
        ).scalar()
        valid_race_names = total_races - empty_race_names

        print(f"[*] 全レース数: {total_races}")
        print(f"[*] race_name が空または NULL のレース数: {empty_race_names}")
        print(f"[*] race_name が設定されているレース数: {valid_race_names}")
        print(f"[*] 空文字列の割合: {empty_race_names / total_races * 100:.2f}%")
        print()

        # 空のrace_nameを持つレースを表示
        if empty_race_names > 0:
            print("--- race_name が空のレース（最新20件） ---")
            empty_races = db.query(models.Race).filter(
                (models.Race.race_name == '') | (models.Race.race_name.is_(None))
            ).order_by(models.Race.race_date.desc()).limit(20).all()

            for race in empty_races:
                print(f"  race_id: {race.id}")
                print(f"    race_date: {race.race_date}")
                print(f"    venue_name: {race.venue_name}")
                print(f"    race_number: {race.race_number}")
                print(f"    race_name: {repr(race.race_name)}")
                print()

        # 有効なrace_nameを持つレース（最新20件）
        print("--- race_name が設定されているレース（最新20件） ---")
        valid_races = db.query(models.Race).filter(
            (models.Race.race_name != '') & (models.Race.race_name.isnot(None))
        ).order_by(models.Race.race_date.desc()).limit(20).all()

        for race in valid_races[:5]:
            print(f"  race_id: {race.id}")
            print(f"    race_date: {race.race_date}")
            print(f"    venue_name: {race.venue_name}")
            print(f"    race_number: {race.race_number}")
            print(f"    race_name: {repr(race.race_name)}")
            print()

        # 空のrace_nameを持つレースが存在する場合、そのrace_idを使ってデバッグ
        if empty_races:
            print()
            print("=" * 80)
            print(f"最初の空のrace_nameを持つレースでデバッグを実行します: {empty_races[0].id}")
            print("=" * 80)

            return empty_races[0].id

    finally:
        db.close()

    return None

if __name__ == "__main__":
    debug_race_id = check_race_name_status()
    if debug_race_id:
        print(f"\nデバッグ対象のrace_id: {debug_race_id}")
