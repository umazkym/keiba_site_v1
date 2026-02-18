#!/usr/bin/env python3
"""AI偏差値・予測・対決成績の問題原因を調査するデバッグスクリプト"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keiba.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=" * 70)
print("データベース調査レポート")
print("=" * 70)

# 1. テーブル件数
print("\n--- 1. テーブル件数 ---")
for table in ['races', 'results', 'horses', 'jockeys', 'trainers', 'predictions', 'matchups', 'horse_number_advantages', 'race_returns']:
    try:
        c.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {c.fetchone()[0]}")
    except:
        print(f"  {table}: テーブルなし")

# 2. レース日付範囲
print("\n--- 2. レース日付範囲 ---")
c.execute("SELECT MIN(race_date), MAX(race_date) FROM races")
row = c.fetchone()
print(f"  最古: {row[0]}, 最新: {row[1]}")

# 3. 年ごとのレース数
print("\n--- 3. 年ごとのレース数 ---")
c.execute("SELECT substr(race_date, 1, 4) as year, COUNT(*) FROM races GROUP BY year ORDER BY year")
for row in c.fetchall():
    print(f"  {row[0]}: {row[1]}件")

# 4. results テーブルの finish_time_sec のNULL率
print("\n--- 4. results.finish_time_sec のNULL率 ---")
c.execute("SELECT COUNT(*) FROM results")
total_results = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM results WHERE finish_time_sec IS NULL")
null_time = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM results WHERE finish_time_sec IS NOT NULL")
non_null_time = c.fetchone()[0]
print(f"  全results: {total_results}")
print(f"  finish_time_sec NULL: {null_time} ({null_time/total_results*100:.1f}%)")
print(f"  finish_time_sec 有効: {non_null_time} ({non_null_time/total_results*100:.1f}%)")

# 5. 年ごとの finish_time_sec NULL率
print("\n--- 5. 年ごとの finish_time_sec NULL率 ---")
c.execute("""
    SELECT substr(r.race_date, 1, 4) as year,
           COUNT(*) as total,
           SUM(CASE WHEN res.finish_time_sec IS NULL THEN 1 ELSE 0 END) as null_count,
           SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as valid_count
    FROM results res
    JOIN races r ON res.race_id = r.id
    GROUP BY year
    ORDER BY year
""")
for row in c.fetchall():
    pct = row[2]/row[1]*100 if row[1] > 0 else 0
    print(f"  {row[0]}: 全{row[1]}件, NULL={row[2]}({pct:.1f}%), 有効={row[3]}")

# 6. rank のNULL率
print("\n--- 6. results.rank のNULL率 ---")
c.execute("SELECT COUNT(*) FROM results WHERE rank IS NULL")
null_rank = c.fetchone()[0]
print(f"  rank NULL: {null_rank} ({null_rank/total_results*100:.1f}%)")

# 7. corner_positions のNULL率
print("\n--- 7. results.corner_positions のNULL率 ---")
c.execute("SELECT COUNT(*) FROM results WHERE corner_positions IS NULL")
null_corner = c.fetchone()[0]
print(f"  corner_positions NULL: {null_corner} ({null_corner/total_results*100:.1f}%)")

# 8. predictions テーブルの状態
print("\n--- 8. predictions テーブルの状態 ---")
c.execute("SELECT COUNT(*) FROM predictions")
total_preds = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM predictions WHERE deviation_score IS NULL")
null_dev = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM predictions WHERE deviation_score IS NOT NULL")
valid_dev = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM predictions WHERE unpredictable_reason IS NOT NULL")
unpredictable = c.fetchone()[0]
print(f"  全predictions: {total_preds}")
print(f"  deviation_score NULL: {null_dev} ({null_dev/total_preds*100:.1f}% of total)")
print(f"  deviation_score 有効: {valid_dev} ({valid_dev/total_preds*100:.1f}% of total)")
print(f"  unpredictable_reason あり: {unpredictable}")

# 9. unpredictable_reason の内訳
print("\n--- 9. unpredictable_reason の内訳 ---")
c.execute("SELECT unpredictable_reason, COUNT(*) FROM predictions WHERE unpredictable_reason IS NOT NULL GROUP BY unpredictable_reason")
for row in c.fetchall():
    print(f"  {row[0]}: {row[1]}件")

# 10. predictions の日付分布（最新10日）
print("\n--- 10. 最新10日間のpredictions状態 ---")
c.execute("""
    SELECT r.race_date, 
           COUNT(*) as total_preds,
           SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as valid_dev,
           SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as null_dev,
           SUM(CASE WHEN p.unpredictable_reason IS NOT NULL THEN 1 ELSE 0 END) as unpredictable
    FROM predictions p
    JOIN races r ON p.race_id = r.id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 15
