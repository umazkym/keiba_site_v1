# C:\Users\tnszk\program\keiba-ai-site\backend\run_pipeline.py
import datetime
from database.database import SessionLocal
from scripts import scraper, parser, database_loader, predictor

def run_prediction_pipeline_for_date(target_date: datetime.date):
    """
    指定された日付の予測を生成する一連の処理を実行する。
    """
    print(f"--- Starting Pipeline for {target_date.strftime('%Y-%m-%d')} ---")
    db = SessionLocal()
    
    # --- 1. 翌日開催のレースIDリストを取得 ---
    target_date_str = target_date.strftime('%Y%m%d')
    all_race_ids = []
    
    # JRA
    html_central = scraper.get_race_list_html_central(target_date_str, force_download=True)
    if html_central:
        all_race_ids.extend(parser.parse_race_ids_from_list(html_central))
    # NAR
    html_nar = scraper.get_race_list_html_nar(target_date_str, force_download=True)
    if html_nar:
        all_race_ids.extend(parser.parse_race_ids_from_list(html_nar))
    
    print(f"Found {len(all_race_ids)} races for tomorrow.")

    # --- 2. 各レースの出走馬情報を取得し、予測を計算・保存 ---
    for race_id in all_race_ids:
        print(f"Processing Race ID: {race_id}")
        is_nar = race_id.startswith('N') # 仮の判定ロジック
        
        # 2a. レース情報と出走馬情報を取得
        race_html = scraper.get_race_result_html(race_id, is_nar=is_nar, force_download=True) # 出馬表ページの方が良い場合もある
        if not race_html:
            continue
            
        # [重要] ここでは出馬表を解析するロジックが必要。
        # 今回はダミーデータで代替する。
        # parsed_race_data = parser.parse_shutsuba_hyo(race_html)
        # horses_in_race = parsed_race_data['horses']
        # race_info = parsed_race_data['race_info']
        
        # --- ダミーデータ ---
        race_info_obj = models.Race(id=race_id, race_date=target_date, race_type="中央", venue_name="東京") # 仮
        horses_in_race = [
            {'id': '2021101234', 'name': 'ウマ1', 'number': 1},
            {'id': '2021105678', 'name': 'ウマ2', 'number': 2},
            # ... 18頭分
        ]
        # --- ダミーデータここまで ---

        # 2b. 予測計算
        predictions = predictor.calculate_deviation_score(db, race_info_obj, horses_in_race)

        # 2c. DBへ保存
        if predictions:
            prediction_data_to_save = {
                "race_id": race_id,
                "predictions": predictions
            }
            database_loader.save_prediction(db, prediction_data_to_save)
            print(f"Saved predictions for race {race_id}")

    db.close()
    print(f"--- Pipeline Finished for {target_date.strftime('%Y-%m-%d')} ---")


if __name__ == "__main__":
    # 実行日の翌日の予測を作成
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    
    # [要件] 過去データの収集も必要
    # ここに、過去2年分のレース結果を収集するロジックを実装する
    # 例:
    # two_years_ago = datetime.date.today() - datetime.timedelta(days=2*365)
    # for day in daterange(two_years_ago, datetime.date.today()):
    #     scrape_and_save_past_results(day)
    
    run_prediction_pipeline_for_date(tomorrow)