#!/usr/bin/env python3
"""調査パート5b: PostgreSQL対応版で偏差値NULL問題を検証"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import func, text
from datetime import date, timedelta
import math
import numpy as np
from collections import defaultdict

db = SessionLocal()

# ===== 1. 日別predictions状態 =====
print("=" * 70)
print("1. 日別predictions状態 (直近30日)")
print("=" * 70)
rows = db.execute(text("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as races,
           COUNT(p.id) as preds,
           SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as dev_ok,
           SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as dev_null,
           SUM(CASE WHEN p.unpredictable_reason IS NOT NULL THEN 1 ELSE 0 END) as unpred,
           STRING_AGG(DISTINCT r.venue_name, ',') as venues
    FROM races r
    LEFT JOIN predictions p ON r.id = p.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 30
""")).fetchall()
print(f"  {'日付':<12} {'レース':>4} {'予測':>5} {'偏差有':>5} {'偏差無':>5} {'不能':>4}  会場")
print("  " + "-" * 75)
for row in rows:
    status = "OK" if row[3] and row[3] > 0 else "NG"
    print(f"  {row[0]!s:<12} {row[1]:>4} {row[2]:>5} {row[3]:>5} {row[4]:>5} {row[5]:>4}  [{status}] {row[6]}")

# ===== 2. unpredictable_reason内訳 =====
print("\n" + "=" * 70)
print("2. unpredictable_reason内訳")
print("=" * 70)
rows = db.execute(text("""
    SELECT COALESCE(p.unpredictable_reason, '(なし=偏差値正常)') as reason, COUNT(*)
    FROM predictions p
    GROUP BY p.unpredictable_reason
    ORDER BY COUNT(*) DESC
""")).fetchall()
for row in rows:
    print(f"  {row[0]}: {row[1]}件")

# ===== 3. finish_time_sec NULL率 =====
print("\n" + "=" * 70)
print("3. 日別 finish_time_sec NULL率 (直近30日)")
print("=" * 70)
rows = db.execute(text("""
    SELECT r.race_date,
           COUNT(res.id) as total,
           SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as time_ok,
           SUM(CASE WHEN res.finish_time_sec IS NULL THEN 1 ELSE 0 END) as time_null
    FROM races r
    JOIN results res ON r.id = res.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 30
""")).fetchall()
print(f"  {'日付':<12} {'結果数':>5} {'タイム有':>6} {'タイム無':>6} {'NULL率':>6}")
print("  " + "-" * 45)
for row in rows:
    pct = row[3]/row[1]*100 if row[1] > 0 else 0
    print(f"  {row[0]!s:<12} {row[1]:>5} {row[2]:>6} {row[3]:>6} {pct:>5.1f}%")

# ===== 4. 予測不能レースの根本原因シミュレーション =====
print("\n" + "=" * 70)
print("4. 偏差値NGレースの根本原因シミュレーション")
print("=" * 70)

# 偏差値が全NULL かつ predictions件数が多い日を取得
ng_date_row = db.execute(text("""
    SELECT r.race_date
    FROM races r
    JOIN predictions p ON r.id = p.race_id
    WHERE r.race_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY r.race_date
    HAVING SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) = 0
    AND COUNT(p.id) > 10
    ORDER BY r.race_date DESC
    LIMIT 1
""")).fetchone()

