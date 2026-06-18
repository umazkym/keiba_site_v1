"""
重賞レースプレビュー記事の自動生成スクリプト
今後7日間に開催される重賞レースを検出し、
WriteOrderを生成して記事自動生成パイプラインに投入する。

設計方針（ハイブリッドアプローチ）:
  Phase 1: netkeibaのrace_list_sub.htmlから重賞レースを検出する。
    - race_list_sub.htmlはAJAXエンドポイント（Selenium不要、1リクエスト、UTF-8）で非常に軽量。
    - HTMLにはグレードを示すCSSクラス（Icon_GradeType1等）が含まれるため、確実にG1/G2/G3を判別できる。
    - DBにはグレード情報が保存されていない（race_typeは'中央'/'地方'のみ）ため、HTMLが唯一の信頼できるソース。
    - 1日あたり1リクエスト × 最大7日 = 最大7リクエスト。BAN対策sleep込みでも30秒程度で完了。
  Phase 2: DBからAI偏差値（predictions）とコース統計を取得する。
    - 出走表がDBに取り込まれていれば予測データを付与。
    - 未取得でもレース名・開催情報だけでプレビュー記事は生成可能。
"""

import os
import sys
import json
import time
import glob
import re
import random
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Any, Optional, Tuple
import urllib.parse

import requests
import pandas as pd
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from database.database import SessionLocal
from database import models
from sqlalchemy import text

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
POSTED_HISTORY_PATH = os.path.join(PROJECT_ROOT, 'data', 'posted_history.json')
WRITE_ORDERS_DIR = os.path.join(PROJECT_ROOT, 'data', 'write_orders')
ARTICLES_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'content', 'articles')

JST = timezone(timedelta(hours=9))

# --- BAN対策設定 ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]
BASE_CENTRAL_URL = "https://race.netkeiba.com"

JRA_VENUE_MAP = {
    '01': '札幌', '02': '函館', '03': '福島', '04': '新潟', '05': '東京',
    '06': '中山', '07': '中京', '08': '京都', '09': '阪神', '10': '小倉'
}


# =============================================================================
# Phase 1: netkeibaからグレードレースを検出
# =============================================================================

def _fetch_race_list_html(date_str: str) -> Optional[str]:
    """
    netkeibaのrace_list_sub.htmlを取得する（JRA中央競馬のみ）。
    Selenium不要、UTF-8のAJAXエンドポイント。1リクエストで完了する軽量な処理。
    """
    url = f"{BASE_CENTRAL_URL}/top/race_list_sub.html?kaisai_date={date_str}"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        # BAN対策: 最小限のsleep（複数日を順に処理するため）
        time.sleep(random.uniform(2.0, 4.0))
        response = requests.get(url, headers=headers, timeout=30)
        response.encoding = 'utf-8'
        html = response.text
        
        if html and 'race_id=' in html:
            return html
        else:
            # レース開催なし or データ未公開
            return None
    except Exception as e:
        print(f"[GradeRaceWriter] race_list_sub.html取得失敗 ({date_str}): {e}")
        return None


def _parse_grade_races_from_html(html: str, target_date: date) -> List[Dict[str, Any]]:
    """
    race_list_sub.htmlのHTMLからグレードレース情報を抽出する。
    
    netkeiba のレース一覧HTMLには、グレードレースを示す以下のCSSクラスが含まれる:
      - Icon_GradeType1: G1
      - Icon_GradeType2: G2
      - Icon_GradeType3: G3
    
    また、テキスト中に (G1), (GI), (G2), (GII), (G3), (GIII) が含まれる場合もある。
    """
    soup = BeautifulSoup(html, 'lxml')
    grade_races = []
    seen_race_ids = set()  # 各レースに2つのリンクがあるため重複排除
    
    # 全レースリンクを取得
    race_links = soup.find_all('a', href=re.compile(r'race_id=(\d{12})'))
    
    for link in race_links:
        href = link.get('href', '')
        race_id_match = re.search(r'race_id=(\d{12})', href)
        if not race_id_match:
            continue
        
        race_id = race_id_match.group(1)
        
        # 重複排除
        if race_id in seen_race_ids:
            continue
        seen_race_ids.add(race_id)
        
        # JRA中央競馬のレースIDのみ対象（会場コード01-10）
        venue_code = race_id[4:6]
        if venue_code not in JRA_VENUE_MAP:
            continue
        
        # グレード判定: 親のli要素内のCSSクラスで厳密に判定
        grade = _detect_grade(link)
        if not grade:
            continue
        
        # レース名を取得（R番号・時刻・距離を除去）
        race_name = _extract_race_name(link)
        if not race_name:
            continue
        
        # レース番号を取得（race_idの末尾2桁）
        race_number = int(race_id[-2:])
        venue_name = JRA_VENUE_MAP.get(venue_code, '不明')
        
        grade_races.append({
            'race_id': race_id,
            'race_name': race_name,
            'race_date': target_date.strftime('%Y-%m-%d'),
            'venue_name': venue_name,
            'race_number': race_number,
            'grade': grade,
            'grade_priority': {'G1': 1, 'G2': 2, 'G3': 3}.get(grade, 4),
        })
    
    return grade_races


