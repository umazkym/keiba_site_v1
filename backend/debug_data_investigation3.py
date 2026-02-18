#!/usr/bin/env python3
"""AI偏差値問題 - 調査パート3: 異常日の根本原因特定"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keiba.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# ============================================
# 調査1: 2026-01-14 (異常日) の全unpredictable_reasonを確認
# ============================================
print("=" * 70)
print("[調査1] 2026-01-14 のpredictions unpredictable_reason")
print("=" * 70)
c.execute("""
    SELECT p.unpredictable_reason, COUNT(*)
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    WHERE r.race_date = '2026-01-14'
    GROUP BY p.unpredictable_reason
""")
for row in c.fetchall():
    print(f"  理由: {row[0]} -> {row[1]}件")

# ============================================
# 調査2: 2026-01-14 のレースのcourse_type分布
# ============================================
print("\n" + "=" * 70)
print("[調査2] 2026-01-14 のレース course_type 分布")
print("=" * 70)
c.execute("""
    SELECT r.course_type, r.venue_name, COUNT(*)
    FROM races r
    WHERE r.race_date = '2026-01-14'
    GROUP BY r.course_type, r.venue_name
""")
for row in c.fetchall():
    print(f"  {row[0]} ({row[1]}): {row[2]}件")

# ============================================
# 調査3: 異常な日のレース1つを完全トレース
# ============================================
print("\n" + "=" * 70)
print("[調査3] 2026-01-14 レース1つを完全トレース")
print("=" * 70)
c.execute("""
    SELECT r.id, r.venue_name, r.race_number, r.race_name, r.course_type, r.distance, r.race_date
    FROM races r
    WHERE r.race_date = '2026-01-14' AND r.course_type IN ('芝', 'ダ')
    ORDER BY r.venue_name, r.race_number
    LIMIT 1
