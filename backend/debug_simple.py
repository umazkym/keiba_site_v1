#!/usr/bin/env python3
"""
シンプルなデバッグスクリプト - 基本情報のみチェック

実行方法:
cd /home/user/keiba_site_v1/backend
python debug_simple.py
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal
from database import models
from sqlalchemy import func

def main():
    db = SessionLocal()

    try:
        print("=" * 60)
        print("  クイックチェック")
        print("=" * 60)

        # 1. レース総数
        total_races = db.query(func.count(models.Race.id)).scalar()
        print(f"\n1️⃣  データベース内のレース総数: {total_races}")

        # 2. ばんえい競馬のレース数
        banei_races = db.query(func.count(models.Race.id)).filter(
            models.Race.id.like('____33%') | models.Race.id.like('____65%')
        ).scalar()
        print(f"2️⃣  ばんえい競馬のレース数: {banei_races}")
        if banei_races > 0:
            print("   ⚠️  本来は0であるべきです！")

        # 3. 最近7日間の日別レース数
        print(f"\n3️⃣  最近7日間のレース数:")
        today = date.today()
        for i in range(7):
            target_date = today - timedelta(days=i)
            count = db.query(func.count(models.Race.id)).filter(
                models.Race.race_date == target_date
            ).scalar()

            weekday = target_date.weekday()
            day_name = ["月", "火", "水", "木", "金", "土", "日"][weekday]
            is_weekend = "🏇" if weekday >= 5 else "📅"

            print(f"   {is_weekend} {target_date} ({day_name}): {count}レース")

        # 4. レースタイプの分布
        print(f"\n4️⃣  レースタイプの分布:")
        central_count = db.query(func.count(models.Race.id)).filter(
            models.Race.race_type == '中央'
        ).scalar()
        local_count = db.query(func.count(models.Race.id)).filter(
            models.Race.race_type == '地方'
        ).scalar()

        print(f"   中央競馬: {central_count}レース")
        print(f"   地方競馬: {local_count}レース")

        # 5. 最近のレースIDサンプル
        print(f"\n5️⃣  最近のレースIDサンプル（最新5件）:")
        recent_races = db.query(models.Race).order_by(
            models.Race.race_date.desc()
        ).limit(5).all()

        for race in recent_races:
            venue_code = race.id[4:6] if len(race.id) >= 6 else "??"
            print(f"   ID: {race.id}, コード: {venue_code}, タイプ: {race.race_type}, 会場: {race.venue_name}")

        print("\n" + "=" * 60)
        print("✅ チェック完了")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
