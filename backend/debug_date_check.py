#!/usr/bin/env python3
"""
日付の不整合をチェックするスクリプト

実行方法:
python debug_date_check.py
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal
from database import models
from sqlalchemy import func

def parse_date_from_race_id(race_id):
    """レースIDから日付を抽出"""
    try:
        if len(race_id) >= 10:
            year = int(race_id[:4])
            month = int(race_id[6:8])
            day = int(race_id[8:10])
            return date(year, month, day)
    except:
        pass
    return None

def main():
    db = SessionLocal()

    try:
        print("=" * 80)
        print("  日付不整合チェック")
        print("=" * 80)

        # 1. race_dateが最新の10件を取得
        print("\n1️⃣  race_dateが最新の10件:")
        recent_by_date = db.query(models.Race).order_by(
            models.Race.race_date.desc()
        ).limit(10).all()

        for race in recent_by_date:
            id_date = parse_date_from_race_id(race.id)
            match = "✅" if id_date == race.race_date else "❌"
            print(f"  {match} race_date: {race.race_date}, レースID: {race.id}, ID日付: {id_date}")

        # 2. race_dateとレースIDの日付が不一致のレースを検索
        print("\n2️⃣  race_dateとレースIDが不一致のレース（最初の20件）:")
        all_races = db.query(models.Race).limit(5000).all()

        mismatches = []
        for race in all_races:
            id_date = parse_date_from_race_id(race.id)
            if id_date and id_date != race.race_date:
                mismatches.append({
                    'race_id': race.id,
                    'race_date': race.race_date,
                    'id_date': id_date,
                    'diff_days': (race.race_date - id_date).days
                })

        print(f"   不一致件数: {len(mismatches)} / {len(all_races)} 件")

        if mismatches:
            print("\n   不一致の例（最初の20件）:")
            for m in mismatches[:20]:
                print(f"   ❌ レースID: {m['race_id']}")
                print(f"      DB日付: {m['race_date']}, ID日付: {m['id_date']}, 差分: {m['diff_days']}日")
        else:
            print("   ✅ すべて一致しています")

        # 3. 未来の日付のレースをチェック
        print("\n3️⃣  未来の日付のレース:")
        today = date.today()
        future_races = db.query(models.Race).filter(
            models.Race.race_date > today
        ).count()

        print(f"   今日: {today}")
        print(f"   未来のレース数: {future_races} 件")

        if future_races > 0:
            print(f"   未来のレース例（最初の5件）:")
            future_examples = db.query(models.Race).filter(
                models.Race.race_date > today
            ).order_by(models.Race.race_date).limit(5).all()

            for race in future_examples:
                print(f"   📅 {race.race_date}: {race.venue_name} {race.race_number}R, ID: {race.id}")

        # 4. 今日と明日のレース数
        print("\n4️⃣  今日と明日のレース数:")
        today = date.today()
        tomorrow = today + timedelta(days=1)
        yesterday = today - timedelta(days=1)

        for target_date in [yesterday, today, tomorrow]:
            count = db.query(func.count(models.Race.id)).filter(
                models.Race.race_date == target_date
            ).scalar()

            weekday = target_date.weekday()
            day_name = ["月", "火", "水", "木", "金", "土", "日"][weekday]

            print(f"   {target_date} ({day_name}): {count}レース")

        # 5. 各月のレース数分布
        print("\n5️⃣  2025年の月別レース数:")
        for month in range(1, 13):
            count = db.query(func.count(models.Race.id)).filter(
                models.Race.race_date >= date(2025, month, 1),
                models.Race.race_date < date(2025, month + 1, 1) if month < 12 else date(2026, 1, 1)
            ).scalar()

            print(f"   {month:2d}月: {count:5d}レース")

        print("\n" + "=" * 80)
        print("✅ チェック完了")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