def _detect_grade(link_element) -> Optional[str]:
    """
    レースリンクの周辺要素からグレード情報を検出する。
    
    netkeibaのrace_list_sub.htmlでは、グレードを示すCSSクラスは以下の通り:
      - Icon_GradeType1: G1
      - Icon_GradeType2: G2
      - Icon_GradeType3: G3
    
    注意: Icon_GradeType5(OP), Icon_GradeType13(詳細), Icon_GradeType15-17(特別/S)
    は重賞ではないため除外する。
    """
    # 検索範囲: リンクの最も近い親 <li> 要素
    # <li> より上（<dl>, <div>）に登ると会場全体のアイコンを拾ってしまう
    search_area = link_element.find_parent('li')
    if not search_area:
        search_area = link_element.parent
    
    if not search_area:
        return None
    
    # CSSクラスで厳密に G1/G2/G3 のみ検出
    # Icon_GradeType1 は OK だが Icon_GradeType13 は NG → 完全一致で判定
    GRADE_CLASS_MAP = {
        'Icon_GradeType1': 'G1',
        'Icon_GradeType2': 'G2',
        'Icon_GradeType3': 'G3',
    }
    
    all_elements = search_area.find_all(class_=True)
    for elem in all_elements:
        classes = elem.get('class', [])
        for cls in classes:
            if cls in GRADE_CLASS_MAP:
                return GRADE_CLASS_MAP[cls]
    
    return None


def _extract_race_name(link_element) -> str:
    """
    リンク要素からレース名を取得し、正規化する。
    
    netkeibaのリンクテキスト形式: "11R天皇賞(春)15:40芝3200m16頭"
    → 「天皇賞(春)」を抽出する。
    """
    text = link_element.get_text(strip=True)
    if not text:
        return ''
    
    # Step 1: R番号プレフィックスを除去 ("11R" → "")
    text = re.sub(r'^\d+R', '', text)
    
    # Step 2: 時刻以降を除去 ("天皇賞(春)15:40芝3200m16頭" → "天皇賞(春)")
    time_match = re.search(r'\d{1,2}:\d{2}', text)
    if time_match:
        text = text[:time_match.start()]
    
    # Step 3: 末尾のコース・距離情報を除去（時刻がない場合のフォールバック）
    text = re.sub(r'[芝ダ障]\d+m.*$', '', text)
    
    text = text.strip()
    return text


def get_upcoming_grade_races() -> List[Dict[str, Any]]:
    """
    今後7日間のJRA重賞レースをnetkeibaから検出する。
    
    1日あたり1回のHTTPリクエスト（race_list_sub.html）で検出。
    Selenium不要、合計30秒程度で完了する軽量な処理。
    """
    today = datetime.now(JST).date()
    target_dates = [today + timedelta(days=i) for i in range(7)]
    
    print(f"[GradeRaceWriter] 対象日付（直近7日間）: {[d.strftime('%m-%d(%a)') for d in target_dates]}")
    
    all_grade_races = []
    
    for target_date in target_dates:
        date_str = target_date.strftime('%Y%m%d')
        html = _fetch_race_list_html(date_str)
        
        if not html:
            continue
        
        grade_races = _parse_grade_races_from_html(html, target_date)
        if grade_races:
            for gr in grade_races:
                print(f"  ★ {gr['race_date']} {gr['race_name']} ({gr['grade']}) @ {gr['venue_name']}")
            all_grade_races.extend(grade_races)
    
    # 日付 → グレード優先度でソート
    all_grade_races.sort(key=lambda r: (r['race_date'], r['grade_priority']))
    
    print(f"[GradeRaceWriter] 重賞レース合計: {len(all_grade_races)}件を検出")
    return all_grade_races


