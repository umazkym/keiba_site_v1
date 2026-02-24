"""
過去レースのAI分析テキストをバッチ再生成するスクリプト。
日付範囲を指定して、その範囲内のレースのAI分析テキストを生成（or 再生成）する。

使い方:
  # 特定の日付範囲のレースを生成（既存テキストはスキップ）
  python backend/scripts/regenerate_ai_texts.py --start 2026-02-01 --end 2026-02-22

  # 既存テキストも含めて強制再生成
  python backend/scripts/regenerate_ai_texts.py --start 2026-02-21 --end 2026-02-21 --force

  # ドライラン（何件が対象かだけ確認）
  python backend/scripts/regenerate_ai_texts.py --start 2026-02-01 --end 2026-02-22 --dry-run

注意:
  - Gemini APIの制限: 1モデルあたり約20リクエスト/日。3レース/チャンクなので約60レース/日。
  - 3モデルのフォールバックがあるため、最大約180レース/日に対応可能。
  - 大量のレースを処理する場合は、日付範囲を分割して数日に分けて実行してください。
"""
import sys
import os
import argparse
import datetime
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.database import SessionLocal
from database import models
from scripts import llm_generator
from sqlalchemy import func


def main():
    parser = argparse.ArgumentParser(description='過去レースのAI分析テキストをバッチ再生成')
    parser.add_argument('--start', required=True, help='開始日 (YYYY-MM-DD)')
    parser.add_argument('--end', required=True, help='終了日 (YYYY-MM-DD)')
    parser.add_argument('--force', action='store_true', help='既存テキストも強制的に再生成')
    parser.add_argument('--dry-run', action='store_true', help='対象レース数の確認のみ（生成しない）')
    parser.add_argument('--venue', type=str, default=None, help='会場名でフィルタ（例: 東京, 阪神）')
    args = parser.parse_args()

    start_date = datetime.datetime.strptime(args.start, '%Y-%m-%d').date()
    end_date = datetime.datetime.strptime(args.end, '%Y-%m-%d').date()

    db = SessionLocal()

    try:
        # 対象レースの取得
        query = db.query(models.Race).filter(
            models.Race.race_date >= start_date,
            models.Race.race_date <= end_date,
            ~models.Race.race_name.like("%新馬%")  # 新馬戦を除外
        )

        if args.venue:
            query = query.filter(models.Race.venue_name.like(f"%{args.venue}%"))

        races = query.order_by(models.Race.race_date, models.Race.id).all()

        # 予測データがあるレースだけに絞る
        target_race_ids = []
        for race in races:
            pred_count = db.query(func.count(models.Prediction.id)).filter(
                models.Prediction.race_id == race.id,
                models.Prediction.deviation_score.isnot(None)
            ).scalar()
            if pred_count > 0:
                target_race_ids.append(race.id)

        # 既存テキストの状態を集計
        has_text = 0
        null_text = 0
        for rid in target_race_ids:
            r = db.query(models.Race).filter(models.Race.id == rid).first()
            if r and r.ai_analysis_text:
                has_text += 1
            else:
                null_text += 1

        print(f"\n{'='*60}")
        print(f"対象期間: {start_date} ～ {end_date}")
        if args.venue:
            print(f"会場フィルタ: {args.venue}")
        print(f"{'='*60}")
        print(f"期間内の全レース数: {len(races)}")
        print(f"予測データありのレース: {len(target_race_ids)}")
        print(f"  うちAIテキストあり: {has_text}")
        print(f"  うちAIテキストなし: {null_text}")

        if args.force:
            print(f"\n⚠ --force指定: 既存テキストも含めて {len(target_race_ids)} レースを再生成します")
            process_ids = target_race_ids
        else:
            # NULLのものだけ生成
            process_ids = []
            for rid in target_race_ids:
                r = db.query(models.Race).filter(models.Race.id == rid).first()
                if r and not r.ai_analysis_text:
                    process_ids.append(rid)
            print(f"\nAIテキストなしの {len(process_ids)} レースを生成します")

        # API使用量の見積もり
        chunks_needed = (len(process_ids) + 2) // 3  # 3レース/チャンク
        print(f"必要なAPIリクエスト数: 約{chunks_needed}回")
        if chunks_needed > 20:
            print(f"⚠ 1モデルの上限(20回)を超えます。フォールバックモデルを使用します。")
        if chunks_needed > 60:
            print(f"⚠ 全モデルの上限(60回)を超える可能性があります。日付範囲を分割してください。")

        if args.dry_run:
            print(f"\n[DRY RUN] 生成は行いません。")
            return

        if not process_ids:
            print(f"\n生成対象のレースがありません。")
            return

        # forceモードの場合、既存テキストをクリア
        if args.force:
            print(f"\n既存テキストをクリア中...")
            for rid in process_ids:
                r = db.query(models.Race).filter(models.Race.id == rid).first()
                if r:
                    r.ai_analysis_text = None
            db.commit()
            print(f"  → {len(process_ids)} レースのテキストをNULLに設定しました。")

        # 生成実行
        print(f"\n生成を開始します...\n")
        llm_generator.generate_analyses_in_batches(db, process_ids)
        print(f"\n✅ バッチ再生成が完了しました。")

    finally:
        db.close()


if __name__ == "__main__":
    main()
