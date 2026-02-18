#!/usr/bin/env python3
"""AI偏差値問題 - データ調査パート2: 核心確認"""
import sqlite3
import os
import sys

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keiba.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=" * 70)
print("【核心調査】最近のレースのfinish_time_sec状態")
print("=" * 70)

# 最近のレースのfinish_time_secが全てNULLかを確認
print("\n--- レース日別: finish_time_sec NULL率 (直近20日) ---")
c.execute("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as race_count,
           COUNT(res.id) as result_count,
           SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as time_valid,
           SUM(CASE WHEN res.finish_time_sec IS NULL THEN 1 ELSE 0 END) as time_null,
           SUM(CASE WHEN res.rank IS NOT NULL THEN 1 ELSE 0 END) as rank_valid
    FROM races r
    JOIN results res ON r.id = res.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 20
""")
print(f"  {'日付':<14} {'レース数':>6} {'結果数':>6} {'タイム有':>6} {'タイム無':>6} {'着順有':>6}")
print("  " + "-" * 58)
for row in c.fetchall():
    print(f"  {row[0]:<14} {row[1]:>6} {row[2]:>6} {row[3]:>6} {row[4]:>6} {row[5]:>6}")

print("\n" + "=" * 70)
print("【核心調査】predictions状態 (直近20日)")
print("=" * 70)
c.execute("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as race_count,
           COUNT(p.id) as pred_count,
           SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as dev_valid,
           SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as dev_null,
           SUM(CASE WHEN p.unpredictable_reason IS NOT NULL THEN 1 ELSE 0 END) as unpred
    FROM races r
    LEFT JOIN predictions p ON r.id = p.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 20
""")
print(f"  {'日付':<14} {'レース':>4} {'予測数':>5} {'偏差有':>5} {'偏差無':>5} {'不能':>4}")
print("  " + "-" * 48)
for row in c.fetchall():
    print(f"  {row[0]:<14} {row[1]:>4} {row[2]:>5} {row[3]:>5} {row[4]:>5} {row[5]:>4}")

print("\n" + "=" * 70)
print("【核心調査】最新日(2026-01-20)の特定レース詳細")
print("=" * 70)

# 2026-01-20のレースで予測が全部---になっているケース
c.execute("""
    SELECT r.id, r.venue_name, r.race_number, r.race_name, r.course_type, r.distance
    FROM races r
    WHERE r.race_date = '2026-01-20'
    ORDER BY r.venue_name, r.race_number
    LIMIT 3
""")
races = c.fetchall()
for race in races:
    race_id = race[0]
    print(f"\n  --- {race[1]} {race[2]}R {race[3]} ({race[4]} {race[5]}m) ---")
    print(f"  レースID: {race_id}")
    
    # 当日レースの出走馬
    c.execute("""
        SELECT res.horse_id, h.name, res.horse_number, res.finish_time_sec, res.rank
        FROM results res
        JOIN horses h ON res.horse_id = h.id
        WHERE res.race_id = ?
        ORDER BY res.horse_number
    """, (race_id,))
    horses = c.fetchall()
    
    for horse in horses:
        horse_id = horse[0]
        horse_name = horse[1]
        
        # この馬の全過去成績数
        c.execute("""
            SELECT COUNT(*) FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE res.horse_id = ? AND r.race_date < '2026-01-20'
        """, (horse_id,))
        total_past = c.fetchone()[0]
        
        # 過去1年 + finish_time_sec有効
        c.execute("""
            SELECT COUNT(*) FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE res.horse_id = ?
            AND r.race_date BETWEEN '2025-01-20' AND '2026-01-18'
            AND res.finish_time_sec IS NOT NULL
        """, (horse_id,))
        valid_1y = c.fetchone()[0]
        
        # 過去1年のfinish_time_sec状態
        c.execute("""
            SELECT r.race_date, res.finish_time_sec, res.rank
            FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE res.horse_id = ?
            AND r.race_date BETWEEN '2025-01-20' AND '2026-01-18'
            ORDER BY r.race_date DESC
            LIMIT 3
        """, (horse_id,))
        recent = c.fetchall()
        recent_info = "; ".join([f"{r[0]}:time={r[1]},rank={r[2]}" for r in recent])
        
        print(f"    {horse[2]:>2}番 {horse_name:<12} 全過去={total_past:>3}, 1年有効={valid_1y:>2} | 直近3走: {recent_info}")