# =============================================================================
# Phase 2: DBからAI予測・コース統計を取得
# =============================================================================

def _get_predictions_from_db(race_id: str) -> List[Dict[str, Any]]:
    """DBからAI偏差値上位5頭の予測データを取得する。"""
    db = SessionLocal()
    try:
        preds = db.query(models.Prediction).filter(
            models.Prediction.race_id == race_id,
            models.Prediction.deviation_score.isnot(None)
        ).order_by(models.Prediction.deviation_score.desc()).limit(5).all()
        
        return [
            {
                'horse_name': p.horse_name,
                'horse_number': p.horse_number,
                'waku_number': p.waku_number,
                'deviation_score': round(p.deviation_score, 2) if p.deviation_score else None,
                'mark': p.mark,
            }
            for p in preds
        ]
    except Exception as e:
        print(f"[GradeRaceWriter] 予測データ取得失敗 ({race_id}): {e}")
        return []
    finally:
        db.close()


def _get_race_details_from_db(race_id: str) -> Dict[str, Any]:
    """DBからレースの詳細情報（コースタイプ、距離、出走頭数）を取得する。"""
    db = SessionLocal()
    try:
        race = db.query(models.Race).filter(models.Race.id == race_id).first()
        if race:
            course_type = race.course_type or ''
            if course_type == 'ダ':
                course_type = 'ダート'
            return {
                'course_type': course_type,
                'distance': race.distance or 0,
                'total_horses': race.total_horses or 0,
            }
        return {'course_type': '', 'distance': 0, 'total_horses': 0}
    except Exception:
        return {'course_type': '', 'distance': 0, 'total_horses': 0}
    finally:
        db.close()


def _get_course_statistics(venue: str, course: str, distance: int) -> List[Dict[str, str]]:
    """直近3年の枠番別勝率統計をDBから取得する。"""
    if not course or distance == 0:
        return []
    
    db = SessionLocal()
    try:
        db_course = 'ダ' if course == 'ダート' else course
        cutoff_date = (datetime.now(JST).date() - timedelta(days=365 * 3)).strftime('%Y-%m-%d')
        
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
        
        df = pd.read_sql_query(query, db.bind, params={
            'venue': venue, 'course': db_course, 'distance': distance, 'cutoff': cutoff_date
        })
        
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
    except Exception as e:
        print(f"[GradeRaceWriter] コース統計取得失敗: {e}")
        return []
    finally:
        db.close()


# =============================================================================
# WriteOrder生成
# =============================================================================

