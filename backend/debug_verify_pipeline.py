"""
パイプライン実行後のDB状態確認スクリプト。
1. 特定の馬のDB内成績件数（パイプライン前後での変化を確認）
2. キャッシュファイルの存在と日時
3. 1頭分のスクレイピング→パース結果を直接表示（DBに保存せず検証のみ）
"""
import os
import sys
import datetime
from database.database import SessionLocal
from database import models
from sqlalchemy import func
from scripts import scraper, parser

def main():
    db = SessionLocal()
    try:
        # ==== 検証1: サンプル馬のDB内成績件数 ====
        print("=" * 70)
        print("【検証1】サンプル馬のDB内成績件数")
        print("=" * 70)
        
        sample_horses = [
            ("2022101496", "トラストユー"),
            ("2022102990", "ベイストラトラ"),
            ("2021103470", "ホウオウシーザー"),
            ("2021102790", "カラーオブワンダー"),
            ("2022103988", "カフジキームン"),
        ]
        
        for horse_id, horse_name in sample_horses:
            total = db.query(func.count(models.Result.id)).filter(models.Result.horse_id == horse_id).scalar()
            valid = db.query(func.count(models.Result.id)).filter(
                models.Result.horse_id == horse_id,
                models.Result.finish_time_sec.isnot(None)
            ).scalar()
            
            # キャッシュファイル確認
            cache_path = os.path.join("data", "html_cache", "horse", f"{horse_id}.bin")
            cache_info = "なし"
            if os.path.exists(cache_path):
                mtime = datetime.datetime.fromtimestamp(os.path.getmtime(cache_path))
                cache_info = f"{mtime} ({os.path.getsize(cache_path)} bytes)"
            
            print(f"\n{horse_name} (ID: {horse_id}):")
            print(f"  DB成績: 全{total}件 (finish_time有: {valid}件)")
            print(f"  キャッシュ: {cache_info}")

        # ==== 検証2: 1頭分のスクレイピング→パース検証（DBに保存しない）====
        print("\n" + "=" * 70)
        print("【検証2】カラーオブワンダー(2021102790)のスクレイピング→パース結果")
        print("=" * 70)
        
        test_id = "2021102790"
        html, was_scraped = scraper.get_horse_page_html(test_id, force_download=True)
        
        if html:
            print(f"HTML取得: 成功 ({len(html)} bytes, was_scraped={was_scraped})")
            parsed = parser.parse_horse_results_page(html)
            
            if parsed:
                print(f"馬名: {parsed.get('horse_name')}")
                results = parsed.get('results', [])
                print(f"パース結果数: {len(results)}件")
                
                if results:
                    print("\nパースされた全成績:")
                    for i, r in enumerate(results):
                        race_date = r.get('race_date', '?')
                        venue = r.get('venue_name', '?')
                        race_name = r.get('race_name', '?')
                        finish = r.get('finish_time_sec')
                        finish_str = f"{finish}秒" if finish else "NULL"
                        race_id = r.get('race_id', '?')
                        print(f"  {i+1}. {race_date} {venue} {race_name} タイム:{finish_str} (race_id:{race_id})")
                    
                    # 1年以内のものがあるか確認
                    one_year_ago = datetime.date.today() - datetime.timedelta(days=365)
                    recent = [r for r in results if r.get('race_date') and r['race_date'] > one_year_ago and r.get('finish_time_sec')]
                    print(f"\n1年以内でfins_time_sec非NULL: {len(recent)}件")
                    for r in recent:
                        print(f"  {r.get('race_date')} {r.get('venue_name')} タイム:{r.get('finish_time_sec')}秒")
                else:
                    print("パース結果が空です！")
            else:
                print("パース失敗: parse_horse_results_page が None を返しました")
        else:
            print("HTML取得失敗")

        # ==== 検証3: 直近予測サマリー ====
        print("\n" + "=" * 70)
        print("【検証3】直近の予測サマリー")
        print("=" * 70)
        
        from sqlalchemy import desc
        dates = db.query(models.Race.race_date).distinct()\
            .order_by(desc(models.Race.race_date)).limit(5).all()
        
        for (d,) in dates:
            race_count = db.query(func.count(func.distinct(models.Prediction.race_id))).join(
                models.Race, models.Prediction.race_id == models.Race.id
            ).filter(models.Race.race_date == d).scalar()
            
            total = db.query(func.count(models.Prediction.id)).join(
                models.Race, models.Prediction.race_id == models.Race.id
            ).filter(models.Race.race_date == d).scalar()
            
            with_dev = db.query(func.count(models.Prediction.id)).join(
                models.Race, models.Prediction.race_id == models.Race.id
            ).filter(
                models.Race.race_date == d,
                models.Prediction.deviation_score.isnot(None)
            ).scalar()
            
            rate = (with_dev / total * 100) if total > 0 else 0
            print(f"  {d}: {race_count}レース {total}予測 偏差値有:{with_dev} ({rate:.1f}%)")

    finally:
        db.close()

if __name__ == "__main__":
    main()
