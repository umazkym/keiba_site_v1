# backend/recalculate_advantages.py
import time
import traceback
from sqlalchemy.orm import Session
from database.database import SessionLocal
from scripts import predictor, database_loader
from database import models # modelsをインポート
import pandas as pd
import math
from tqdm import tqdm

def main():
    """
    データベース内の全レース結果を基に、馬番有利不利データのみを再計算する専用スクリプト。（進捗表示強化版）
    """
    print("=" * 80)
    print("--- 馬番有利不利データ 再計算スクリプト (進捗表示強化版) ---")
    print("=" * 80)
    
    start_time = time.time()
    db: Session = SessionLocal()
    
    try:
        # 1. 最初に既存のデータをすべて削除
        print("ステップ1/4: 既存の馬番有利不利データを削除しています...")
        num_deleted = db.query(models.HorseNumberAdvantage).delete(synchronize_session=False)
        db.commit()
        print(f" -> 完了 ({num_deleted}件のレコードを削除しました)")

        # 2. 全期間のデータを取得するクエリを定義
        results_query = db.query(
            models.Race.id,
            models.Race.venue_name,
            models.Race.course_type,
            models.Race.distance,
            models.Race.total_horses,
            models.Result.horse_number,
            models.Result.rank
        ).join(models.Result, models.Race.id == models.Result.race_id)\
        .filter(models.Result.rank.isnot(None))\
        .filter(models.Race.total_horses.isnot(None))\
        .filter(models.Race.course_type.in_(['芝', 'ダ']))

        total_rows = results_query.count()
        if total_rows == 0:
            print("計算対象のデータがありませんでした。処理を終了します。")
            return

        print(f"\nステップ2/4: データベースから全レース結果 ({total_rows}件) を読み込み、スコアを計算します...")
        
        chunk_size = 50000
        chunks = pd.read_sql(results_query.statement, db.bind, chunksize=chunk_size)
        
        all_scores_df_list = []
        with tqdm(total=total_rows, desc=" -> 進捗") as pbar:
            for chunk_df in chunks:
                ai_scores = []
                # チャンク内でレースごとにグループ化してスコアを計算
                for _, group in chunk_df.groupby('id'):
                    n = group['total_horses'].iloc[0]
                    if pd.isna(n) or int(n) < 2: continue
                    n = int(n)
                    
                    e = (n + 1) / 2.0
                    sd = math.sqrt((n**2 - 1) / 12.0)
                    if sd == 0: continue
                    
                    group['advantage_score'] = (e - group['rank']) / sd
                    ai_scores.append(group)
                
                if ai_scores:
                    all_scores_df_list.append(pd.concat(ai_scores))
                pbar.update(len(chunk_df))

        if not all_scores_df_list:
            print("スコアを計算できる有効なデータがありませんでした。")
            return
            
        print("\nステップ3/4: 全データの統計集計を行っています... (この処理には数分かかる場合があります)")
        df_with_ai = pd.concat(all_scores_df_list)
        
        advantage_groups = df_with_ai.groupby([
            'venue_name', 'course_type', 'distance', 'horse_number'
        ])['advantage_score'].agg(['mean']).reset_index()
        
        advantage_groups.rename(columns={'mean': 'advantage_score'}, inplace=True)
        print(" -> 集計完了")
        
        print("\nステップ4/4: 計算結果をデータベースに保存しています...")
        advantages_to_save = advantage_groups.to_dict('records')
        
        if advantages_to_save:
            database_loader.save_horse_number_advantages(db, advantages_to_save)
            print(f" -> 完了 ({len(advantages_to_save)}件のレコードを保存しました)")
        
        db.commit()

        elapsed_time = time.time() - start_time
        print("\n" + "=" * 80)
        print(f"✅ 全ての処理が正常に完了しました！ (合計処理時間: {elapsed_time:.2f}秒)")
        print("=" * 80)
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        print("\n" + "=" * 80)
        print(f"🚨 処理中にエラーが発生しました。 (経過時間: {elapsed_time:.2f}秒)")
        print("=" * 80)
        traceback.print_exc()
        db.rollback()
        
    finally:
        if db.is_active:
            db.close()
            print("データベース接続を閉じました。")

if __name__ == "__main__":
    main()