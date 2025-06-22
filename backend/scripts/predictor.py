# C:\Users\tnszk\program\keiba-ai-site\backend\scripts\predictor.py
from sqlalchemy.orm import Session
from database import models
import pandas as pd
from datetime import date, timedelta
from typing import List, Dict

def calculate_deviation_score(db: Session, race: models.Race, horses: List[Dict]) -> List[Dict]:
    """
    1レース分の全馬の偏差値と印を計算する。
    """
    start_date = race.race_date - timedelta(days=2*365)
    end_date = race.race_date - timedelta(days=2)

    all_horse_predictions = []

    for horse in horses:
        # 1. 各馬の過去成績をDBから取得
        past_results_query = db.query(models.Result).join(models.Race).filter(
            models.Result.horse_id == horse['id'],
            models.Race.race_date.between(start_date, end_date)
        ).all()
        
        if not past_results_query:
            # 過去データがない馬はデフォルト値
            performance_score = 50.0
        else:
            # 2. パフォーマンス指標を計算 (例: タイムベース)
            # ここで、レースの距離や馬場状態に応じて補正を加える複雑なロジックを実装
            # ここでは単純化し、着順の平均をスコアとする
            df = pd.DataFrame([r.__dict__ for r in past_results_query])
            
            # (例) 平均着順を元にスコア化 (低いほど良い)
            avg_rank = df['rank'].mean()
            # スコアを反転 (高いほど良い)
            performance_score = 100 - avg_rank * 5

        all_horse_predictions.append({
            'horse_id': horse['id'],
            'horse_name': horse['name'],
            'horse_number': horse['number'],
            'raw_score': performance_score
        })

    # 3. レース内での偏差値(T-Score)を計算
    if not all_horse_predictions:
        return []
        
    df_pred = pd.DataFrame(all_horse_predictions)
    mean = df_pred['raw_score'].mean()
    std = df_pred['raw_score'].std(ddof=0) # 母標準偏差
    
    if std == 0:
        df_pred['deviation_score'] = 50.0
    else:
        df_pred['deviation_score'] = df_pred['raw_score'].apply(lambda x: 10 * (x - mean) / std + 50)
    
    df_pred['deviation_score'] = df_pred['deviation_score'].round(2)
    
    # 4. 印を付与
    df_pred = df_pred.sort_values('deviation_score', ascending=False).reset_index()
    marks = ["◎", "〇", "▲", "△", "☆"]
    df_pred['mark'] = df_pred.index.map(lambda i: marks[i] if i < len(marks) else "")
    
    # 5. 1Cスタート指標を計算 (例: 過去の平均1コーナー通過順位)
    # このロジックもここで実装する
    df_pred['start_1c_indicator'] = 5.0 # 仮

    return df_pred.to_dict('records')