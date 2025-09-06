import os
import sys
import pprint
from scripts import scraper, parser

def debug_result_parser(race_id: str):
    """
    指定されたレースIDの結果ページを強制的にダウンロードし、
    パーサーが正しく機能するか検証する。
    失敗した場合はHTMLをファイルに保存する。
    """
    print("=" * 80)
    print(f"--- レース結果パーサー デバッグスクリプト ---")
    print(f"🐴 対象レースID: {race_id}")
    print("=" * 80)

    try:
        is_nar = int(race_id[4:6]) >= 30
        race_type_str = "NAR" if is_nar else "JRA"
        print(f"レース種別: {race_type_str}")

        print("\n[ステップ1] Webからレース結果ページのHTMLを強制ダウンロードします...")
        html_content, _ = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True)

        if not html_content:
            print("\n❌ エラー: HTMLの取得に失敗しました。")
            return

        print("✅ HTMLの取得に成功しました。解析を開始します...")

        parsed_data = parser.parse_race_result_page(html_content, race_id)

        print("\n--- [検証結果] ---")
        if parsed_data and parsed_data.get('results') and parsed_data.get('returns'):
            print("🎉 解析成功！")
            print("\n[レース情報]")
            pprint.pprint(parsed_data.get('race_info'))
            print("\n[払い戻し情報]")
            pprint.pprint(parsed_data.get('returns'))
        else:
            print("🚨 解析失敗: ページから結果または払い戻し情報を抽出できませんでした。")
            
            # 失敗したHTMLをファイルに保存
            debug_dir = "debug_logs"
            os.makedirs(debug_dir, exist_ok=True)
            file_path = os.path.join(debug_dir, f"failed_result_{race_id}.html")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            
            print(f"\n💡 分析のため、失敗したページのHTMLを以下のファイルに保存しました:")
            print(f"   -> {os.path.abspath(file_path)}")
            print("\n次のステップ: このHTMLファイルの中身を全てコピーして、私に返信してください。")

    except Exception as e:
        import traceback
        print(f"\n❌ 予期せぬエラーが発生しました: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/debug_result_parser.py <race_id>")
        print("   例: python backend/debug_result_parser.py 202543083010")
        sys.exit(1)
        
    main_race_id = sys.argv[1]
    debug_result_parser(main_race_id)