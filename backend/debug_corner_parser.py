# C:\Users\tnszk\program\GitHub\backend\debug_corner_parser.py
import sys
import pprint
from scripts import scraper, parser

# --- 解析対象のURLをここで指定 ---
JRA_RACE_URL = "https://race.netkeiba.com/race/result.html?race_id=202510020804"
NAR_RACE_URL = "https://nar.netkeiba.com/race/result.html?race_id=202548072409"
# ---

def test_corner_parser_for_url(url: str):
    """
    指定されたURLのHTMLを取得し、パーサーを実行して
    各馬のコーナー通過順位(`corner_positions`)を表示する。
    """
    print("=" * 80)
    print(f"--- 以下のURLのコーナー通過順位を解析します ---")
    print(url)
    print("-" * 80)

    try:
        is_nar = "nar.netkeiba.com" in url
        race_id = url.split("race_id=")[-1]
        
        html_content = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True)

        if not html_content:
            print("[エラー] HTMLの取得に失敗しました。")
            print("=" * 80 + "\n")
            return

        parsed_data = parser.parse_race_result_page(html_content, race_id)

        if not parsed_data or 'results' not in parsed_data:
            print("[エラー] ページの解析、またはレース結果の取得に失敗しました。")
            print("=" * 80 + "\n")
            return
            
        results_data = parsed_data.get('results')

        if not results_data:
            print("[結果] レース結果データが見つかりませんでした。")
        else:
            print(">>> 解析結果:")
            all_ok = True
            for horse_result in results_data:
                horse_name = horse_result.get('horse_name', '不明な馬')
                corner_positions = horse_result.get('corner_positions')
                
                # corner_positionsが空リストやNoneでないかチェック
                if not corner_positions:
                    all_ok = False
                
                print(f"  - 馬名: {horse_name:<20} | コーナー通過順位: {corner_positions}")
            
            print("-" * 50)
            if all_ok:
                print("【成功】すべての馬からコーナー通過順位のデータを取得できました。")
            else:
                print("【失敗】一部またはすべての馬からコーナー通過順位のデータを取得できませんでした。")

            
    except Exception as e:
        print(f"[致命的なエラー] 処理中に予期せぬエラーが発生しました: {e}")
    finally:
        print("=" * 80 + "\n")


if __name__ == '__main__':
    print("--- 中央・地方競馬 コーナー通過順位パーサーのデバッグテストを開始します ---")
    
    # 中央競馬のURLをテスト
    test_corner_parser_for_url(JRA_RACE_URL)
    
    # 地方競馬のURLをテスト
    test_corner_parser_for_url(NAR_RACE_URL)
    
    print("--- デバッグテストが完了しました ---")