# crud/matchup_calculator.py
"""
対戦成績（マッチアップ）計算モジュール

predictor.py から分離した軽量モジュール。
pandas/numpy等の重量ライブラリに依存しないため、
API専用Dockerイメージ（Dockerfile.api）でも安全に動作する。
"""
from sqlalchemy.orm import Session
from database import models
from datetime import date
from typing import List, Dict, Any
from collections import defaultdict


def calculate_matchups(db: Session, horse_ids: List[str], start_date: date, end_date: date) -> Dict[str, Any]:
    """
    指定された馬リストの過去対戦成績を計算する。
    SQLAlchemy + 標準ライブラリのみで動作（重量ライブラリ不要）。
    """
    if len(horse_ids) < 2:
        return {}

    past_results = db.query(models.Result, models.Race.venue_name, models.Race.race_date)\
        .join(models.Race, models.Result.race_id == models.Race.id)\
        .filter(models.Result.horse_id.in_(horse_ids))\
        .filter(models.Race.race_date.between(start_date, end_date))\
        .all()

    races_grouped = defaultdict(list)
    for res, venue_name, race_date in past_results:
        races_grouped[res.race_id].append({
            'horse_id': res.horse_id, 'rank': res.rank,
            'venue_name': venue_name, 'race_date': race_date.strftime('%Y-%m-%d')
        })

    matchup_matrix = defaultdict(lambda: {'win': 0, 'loss': 0, 'draw': 0, 'history': []})
    for past_race_id, participants in races_grouped.items():
        if len(participants) < 2:
            continue
        for i in range(len(participants)):
            for j in range(i + 1, len(participants)):
                p1 = participants[i]
                p2 = participants[j]
                if p1.get('rank') is not None and p2.get('rank') is not None:
                    key1 = f"{p1['horse_id']}_vs_{p2['horse_id']}"
                    key2 = f"{p2['horse_id']}_vs_{p1['horse_id']}"
                    history_entry = {
                        'race_id': past_race_id, 'race_date': participants[0]['race_date'],
                        'venue_name': participants[0]['venue_name'],
                        'p1_horse_id': p1['horse_id'], 'p1_rank': p1['rank'],
                        'p2_horse_id': p2['horse_id'], 'p2_rank': p2['rank']
                    }
                    if p1['rank'] < p2['rank']:
                        matchup_matrix[key1]['win'] += 1
                        matchup_matrix[key2]['loss'] += 1
                    elif p2['rank'] < p1['rank']:
                        matchup_matrix[key1]['loss'] += 1
                        matchup_matrix[key2]['win'] += 1
                    else:
                        matchup_matrix[key1]['draw'] += 1
                        matchup_matrix[key2]['draw'] += 1
                    matchup_matrix[key1]['history'].append(history_entry)
                    matchup_matrix[key2]['history'].append(history_entry)

    return dict(matchup_matrix)
