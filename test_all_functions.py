# test_all_functions.py
import subprocess
import time
from datetime import datetime

def run_test(command, description):
    """テストコマンドを実行し、結果を表示"""
    print("\n" + "="*80)
    print(f"テスト: {description}")
    print("="*80)
    print(f"実行コマンド: {command}\n")
    
    start_time = time.time()
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            encoding='utf-8',
            errors='replace'
        )
        elapsed = time.time() - start_time
        
        # 出力を表示
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        # 結果判定
        if result.returncode == 0:
            if "✅ 分析が完了しました" in result.stdout:
                print(f"✅ 成功 (実行時間: {elapsed:.1f}秒)")
                return True
            else:
                print(f"⚠️ 完了したが、期待される出力が見つかりません (実行時間: {elapsed:.1f}秒)")
                return False
        else:
            print(f"❌ 失敗 (returncode: {result.returncode}, 実行時間: {elapsed:.1f}秒)")
            return False
            
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ エラー発生: {e} (実行時間: {elapsed:.1f}秒)")
        return False

def main():
    print("="*80)
    print("master_analyzer.py 全機能テスト")
    print("="*80)
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # テスト対象の日付範囲（実際のデータに合わせて調整してください）
    start_date = "2024-01-01"
    end_date = "2024-12-31"
    
    # テストケースの定義
    tests = [
        # 1. AI予測精度レビュー
        (
            f"python master_analyzer.py ai_review --start_date {start_date} --end_date {end_date}",
            "AI予測精度レビュー"
        ),
        
        # 2. コース傾向分析
        (
            "python master_analyzer.py course --venue 東京 --course_type 芝 --distance 2400",
            "コース傾向分析（東京芝2400m）"
        ),
        
        # 3. 騎手分析（C.ルメール）
        (
            "python master_analyzer.py jockey --id 05339",
            "騎手分析（C.ルメール）"
        ),
        
        # 4. 調教師分析（適切なIDに変更してください）
        (
            "python master_analyzer.py trainer --id 01145",
            "調教師分析"
        ),
        
        # 5. 種牡馬分析（動作不可の確認）
        (
            "python master_analyzer.py sire --id 2002100816",
            "種牡馬分析（動作不可確認）"
        ),
        
        # 6. AI vs オッズ分析
        (
            f"python master_analyzer.py odds --start_date {start_date} --end_date {end_date}",
            "AI vs オッズ分析"
        ),
        
        # 7. 季節別分析
        (
            f"python master_analyzer.py seasonal --start_date {start_date} --end_date {end_date}",
            "季節別分析"
        ),
        
        # 8. 馬場状態別分析
        (
            f"python master_analyzer.py ground --venue 東京 --start_date {start_date} --end_date {end_date}",
            "馬場状態別分析（東京）"
        ),
        
        # 9. レースグレード別分析
        (
            f"python master_analyzer.py grade --start_date {start_date} --end_date {end_date}",
            "レースグレード別分析"
        ),
        
        # 10. 騎手×種牡馬組み合わせ（動作不可の確認）
        (
            f"python master_analyzer.py jockey_sire --start_date {start_date} --end_date {end_date}",
            "騎手×種牡馬組み合わせ（動作不可確認）"
        ),
        
        # 11. 距離適性詳細分析（実在する馬IDに変更してください）
        (
            "python master_analyzer.py distance_profile --horse_id 2015104324",
            "距離適性詳細分析"
        ),
    ]
    
    # テスト実行
    results = []
    total_start = time.time()
    
    for command, description in tests:
        success = run_test(command, description)
        results.append((description, success))
        time.sleep(1)  # 次のテストまで少し待機
    
    # 結果サマリー
    total_elapsed = time.time() - total_start
    print("\n" + "="*80)
    print("テスト結果サマリー")
    print("="*80)
    
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    for description, success in results:
        status = "✅ 成功" if success else "❌ 失敗"
        print(f"{status}: {description}")
    
    print(f"\n成功: {success_count}/{total_count}")
    print(f"総実行時間: {total_elapsed:.1f}秒")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 期待される動作不可の機能についての注記
    print("\n注記:")
    print("  - 種牡馬分析とその組み合わせ分析は、データベーススキーマの制約により動作不可です。")
    print("  - これらは意図的な動作であり、エラーメッセージが表示されることが正常です。")

if __name__ == "__main__":
    main()