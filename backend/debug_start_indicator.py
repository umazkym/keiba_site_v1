import datetime
import pandas as pd
from scripts import scraper, parser, predictor

# --------------------------------------------------------------------------
# ▼▼▼ ここに確認したいレースIDを追加・編集してください ▼▼▼
# JRAとNARのレースIDを混在させることができます。
TARGET_RACE_IDS = [
    "202505030611",  # JRAのレース例 (宝塚記念)
    "202555062209",  # NARのレース例 (佐賀競馬)
    "202509030611",  # 別のJRAレース例 (スプリンターズS)
]
# --------------------------------------------------------------------------


def debug_race(race_id: str):
    """
    指定された単一のレースIDに対して、AIスタート位置予測の計算をデバッグ実行する。
    """
    print(f"\n{'='*25} レースID: {race_id} の検証を開始 {'='*25}")

    try:
        # 地方競馬(NAR)か中央競馬(JRA)かを判定
        # (race_idの5,6桁目が30以上なら地方競馬)
        is_nar = int(race_id[4:6]) >= 30
        race_type = "地方(NAR)" if is_nar else "中央(JRA)"
        print(f"レース種別: {race_type}")

        # 1. 出馬表HTMLを取得・解析して出走馬リストを取得
        shutuba_html = scraper.get_shutuba_html(race_id, is_nar=is_nar, force_download=True)
        if not shutuba_html:
            print(f"[エラー] 出馬表HTMLの取得に失敗しました。")
            return

        shutuba_data = parser.parse_shutuba_page(shutuba_html, race_id, is_nar)
        if not shutuba_data or not shutuba_data.get('horses'):
            print(f"[エラー] 出馬表の解析に失敗しました。")
            return
            
        horses = shutuba_data['horses']
        print(f"{len(horses)}頭の出走馬情報を取得しました。")

        # 2. 各馬の1Cスタート指標の元となるZ-scoreを計算
        print("各馬の過去成績を分析し、1Cスタート指標を計算中...")
        results = []
        # predictorに渡す日付は未来の日付であれば問題ないため本日日付を使用
        race_date = datetime.date.today() 

        for horse in horses:
            horse_id = horse.get('horse_id')
            if not horse_id:
                continue

            # 前回修正したpredictorの計算ロジックを直接呼び出す
            z_score = predictor._compute_1c_indicator_from_horse_page(horse_id, race_date)
            
            results.append({
                'horse_number': horse.get('horse_number'),
                'horse_name': horse.get('horse_name'),
                'z_score': z_score
            })
            print(f"  -> {horse.get('horse_name')}: Z-score = {z_score}")

        # 3. Z-scoreを1-100の指標にスケーリング
        df = pd.DataFrame(results)
        valid_scores = df['z_score'].dropna()

        if len(valid_scores) > 1:
            min_val, max_val = valid_scores.min(), valid_scores.max()
            # 全てのZ-scoreが同じ値だった場合の分岐
            if abs(max_val - min_val) < 1e-9:
                df['indicator'] = 50.0
            else:
                # Z-scoreを1から100の範囲に正規化
                df['indicator'] = df['z_score'].apply(
                    lambda z: 1.0 + (z - min_val) * 99 / (max_val - min_val) if pd.notna(z) else None
                )
        else:
            df['indicator'] = None

        # 4. 結果を表示
        print("\n--- 計算結果 ---")
        df_sorted = df.sort_values(by='horse_number')
        for _, row in df_sorted.iterrows():
            indicator_str = f"{row['indicator']:.2f}" if pd.notna(row['indicator']) else "計算不可"
            print(f"  馬番 {str(row['horse_number']):>2}: {row['horse_name']:<15} -> AIスタート位置予測: {indicator_str}")

    except Exception as e:
        import traceback
        print(f"[致命的エラー] 処理中に予期せぬエラーが発生しました: {e}")
        traceback.print_exc()
    finally:
        print(f"{'='*65}")

if __name__ == '__main__':
    print("--- AIスタート位置予測 デバッグスクリプト開始 ---")
    for r_id in TARGET_RACE_IDS:
        debug_race(r_id)
    print("\n--- 全ての処理が完了しました ---")