""")
for row in c.fetchall():
    print(f"  {row[0]}: 全{row[1]}件, 有効偏差値={row[2]}, NULL偏差値={row[3]}, 予測不能={row[4]}")

# 11. matchups テーブルの状態
print("\n--- 11. matchups テーブルの状態 ---")
c.execute("SELECT COUNT(*) FROM matchups")
total_matchups = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM matchups WHERE matchup_data = '{}' OR matchup_data IS NULL")
empty_matchups = c.fetchone()[0]
print(f"  全matchups: {total_matchups}")
print(f"  空/NULLのmatchups: {empty_matchups}")

# 12. matchups の日付分布
print("\n--- 12. 最新10日間のmatchups状態 ---")
c.execute("""
    SELECT r.race_date, 
           COUNT(DISTINCT r.id) as total_races,
           COUNT(DISTINCT m.race_id) as races_with_matchup
    FROM races r
    LEFT JOIN matchups m ON r.id = m.race_id
    GROUP BY r.race_date
    ORDER BY r.race_date DESC
    LIMIT 15
""")
for row in c.fetchall():
    print(f"  {row[0]}: 全{row[1]}レース, matchupあり={row[2]}")

# 13. 特定レースの深掘り: 最新日付のレースを1つ取得して詳細調査
print("\n--- 13. 最新日付レース詳細調査 ---")
c.execute("SELECT id, race_date, venue_name, race_number, race_name, course_type, distance FROM races ORDER BY race_date DESC LIMIT 5")
latest_races = c.fetchall()
for race in latest_races:
    race_id = race[0]
    print(f"\n  レース: {race[2]} {race[3]}R {race[4]} (ID: {race_id}, 日付: {race[1]})")
    
    # 出走馬の過去成績有無
    c.execute("""
        SELECT res.horse_id, h.name, res.finish_time_sec, res.rank, res.horse_number
        FROM results res
        JOIN horses h ON res.horse_id = h.id
        WHERE res.race_id = ?
        ORDER BY res.horse_number
    """, (race_id,))
    horses_in_race = c.fetchall()
    
    if not horses_in_race:
        print("    出走馬データなし")
        continue
    
    for horse in horses_in_race[:5]:  # 最初の5頭だけ
        horse_id = horse[0]
        horse_name = horse[1]
        
        # 過去1年の成績数
        c.execute("""
            SELECT COUNT(*) FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE res.horse_id = ?
            AND r.race_date < ?
            AND r.race_date >= date(?, '-365 days')
        """, (horse_id, race[1], race[1]))
        past_count = c.fetchone()[0]
        
        # 過去1年でfinish_time_secが有効な成績数
        c.execute("""
            SELECT COUNT(*) FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE res.horse_id = ?
            AND r.race_date < ?
            AND r.race_date >= date(?, '-365 days')
            AND res.finish_time_sec IS NOT NULL
        """, (horse_id, race[1], race[1]))
        past_valid = c.fetchone()[0]
        
        # predictions での偏差値
        c.execute("SELECT deviation_score, unpredictable_reason FROM predictions WHERE race_id = ? AND horse_id = ?", (race_id, horse_id))
        pred = c.fetchone()
        
        print(f"    {horse[4]}番 {horse_name}: 過去1年成績={past_count}, 有効タイム成績={past_valid}, "
              f"当レースタイム={'有' if horse[2] else 'NULL'}, "
              f"偏差値={pred[0] if pred else 'N/A'}, 理由={pred[1] if pred else 'N/A'}")

# 14. course_typeの分布確認（avg_time計算に使われるフィルタ）
print("\n--- 14. course_type の分布 ---")
c.execute("SELECT course_type, COUNT(*) FROM races GROUP BY course_type ORDER BY COUNT(*) DESC")
for row in c.fetchall():
    print(f"  {row[0]}: {row[1]}件")

# 15. 過去データで finish_time_sec AND avg_time が取れるか確認
print("\n--- 15. avg_time計算の検証（芝/ダのみ） ---")
c.execute("""
    SELECT r.venue_name, r.course_type, r.distance, 
           COUNT(*) as race_count,
           AVG(res.finish_time_sec) as avg_time
    FROM races r
    JOIN results res ON r.id = res.race_id
    WHERE r.course_type IN ('芝', 'ダ')
    AND res.finish_time_sec IS NOT NULL
    GROUP BY r.venue_name, r.course_type, r.distance
    ORDER BY race_count DESC
    LIMIT 15
