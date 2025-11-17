#!/usr/bin/env python3
"""
競馬サイトのデバッグチェックスクリプト

このスクリプトを実行すると、以下をチェックします：
1. データベース内のレースIDの形式
2. ばんえい競馬のデータ整合性
3. 土日のレース数とメモリ使用量予測
4. レースタイプの不一致

実行方法:
python debug_check.py
"""

import sys
import os
from datetime import date, timedelta, datetime
from collections import defaultdict, Counter
from sqlalchemy import func

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal
from database import models

# ばんえい競馬の会場コード
BANEI_VENUE_CODES = ["33", "65"]

def print_section(title):
    """セクションタイトルを表示"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def check_race_id_format():
    """チェック1: レースIDの形式をチェック"""
    print_section("チェック1: レースIDの形式")

    db = SessionLocal()
    try:
        # 全レースを取得
        all_races = db.query(models.Race).limit(1000).all()

        invalid_races = []
        valid_count = 0

        for race in all_races:
            race_id = race.id

            # 長さチェック
            if len(race_id) != 12:
                invalid_races.append({
                    'id': race_id,
                    'reason': f'長さが{len(race_id)}文字（12文字であるべき）',
                    'date': race.race_date,
                    'venue': race.venue_name
                })
                continue

            # 数字のみかチェック
            if not race_id.isdigit():
                invalid_races.append({
                    'id': race_id,
                    'reason': '数字以外の文字が含まれる',
                    'date': race.race_date,
                    'venue': race.venue_name
                })
                continue

            # 会場コードの範囲チェック
            try:
                venue_code = int(race_id[4:6])
                # 01-10: 中央競馬
                # 30-65: 地方競馬
                if not ((1 <= venue_code <= 10) or (30 <= venue_code <= 65)):
                    invalid_races.append({
                        'id': race_id,
                        'reason': f'会場コード{venue_code:02d}が範囲外（01-10, 30-65のみ有効）',
                        'date': race.race_date,
                        'venue': race.venue_name
                    })
                    continue
            except (ValueError, IndexError) as e:
                invalid_races.append({
                    'id': race_id,
                    'reason': f'会場コードの抽出に失敗: {e}',
                    'date': race.race_date,
                    'venue': race.venue_name
                })
                continue

            valid_count += 1

        print(f"✅ チェック済みレース数: {len(all_races)}")
        print(f"✅ 正常なレースID: {valid_count}")
        print(f"⚠️  不正なレースID: {len(invalid_races)}")

        if invalid_races:
            print("\n❌ 不正なレースID（最初の10件）:")
            for race in invalid_races[:10]:
                print(f"  - ID: {race['id']}")
                print(f"    理由: {race['reason']}")
                print(f"    日付: {race['date']}, 会場: {race['venue']}")
        else:
            print("\n✅ すべてのレースIDは正常です！")

        return len(invalid_races) == 0

    finally:
        db.close()

def check_banei_consistency():
    """チェック2: ばんえい競馬のデータ整合性"""
    print_section("チェック2: ばんえい競馬のデータ整合性")

    db = SessionLocal()
    try:
        # ばんえい競馬のレースを検索
        banei_races = db.query(models.Race).filter(
            models.Race.id.like('____33%') | models.Race.id.like('____65%')
        ).all()

        if not banei_races:
            print("✅ ばんえい競馬のレースはDBに存在しません（正常）")
            return True

        print(f"⚠️  ばんえい競馬のレースが {len(banei_races)} 件見つかりました")
        print("   （本来は除外されるべき）\n")

        # 各レースについて、予測データと結果データをチェック
        issues = []
        for race in banei_races[:10]:  # 最初の10件のみ
            has_predictions = db.query(models.Prediction).filter(
                models.Prediction.race_id == race.id
            ).count() > 0

            has_results = db.query(models.Result).filter(
                models.Result.race_id == race.id
            ).count() > 0

            if has_results and not has_predictions:
                issues.append({
                    'race_id': race.id,
                    'date': race.race_date,
                    'venue': race.venue_name,
                    'has_predictions': has_predictions,
                    'has_results': has_results
                })

        if issues:
            print("❌ データ不整合が見つかりました:")
            for issue in issues:
                print(f"  - レースID: {issue['race_id']}")
                print(f"    日付: {issue['date']}, 会場: {issue['venue']}")
                print(f"    予測データ: {'あり' if issue['has_predictions'] else 'なし'}")
                print(f"    結果データ: {'あり' if issue['has_results'] else 'なし'}")
                print(f"    → 結果だけあって予測がない状態！")
        else:
            print("✅ ばんえい競馬のデータに不整合はありません")

        return len(issues) == 0

    finally:
        db.close()

def check_weekend_load():
    """チェック3: 土日のレース数をチェック"""
    print_section("チェック3: 土日のレース負荷")

    db = SessionLocal()
    try:
        # 最近30日間の日別レース数を集計
        today = date.today()
        start_date = today - timedelta(days=30)

        races_by_date = db.query(
            models.Race.race_date,
            func.count(models.Race.id).label('count')
        ).filter(
            models.Race.race_date >= start_date
        ).group_by(models.Race.race_date).order_by(models.Race.race_date.desc()).all()

        if not races_by_date:
            print("⚠️  最近30日間のレースデータがありません")
            return False

        # 土日と平日を分類
        weekend_counts = []
        weekday_counts = []

        print("\n最近のレース数（最新10日分）:")
        for race_date, count in races_by_date[:10]:
            weekday = race_date.weekday()  # 0=月曜, 6=日曜
            is_weekend = weekday >= 5

            day_name = ["月", "火", "水", "木", "金", "土", "日"][weekday]
            emoji = "🏇" if is_weekend else "📅"

            print(f"  {emoji} {race_date} ({day_name}曜日): {count}レース")

            if is_weekend:
                weekend_counts.append(count)
            else:
                weekday_counts.append(count)

        if weekend_counts:
            avg_weekend = sum(weekend_counts) / len(weekend_counts)
            max_weekend = max(weekend_counts)
            print(f"\n土日の統計:")
            print(f"  平均: {avg_weekend:.1f}レース/日")
            print(f"  最大: {max_weekend}レース/日")

        if weekday_counts:
            avg_weekday = sum(weekday_counts) / len(weekday_counts)
            max_weekday = max(weekday_counts)
            print(f"\n平日の統計:")
            print(f"  平均: {avg_weekday:.1f}レース/日")
            print(f"  最大: {max_weekday}レース/日")

        # メモリ使用量の概算
        if weekend_counts:
            print(f"\n💾 メモリ使用量の概算:")
            print(f"  1レースあたり約5-10MBのメモリを使用すると仮定")
            print(f"  土日最大 {max_weekend}レース × 10MB = 約 {max_weekend * 10}MB")
            print(f"  現在の制限: 512MB")

            if max_weekend * 10 > 400:
                print(f"  ⚠️  メモリ不足の可能性あり！")
            else:
                print(f"  ✅ メモリは十分です")

        return True

    finally:
        db.close()

def check_race_type_consistency():
    """チェック4: レースタイプの整合性"""
    print_section("チェック4: レースタイプの整合性")

    db = SessionLocal()
    try:
        # race_typeとレースIDの会場コードが一致しているかチェック
        races = db.query(models.Race).limit(1000).all()

        inconsistent = []

        for race in races:
            race_id = race.id
            if len(race_id) < 6:
                continue

            try:
                venue_code = int(race_id[4:6])

                # レースIDから判定されるrace_type
                expected_type = '中央' if 1 <= venue_code <= 10 else '地方'

                # DBに保存されているrace_type
                actual_type = race.race_type

                if expected_type != actual_type:
                    inconsistent.append({
                        'race_id': race_id,
                        'date': race.race_date,
                        'venue': race.venue_name,
                        'venue_code': venue_code,
                        'expected': expected_type,
                        'actual': actual_type
                    })
            except (ValueError, IndexError):
                continue

        print(f"✅ チェック済みレース数: {len(races)}")
        print(f"⚠️  不整合: {len(inconsistent)} 件")

        if inconsistent:
            print("\n❌ レースタイプの不整合（最初の10件）:")
            for race in inconsistent[:10]:
                print(f"  - レースID: {race['race_id']}, 会場コード: {race['venue_code']:02d}")
                print(f"    日付: {race['date']}, 会場: {race['venue']}")
                print(f"    期待値: {race['expected']}, 実際: {race['actual']}")
        else:
            print("\n✅ すべてのレースタイプは整合しています！")

        return len(inconsistent) == 0

    finally:
        db.close()

def check_venue_code_distribution():
    """チェック5: 会場コードの分布"""
    print_section("チェック5: 会場コードの分布")

    db = SessionLocal()
    try:
        races = db.query(models.Race).limit(10000).all()

        venue_codes = Counter()

        for race in races:
            if len(race.id) >= 6:
                venue_code = race.id[4:6]
                venue_codes[venue_code] += 1

        print(f"会場コードの分布（上位20件）:")
        for code, count in venue_codes.most_common(20):
            try:
                code_int = int(code)
                if 1 <= code_int <= 10:
                    race_type = "中央"
                elif 30 <= code_int <= 65:
                    race_type = "地方"
                else:
                    race_type = "❓不明"
            except ValueError:
                race_type = "❓不正"

            print(f"  コード {code} ({race_type}): {count} レース")

        return True

    finally:
        db.close()

def main():
    """メイン関数"""
    print("=" * 80)
    print("  競馬サイト デバッグチェック")
    print("=" * 80)

    results = {}

    try:
        results['race_id_format'] = check_race_id_format()
        results['banei_consistency'] = check_banei_consistency()
        results['weekend_load'] = check_weekend_load()
        results['race_type'] = check_race_type_consistency()
        results['venue_distribution'] = check_venue_code_distribution()

        # 総合結果
        print_section("総合結果")

        all_ok = all(results.values())

        print("\nチェック結果:")
        for check, result in results.items():
            status = "✅ OK" if result else "❌ NG"
            print(f"  {check}: {status}")

        if all_ok:
            print("\n🎉 すべてのチェックが正常です！")
        else:
            print("\n⚠️  いくつか問題が見つかりました。上記の詳細を確認してください。")

    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
