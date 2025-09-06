# backend/debug_cache_checker.py
import os
import sys
from datetime import datetime, timedelta
from scripts import parser

def check_cache_files_for_period(start_date_str: str, end_date_str: str):
    """
    指定された期間のJRAおよびNARのレース一覧キャッシュファイルを確認し、
    各ファイルから検出されたレースIDの数を表示する。
    """
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        print(f"\n❌ エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print(f"\n--- レース一覧キャッシュファイルの健全性チェック ---")
    print(f"期間: {start_date_str} から {end_date_str}")
    print("-" * 50)

    current_date = start_date
    while current_date <= end_date:
        date_str_ymd = current_date.strftime('%Y%m%d')
        date_str_display = current_date.strftime('%Y-%m-%d')
        
        jra_path = os.path.join("data", "html_cache", "racelist", f"{date_str_ymd}.bin")
        nar_path = os.path.join("data", "html_cache", "nar_racelist", f"{date_str_ymd}.bin")

        jra_info = "ファイルなし"
        if os.path.exists(jra_path):
            with open(jra_path, 'r', encoding='utf-8', errors='ignore') as f:
                html = f.read()
            if not html.strip():
                jra_info = "空ファイル"
            else:
                try:
                    race_ids = parser.parse_race_ids_from_list(html)
                    jra_info = f"{len(race_ids)} レース"
                except Exception:
                    jra_info = "パース失敗"

        nar_info = "ファイルなし"
        if os.path.exists(nar_path):
            with open(nar_path, 'r', encoding='utf-8', errors='ignore') as f:
                html = f.read()
            if not html.strip():
                nar_info = "空ファイル"
            else:
                try:
                    race_ids = parser.parse_race_ids_from_list(html)
                    nar_info = f"{len(race_ids)} レース"
                except Exception:
                    nar_info = "パース失敗"
        
        print(f"🗓️  {date_str_display} | JRA: {jra_info:<12} | NAR: {nar_info}")

        current_date += timedelta(days=1)
    
    print("-" * 50)
    print("💡 フロントでエラーが出た日のキャッシュが「ファイルなし」または「空ファイル」になっていれば、スクレイピング失敗が原因である可能性が非常に高いです。")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("\n💡 使い方: python backend/debug_cache_checker.py <開始日> <終了日>")
        print("   例: python backend/debug_cache_checker.py 2025-08-15 2025-09-07")
        sys.exit(1)
    
    check_cache_files_for_period(sys.argv[1], sys.argv[2])