""")
for row in c.fetchall():
    print(f"  {row[0]} {row[1]} {row[2]}m: {row[3]}件, avg_time={row[4]:.2f}s")

# 16. 重要: finish_time_secがNULLなのにrankがあるケースの確認
print("\n--- 16. rank有り かつ finish_time_sec NULLのケース ---")
c.execute("""
    SELECT substr(r.race_date, 1, 4) as year, COUNT(*)
    FROM results res
    JOIN races r ON res.race_id = r.id
    WHERE res.rank IS NOT NULL AND res.finish_time_sec IS NULL
    GROUP BY year
    ORDER BY year
""")
for row in c.fetchall():
    print(f"  {row[0]}: {row[1]}件")

# 17. レースごとにfinish_time_secの歯抜け状況確認
print("\n--- 17. finish_time_sec 歯抜けパターン（最近のレース） ---")
c.execute("""
    SELECT r.race_date, r.id, r.venue_name, r.race_number, r.race_name,
           COUNT(*) as total_horses_in_result,
           SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as with_time,
           SUM(CASE WHEN res.finish_time_sec IS NULL THEN 1 ELSE 0 END) as without_time
    FROM races r
    JOIN results res ON r.id = res.race_id
    GROUP BY r.id
    ORDER BY r.race_date DESC
    LIMIT 20
""")
for row in c.fetchall():
    print(f"  {row[0]} {row[2]} {row[3]}R: 出走{row[5]}頭, タイム有={row[6]}, タイム無={row[7]}")

# 18. 過去1年の成績データの取得対象: 日付フィルタの確認
# predictor.pyでは race_date - 365 ~ race_date - 2 をフィルタ
print("\n--- 18. _get_bulk_performance_data のフィルタ検証 ---")
c.execute("SELECT MAX(race_date) FROM races")
latest_date = c.fetchone()[0]
print(f"  最新レース日: {latest_date}")

# 最新レースの馬たちの過去データ（日付フィルタ適用）
c.execute("""
    SELECT res.horse_id, h.name
    FROM results res
    JOIN horses h ON res.horse_id = h.id
    WHERE res.race_id = (SELECT id FROM races ORDER BY race_date DESC LIMIT 1)
    LIMIT 5
""")
sample_horses = c.fetchall()
for horse_id, horse_name in sample_horses:
    # 過去1年 (race_date - 365 ~ race_date - 2)
    c.execute(f"""
        SELECT COUNT(*), 
               SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END)
        FROM results res
        JOIN races r ON res.race_id = r.id
        WHERE res.horse_id = ?
        AND r.race_date BETWEEN date('{latest_date}', '-365 days') AND date('{latest_date}', '-2 days')
    """, (horse_id,))
    data = c.fetchone()
    
    # course_typeフィルタ（芝/ダのみでのavg_time）も考慮
    c.execute(f"""
        SELECT COUNT(*)
        FROM results res
        JOIN races r ON res.race_id = r.id
        WHERE res.horse_id = ?
        AND r.race_date BETWEEN date('{latest_date}', '-365 days') AND date('{latest_date}', '-2 days')
        AND r.course_type IN ('芝', 'ダ')
        AND res.finish_time_sec IS NOT NULL
    """, (horse_id,))
    valid_with_course = c.fetchone()[0]
    
    print(f"  {horse_name}: 全{data[0]}件, タイム有{data[1]}件, 芝/ダでタイム有{valid_with_course}件")

conn.close()
print("\n調査完了")
