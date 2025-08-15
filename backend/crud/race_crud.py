# C:\Users\tnszk\program\GitHub\backend\crud\race_crud.py
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_  # or_ をインポート
from database import models
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from scripts import predictor  # predictorをインポート


def get_predictions_by_date(db: Session, target_date: date) -> Dict[str, Any]:
    """
    指定された日付のレースと予測、結果をDBから取得し、スキーマに合わせた構造で返す。
    APIパフォーマンス向上のため、巨大なmatchupデータは除外し、
    horse_number_advantagesは一括取得してN+1問題を解消する。
    """
    # ★★★ 修正点1: joinedloadから matchup を削除し、APIレスポンスを軽量化 ★★★
    # matchupデータはデータ量が非常に大きく、ロード遅延の主原因です。
    # フロントエンドは必要な時に個別APIでこのデータを取得するため、初期ロードでは不要です。
    races_with_preds = db.query(models.Race)\
        .options(
            joinedload(models.Race.predictions),
            # joinedload(models.Race.matchup), # この行を削除またはコメントアウト
            joinedload(models.Race.results).joinedload(models.Result.horse)
        )\
        .filter(models.Race.race_date == target_date)\
        .order_by(models.Race.venue_name, models.Race.race_number)\
        .all()

    if not races_with_preds:
        return {"jra": [], "nar": []}

    # ★★★ 修正点2: 馬番有利不利データ(horse_number_advantages)を一括取得してN+1問題を解消 ★★★
    # Step 1: レース情報から必要な条件（競馬場、コース、距離）の組み合わせを重複なく収集します。
    race_conditions = {
        (race.venue_name, race.course_type, race.distance)
        for race in races_with_preds
        if race.venue_name and race.course_type and race.distance
    }

    # Step 2: 収集した全条件に合致する有利不利データを、DBから一度のクエリで全て取得します。
    advantages_map = defaultdict(list)
    if race_conditions:
        filters = [
            (models.HorseNumberAdvantage.venue_name == v_name) &
            (models.HorseNumberAdvantage.course_type == c_type) &
            (models.HorseNumberAdvantage.distance == dist)
            for v_name, c_type, dist in race_conditions
        ]
        all_advantages = db.query(models.HorseNumberAdvantage).filter(or_(*filters)).all()
        
        # Step 3: 取得したデータを処理しやすいように辞書（マップ）に格納します。
        for adv in all_advantages:
            key = (adv.venue_name, adv.course_type, adv.distance)
            advantages_map[key].append(adv)

    # データを会場ごとに分類
    jra_venues: Dict[str, List[models.Race]] = defaultdict(list)
    nar_venues: Dict[str, List[models.Race]] = defaultdict(list)

    for race in races_with_preds:
        # 予測データを偏差値でソート
        if race.predictions:
            race.predictions.sort(
                key=lambda p: p.deviation_score if p.deviation_score is not None else -float('inf'),
                reverse=True
            )
        
        # Step 4: 作成したマップから各レースに対応する有利不利データを割り当てます。
        # これにより、ループ内でDBにアクセスする必要がなくなります。
        key = (race.venue_name, race.course_type, race.distance)
        advantages = advantages_map.get(key, [])
        advantages.sort(key=lambda x: x.horse_number)
        setattr(race, 'horse_number_advantages', advantages)

        # 結果データに馬名を付与（フロントエンドのスキーマ用）
        for r in race.results:
            setattr(r, 'horse_name', r.horse.name if r.horse else 'N/A')

        # JRAとNARに分類
        if race.race_type == '中央':
            jra_venues[race.venue_name].append(race)
        elif race.race_type == '地方':
            nar_venues[race.venue_name].append(race)

    jra_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in jra_venues.items()]
    nar_result = [{"venue_name": v_name, "races": race_list} for v_name, race_list in nar_venues.items()]

    return {"jra": jra_result, "nar": nar_result}


