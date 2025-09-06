# backend/generate_website_analysis_data.py
import os
import requests
import json
import argparse
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from tqdm import tqdm

# --- 設定 ---
API_BASE_URL = "http://127.0.0.1:8000"
MAX_RETRIES = 3  # データ取得の最大リトライ回数
RETRY_DELAY = 5  # リトライ時の待機時間 (秒)

# --- 関数定義 ---

def fetch_data_for_date(date_str: str) -> Optional[Dict[str, Any]]:
    """
    指定された日付のレース予測データをAPIから取得する。
    接続エラー時にリトライ処理を行うように改良。
    """
    api_url = f"{API_BASE_URL}/api/v1/predictions/{date_str}"
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(api_url, timeout=60)
            if response.status_code == 404:
                tqdm.write(f"INFO: {date_str} のレースデータは見つかりませんでした（非開催日の可能性）。")
                return None
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            tqdm.write(f"WARN: [{attempt + 1}/{MAX_RETRIES}] {date_str} のデータ取得中にエラー: {e}")
            if attempt < MAX_RETRIES - 1:
                tqdm.write(f"       {RETRY_DELAY}秒待機して再試行します...")
                time.sleep(RETRY_DELAY)
            else:
                tqdm.write(f"ERROR: 最大リトライ回数({MAX_RETRIES}回)に達しました。")
                tqdm.write("ヒント: FastAPIサーバー (uvicorn main:app --reload) が起動しているか確認してください。")
                return None
    return None

def summarize_data(full_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLMでの分析用に、取得したデータから主要な情報のみを抽出して軽量化する。
    """
    summary = {}
    for date, day_data in full_data.items():
        summary[date] = {"jra": [], "nar": []}
        for race_type in ["jra", "nar"]:
            for venue in day_data.get(race_type, []):
                summarized_venue = {
                    "venue_name": venue.get("venue_name"),
                    "races": []
                }
                for race in venue.get("races", []):
                    summarized_race = {
                        "id": race.get("id"),
                        "race_number": race.get("race_number"),
                        "race_name": race.get("race_name"),
                        "course_type": race.get("course_type"),
                        "distance": race.get("distance"),
                        "predictions": [
                            {
                                "mark": p.get("mark"),
                                "horse_number": p.get("horse_number"),
                                "horse_name": p.get("horse_name"),
                                "deviation_score": p.get("deviation_score"),
                                # ==============================================================================
                                # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
                                "unpredictable_reason": p.get("unpredictable_reason") # 予測不能理由を追加
                                # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                                # ==============================================================================
                            } for p in race.get("predictions", [])
                        ]
                    }
                    summarized_venue["races"].append(summarized_race)
                summary[date][race_type].append(summarized_venue)
    return summary

def main():
    """
    メイン処理。
    指定された期間のウェブサイトコンテンツ（APIレスポンス）を取得し、
    JSONファイルとして保存する。
    """
    parser = argparse.ArgumentParser(
        description="指定された期間のレース予測データをAPIから取得し、JSONファイルに保存するスクリプト。",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    default_end_date = datetime(2025, 8, 19)
    default_start_date = datetime(2025, 8, 1)

    parser.add_argument(
        '--start',
        default=default_start_date.strftime('%Y-%m-%d'),
        help=f"取得開始日 (YYYY-MM-DD形式)。デフォルト: {default_start_date.strftime('%Y-%m-%d')}"
    )
    parser.add_argument(
        '--end',
        default=default_end_date.strftime('%Y-%m-%d'),
        help=f"取得終了日 (YYYY-MM-DD形式)。デフォルト: {default_end_date.strftime('%Y-%m-%d')}"
    )
    parser.add_argument(
        '--output',
        default='website_analysis_data.json',
        help="出力ファイル名 (JSON形式)。デフォルト: website_analysis_data.json"
    )
    # ★★★ 新機能 ★★★
    parser.add_argument(
        '--summary',
        action='store_true',  # このフラグがあるとTrueになる
        help="LLMでの分析用に、主要な予測情報のみを抽出した軽量なファイルを出力します。"
    )

    args = parser.parse_args()

    try:
        start_date = datetime.strptime(args.start, '%Y-%m-%d').date()
        end_date = datetime.strptime(args.end, '%Y-%m-%d').date()
        if start_date > end_date:
            print("エラー: 開始日は終了日より前の日付にしてください。")
            return
    except ValueError:
        print("エラー: 日付の形式が正しくありません。'YYYY-MM-DD'形式で指定してください。")
        return

    print("=" * 80)
    print("ウェブサイト コンテンツ分析データ生成スクリプト (改良版)")
    print("-" * 80)
    print(f"取得期間: {start_date.strftime('%Y-%m-%d')} から {end_date.strftime('%Y-%m-%d')} まで")
    print(f"出力ファイル: {args.output}")
    print(f"軽量化モード: {'有効' if args.summary else '無効'}")
    print("=" * 80)
    print("\n注意: 実行前に、別ターミナルで FastAPI サーバーを起動してください。")
    print("コマンド: uvicorn main:app --reload\n")

    dates_to_process = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    
    all_website_data = {}
    for target_date in tqdm(dates_to_process, desc="各日付のデータを取得中"):
        date_str = target_date.strftime('%Y-%m-%d')
        data = fetch_data_for_date(date_str)
        if data:
            all_website_data[date_str] = data

    if not all_website_data:
        print("\n取得できたデータがありませんでした。期間やサーバーの状態を確認してください。")
        return
        
    final_data = all_website_data
    if args.summary:
        print("\n--summary オプションが指定されたため、データを軽量化しています...")
        final_data = summarize_data(all_website_data)
        print("軽量化が完了しました。")

    try:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
        print(f"\n処理が完了しました。データが '{os.path.abspath(args.output)}' に保存されました。")
        print(f"合計 {len(all_website_data)} 日分のデータを取得しました。")
    except IOError as e:
        print(f"\nエラー: ファイルの書き込みに失敗しました: {e}")

if __name__ == '__main__':
    main()