"""
データ整合性チェック
バックフィル後のローカルDBの整合性を確認
"""
import sys
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, '.')
from database import models

print("=" * 70)
print("データ整合性チェック")
print("=" * 70)

# ローカルSQLite接続
local_url = "sqlite:///./keiba.db"
local_engine = create_engine(local_url)
LocalSession = sessionmaker(bind=local_engine)
local_db = LocalSession()

try:
    # 各テーブルの件数
    print("\n[テーブル件数]")
    
    races_count = local_db.query(models.Race).count()
    horses_count = local_db.query(models.Horse).count()
    jockeys_count = local_db.query(models.Jockey).count()
    trainers_count = local_db.query(models.Trainer).count()
    results_count = local_db.query(models.Result).count()
    predictions_count = local_db.query(models.Prediction).count()
    
    print(f"  Races:       {races_count:>8,}件")
    print(f"  Horses:      {horses_count:>8,}件")
    print(f"  Jockeys:     {jockeys_count:>8,}件")
    print(f"  Trainers:    {trainers_count:>8,}件")
    print(f"  Results:     {results_count:>8,}件")
    print(f"  Predictions: {predictions_count:>8,}件")
    
    # 日付範囲
    print("\n[日付範囲]")
    min_date = local_db.query(func.min(models.Race.race_date)).scalar()
    max_date = local_db.query(func.max(models.Race.race_date)).scalar()
    print(f"  最古: {min_date}")
    print(f"  最新: {max_date}")
    
    # 重複チェック
    print("\n[重複チェック]")
    
    # レースID重複
    race_duplicates = local_db.query(
        models.Race.id,
        func.count(models.Race.id).label('count')
    ).group_by(models.Race.id).having(func.count(models.Race.id) > 1).all()
    
    print(f"  レースID重複: {len(race_duplicates)}件")
    if race_duplicates:
        for race_id, count in race_duplicates[:5]:
            print(f"    {race_id}: {count}件")
    
    # NULL値チェック
    print("\n[NULL値チェック]")
    
    races_null_date = local_db.query(models.Race).filter(
        models.Race.race_date == None
    ).count()
    print(f"  レース日付がNULL: {races_null_date}件")
    
    results_null_horse = local_db.query(models.Result).filter(
        models.Result.horse_id == None
    ).count()
    print(f"  結果の馬IDがNULL: {results_null_horse}件")
    
    # 外部キー整合性
    print("\n[外部キー整合性]")
    
    # Resultのrace_idがRaceに存在するか
    orphan_results = local_db.query(models.Result).filter(
        ~models.Result.race_id.in_(
            local_db.query(models.Race.id)
        )
    ).count()
    print(f"  孤立した結果: {orphan_results}件")
    
    # Predictionのrace_idがRaceに存在するか
    orphan_predictions = local_db.query(models.Prediction).filter(
        ~models.Prediction.race_id.in_(
            local_db.query(models.Race.id)
        )
    ).count()
    print(f"  孤立した予測: {orphan_predictions}件")
    
    # バックフィル期間のデータ確認
    print("\n[バックフィル期間のデータ]")
    from datetime import datetime
    
    backfill_start = datetime(2024, 11, 20).date()
    backfill_end = datetime(2026, 1, 13).date()
    
    backfill_races = local_db.query(models.Race).filter(
        models.Race.race_date >= backfill_start,
        models.Race.race_date <= backfill_end
    ).count()
    
    print(f"  2024-11-20 〜 2026-01-13: {backfill_races:,}件")
    
    # 期間内の結果データ
    backfill_results = local_db.query(models.Result).join(
        models.Race
    ).filter(
        models.Race.race_date >= backfill_start,
        models.Race.race_date <= backfill_end
    ).count()
    
    print(f"  同期間の結果: {backfill_results:,}件")
    
    # レースあたりの平均エントリー数
    avg_entries = backfill_results / backfill_races if backfill_races > 0 else 0
    print(f"  平均エントリー数: {avg_entries:.1f}頭/レース")
    
finally:
    local_db.close()

print("\n" + "=" * 70)
print("整合性チェック完了")
print("=" * 70)