""")
sample_race = c.fetchone()
if not sample_race:
    # 芝・ダがなければ何でもいい
    c.execute("""
        SELECT r.id, r.venue_name, r.race_number, r.race_name, r.course_type, r.distance, r.race_date
        FROM races r
        WHERE r.race_date = '2026-01-14'
        ORDER BY r.venue_name, r.race_number
        LIMIT 1
    """)
    sample_race = c.fetchone()

if sample_race:
    race_id = sample_race[0]
    race_date = sample_race[6]
    print(f"  対象レース: {sample_race[1]} {sample_race[2]}R {sample_race[3]}")
    print(f"  course_type={sample_race[4]}, distance={sample_race[5]}")
    print(f"  race_id={race_id}")

    c.execute("""
        SELECT res.horse_id, h.name, res.horse_number, res.finish_time_sec, res.rank
        FROM results res
        JOIN horses h ON res.horse_id = h.id
        WHERE res.race_id = ?
        ORDER BY res.horse_number
    """, (race_id,))
    horses = c.fetchall()
    
    print(f"\n  出走馬 ({len(horses)}頭):")
    valid_score_horses = 0
    for horse in horses:
        horse_id = horse[0]
        horse_name = horse[1]
        
        # predictor.pyの _get_bulk_performance_data と同じロジック
        # start_date_filter = race_date - 365 days
        # end_date_filter = race_date - 2 days
        # course_type IN ('芝', 'ダ') でavg_timeを算出
        c.execute("""
            SELECT r2.venue_name, r2.course_type, r2.distance,
                   res2.finish_time_sec,
                   r2.race_date
            FROM results res2
            JOIN races r2 ON res2.race_id = r2.id
            WHERE res2.horse_id = ?
            AND r2.race_date BETWEEN date(?, '-365 days') AND date(?, '-2 days')
            ORDER BY r2.race_date DESC
        """, (horse_id, race_date, race_date))
        past_results = c.fetchall()
        
        has_time_count = sum(1 for r in past_results if r[3] is not None)
        
        # avg_timeが取れるか: venue_name, course_type, distanceでavg
        time_with_avg = 0
        for pr in past_results:
            if pr[3] is not None:
                # この馬の過去レースのvenue/course/distanceでavg_timeを計算
                c.execute("""
                    SELECT AVG(res3.finish_time_sec)
                    FROM results res3
                    JOIN races r3 ON res3.race_id = r3.id
                    WHERE r3.venue_name = ? AND r3.course_type = ? AND r3.distance = ?
                    AND r3.course_type IN ('芝', 'ダ')
                    AND res3.finish_time_sec IS NOT NULL
                """, (pr[0], pr[1], pr[2]))
                avg = c.fetchone()[0]
                if avg is not None:
                    time_with_avg += 1
        
        if time_with_avg > 0:
            valid_score_horses += 1
        
        # predictionの状態
        c.execute("SELECT deviation_score, unpredictable_reason FROM predictions WHERE race_id = ? AND horse_id = ?",
                  (race_id, horse_id))
        pred = c.fetchone()
        pred_dev = pred[0] if pred else "N/A"
        pred_reason = pred[1] if pred else "N/A"
        
        print(f"    {horse[2]:>2}番 {horse_name:<14} 過去1年={len(past_results):>2}走, "
              f"タイム有={has_time_count:>2}, avg有={time_with_avg:>2} | 偏差値={pred_dev}, 理由={pred_reason}")
    
    print(f"\n  => 有効スコア計算可能な馬: {valid_score_horses}頭 (2頭以上なら予測可能なはず)")

# ============================================
# 調査4: 正常日 2026-01-13 と異常日 2026-01-14 の差分分析
# ============================================
print("\n" + "=" * 70)
print("[調査4] 正常日 vs 異常日 の差分")
print("=" * 70)

for target_date in ['2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16',
                     '2026-01-17', '2026-01-18', '2026-01-19', '2026-01-20']:
    c.execute("""
        SELECT COUNT(DISTINCT r.id) as races,
               SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as dev_ok,
               SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as dev_null
        FROM races r
        LEFT JOIN predictions p ON r.id = p.race_id
        WHERE r.race_date = ?
    """, (target_date,))
    pred_data = c.fetchone()
    
    c.execute("""
        SELECT GROUP_CONCAT(DISTINCT r.venue_name)
        FROM races r WHERE r.race_date = ?
    """, (target_date,))
    venues = c.fetchone()[0]
    
    c.execute("""
        SELECT GROUP_CONCAT(DISTINCT r.course_type)
        FROM races r WHERE r.race_date = ?
    """, (target_date,))
    ctypes = c.fetchone()[0]
    
    status = "正常" if pred_data[1] and pred_data[1] > 0 else "異常(全NULL)"
    print(f"  {target_date}: [{status}] レース={pred_data[0]}, 偏差有={pred_data[1]}, 偏差無={pred_data[2]} | 会場={venues} | course={ctypes}")

# ============================================
# 調査5: race_type, race_nameのパターン確認
# ============================================
print("\n" + "=" * 70)
print("[調査5] 2026-01-14 のrace_name に '新馬' '障害' 含むか")
print("=" * 70)
c.execute("""
    SELECT r.race_name, r.race_type, r.course_type, COUNT(*)
    FROM races r
    WHERE r.race_date = '2026-01-14'
    GROUP BY r.race_name, r.race_type, r.course_type
""")
for row in c.fetchall():
    print(f"  {row[0]} (type={row[1]}, course={row[2]}): {row[3]}件")

# ============================================
# 調査6: 最古のpredictionと最新のpredictionの日付確認
# ============================================
print("\n" + "=" * 70)
print("[調査6] predictions生成日の分布")
print("=" * 70)
c.execute("""
    SELECT MIN(r.race_date), MAX(r.race_date)
    FROM predictions p
    JOIN races r ON p.race_id = r.id
""")
row = c.fetchone()
print(f"  predictions対象レース: {row[0]} ~ {row[1]}")

c.execute("""
    SELECT MIN(r.race_date), MAX(r.race_date)
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    WHERE p.deviation_score IS NOT NULL
""")
row = c.fetchone()
print(f"  deviation_score有効: {row[0]} ~ {row[1]}")

# ============================================
# 調査7: 年月ごとの predictions 正常率
# ============================================
print("\n" + "=" * 70)
print("[調査7] 月別の predictions 正常率")
print("=" * 70)
c.execute("""
    SELECT substr(r.race_date, 1, 7) as month,
           COUNT(*) as total,
           SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as valid,
           ROUND(100.0 * SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
""")
for row in c.fetchall():
    bar = "#" * int(row[3] / 5) if row[3] else ""
    print(f"  {row[0]}: {row[3]:>5.1f}% ({row[2]:>5}/{row[1]:>5}) {bar}")

conn.close()
print("\n調査完了")
