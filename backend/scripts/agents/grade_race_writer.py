"""
重賞レースプレビュー記事の自動生成スクリプト
今後14日間に開催される重賞レースをDBから取得し、
WriteOrderを生成して記事自動生成パイプラインに投入する。
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import and_

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')

JST = timezone(timedelta(hours=9))

GRADE_KEYWORDS = ['G1', 'G2', 'G3', 'GI', 'GII', 'GIII', 'Ｇ１', 'Ｇ２', 'Ｇ３', 'J・G']


def is_grade_race(race_name: str) -> bool:
    if not race_name:
        return False
    return any(kw in race_name for kw in GRADE_KEYWORDS)


def get_grade_priority(race_name: str) -> int:
    if not race_name:
        return 99
    if any(kw in race_name for kw in ['G1', 'GI', 'Ｇ１']):
        return 1
    if any(kw in race_name for kw in ['G2', 'GII', 'Ｇ２']):
        return 2
    if any(kw in race_name for kw in ['G3', 'GIII', 'Ｇ３']):
        return 3
    return 4


def load_posted_keywords() -> set:
    if not os.path.exists(POSTED_HISTORY_PATH):
        return set()
    try:
        with open(POSTED_HISTORY_PATH, 'r', encoding='utf-8') as f:
            history = json.load(f)
            return {item.get('target_keyword', '') for item in history}
    except Exception:
        return set()


def get_upcoming_grade_races(days_ahead: int = 14) -> List[Dict[str, Any]]:
    today_jst = datetime.now(JST).date()
    end_date = today_jst + timedelta(days=days_ahead)

    db = SessionLocal()
    try:
        races = db.query(models.Race).filter(
            and_(
                models.Race.race_date >= today_jst,
                models.Race.race_date <= end_date,
                models.Race.race_type == '中央',
            )
        ).order_by(models.Race.race_date).all()

        grade_races = []
        for race in races:
            if not is_grade_race(race.race_name or ''):
                continue

            pred_count = db.query(models.Prediction).filter(
                models.Prediction.race_id == race.id,
                models.Prediction.deviation_score.isnot(None)
            ).count()

            if pred_count == 0:
                continue

            predictions = db.query(models.Prediction).filter(
                models.Prediction.race_id == race.id,
                models.Prediction.deviation_score.isnot(None)
            ).order_by(models.Prediction.deviation_score.desc()).limit(5).all()

            grade_races.append({
                'race_id': race.id,
                'race_name': race.race_name,
                'race_date': race.race_date.strftime('%Y-%m-%d'),
                'venue_name': race.venue_name,
                'race_number': race.race_number,
                'course_type': race.course_type or '',
                'distance': race.distance or 0,
                'total_horses': race.total_horses or 0,
                'grade_priority': get_grade_priority(race.race_name or ''),
                'predictions': [
                    {
                        'horse_name': p.horse_name,
                        'horse_number': p.horse_number,
                        'waku_number': p.waku_number,
                        'deviation_score': round(p.deviation_score, 2) if p.deviation_score else None,
                        'mark': p.mark,
                    }
                    for p in predictions
                ]
            })

        grade_races.sort(key=lambda r: (r['race_date'], r['grade_priority']))
        return grade_races

    finally:
        db.close()


def build_write_order(race: Dict[str, Any]) -> Dict[str, Any]:
    race_name = race['race_name']
    venue = race['venue_name']
    course = race['course_type']
    distance = race['distance']
    race_date = race['race_date']
    year = race_date[:4]
    preds = race['predictions']

    target_keyword = f"{race_name}{year} AI予想 無料"
    course_text = f"{venue}競馬場 {course}{distance}m"

    top_horses_metrics = []
    for p in preds[:5]:
        top_horses_metrics.append({
            '馬番': f"{p['waku_number']}枠{p['horse_number']}番",
            '馬名': p['horse_name'],
            'AI偏差値': str(p['deviation_score']),
            '印': p['mark'],
        })

    return {
        'target_keyword': target_keyword,
        'theme_cluster': 'grade_race_preview',
        'reference_data': {
            'race_name': race_name,
            'race_date': race_date,
            'venue': course_text,
            'total_horses': race['total_horses'],
            'period': f"{race_date}開催",
            'condition': course_text,
            'sample_size': race['total_horses'],
            'key_metrics': top_horses_metrics,
            'source': 'UMA-FREE AI分析データ',
        },
        'competing_article_structure': [
            f'{race_name}{year}の出走馬と枠順',
            'AI偏差値ランキングと上位馬の分析',
            f'{course_text}のコース特性と傾向',
            '馬券戦略と注目馬まとめ',
        ],
        'article_type': 'grade_race_preview',
        'race_id': race['race_id'],
    }


def generate_grade_race_orders() -> int:
    print("[GradeRaceWriter] 重賞レースプレビュー記事の生成開始...")

    posted_keywords = load_posted_keywords()
    upcoming = get_upcoming_grade_races(days_ahead=14)

    if not upcoming:
        print("[GradeRaceWriter] 今後14日間に予測データ付きの重賞レースが見つかりません。")
        return 0

    print(f"[GradeRaceWriter] {len(upcoming)}件の重賞レースを発見")
    os.makedirs(WRITE_ORDERS_DIR, exist_ok=True)
    generated_count = 0

    for race in upcoming:
        race_name = race['race_name']
        year = race['race_date'][:4]
        target_keyword = f"{race_name}{year} AI予想 無料"

        if target_keyword in posted_keywords:
            print(f"[GradeRaceWriter] スキップ（生成済み）: {target_keyword}")
            continue

        order = build_write_order(race)
        now = datetime.now()
        timestamp = now.strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{race['race_id'][-6:]}.json"
        output_path = os.path.join(WRITE_ORDERS_DIR, filename)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(order, f, ensure_ascii=False, indent=2)

        print(f"[GradeRaceWriter] WriteOrder生成: {race_name}{year} → {filename}")
        generated_count += 1
        time.sleep(0.5)

    print(f"[GradeRaceWriter] 完了: {generated_count}件のWriteOrderを生成しました。")
    return generated_count


if __name__ == '__main__':
    generate_grade_race_orders()
    sys.exit(0)