def get_special_pick_for_date(db: Session, target_date: date) -> Optional[models.Prediction]:
    """
    指定された日付の予測の中から、最も偏差値が高いものを1件取得する
    """
    return db.query(models.Prediction)\
        .join(models.Race, models.Prediction.race_id == models.Race.id)\
        .filter(models.Race.race_date == target_date)\
        .filter(models.Prediction.deviation_score.isnot(None)) \
        .order_by(desc(models.Prediction.deviation_score))\
        .first()


def get_filtered_matchups_for_race(db: Session, race_id: str, start_date: date, end_date: date) -> Optional[Dict[str, Any]]:
    """
    指定されたレースの出走馬と期間に基づいて、対戦成績を動的に計算する。
    """
    horse_results = db.query(models.Result.horse_id).filter(models.Result.race_id == race_id).all()
    if not horse_results:
        return None

    horse_ids = [r.horse_id for r in horse_results]

    matchup_data = predictor.calculate_matchups(db, horse_ids, start_date, end_date)

    return matchup_data


def get_top_payout_hits(db: Session, days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    races = db.query(models.Race).filter(
        models.Race.race_date.between(start_date, end_date)
    ).all()

    all_hits = []  # すべての的中を格納するリスト
    for race in races:
        top_5_preds = db.query(models.Prediction).filter(
            models.Prediction.race_id == race.id,
            models.Prediction.mark.in_(['◎', '〇', '▲', '△', '☆'])
        ).all()

        if not top_5_preds:
            continue

        # AI予測上位5頭の馬番号と枠番号のセットを作成
        top_5_horse_numbers = {p.horse_number for p in top_5_preds}
        top_5_waku_numbers = {p.waku_number for p in top_5_preds if p.waku_number is not None}

        race_returns = db.query(models.RaceReturn).filter(models.RaceReturn.race_id == race.id).all()
        if not race_returns:
            continue

        for r_return in race_returns:
            is_hit = False
            # 枠連の場合、枠番号で的中を判定
            if r_return.bet_type == 'wakuren':
                winning_waku_numbers = {r_return.number_1}
                if r_return.number_2:
                    winning_waku_numbers.add(r_return.number_2)
                # AI予測した枠番号のセットに、的中した枠番号がすべて含まれているか確認
                if winning_waku_numbers.issubset(top_5_waku_numbers):
                    is_hit = True
            else:
                # 枠連以外の券種は、馬番号で的中を判定
                winning_horse_numbers = {r_return.number_1}
                if r_return.number_2:
                    winning_horse_numbers.add(r_return.number_2)
                if r_return.number_3:
                    winning_horse_numbers.add(r_return.number_3)

                # AI予測した馬番号のセットに、的中した馬番号がすべて含まれているか確認
                if winning_horse_numbers.issubset(top_5_horse_numbers):
                    is_hit = True

            # 的中していた場合のみリストに追加
            if is_hit:
                delimiter = '→' if r_return.bet_type in ['umatan', 'sanrentan'] else '-'
                numbers_str_list = [str(n) for n in [r_return.number_1, r_return.number_2, r_return.number_3] if n is not None]
                winning_numbers_str = delimiter.join(numbers_str_list)

                BET_TYPE_MAP_JA = {
                    'tansho': '単勝', 'fukusho': '複勝', 'wakuren': '枠連', 'umaren': '馬連',
                    'wide': 'ワイド', 'umatan': '馬単', 'sanrenpuku': '3連複', 'sanrentan': '3連単'
                }

                all_hits.append({
                    "race_id": race.id,
                    "race_date": race.race_date,
                    "venue_name": race.venue_name,
                    "race_number": race.race_number,
                    "race_name": race.race_name,
                    "bet_type": BET_TYPE_MAP_JA.get(r_return.bet_type, r_return.bet_type),
                    "winning_numbers": winning_numbers_str,
                    "payout": r_return.payout
                })

    # すべての的中の中から配当が高い順にソートして上位limit件を返す
    sorted_hits = sorted(all_hits, key=lambda x: x['payout'], reverse=True)
    return sorted_hits[:limit]