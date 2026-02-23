import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# プロジェクトルートディレクトリをPythonパスに追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from database import models
from scripts import llm_generator

# .envファイルを読み込む
load_dotenv()

def main():
    target_date_str = input("生成したいレース日付をYYYY-MM-DD形式で入力してください (例: 2026-02-21): ")
    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        print("日付の形式が正しくありません。YYYY-MM-DD形式で入力してください。")
        return

    db = SessionLocal()
    try:
        # 指定日のレースを取得
        races = db.query(models.Race).filter(models.Race.race_date == target_date).all()
        if not races:
            print(f"{target_date} のレースが見つかりません。")
            return

        print(f"{target_date} のレース全 {len(races)} 件についてAIテキスト生成を開始します...")
        print(f"※Gemini APIキー: {'設定済み' if os.getenv('GEMINI_API_KEY') else '未設定（エラーになります）'}")
        
        for race in races:
            print(f"[{race.venue_name}{race.race_number}R] {race.race_name} の生成処理中...")
            success = llm_generator.generate_and_save_race_analysis(db, race.id)
            if success:
                print(" -> 完了")
            else:
                print(" -> スキップ（既に生成済み）、または失敗")
                
        print("全レースの処理が完了しました。")
    finally:
        db.close()

if __name__ == "__main__":
    main()
