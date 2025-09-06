import os
import sys
from scripts import parser  # 既存のパーサーをインポート

def debug_horse_parser(horse_id: str):
    """
    指定された馬IDのキャッシュファイルを読み込み、
    馬名と過去成績が正しく解析できるか検証する。
    """
    print("=" * 80)
    print(f"--- 馬名パーサー デバッグスクリプト ---")
    print(f"🐴 対象馬ID: {horse_id}")
    
    cache_file_path = os.path.join("data", "html_cache", "horse", f"{horse_id}.bin")
    print(f"📁 対象キャッシュファイル: {cache_file_path}")
    print("=" * 80)

    if not os.path.exists(cache_file_path):
        print(f"\n❌ エラー: キャッシュファイルが見つかりません。")
        print(" -> この馬のデータは `run_pipeline.py` のSTAGE 1で収集されていません。")
        return

    try:
        with open(cache_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
        
        if not html:
            print("\n❌ エラー: キャッシュファイルは空です。")
            return

        print("\n✅ キャッシュファイルの読み込みに成功。解析を開始します...")
        
        parsed_data = parser.parse_horse_results_page(html)
        
        if not parsed_data:
            print("\n❌ 解析失敗: データ構造を全く認識できませんでした。")
            return

        # --- 検証 ---
        horse_name = parsed_data.get('horse_name')
        results_count = len(parsed_data.get('results', []))

        print("\n--- [検証結果] ---")
        if horse_name:
            print(f"  ✅ 馬名: '{horse_name}' (正常に取得できました)")
        else:
            print(f"  ❌ 馬名: 取得できませんでした (None)")
        
        print(f"  ✅ 過去成績件数: {results_count} 件")

        print("\n--- [結論] ---")
        if horse_name:
            print("🎉 正常です。この馬のデータ処理は成功するはずです。")
        else:
            print("🚨 問題発見: 馬名が取得できていません。")
            print("   これが原因で`horses`テーブルへの登録が失敗し、外部キー制約違反エラーが発生しています。")
            print("   次のステップで、この問題に対応するためにパーサーを修正します。")

    except Exception as e:
        import traceback
        print(f"\n❌ 予期せぬエラーが発生しました: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/debug_horse_name_parser.py <horse_id>")
        print("   例: python backend/debug_horse_name_parser.py 2020107203")
        sys.exit(1)
        
    main_horse_id = sys.argv[1]
    debug_horse_parser(main_horse_id)