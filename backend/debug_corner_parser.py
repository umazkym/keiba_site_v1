# backend/extract_corners_from_cache.py
import os
import sys
from bs4 import BeautifulSoup
import re
from typing import Optional, List

# --- scripts/parser.py から必要な関数をコピー＆簡略化 ---

def _safe_int(value: any) -> Optional[int]:
    if value is None: return None
    try: return int(str(value).strip())
    except (ValueError, TypeError): return None

def parse_corners_from_html_for_debug(html_content: str) -> List[dict]:
    """
    指定された馬の過去成績ページのHTMLコンテンツから、
    コーナー通過順位だけを抽出するデバッグ用の新しいパーサー。
    """
    soup = BeautifulSoup(html_content, 'lxml')
    results_list = []

    # 過去成績のテーブルを探す
    results_table = soup.find('table', class_=re.compile("db_h_race_results|race_table_01"))
    if not results_table:
        print("❌ エラー: 過去成績テーブルが見つかりませんでした。")
        return []

    # テーブルのヘッダーから各列のインデックスを取得
    headers = [th.get_text(strip=True) for th in results_table.find_all('th')]
    col_map = {name: i for i, name in enumerate(headers)}
    
    # データ行を取得
    rows = results_table.find('tbody').find_all('tr')

    print(f"✅ テーブルから {len(rows)} 件のレース結果を検出しました。")
    print("-" * 60)

    for row in rows:
        cols_text = [c.get_text(strip=True) for c in row.find_all('td')]
        
        # 最低限必要な列があるかチェック
        if len(cols_text) < 15: continue

        try:
            race_date = cols_text[col_map.get('日付', 0)]
            race_name = cols_text[col_map.get('レース名', 4)]
            
            # コーナー通過順位の列インデックスを動的に探す
            corner_col_idx = col_map.get('通過', -1)
            # もし'通過'というカラム名が見つからなければ、位置（19番目）で決め打ちする
            # netkeibaのHTML構造では、この列は可変だが、多くの場合19番目前後にある
            if corner_col_idx == -1 and len(cols_text) > 19:
                corner_col_idx = 19
            
            corner_positions_str = "データなし"
            corner_positions = []
            if corner_col_idx != -1 and corner_col_idx < len(cols_text):
                corner_positions_str = cols_text[corner_col_idx]
                # '1-2' や '1(2,3)' のような複雑なパターンにも対応
                corner_positions = [_safe_int(p) for p in re.split(r'[,()-]', corner_positions_str) if p.isdigit()]
                corner_positions = [p for p in corner_positions if p is not None]

            result_entry = {
                "race_date": race_date,
                "race_name": race_name,
                "raw_corner_text": corner_positions_str,
                "extracted_corners": corner_positions
            }
            results_list.append(result_entry)
            
        except (IndexError, AttributeError) as e:
            print(f"⚠️ 警告: ある行の解析中にエラーが発生しました (スキップします): {e}")
            continue
            
    return results_list


def main(horse_id: str):
    """
    指定された馬IDのキャッシュファイルを読み込み、コーナー通過順位を抽出する。
    """
    cache_file_path = os.path.join("data", "html_cache", "horse", f"{horse_id}.bin")

    print("="*80)
    print(f"--- キャッシュファイルからのコーナー順位抽出テスト ---")
    print(f"🐴 対象馬ID: {horse_id}")
    print(f"📁 対象ファイル: {cache_file_path}")
    print("="*80)

    if not os.path.exists(cache_file_path):
        print(f"\n❌ エラー: キャッシュファイルが見つかりません。")
        print("   -> この馬のデータはまだスクレイピングされていない可能性があります。")
        return

    try:
        with open(cache_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
        
        if not html:
            print("\n❌ エラー: キャッシュファイルは空です。")
            return

        print("\n✅ キャッシュファイルの読み込みに成功しました。解析を開始します...")
        
        extracted_data = parse_corners_from_html_for_debug(html)
        
        if not extracted_data:
            print("\n❌ 解析に失敗しました。データを抽出できませんでした。")
            return

        print("\n--- [抽出結果] ---")
        valid_count = 0
        for data in extracted_data:
            if data['extracted_corners']:
                status = "✅ [成功]"
                valid_count += 1
            else:
                status = "❌ [失敗]"
            
            print(f"{status} {data['race_date']} {data['race_name']:<20} | "
                  f"元テキスト: '{data['raw_corner_text']}' -> 抽出結果: {data['extracted_corners']}")

        print("\n--- [最終結論] ---")
        if valid_count > 0:
            print(f"🎉 成功: {len(extracted_data)}レース中、{valid_count}件のコーナー通過データを抽出できました。")
            print("   -> この結果は、古いキャッシュを削除せずに、パーサーの修正だけで対応可能であることを示しています。")
        else:
            print(f"😭 失敗: {len(extracted_data)}レース中、有効なコーナー通過データを1件も抽出できませんでした。")
            print("   -> このHTMLの構造が想定と大きく異なる可能性があります。")

    except Exception as e:
        import traceback
        print(f"\n❌ 予期せぬエラーが発生しました: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n💡 使い方: python backend/extract_corners_from_cache.py <horse_id>")
        print("   例: python backend/extract_corners_from_cache.py 2019101459")
        sys.exit(1)
    
    main(sys.argv[1])