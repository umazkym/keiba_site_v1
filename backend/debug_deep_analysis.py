"""
AI偏差値問題の深層調査スクリプト
パイプライン実行後も改善しない根本原因を特定する

調査項目:
1. 2026-02-12の予測状態 (deviation_score NULL率)
2. 2026-02-12の馬の過去成績データの有無 (finish_time_sec/avg_time)
3. predictor._get_bulk_performance_dataの実際の動作をシミュレーション
4. 正常日と異常日の比較
"""
from dotenv import load_dotenv
load_dotenv()

import os
import sys
import math
import datetime
from datetime import timedelta
from collections import defaultdict

from sqlalchemy import func, create_engine, text
from sqlalchemy.orm import sessionmaker

from database.database import SessionLocal
from database import models

def main():
    db = SessionLocal()
    
    try:
        # ===== 調査1: 直近日付別 予測状態 =====
        print("=" * 80)
        print("【調査1】直近の日付別 予測状態")
        print("=" * 80)
        
        recent_dates = db.execute(text("""
            SELECT r.race_date, 
                   COUNT(DISTINCT r.id) as race_count,
                   COUNT(p.id) as pred_count,
                   SUM(CASE WHEN p.deviation_score IS NOT NULL THEN 1 ELSE 0 END) as dev_valid,
                   SUM(CASE WHEN p.deviation_score IS NULL THEN 1 ELSE 0 END) as dev_null,
                   SUM(CASE WHEN p.unpredictable_reason IS NOT NULL THEN 1 ELSE 0 END) as unpred
            FROM races r
            LEFT JOIN predictions p ON r.id = p.race_id
            WHERE r.race_date >= CURRENT_DATE - INTERVAL '14 days'
            GROUP BY r.race_date
            ORDER BY r.race_date DESC
        """)).fetchall()
        
        print(f"{'日付':<14} {'レース数':>8} {'予測数':>8} {'偏差値有':>8} {'偏差値無':>8} {'対象外':>8} {'有効率':>8}")
        print("-" * 80)
        for row in recent_dates:
            rate = f"{row[3]/row[2]*100:.1f}%" if row[2] > 0 else "N/A"
            print(f"{str(row[0]):<14} {row[1]:>8} {row[2]:>8} {row[3]:>8} {row[4]:>8} {row[5]:>8} {rate:>8}")
        
        # ===== 調査2: 2026-02-12のunpredictable_reason内訳 =====
        print("\n" + "=" * 80)
        print("【調査2】2026-02-12 の unpredictable_reason 内訳")
        print("=" * 80)
        
        reasons = db.execute(text("""
            SELECT p.unpredictable_reason, COUNT(*) as cnt
            FROM predictions p
            JOIN races r ON p.race_id = r.id
            WHERE r.race_date = '2026-02-12'
            GROUP BY p.unpredictable_reason
            ORDER BY cnt DESC
        """)).fetchall()
        
        for row in reasons:
            reason = row[0] if row[0] else "(NULL - 正常予測)"
            print(f"  {reason}: {row[1]}件")
            
        # ===== 調査3: 2026-02-12の具体的なレース1つをトレース =====
        print("\n" + "=" * 80)
        print("【調査3】2026-02-12 のレース1つを詳細トレース (予測対象外のもの)")
        print("=" * 80)
        
        # 予測対象外のレースを1つ取得
        sample_race = db.execute(text("""
            SELECT DISTINCT r.id, r.race_name, r.venue_name, r.course_type, r.distance, r.race_date
            FROM races r
            JOIN predictions p ON r.id = p.race_id
            WHERE r.race_date = '2026-02-12'
              AND p.unpredictable_reason LIKE '%2頭未満%'
            LIMIT 1
        """)).fetchone()
        
        if not sample_race:
            print("予測対象外レースが見つかりません。正常なケースを調査します。")
            sample_race = db.execute(text("""
                SELECT DISTINCT r.id, r.race_name, r.venue_name, r.course_type, r.distance, r.race_date
                FROM races r
                JOIN predictions p ON r.id = p.race_id
                WHERE r.race_date = '2026-02-12'
                LIMIT 1
            """)).fetchone()
        
        if sample_race:
            race_id = sample_race[0]
            print(f"レースID: {race_id}")
            print(f"レース名: {sample_race[1]}")
            print(f"会場/コース/距離: {sample_race[2]} / {sample_race[3]} / {sample_race[4]}m")
            
            # このレースの出走馬を取得
            horses_in_race = db.execute(text("""
                SELECT res.horse_id, h.name, res.horse_number, 
                       p.deviation_score, p.unpredictable_reason
                FROM results res
                JOIN horses h ON res.horse_id = h.id
                LEFT JOIN predictions p ON res.race_id = p.race_id AND res.horse_id = p.horse_id
                WHERE res.race_id = :race_id
                ORDER BY res.horse_number
            """), {"race_id": race_id}).fetchall()
            
            print(f"\n出走馬数: {len(horses_in_race)}頭")
            
            # 各馬の過去データ詳細
            race_date = sample_race[5]
            start_date = race_date - timedelta(days=365)
            end_date = race_date - timedelta(days=2)
            
            print(f"過去データ検索期間: {start_date} ～ {end_date}")
            print()
            
            valid_count = 0
            for horse in horses_in_race[:5]:  # 最初の5頭を詳細表示
                horse_id = horse[0]
                horse_name = horse[1]
                horse_num = horse[2]
                dev_score = horse[3]
                
                print(f"--- 馬番{horse_num} {horse_name} (ID: {horse_id}) ---")
    
                # キャッシュファイルの更新日時確認
                cache_path = os.path.join("data", "html_cache", "horse", f"{horse_id}.bin")
                if os.path.exists(cache_path):
                    mtime = datetime.datetime.fromtimestamp(os.path.getmtime(cache_path))
                    print(f"  キャッシュ更新日時: {mtime}")
                else:
                    print("  キャッシュファイルなし")

                print(f"  偏差値: {dev_score}")
                
                # この馬の全過去成績数
                total_results = db.execute(text("""
                    SELECT COUNT(*) FROM results WHERE horse_id = :hid
                """), {"hid": horse_id}).scalar()
                
                # 1年以内の過去成績数
                past_in_range = db.execute(text("""
                    SELECT COUNT(*)
                    FROM results res
                    JOIN races r ON res.race_id = r.id
                    WHERE res.horse_id = :hid
                      AND r.race_date BETWEEN :start AND :end
                """), {"hid": horse_id, "start": start_date, "end": end_date}).scalar()
                
                # finish_time_secが非NULLの過去成績数（1年以内）
                past_with_time = db.execute(text("""
                    SELECT COUNT(*)
                    FROM results res
                    JOIN races r ON res.race_id = r.id
                    WHERE res.horse_id = :hid
                      AND r.race_date BETWEEN :start AND :end
                      AND res.finish_time_sec IS NOT NULL
                """), {"hid": horse_id, "start": start_date, "end": end_date}).scalar()
                
                print(f"  DB内の全成績数: {total_results}")
                print(f"  1年以内の成績数: {past_in_range}")
                print(f"  1年以内でfinish_time_sec非NULL: {past_with_time}")
                
                # finish_time_secが非NULLの成績を表示
                past_detail = db.execute(text("""
                    SELECT r.race_date, r.venue_name, r.course_type, r.distance,
                           res.finish_time_sec, res.rank
                    FROM results res
                    JOIN races r ON res.race_id = r.id
                    WHERE res.horse_id = :hid
                      AND r.race_date BETWEEN :start AND :end
                    ORDER BY r.race_date DESC
                    LIMIT 5
                """), {"hid": horse_id, "start": start_date, "end": end_date}).fetchall()
                
                if past_detail:
                    print(f"  過去成績(最新5件):")
                    for d in past_detail:
                        time_str = f"{d[4]:.1f}秒" if d[4] else "NULL"
                        print(f"    {d[0]} {d[1]} {d[2]}{d[3]}m 着順:{d[5]} タイム:{time_str}")
                else:
                    print(f"  ※ 1年以内の過去成績なし")
                    # 全期間で見てみる
                    full_past = db.execute(text("""
                        SELECT r.race_date, r.venue_name, res.finish_time_sec
                        FROM results res
                        JOIN races r ON res.race_id = r.id
                        WHERE res.horse_id = :hid
                        ORDER BY r.race_date DESC
                        LIMIT 3
                    """), {"hid": horse_id}).fetchall()
                    if full_past:
                        print(f"  全期間の最新成績:")
                        for d in full_past:
                            time_str = f"{d[2]:.1f}秒" if d[2] else "NULL"
                            print(f"    {d[0]} {d[1]} タイム:{time_str}")
                
                # avg_timeが取得可能かチェック
                if past_detail:
                    for d in past_detail[:1]:
                        avg_time = db.execute(text("""
                            SELECT AVG(res.finish_time_sec)
                            FROM results res
                            JOIN races r ON res.race_id = r.id
                            WHERE r.venue_name = :venue
                              AND r.course_type = :ctype
                              AND r.distance = :dist
                              AND res.finish_time_sec IS NOT NULL
                        """), {"venue": d[1], "ctype": d[2], "dist": d[3]}).scalar()
                        print(f"  avg_time ({d[1]}/{d[2]}/{d[3]}m): {f'{avg_time:.2f}秒' if avg_time else 'NULL'}")
                
                if past_with_time > 0:
                    valid_count += 1
                print()
            
            print(f"サンプル5頭中、有効スコア馬数 (finish_time_sec非NULL): {valid_count}")
            print(f"→ 2頭未満なら予測対象外")
        
        # ===== 調査4: DB全体のfinish_time_sec状況 =====
        print("\n" + "=" * 80)
        print("【調査4】DB全体の finish_time_sec 状況")
        print("=" * 80)
        
        time_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as has_time,
                SUM(CASE WHEN finish_time_sec IS NULL THEN 1 ELSE 0 END) as no_time
            FROM results
        """)).fetchone()
        
        rate = f"{time_stats[1]/time_stats[0]*100:.1f}%" if time_stats[0] > 0 else "N/A"
        print(f"全results件数: {time_stats[0]}")
        print(f"finish_time_sec 非NULL: {time_stats[1]} ({rate})")
        print(f"finish_time_sec NULL: {time_stats[2]}")
        
        # 日付別のfinish_time_sec有効率
        print("\n日付別 finish_time_sec有効率 (直近30日):")
        date_time_stats = db.execute(text("""
            SELECT r.race_date,
                   COUNT(*) as total,
                   SUM(CASE WHEN res.finish_time_sec IS NOT NULL THEN 1 ELSE 0 END) as has_time
            FROM results res
            JOIN races r ON res.race_id = r.id
            WHERE r.race_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY r.race_date
            ORDER BY r.race_date DESC
        """)).fetchall()
        
        print(f"{'日付':<14} {'全件数':>8} {'タイム有':>8} {'有効率':>8}")
        print("-" * 50)
        for row in date_time_stats:
            rate = f"{row[2]/row[1]*100:.1f}%" if row[1] > 0 else "N/A"
            print(f"{str(row[0]):<14} {row[1]:>8} {row[2]:>8} {rate:>8}")
        
        # ===== 調査5: predictor._get_bulk_performance_data のシミュレーション =====
        print("\n" + "=" * 80)
        print("【調査5】_get_bulk_performance_data シミュレーション")
        print("=" * 80)
        
        if sample_race:
            race_date = sample_race[5]
            start_date = race_date - timedelta(days=365)
            end_date = race_date - timedelta(days=2)
            
            all_horse_ids = [h[0] for h in horses_in_race]
            
            # avg_timesサブクエリと同じロジック
            avg_times_base_q = db.query(
                models.Race.venue_name, models.Race.course_type, models.Race.distance,
                func.avg(models.Result.finish_time_sec).label('avg_time')
            ).join(models.Result).filter(models.Race.course_type.in_(['芝', 'ダ'])).group_by(
                models.Race.venue_name, models.Race.course_type, models.Race.distance
            ).subquery()
            
            results = db.query(models.Result, models.Race, avg_times_base_q.c.avg_time)\
                .join(models.Race, models.Result.race_id == models.Race.id)\
                .outerjoin(avg_times_base_q, (models.Race.venue_name == avg_times_base_q.c.venue_name) & 
                                             (models.Race.course_type == avg_times_base_q.c.course_type) & 
                                             (models.Race.distance == avg_times_base_q.c.distance))\
                .filter(models.Result.horse_id.in_(all_horse_ids))\
                .filter(models.Race.race_date.between(start_date, end_date))\
                .all()
            
            results_by_horse = defaultdict(list)
            for res, race, avg_time in results:
                results_by_horse[res.horse_id].append((res, race, avg_time))
            
            print(f"検索期間: {start_date} ～ {end_date}")
            print(f"出走馬数: {len(all_horse_ids)}頭")
            print(f"過去データが見つかった馬数: {len(results_by_horse)}頭")
            
            scores_valid = 0
            for horse in horses_in_race:
                hid = horse[0]
                hname = horse[1]
                past = results_by_horse.get(hid, [])
                
                # finish_time_sec と avg_time が両方非NULLのレコード数
                valid_records = sum(1 for r, race, avg in past if r.finish_time_sec and avg)
                
                if past:
                    sample = past[0]
                    print(f"  {hname}: {len(past)}件の過去データ, うちスコア計算可能: {valid_records}件"
                          f" (time={sample[0].finish_time_sec}, avg={sample[2]})")
                else:
                    print(f"  {hname}: 過去データなし")
                
                if valid_records > 0:
                    scores_valid += 1
            
            print(f"\n有効スコア馬数: {scores_valid}/{len(all_horse_ids)} (2頭以上あれば予測可能)")
        
        # ===== 調査6: 正常に偏差値が出ている日のサンプル =====
        print("\n" + "=" * 80)
        print("【調査6】偏差値が正常に計算されている日のサンプル比較")
        print("=" * 80)
        
        normal_date = db.execute(text("""
            SELECT r.race_date
            FROM races r
            JOIN predictions p ON r.id = p.race_id
            WHERE p.deviation_score IS NOT NULL
            GROUP BY r.race_date
            ORDER BY r.race_date DESC
            LIMIT 1
        """)).scalar()
        
        if normal_date:
            print(f"正常日: {normal_date}")
            normal_sample = db.execute(text("""
                SELECT DISTINCT r.id, r.race_name, r.venue_name, r.course_type, r.distance
                FROM races r
                JOIN predictions p ON r.id = p.race_id
                WHERE r.race_date = :d AND p.deviation_score IS NOT NULL
                LIMIT 1
            """), {"d": normal_date}).fetchone()
            
            if normal_sample:
                print(f"  レース: {normal_sample[1]} ({normal_sample[2]} {normal_sample[3]}{normal_sample[4]}m)")
                
                # このレースの馬の過去データ
                n_horses = db.execute(text("""
                    SELECT res.horse_id, h.name
                    FROM results res
                    JOIN horses h ON res.horse_id = h.id
                    WHERE res.race_id = :rid
                    LIMIT 3
                """), {"rid": normal_sample[0]}).fetchall()
                
                n_race_date = normal_date
                n_start = n_race_date - timedelta(days=365)
                n_end = n_race_date - timedelta(days=2)
                
                for nh in n_horses:
                    # 1年以内の成績
                    past_count = db.execute(text("""
                        SELECT COUNT(*)
                        FROM results res
                        JOIN races r ON res.race_id = r.id
                        WHERE res.horse_id = :hid
                          AND r.race_date BETWEEN :start AND :end
                          AND res.finish_time_sec IS NOT NULL
                    """), {"hid": nh[0], "start": n_start, "end": n_end}).scalar()
                    print(f"  {nh[1]}: finish_time_sec非NULLの1年以内成績 = {past_count}件")
        else:
            print("偏差値が正常な日が見つかりません！")
        
        print("\n" + "=" * 80)
        print("調査完了")
        print("=" * 80)
        
        # ===== 調査7: スクレイピング動作検証 =====
        print("\n" + "=" * 80)
        print("【調査7】スクレイピング動作検証 (トラストユー ID:2022101496)")
        print("=" * 80)
        
        test_horse_id = "2022101496"
        from scripts import scraper
        
        print(f"カレントディレクトリ: {os.getcwd()}")
        print(f"scraper.HTML_DIR: {os.path.abspath(scraper.HTML_DIR)}")
        
        # 強制ダウンロード実行
        print("get_horse_page_html(..., force_download=True) を実行中...")
        try:
            html, was_scraped = scraper.get_horse_page_html(test_horse_id, force_download=True)
            print(f"結果: html取得={'成功' if html else '失敗'}, was_scraped={was_scraped}")
            
            if html:
                print(f"HTMLサイズ: {len(html)} bytes")
                # ファイルパスの確認
                expected_path = os.path.join(scraper.HTML_DIR, "horse", f"{test_horse_id}.bin")
                print(f"期待される保存パス: {expected_path}")
                if os.path.exists(expected_path):
                    print(f"ファイル存在確認: OK")
                    print(f"ファイルサイズ: {os.path.getsize(expected_path)} bytes")
                    mtime = datetime.datetime.fromtimestamp(os.path.getmtime(expected_path))
                    print(f"ファイル更新日時: {mtime}")
                else:
                    print(f"ファイル存在確認: NG (ファイルが見つかりません)")
            else:
                print("HTMLが取得できませんでした。ネットワーク制限やBANの可能性があります。")
                
        except Exception as e:
            print(f"スクレイピング実行中にエラー発生: {e}")
            import traceback
            traceback.print_exc()
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