if ng_date_row:
    ng_date = ng_date_row[0]
    print(f"対象NG日: {ng_date}")
    
    ng_race = db.query(models.Race).filter(
        models.Race.race_date == ng_date,
        models.Race.course_type.in_(['芝', 'ダ'])
    ).first()
    if not ng_race:
        ng_race = db.query(models.Race).filter(models.Race.race_date == ng_date).first()
    
    if ng_race:
        race_id = ng_race.id
        race_date_val = ng_race.race_date
        print(f"対象レース: {ng_race.venue_name} {ng_race.race_number}R {ng_race.race_name}")
        print(f"  course_type={ng_race.course_type}, distance={ng_race.distance}")
        
        shutuba = db.query(
            models.Result.horse_id, models.Horse.name, models.Result.horse_number
        ).join(models.Horse, models.Result.horse_id == models.Horse.id)\
         .filter(models.Result.race_id == race_id).all()
        
        horse_ids = [h.horse_id for h in shutuba if h.horse_id and h.horse_number]
        start_f = race_date_val - timedelta(days=365)
        end_f = race_date_val - timedelta(days=2)
        print(f"  日付フィルタ: {start_f} ~ {end_f}")
        print(f"  出走馬: {len(horse_ids)}頭")
        
        avg_q = db.query(
            models.Race.venue_name, models.Race.course_type, models.Race.distance,
            func.avg(models.Result.finish_time_sec).label('avg_time')
        ).join(models.Result).filter(models.Race.course_type.in_(['芝', 'ダ'])).group_by(
            models.Race.venue_name, models.Race.course_type, models.Race.distance
        ).subquery()
        
        results_by = defaultdict(list)
        for i in range(0, len(horse_ids), 5):
            batch = horse_ids[i:i+5]
            br = db.query(models.Result, models.Race, avg_q.c.avg_time)\
                .join(models.Race, models.Result.race_id == models.Race.id)\
                .outerjoin(avg_q, (models.Race.venue_name == avg_q.c.venue_name) & \
                                  (models.Race.course_type == avg_q.c.course_type) & \
                                  (models.Race.distance == avg_q.c.distance))\
                .filter(models.Result.horse_id.in_(batch))\
                .filter(models.Race.race_date.between(start_f, end_f))\
                .all()
            for res, race, avg_time in br:
                results_by[res.horse_id].append((res, race, avg_time))
        
        half_life = 180.0
        decay = math.log(2.0) / half_life
        
        valid_count = 0
        print(f"\n  各馬の分析:")
        for h in shutuba:
            if not h.horse_id or not h.horse_number:
                continue
            past = results_by.get(h.horse_id, [])
            scores = []
            null_time, null_avg = 0, 0
            for res, race, avg_time in past:
                if res.finish_time_sec and avg_time:
                    scores.append(avg_time - res.finish_time_sec)
                else:
                    if not res.finish_time_sec: null_time += 1
                    if not avg_time: null_avg += 1
            
            perf = np.mean(scores) if scores else None
            if perf is not None: valid_count += 1
            
            print(f"    {h.horse_number:>2}番 {h.name:<14}: 過去{len(past):>2}走, "
                  f"有効={len(scores):>2}, time_null={null_time}, avg_null={null_avg}, "
                  f"score={'%.2f' % perf if perf else 'None'}")
        
        print(f"\n  ===> 有効スコア馬: {valid_count}/{len(horse_ids)}")
        if valid_count < 2:
            print("  ===> 原因: 有効スコアが2頭未満")
        else:
            print("  ===> 現在のDBでは予測可能! 予測生成時のデータ状態が異なっていた")
else:
    print("直近30日で偏差値が全NULLの日はありません")
    
    # 一部NULLの日を確認
    print("\n偏差値NULLが含まれる日:")
    rows = db.execute(text("""
        SELECT r.race_date,
               COUNT(p.id) as total,
               SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as ok,
               SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as ng
        FROM races r
        JOIN predictions p ON r.id = p.race_id
        WHERE r.race_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY r.race_date
        HAVING SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) > 0
        ORDER BY r.race_date DESC
        LIMIT 10
    """)).fetchall()
    for row in rows:
        print(f"  {row[0]}: total={row[1]}, ok={row[2]}, ng={row[3]}")

# ===== 5. matchupの状態 =====
print("\n" + "=" * 70)
print("5. matchup状態 (直近15日)")
print("=" * 70)
rows = db.execute(text("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as total,
           COUNT(DISTINCT m.race_id) as with_m,
           COUNT(DISTINCT r.id) - COUNT(DISTINCT m.race_id) as without_m
    FROM races r
    LEFT JOIN matchups m ON r.id = m.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 15
""")).fetchall()
print(f"  {'日付':<12} {'全レース':>6} {'matchup有':>8} {'matchup無':>8}")
print("  " + "-" * 44)
for row in rows:
    print(f"  {row[0]!s:<12} {row[1]:>6} {row[2]:>8} {row[3]:>8}")

# ===== 6. predictions件数とレース数の不整合 =====
print("\n" + "=" * 70)
print("6. predictions未生成レースの確認")
print("=" * 70)
rows = db.execute(text("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as total_races,
           COUNT(DISTINCT p.race_id) as with_pred,
           COUNT(DISTINCT r.id) - COUNT(DISTINCT p.race_id) as without_pred
    FROM races r
    LEFT JOIN predictions p ON r.id = p.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 15
""")).fetchall()
print(f"  {'日付':<12} {'全レース':>6} {'予測有':>6} {'予測無':>6}")
print("  " + "-" * 40)
for row in rows:
    print(f"  {row[0]!s:<12} {row[1]:>6} {row[2]:>6} {row[3]:>6}")

db.close()
print("\n調査完了")
