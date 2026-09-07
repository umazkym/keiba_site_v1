"""
重賞検出ロジックのデバッグスクリプト
DB上のレースデータの実際の値を確認し、重賞検出が失敗する原因を特定する。

使い方:
  DATABASE_URL=postgresql://... python debug_grade_detection.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
# プロジェクトルートの.env → backend/.env の順で読む（DATABASE_URLを確実に取得）
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
load_dotenv()  # backend/.env（上書きはしない）

db_url = os.getenv('DATABASE_URL', '')
if not db_url.startswith('postgres'):
    print(f"[WARNING] DATABASE_URL がPostgreSQLを指していません: {db_url[:30]}...")
    print("  ヒント: 以下のコマンドで直接指定できます:")
    print('  $env:DATABASE_URL = "postgresql://..."; python debug_grade_detection.py')
    print()


from database.database import SessionLocal
from database import models
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))
GRADE_KEYWORDS = ['G1', 'G2', 'G3', 'GI', 'GII', 'GIII', 'Ｇ１', 'Ｇ２', 'Ｇ３', 'J・G']

def main():
    db = SessionLocal()
    try:
        today = datetime.now(JST).date()
        target_dates = [today + timedelta(days=i) for i in range(7)]
        print(f"=== 対象日付: {[d.strftime('%Y-%m-%d') for d in target_dates]} ===\n")

        races = db.query(models.Race).filter(
            models.Race.race_date.in_(target_dates)
        ).order_by(models.Race.race_date, models.Race.race_number).all()

        print(f"全レース数: {len(races)}件\n")

        # 1. 全レースのrace_name, race_type, race_numberを出力（重賞候補を探す）
        print("=" * 100)
        print(f"{'日付':<12} {'R番':>3} {'race_type':<15} {'race_name':<40} {'venue':<6} {'距離':>6}")
        print("=" * 100)

        potential_grade = []
        for race in races:
            race_name = race.race_name or ''
            race_type = race.race_type or ''
            
            # GRADE_KEYWORDSチェック
            has_grade_in_name = any(kw in race_name for kw in GRADE_KEYWORDS)
            has_grade_in_type = any(kw in race_type for kw in GRADE_KEYWORDS)
            
            # 重賞っぽいレース名のパターンも確認（賞、ステークス、カップ等）
            is_named_race = any(kw in race_name for kw in [
                '賞', 'ステークス', 'カップ', 'S', 'C', 'ダービー', 'オークス', 
                '記念', 'マイル', 'クラシック', '天皇', '有馬', '桜花', '皐月'
            ])
            
            marker = ''
            if has_grade_in_name: marker = '★NAME_HIT'
            elif has_grade_in_type: marker = '★TYPE_HIT'
            elif is_named_race: marker = '▲NAMED'
            
            course = race.course_type or ''
            dist = race.distance or 0
            
            print(f"{race.race_date}  R{race.race_number:>2}  {race_type:<15} {race_name:<40} {race.venue_name:<6} {course}{dist}m  {marker}")
            
            if has_grade_in_name or has_grade_in_type or is_named_race:
                potential_grade.append(race)

        print("\n" + "=" * 100)
        print(f"\n=== 重賞候補のサマリー ===")
        print(f"race_nameにGRADE_KEYWORDS含む: {sum(1 for r in races if any(kw in (r.race_name or '') for kw in GRADE_KEYWORDS))}件")
        print(f"race_typeにGRADE_KEYWORDS含む: {sum(1 for r in races if any(kw in (r.race_type or '') for kw in GRADE_KEYWORDS))}件")
        print(f"命名レース(賞/S等を含む): {len(potential_grade)}件")

        # 2. race_typeのユニーク値一覧
        print(f"\n=== race_type のユニーク値一覧 ===")
        all_types = db.query(models.Race.race_type).distinct().all()
        for t in sorted(all_types, key=lambda x: x[0] or ''):
            print(f"  - '{t[0]}'")

    finally:
        db.close()

if __name__ == '__main__':
    main()
