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
import requests
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import and_, text
from scripts import scraper, parser

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')

JST = timezone(timedelta(hours=9))

GRADE_KEYWORDS = ['G1', 'G2', 'G3', 'GI', 'GII', 'GIII', 'Ｇ１', 'Ｇ２', 'Ｇ３', 'J・G']

JRA_VENUE_MAP = {
    '01': '札幌', '02': '函館', '03': '福島', '04': '新潟', '05': '東京',
    '06': '中山', '07': '中京', '08': '京都', '09': '阪神', '10': '小倉'
}


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


def get_upcoming_weekend_dates() -> List[datetime.date]:
    today = datetime.now(JST).date()
    days_to_sat = (5 - today.weekday()) % 7
    sat_date = today + timedelta(days=days_to_sat)
    sun_date = sat_date + timedelta(days=1)
    return [sat_date, sun_date]

def get_upcoming_grade_races() -> List[Dict[str, Any]]:
    db = SessionLocal()
    grade_races = []
    try:
        target_dates = get_upcoming_weekend_dates()
        print(f"[GradeRaceWriter] 対象日付: {[d.strftime('%Y-%m-%d') for d in target_dates]}")
        
        for d in target_dates:
            date_str = d.strftime('%Y%m%d')
            list_html, _ = scraper.get_race_list_html(date_str, is_nar=False, force_download=False)
            if not list_html:
                continue
                
            race_ids = parser.parse_race_ids_from_list(list_html)
            for rid in race_ids:
                shutuba_html = scraper.get_shutuba_html_content(rid, is_nar=False, force_download=False)
                if not shutuba_html:
                    continue
                parsed = parser.parse_shutuba_page(shutuba_html, rid)
                race_info = parsed.get('race_info', {})
                race_name = race_info.get('race_name', '')
                
                if not is_grade_race(race_name):
                    continue
                
                venue_code = rid[4:6]
                venue_name = JRA_VENUE_MAP.get(venue_code, '中央')
                
                pred_count = db.query(models.Prediction).filter(
                    models.Prediction.race_id == rid,
                    models.Prediction.deviation_score.isnot(None)
                ).count()
                
                predictions = []
                if pred_count > 0:
                    preds = db.query(models.Prediction).filter(
                        models.Prediction.race_id == rid,
                        models.Prediction.deviation_score.isnot(None)
                    ).order_by(models.Prediction.deviation_score.desc()).limit(5).all()
                    
                    predictions = [
                        {
                            'horse_name': p.horse_name,
                            'horse_number': p.horse_number,
                            'waku_number': p.waku_number,
                            'deviation_score': round(p.deviation_score, 2) if p.deviation_score else None,
                            'mark': p.mark,
                        }
                        for p in preds
                    ]
                
                grade_races.append({
                    'race_id': rid,
                    'race_name': race_name,
                    'race_date': race_info.get('race_date', d).strftime('%Y-%m-%d'),
                    'venue_name': venue_name,
                    'race_number': race_info.get('race_number', 0),
                    'course_type': race_info.get('course_type', ''),
                    'distance': race_info.get('distance', 0),
                    'total_horses': race_info.get('total_horses', 0),
                    'grade_priority': get_grade_priority(race_name),
                    'predictions': predictions
                })

        grade_races.sort(key=lambda r: (r['race_date'], r['grade_priority']))
        return grade_races

    finally:
        db.close()


def get_course_statistics(db, venue: str, course: str, distance: int) -> List[Dict[str, str]]:
    if not course: course = '芝'
    if distance == 0: distance = 1600
    
    cutoff_date = (datetime.now(JST).date() - timedelta(days=365*3)).strftime('%Y-%m-%d')
    
    query = text("""
        SELECT res.waku_number, COUNT(res.id) as runs, SUM(CASE WHEN res.rank = 1 THEN 1 ELSE 0 END) as wins
        FROM results res
        JOIN races r ON res.race_id = r.id
        WHERE r.venue_name = :venue AND r.course_type = :course AND r.distance = :distance
        AND r.race_date >= :cutoff
        AND res.waku_number BETWEEN 1 AND 8
        GROUP BY res.waku_number
        ORDER BY res.waku_number
    """)
    
    try:
        df = pd.read_sql_query(query, db.bind, params={'venue': venue, 'course': course, 'distance': distance, 'cutoff': cutoff_date})
    except Exception as e:
        print(f"[GradeRaceWriter Warning] Course stat query failed: {e}")
        return []
        
    if df.empty:
        return []
        
    stats = []
    for _, row in df.iterrows():
        runs = row['runs']
        wins = row['wins']
        win_rate = round((wins / runs) * 100, 1) if runs > 0 else 0
        stats.append({
            '枠番': f"{int(row['waku_number'])}枠",
            '勝率': f"{win_rate}%"
        })
    return stats


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
            '馬番': f"{p['waku_number']}枠{p['horse_number']}番" if p['waku_number'] else f"{p['horse_number']}番",
            '馬名': p['horse_name'],
            'AI偏差値': str(p['deviation_score']),
            '印': p['mark'],
        })
        
    db = SessionLocal()
    course_stats = []
    try:
        if venue and course and distance:
            course_stats = get_course_statistics(db, venue, course, distance)
    finally:
        db.close()

    import urllib.parse
    venue_encoded = urllib.parse.quote(venue)
    race_url = f"https://uma-free.com/races/{race_date}?race={race['race_number']}&venue={venue_encoded}"

    return {
        'target_keyword': target_keyword,
        'theme_cluster': 'grade_race_preview',
        'priority': 100 - race['grade_priority'] * 10,
        'has_predictions': len(preds) > 0,
        'reference_data': {
            'race_name': race_name,
            'race_date': race_date,
            'race_url': race_url,
            'venue': course_text,
            'total_horses': race['total_horses'],
            'period': f"{race_date}開催",
            'condition': course_text,
            'course_stats': course_stats,
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
    upcoming = get_upcoming_grade_races()

    if not upcoming:
        print("[GradeRaceWriter] 該当週に重賞レースが見つかりません。")
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
