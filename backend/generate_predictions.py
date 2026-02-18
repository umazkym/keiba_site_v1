#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
指定日の予測を直接データベースから生成するスクリプト

使い方:
    python generate_predictions.py --date 2026-01-25
    python generate_predictions.py --date today
    python generate_predictions.py --date tomorrow
"""

from dotenv import load_dotenv
load_dotenv()

import os
import sys
import gc
import argparse
from datetime import datetime, timedelta, timezone
from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.database import SessionLocal
from database import models
from scripts import predictor, database_loader


def parse_date(date_str: str) -> datetime:
    """日付文字列を解析してdatetime.dateを返す"""
    jst = timezone(timedelta(hours=9))
    today = datetime.now(jst).date()
    
    if date_str == 'today':
        return today
    elif date_str == 'tomorrow':
        return today + timedelta(days=1)
    elif date_str == 'yesterday':
        return today - timedelta(days=1)
    else:
        return datetime.strptime(date_str, '%Y-%m-%d').date()


def generate_predictions_for_date(target_date):
    """
    指定した日付のレースに対して予測を生成する
    """
    print("=" * 60)
    print(f"予測生成スクリプト")
    print("=" * 60)
    print(f"対象日: {target_date}")
    print()
    
    db = SessionLocal()
    
    try:
        # レースを取得
        races = db.query(models.Race).filter(
            models.Race.race_date == target_date
        ).all()
        
        if not races:
            print(f"❌ {target_date} のレースが見つかりません")
            return False
        
        print(f"{len(races)} レースを処理します\n")
        
        success = 0
        skip = 0
        
        for race in tqdm(races, desc="予測生成"):
            race_id = race.id
            
            try:
                # 既存予測を削除
                db.query(models.Prediction).filter(
                    models.Prediction.race_id == race_id
                ).delete(synchronize_session=False)
                db.query(models.Matchup).filter(
                    models.Matchup.race_id == race_id
                ).delete(synchronize_session=False)
                db.commit()
                
                # 予測を生成
                predictions = predictor.create_predictions_for_race(race_id, db)
                
                if predictions:
                    # 保存
                    database_loader.save_prediction(db, race_id, predictions)
                    
                    # マッチアップも保存
                    horse_ids = [p.get("horse_id") for p in predictions if p.get("horse_id")]
                    if horse_ids:
                        predictor.calculate_and_save_matchups_for_race(db, race_id, horse_ids)
                    
                    success += 1
                else:
                    skip += 1
                    
            except Exception as e:
                tqdm.write(f"  ❌ {race_id}: {e}")
                db.rollback()
                
            gc.collect()
        
        # 確認
        final_count = db.query(models.Prediction).filter(
            models.Prediction.race_id.in_([r.id for r in races])
        ).count()
        
        print(f"\n結果: 成功={success}, スキップ={skip}")
        print(f"保存済み予測: {final_count} 件")
        
        return success > 0
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description='指定日の予測を生成')
    parser.add_argument('--date', type=str, default='today',
                       help='対象日: "today", "tomorrow", "yesterday", または "YYYY-MM-DD"')
    args = parser.parse_args()
    
    target_date = parse_date(args.date)
    success = generate_predictions_for_date(target_date)
    
    if success:
        print("\n✅ 完了")
    else:
        print("\n⚠️ 予測生成に問題がありました")
        sys.exit(1)


if __name__ == "__main__":
    main()
