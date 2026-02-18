#!/usr/bin/env python3
"""調査パート4b: 正しいrace_idを特定してpredictorロジックをシミュレート"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import func
from datetime import date, timedelta
import math
import numpy as np
import pandas as pd
from collections import defaultdict

db = SessionLocal()

# まず2026-01-14のレースIDを確認
print("=== 2026-01-14のレースID一覧（最初の5件） ===")
races = db.query(models.Race).filter(
    models.Race.race_date == date(2026, 1, 14)
).order_by(models.Race.race_number).limit(5).all()

if not races:
    print("レースが見つかりません！")
    
    # どの日付にデータがあるか確認
    print("\n最近の日付:")
    from sqlalchemy import text
    rows = db.execute(text("SELECT race_date, COUNT(*) FROM races GROUP BY race_date ORDER BY race_date DESC LIMIT 10")).fetchall()
    for r in rows:
        print(f"  {r[0]}: {r[1]}件")
    
    db.close()
    sys.exit(0)

for r in races:
    print(f"  {r.id}: {r.venue_name} {r.race_number}R {r.race_name} ({r.course_type} {r.distance}m)")

# 最初のレースを使う
target_race = races[0]
race_id = target_race.id
race_date_val = target_race.race_date
print(f"\n対象レース: {target_race.venue_name} {target_race.race_number}R {target_race.race_name}")
print(f"race_id: {race_id}, course_type: {target_race.course_type}, distance: {target_race.distance}")

# 出走馬取得
shutuba = db.query(
    models.Result.horse_id, models.Horse.name, models.Result.horse_number, models.Result.waku_number
).join(models.Horse, models.Result.horse_id == models.Horse.id)\
 .filter(models.Result.race_id == race_id).all()
print(f"出走馬: {len(shutuba)}頭")

horse_ids = [h.horse_id for h in shutuba if h.horse_id and h.horse_number]

# predictor.pyの _get_bulk_performance_data と同一ロジック
start_filter = race_date_val - timedelta(days=365)
end_filter = race_date_val - timedelta(days=2)
print(f"日付フィルタ: {start_filter} ~ {end_filter}")

avg_times_base_q = db.query(
    models.Race.venue_name, models.Race.course_type, models.Race.distance,
    func.avg(models.Result.finish_time_sec).label('avg_time')
).join(models.Result).filter(models.Race.course_type.in_(['芝', 'ダ'])).group_by(
    models.Race.venue_name, models.Race.course_type, models.Race.distance
).subquery()

results_by_horse = defaultdict(list)
for i in range(0, len(horse_ids), 5):
    batch = horse_ids[i:i+5]
    batch_results = db.query(models.Result, models.Race, avg_times_base_q.c.avg_time)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .outerjoin(avg_times_base_q, (models.Race.venue_name == avg_times_base_q.c.venue_name) & \
                                     (models.Race.course_type == avg_times_base_q.c.course_type) & \
                                     (models.Race.distance == avg_times_base_q.c.distance))\
        .filter(models.Result.horse_id.in_(batch))\
        .filter(models.Race.race_date.between(start_filter, end_filter))\
        .all()
    for res, race, avg_time in batch_results:
        results_by_horse[res.horse_id].append((res, race, avg_time))

# スコア計算
half_life = 180.0
decay = math.log(2.0) / half_life

valid_count = 0
print(f"\n各馬のスコア計算結果:")
for h in shutuba:
    if not h.horse_id or not h.horse_number:
        continue
    past = results_by_horse.get(h.horse_id, [])
    scores, weights = [], []
    for res, race, avg_time in past:
        if res.finish_time_sec and avg_time:
            scores.append(avg_time - res.finish_time_sec)
            weights.append(math.exp(-decay * max((race_date_val - race.race_date).days, 0)))
    
    perf = np.average(scores, weights=weights) if scores else None
    if perf is not None:
        valid_count += 1
    
    # 詳細：最初の3件の過去データ
    detail = []
    for res, race, avg_time in past[:3]:
        detail.append(f"  {race.race_date} {race.venue_name} {race.course_type}{race.distance}m "
                      f"time={res.finish_time_sec} avg={avg_time}")
    
    print(f"  {h.horse_number}番 {h.name}: 過去{len(past)}走, 有効={len(scores)}, score={perf}")
    for d in detail:
        print(f"    {d}")

print(f"\n有効スコア馬数: {valid_count}/{len(horse_ids)} (2頭以上で予測可能)")
if valid_count < 2:
    print(">>> これが原因: 有効スコアが2頭未満のため予測不能 <<<")
else:
    print(">>> シミュレーションでは予測可能... predictionsテーブルの生成タイミングの問題の可能性 <<<")

# === 追加: predictionsテーブルの実際の値も確認 ===
print(f"\n=== DB上のpredictions (race_id={race_id}) ===")
preds = db.query(models.Prediction).filter(models.Prediction.race_id == race_id).all()
for p in preds[:5]:
    print(f"  {p.horse_number}番 {p.horse_name}: dev={p.deviation_score}, reason={p.unpredictable_reason}")

db.close()
print("\n調査完了")
