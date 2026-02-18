"""
既存データの日付範囲を確認して、真の欠損期間を特定する
"""
import sys
from datetime import datetime
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, '.')
from database import models

print("=" * 70)
print("既存データの日付範囲確認")
print("=" * 70)

# ローカルSQLite接続
local_url = "sqlite:///./keiba.db"
local_engine = create_engine(local_url)
LocalSession = sessionmaker(bind=local_engine)
local_db = LocalSession()

try:
    # 既存レース数
    total_races = local_db.query(models.Race).count()
    print(f"\n総レース数: {total_races:,}件")
    
    # 日付範囲
    min_date = local_db.query(func.min(models.Race.race_date)).scalar()
    max_date = local_db.query(func.max(models.Race.race_date)).scalar()
    
    print(f"\n日付範囲:")
    print(f"  最古: {min_date}")
    print(f"  最新: {max_date}")
    
    # 年月ごとの集計
    print(f"\n年月ごとのレース数:")
    
    from sqlalchemy import extract
    
    # 年月でグループ化
    results = local_db.query(
        extract('year', models.Race.race_date).label('year'),
        extract('month', models.Race.race_date).label('month'),
        func.count(models.Race.id).label('count')
    ).group_by('year', 'month').order_by('year', 'month').all()
    
    for year, month, count in results:
        print(f"  {int(year):04d}-{int(month):02d}: {count:4d}件")
    
    # 2024年11月以降のデータがあるか確認
    target_start = datetime(2024, 11, 20).date()
    target_end = datetime(2026, 1, 13).date()
    
    print(f"\n指定期間（2024-11-20 〜 2026-01-13）のレース数:")
    count_in_range = local_db.query(models.Race).filter(
        models.Race.race_date >= target_start,
        models.Race.race_date <= target_end
    ).count()
    print(f"  {count_in_range:,}件")
    
    # 2024-11-20以降の欠損日を探す
    print(f"\n欠損日の確認:")
    from datetime import timedelta
    
    current_date = target_start
    missing_dates = []
    
    while current_date <= target_end:
        count = local_db.query(models.Race).filter(
            models.Race.race_date == current_date
        ).count()
        
        if count == 0:
            missing_dates.append(current_date)
        
        current_date += timedelta(days=1)
    
    print(f"  欠損日数: {len(missing_dates)}日")
    
    if len(missing_dates) > 0 and len(missing_dates) <= 20:
        print(f"\n  欠損日一覧:")
        for date in missing_dates[:20]:
            print(f"    {date}")
    elif len(missing_dates) > 20:
        print(f"\n  欠損日範囲:")
        print(f"    最初: {missing_dates[0]}")
        print(f"    最後: {missing_dates[-1]}")
    
finally:
    local_db.close()

print("\n" + "=" * 70)
print("推奨バックフィル期間:")
print("=" * 70)

if len(missing_dates) == 0:
    print("  ✅ 欠損なし - バックフィル不要")
elif len(missing_dates) > 0:
    # 連続した欠損期間を見つける
    ranges = []
    start = missing_dates[0]
    prev = missing_dates[0]
    
    for date in missing_dates[1:]:
        if (date - prev).days > 1:
            ranges.append((start, prev))
            start = date
        prev = date
    ranges.append((start, prev))
    
    print(f"\n  欠損期間（{len(ranges)}区間）:")
    for i, (s, e) in enumerate(ranges, 1):
        days = (e - s).days + 1
        print(f"    {i}. {s} 〜 {e} ({days}日間)")
