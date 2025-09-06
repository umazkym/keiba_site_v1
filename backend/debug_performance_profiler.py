# backend/debug_performance_profiler.py
import cProfile
import pstats
import io
import os
import sys
import datetime
from run_pipeline import pre_scrape_all_data, backfill_historical_data, process_advantage_in_chunks
from database.database import SessionLocal

# --- 設定 ---
# ここで計測したい期間を指定してください
START_DATE_STR = "2025-05-23"
END_DATE_STR = "2025-05-25"

# cProfileの結果を保存するファイル名
PROFILE_OUTPUT_FILE = "perf_logs/pipeline_profile.prof"
PROFILE_STATS_FILE = "perf_logs/pipeline_stats.txt"

def run_profiling():
    """
    パイプラインの主要なステージをプロファイリングし、結果をファイルに出力する。
    """
    if 'PIPELINE_MODE' not in os.environ or os.environ['PIPELINE_MODE'] != 'HISTORY':
        print("\n❌ エラー: このスクリプトは PIPELINE_MODE=HISTORY で実行する必要があります。")
        print("💡 実行前に環境変数を設定してください。例 (PowerShell):")
        print("   $env:PIPELINE_MODE=\"HISTORY\"")
        return

    try:
        start_date = datetime.datetime.strptime(START_DATE_STR, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(END_DATE_STR, '%Y-%m-%d').date()
    except ValueError:
        print(f"\n❌ エラー: 日付形式が正しくありません。'{START_DATE_STR}' または '{END_DATE_STR}' を 'YYYY-MM-DD' 形式で指定してください。")
        return

    # ログディレクトリを作成
    os.makedirs("perf_logs", exist_ok=True)

    print("=" * 80)
    print("--- パフォーマンスプロファイリングを開始します ---")
    print(f"対象期間: {START_DATE_STR} ～ {END_DATE_STR}")
    print(f"プロファイルデータ: {PROFILE_OUTPUT_FILE}")
    print(f"統計情報: {PROFILE_STATS_FILE}")
    print("=" * 80)

    # プロファイラを初期化
    profiler = cProfile.Profile()
    profiler.enable()

    try:
        # --- パイプラインの各ステージを実行 ---
        print("\n--- [STAGE 1/3] 事前スクレイピングを実行中... ---")
        pre_scrape_all_data(start_date, end_date)
        print("--- STAGE 1 完了 ---")

        print("\n--- [STAGE 2/3] DB保存とAI予測を実行中... ---")
        backfill_historical_data(start_date, end_date)
        print("--- STAGE 2 完了 ---")

        print("\n--- [STAGE 3/3] 馬番有利不利データを計算中... ---")
        db_session = SessionLocal()
        try:
            # HISTORYモードでの有利不利計算は、DB全体を対象とするのが一般的
            # ここではプロファイル用に指定期間のみを対象とする
            history_start_date = datetime.date(2024, 1, 1) # プロジェクトの開始日に合わせる
            history_end_date = datetime.date.today()
            process_advantage_in_chunks(db_session, history_start_date, history_end_date, chunk_size_days=90)
        finally:
            db_session.close()
        print("--- STAGE 3 完了 ---")

    except Exception as e:
        print(f"\n❌ パイプライン実行中にエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # プロファイリングを終了
        profiler.disable()
        print("\n--- プロファイリングを終了しました ---")

        # 結果を整形して出力
        s = io.StringIO()
        # sort='cumulative' で累積時間の長い順にソート
        stats = pstats.Stats(profiler, stream=s).sort_stats('cumulative')
        stats.print_stats(30) # 上位30件の処理を表示

        # 統計情報をファイルに保存
        with open(PROFILE_STATS_FILE, 'w', encoding='utf-8') as f:
            f.write(f"Performance Analysis for {START_DATE_STR} to {END_DATE_STR}\n")
            f.write("="*50 + "\n")
            f.write(s.getvalue())
        
        # プロファイルデータ本体を保存
        profiler.dump_stats(PROFILE_OUTPUT_FILE)
        
        print(f"\n✅ 結果を '{PROFILE_STATS_FILE}' に保存しました。")
        print("   このファイルを確認して、どの関数の実行に時間がかかっているかを確認してください。")

if __name__ == '__main__':
    # このスクリプトは `run_pipeline.py` と同じ引数を取るわけではないため、
    # sys.argvを直接渡さずに、スクリプト上部の設定を使用する。
    run_profiling()