print("\n" + "=" * 70)
print("【核心調査】偏差値が正常に出ている日と出ていない日の差")
print("=" * 70)

# 偏差値が正常に出ている日(2026-01-13)のレース
print("\n--- 正常な日: 2026-01-13 のサンプル ---")
c.execute("""
    SELECT r.id, r.venue_name, r.race_number, r.race_name, r.course_type
    FROM races r
    WHERE r.race_date = '2026-01-13'
    LIMIT 2
""")
races_ok = c.fetchall()
for race in races_ok:
    race_id = race[0]
    print(f"\n  {race[1]} {race[2]}R {race[3]}")
    c.execute("""
        SELECT res.horse_id, h.name, res.horse_number, res.finish_time_sec, res.rank,
               p.deviation_score, p.unpredictable_reason
        FROM results res
        JOIN horses h ON res.horse_id = h.id
        LEFT JOIN predictions p ON p.race_id = res.race_id AND p.horse_id = res.horse_id
        WHERE res.race_id = ?
        ORDER BY res.horse_number
        LIMIT 5
    """, (race_id,))
    for row in c.fetchall():
        print(f"    {row[2]:>2}番 {row[1]:<12} time={row[3]}, rank={row[4]}, 偏差={row[5]}, 理由={row[6]}")

# 偏差値が全部NULLの日(2026-01-14)のレース
print("\n--- 異常な日: 2026-01-14 のサンプル ---")
c.execute("""
    SELECT r.id, r.venue_name, r.race_number, r.race_name, r.course_type
    FROM races r
    WHERE r.race_date = '2026-01-14'
    LIMIT 2
""")
races_ng = c.fetchall()
for race in races_ng:
    race_id = race[0]
    print(f"\n  {race[1]} {race[2]}R {race[3]}")
    c.execute("""
        SELECT res.horse_id, h.name, res.horse_number, res.finish_time_sec, res.rank,
               p.deviation_score, p.unpredictable_reason
        FROM results res
        JOIN horses h ON res.horse_id = h.id
        LEFT JOIN predictions p ON p.race_id = res.race_id AND p.horse_id = res.horse_id
        WHERE res.race_id = ?
        ORDER BY res.horse_number
        LIMIT 5
    """, (race_id,))
    for row in c.fetchall():
        print(f"    {row[2]:>2}番 {row[1]:<12} time={row[3]}, rank={row[4]}, 偏差={row[5]}, 理由={row[6]}")

print("\n" + "=" * 70)
print("【核心調査】 matchups (過去対決成績) の状態")
print("=" * 70)

# matchups日別
c.execute("""
    SELECT r.race_date,
           COUNT(DISTINCT r.id) as total_races,
           COUNT(DISTINCT m.race_id) as with_matchup,
           COUNT(DISTINCT r.id) - COUNT(DISTINCT m.race_id) as without_matchup
    FROM races r
    LEFT JOIN matchups m ON r.id = m.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 20
""")
print(f"  {'日付':<14} {'全レース':>6} {'matchup有':>8} {'matchup無':>8}")
print("  " + "-" * 44)
for row in c.fetchall():
    print(f"  {row[0]:<14} {row[1]:>6} {row[2]:>8} {row[3]:>8}")

# matchupがある場合、中身が空かチェック
print("\n--- matchup_dataの中身確認 ---")
c.execute("""
    SELECT m.race_id, LENGTH(m.matchup_data), m.matchup_data
    FROM matchups m
    JOIN races r ON m.race_id = r.id
    ORDER BY r.race_date DESC
    LIMIT 5
""")
for row in c.fetchall():
    data = row[2]
    data_preview = str(data)[:100] if data else "NULL"
    print(f"  race_id={row[0]}, data_len={row[1]}, preview={data_preview}")

# 空の matchup_data
c.execute("SELECT COUNT(*) FROM matchups WHERE matchup_data = '{}' OR matchup_data = 'null' OR matchup_data IS NULL OR LENGTH(matchup_data) < 5")
empty_count = c.fetchone()[0]
print(f"\n  空/最小のmatchup_data: {empty_count}件")

conn.close()
print("\n調査完了")
