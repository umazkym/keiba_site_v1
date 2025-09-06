# backend/debug_io_parser_speed.py
import os
import sys
import time
from datetime import datetime, timedelta
from tqdm import tqdm
from scripts import parser

def profile_io_and_parsing(start_date: datetime.date, end_date: datetime.date):
    """
    Webアクセスを行わず、ローカルキャッシュの読み込みと解析の速度のみを計測する。
    """
    print("\n--- [I/O & Parser Profiler] ---")
    print(f"計測期間: {start_date} から {end_date} まで")
    print("Webサイトへのアクセスは行いません。")
    print("="*60)
    
    total_start_time = time.time()
    dates_to_process = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    all_horse_ids_to_fetch = set()
    
    races_processed_count = 0
    
    with tqdm(dates_to_process, desc="日付ごと", unit="day") as pbar:
        for target_date in pbar:
            target_date_str = target_date.strftime('%Y%m%d')
            
            for is_nar in [False, True]:
                dir_path = os.path.join("data", "html_cache", "nar_racelist" if is_nar else "racelist")
                file_path = os.path.join(dir_path, f"{target_date_str}.bin")

                if not os.path.exists(file_path):
                    continue
                
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    list_html = f.read()

                if not list_html:
                    continue

                race_ids = parser.parse_race_ids_from_list(list_html)
                if not race_ids:
                    continue

                for race_id in race_ids:
                    races_processed_count += 1
                    shutuba_dir_path = os.path.join("data", "html_cache", "shutuba")
                    shutuba_file_path = os.path.join(shutuba_dir_path, f"{race_id}.bin")
                    
                    if not os.path.exists(shutuba_file_path):
                        continue

                    with open(shutuba_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        shutuba_html = f.read()
                    
                    if shutuba_html:
                        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id)
                        if shutuba_data:
                            for horse in shutuba_data.get("horses", []):
                                if horse.get("horse_id"):
                                    all_horse_ids_to_fetch.add(horse["horse_id"])

    total_elapsed = time.time() - total_start_time
    
    print("\n" + "="*60)
    print("--- 計測完了 ---")
    print(f"総処理時間: {total_elapsed:.2f}秒")
    print(f"処理した日数: {len(dates_to_process)}日")
    print(f"処理したレース数 (出馬表): {races_processed_count}レース")
    print(f"収集したユニークな馬の数: {len(all_horse_ids_to_fetch)}頭")
    if races_processed_count > 0:
        print(f"1レースあたりの平均処理時間: {total_elapsed / races_processed_count * 1000:.2f}ミリ秒")
    print("="*60)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("\n使い方: python backend/debug_io_parser_speed.py <開始日> <終了日>")
        print("例: python backend/debug_io_parser_speed.py 2024-10-01 2025-08-30")
        sys.exit(1)
        
    try:
        start_date_obj = datetime.strptime(sys.argv[1], '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
    except ValueError:
        print("\nエラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        sys.exit(1)
        
    profile_io_and_parsing(start_date_obj, end_date_obj)