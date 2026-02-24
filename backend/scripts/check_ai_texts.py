"""
本番DBのAI分析テキストの現状を調査するスクリプト。
- 全レース数
- ai_analysis_text が NULL のレース数
- ai_analysis_text が存在するレース数（日付別分布）
- 存在するテキストのサンプル（最初の50文字）
"""
import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import func

db = SessionLocal()

# 1. 全レース数
total = db.query(func.count(models.Race.id)).scalar()
print(f"全レース数: {total}")

# 2. ai_analysis_text が NULL
null_count = db.query(func.count(models.Race.id)).filter(models.Race.ai_analysis_text.is_(None)).scalar()
print(f"AIテキストなし (NULL): {null_count}")

# 3. ai_analysis_text が存在
has_text = db.query(func.count(models.Race.id)).filter(models.Race.ai_analysis_text.isnot(None)).scalar()
print(f"AIテキストあり: {has_text}")

# 4. 日付別の分布（AIテキストあり）
print(f"\n--- AIテキストあり: 日付別分布 ---")
date_dist = db.query(
    models.Race.race_date,
    func.count(models.Race.id)
).filter(
    models.Race.ai_analysis_text.isnot(None)
).group_by(
    models.Race.race_date
).order_by(
    models.Race.race_date.desc()
).limit(30).all()

if date_dist:
    for d, c in date_dist:
        print(f"  {d}: {c} レース")
else:
    print("  → AIテキストが存在するレースはありません。")

# 5. 日付別の分布（AIテキストなし、最新20日分）
print(f"\n--- AIテキストなし: 日付別分布（最新20日分） ---")
null_date_dist = db.query(
    models.Race.race_date,
    func.count(models.Race.id)
).filter(
    models.Race.ai_analysis_text.is_(None)
).group_by(
    models.Race.race_date
).order_by(
    models.Race.race_date.desc()
).limit(20).all()

for d, c in null_date_dist:
    print(f"  {d}: {c} レース")

# 6. テキストのサンプル（存在する場合、最新3件）
if has_text > 0:
    print(f"\n--- AIテキスト サンプル（最新3件、先頭80文字） ---")
    samples = db.query(
        models.Race.race_date,
        models.Race.race_name,
        models.Race.ai_analysis_text
    ).filter(
        models.Race.ai_analysis_text.isnot(None)
    ).order_by(
        models.Race.race_date.desc()
    ).limit(3).all()
    
    for d, name, text in samples:
        preview = text[:80].replace('\n', ' ').replace('\r', '') if text else "(empty)"
        print(f"  [{d}] {name}: {preview}...")

db.close()