def load_posted_keywords() -> set:
    if not os.path.exists(POSTED_HISTORY_PATH):
        return set()
    try:
        with open(POSTED_HISTORY_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return {
                item.get('target_keyword')
                for item in data
                if item.get('target_keyword') and (
                    item.get('draft') is False
                    or bool(item.get('slug'))
                    or bool(item.get('published_at'))
                )
            }
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
                            if kw:
                                keywords.add(kw)
                            break
        except Exception:
            continue
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
                if kw:
                    keywords.add(kw)
        except Exception:
            continue
    return keywords


def build_write_order(race: Dict[str, Any]) -> Dict[str, Any]:
    race_name = race['race_name']
    venue = race['venue_name']
    race_date = race['race_date']
    race_id = race['race_id']
    grade = race['grade']
    year = race_date[:4]
    
    # Phase 2: DBから追加データを取得
    predictions = _get_predictions_from_db(race_id)
    details = _get_race_details_from_db(race_id)
    course_type = details['course_type'] or '芝'
    distance = details['distance'] or 0
    total_horses = details['total_horses'] or 0
    has_predictions = len(predictions) > 0
    draw_confirmed = has_predictions and all(
        p.get('horse_number') and p.get('waku_number')
        for p in predictions
    )
    race_day = datetime.strptime(race_date, '%Y-%m-%d').date()
    days_to_race = (race_day - datetime.now(JST).date()).days
    if days_to_race <= 0:
        race_phase = 'race_day'
    elif days_to_race <= 2:
        race_phase = 'final_48h'
    else:
        race_phase = 'race_week'

    search_intent = 'ai_prediction' if has_predictions else 'field_analysis'
    search_intent_label = 'AI予想' if has_predictions else '出走構成・適性'
    target_keyword = (
        f"{race_name}{year} AI予想 無料"
        if has_predictions
        else f"{race_name}{year} 出走予定 コース分析"
    )
    
    course_text = f"{venue}競馬場 {course_type}{distance}m" if distance > 0 else f"{venue}競馬場"
    
    # AI偏差値上位馬の情報
    top_horses_metrics = []
    for p in predictions[:5]:
        top_horses_metrics.append({
            '馬番': f"{p['waku_number']}枠{p['horse_number']}番" if p.get('waku_number') else f"{p['horse_number']}番",
            '馬名': p['horse_name'],
            'AI偏差値': str(p['deviation_score']),
            '印': p['mark'],
        })
    
    # コース統計
    course_stats = []
    if venue and course_type and distance > 0:
        course_stats = _get_course_statistics(venue, course_type, distance)
    
    venue_encoded = urllib.parse.quote(venue)
    race_url = f"https://uma-free.com/races/{race_date}?race={race.get('race_number', '')}&venue={venue_encoded}"
    
    if has_predictions:
        competing_structure = [
            f'{race_name}{year}の開催条件と出走構成',
            'AI偏差値と入力済みデータの比較',
            'コース特性と距離適性',
            '評価を上げる材料と慎重に見る条件',
            '当日の出馬表で更新する項目',
        ]
        content_focus = 'AI偏差値を出走構成、距離適性、コース特性と照合し、数値だけで評価を決めない'
    else:
        competing_structure = [
            f'{race_name}{year}の公式日程と開催条件',
            '出走予定馬を比較する観点',
            'コース特性と距離適性',
            '現段階で確認できる事実と未発表情報',
            '出馬表公開後に更新する項目',
        ]
        content_focus = '開催条件、出走構成、距離適性を主役にし、未発表の枠順や追い切りを定型的に広げない'

    return {
        'target_keyword': target_keyword,
        'theme_cluster': 'grade_race_preview',
        'priority': 100 - race['grade_priority'] * 10,  # G1=90, G2=80, G3=70
        'has_predictions': has_predictions,
        'reference_data': {
            'race_name': f"{race_name}({grade})",
            'race_date': race_date,
            'scheduled_race_date': race_date,
            'days_to_race': days_to_race,
            'race_phase': race_phase,
            'race_url': race_url,
            'venue': course_text,
            'total_horses': total_horses,
            'search_intent': search_intent,
            'search_intent_label': search_intent_label,
            'search_angle_label': search_intent_label,
            'draw_status': 'confirmed' if draw_confirmed else 'pre_draw',
            'topic_bridge': {
                'writer_focus': content_focus,
                'primary_search_intent': search_intent,
                'avoid_overuse': [] if search_intent in {'waku', 'training'} else ['枠順', '追い切り'],
            },
            'period': f"{race_date}開催",
            'condition': course_text,
            'course_stats': course_stats,
            'key_metrics': top_horses_metrics,
            'source': 'UMA-FREE AI分析データ',
        },
        'competing_article_structure': competing_structure,
        'article_type': 'grade_race_preview',
        'race_id': race_id,
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
        order = build_write_order(race)
        target_keyword = order['target_keyword']

        if target_keyword in all_known_keywords:
            print(f"[GradeRaceWriter] スキップ（生成済み）: {target_keyword}")
            continue

        now = datetime.now()
        timestamp = now.strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{race['race_id'][-6:]}.json"
        output_path = os.path.join(WRITE_ORDERS_DIR, filename)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(order, f, ensure_ascii=False, indent=2)

        print(f"[GradeRaceWriter] WriteOrder生成: {race_name}({race['grade']}) → {filename}")
        generated_count += 1
        time.sleep(0.5)

    print(f"[GradeRaceWriter] 完了: {generated_count}件のWriteOrderを生成しました。")
    return generated_count


if __name__ == '__main__':
    generate_grade_race_orders()
    sys.exit(0)
