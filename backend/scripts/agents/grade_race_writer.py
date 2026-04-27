"""
重賞レースプレビュー記事の自動生成スクリプト
今後7日間に開催される重賞レースをDBから取得し、
WriteOrderを生成して記事自動生成パイプラインに投入する。

設計方針:
  - スクレイピング（scraper/parser）に一切依存しない。
  - run_pipeline.py が毎日DBに投入済みのレースデータ（races / predictions テーブル）を
    直接クエリすることで、GitHub Actions環境でも確実に動作させる。
  - 旧実装はHTML取得のsleep・BAN対策でGitHub Actionsのタイムアウトに抵触していた。
"""

import os
import sys
import json
import time
import glob
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import urllib.parse

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import and_, text

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')

JST = timezone(timedelta(hours=9))

GRADE_KEYWORDS = ['G1', 'G2', 'G3', 'GI', 'GII', 'GIII', 'Ｇ１', 'Ｇ２', 'Ｇ３', 'J・G']

JRA_VENUE_MAP = {
    '01': '札幌', '02': '函館', '03': '福島', '04': '新潟', '05': '東京',
    '06': '中山', '07': '中京', '08': '京都', '09': '阪神', '10': '小倉'
}

# venue_name → venue_code の逆引きマップ（DB上のvenue_nameからrace_idのvenue_codeへの変換用）
VENUE_NAME_MAP = {v: k for k, v in JRA_VENUE_MAP.items()}

ARTICLES_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'content', 'articles')


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
            data = json.load(f)
            return {item.get('target_keyword') for item in data}
    except Exception:
        return set()

def load_existing_article_keywords() -> set:
    keywords = set()
    if not os.path.exists(ARTICLES_DIR):
        return keywords
    for filepath in glob.glob(os.path.join(ARTICLES_DIR, '*.md')):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    for line in parts[1].split('\n'):
                        if line.strip().startswith('target_keyword:'):
                            kw = line.split(':', 1)[1].strip().strip('"').strip("'")
                            if kw: keywords.add(kw)
                            break
        except Exception: continue
    return keywords

def load_pending_order_keywords() -> set:
    keywords = set()
    if not os.path.exists(WRITE_ORDERS_DIR):
        return keywords
    for filepath in glob.glob(os.path.join(WRITE_ORDERS_DIR, '*.json')):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                order = json.load(f)
                kw = order.get('target_keyword')
                if kw: keywords.add(kw)
        except Exception: continue
    return keywords


def get_upcoming_target_dates() -> List:
    today = datetime.now(JST).date()
    # 土日限定ではなく向こう7日間（1週間）を走査する。
    # 理由: 3日間開催の月曜祝日（例: 京都大賞典）や、年末の変則開催（例: ホープフルSの火曜・木曜開催）を取りこぼさないため。
    # 重複判定ロジックが正常に機能しているため、何日先を走査しても二重生成は発生しない。
    return [today + timedelta(days=i) for i in range(7)]


def get_upcoming_grade_races() -> List[Dict[str, Any]]:
    """
    DBから直近7日間の重賞レースを取得する。

    旧実装ではスクレイピング（scraper.get_race_list_html + parser）に依存していたため、
    GitHub Actions環境ではキャッシュ不在 + BAN対策sleepにより確実に失敗していた。
    DBには run_pipeline.py が毎日レースデータを投入済みなので、直接クエリに変更。
    """
    db = SessionLocal()
    grade_races = []
    try:
        target_dates = get_upcoming_target_dates()
        print(f"[GradeRaceWriter] 対象日付（直近7日間）: {[d.strftime('%m-%d') for d in target_dates]}")

        # DBから対象日のレースを一括取得
        races = db.query(models.Race).filter(
            models.Race.race_date.in_(target_dates)
        ).all()

        if not races:
            print(f"[GradeRaceWriter] DB上に対象日のレースが存在しません")
            return []

        print(f"[GradeRaceWriter] DB上のレース総数: {len(races)}件")

        for race in races:
            race_name = race.race_name or ''

            if not is_grade_race(race_name):
                continue

            venue_name = race.venue_name or '中央'
            race_date = race.race_date

            # 予測データを取得（AI偏差値上位5頭）
            preds = db.query(models.Prediction).filter(
                models.Prediction.race_id == race.id,
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

            # course_typeの表示名変換（DBでは'ダ'が使われる場合がある）
            course_type = race.course_type or ''
            if course_type == 'ダ':
                course_type = 'ダート'

            grade_races.append({
                'race_id': race.id,
                'race_name': race_name,
                'race_date': race_date.strftime('%Y-%m-%d'),
                'venue_name': venue_name,
                'race_number': race.race_number or 0,
                'course_type': course_type,
                'distance': race.distance or 0,
                'total_horses': race.total_horses or 0,
                'grade_priority': get_grade_priority(race_name),
                'predictions': predictions
            })

        grade_races.sort(key=lambda r: (r['race_date'], r['grade_priority']))
        print(f"[GradeRaceWriter] 重賞レース: {len(grade_races)}件を検出")
        for gr in grade_races:
            pred_status = f"予測あり({len(gr['predictions'])}頭)" if gr['predictions'] else "予測なし"
            print(f"  - {gr['race_date']} {gr['race_name']} ({gr['venue_name']}) [{pred_status}]")
        return grade_races

    finally:
        db.close()


def get_course_statistics(db, venue: str, course: str, distance: int) -> List[Dict[str, str]]:
    if not course: course = '芝'
    if distance == 0: distance = 1600

    # course_typeのDB値に合わせる（DBでは'ダ'が使われている場合がある）
    db_course = course
    if course == 'ダート':
        db_course = 'ダ'

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
        df = pd.read_sql_query(query, db.bind, params={'venue': venue, 'course': db_course, 'distance': distance, 'cutoff': cutoff_date})
    except Exception as e:
        print(f"[GradeRaceWriter Warning] Course stat query failed: {e}")
        # '芝'でも試す（DBの値が安定しない場合のフォールバック）
        if db_course != course:
            try:
                df = pd.read_sql_query(query, db.bind, params={'venue': venue, 'course': course, 'distance': distance, 'cutoff': cutoff_date})
            except Exception:
                return []
        else:
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
    existing_keywords = load_existing_article_keywords()
    pending_keywords = load_pending_order_keywords()
    all_known_keywords = posted_keywords | existing_keywords | pending_keywords

    print(f"[GradeRaceWriter] 重複チェック対象: posted={len(posted_keywords)}, 既存記事={len(existing_keywords)}, 未消費order={len(pending_keywords)}")

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

        if target_keyword in all_known_keywords:
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
