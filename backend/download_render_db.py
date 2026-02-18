"""
RenderデータベースからローカルSQLiteにデータをダウンロード

Phase 1: Renderから既存データを取得してローカルに保存
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from tqdm import tqdm

# プロジェクトパスを追加
sys.path.insert(0, '.')

from database.database import Base
from database import models

print("=" * 70)
print("RenderデータベースからローカルSQLiteへのダウンロード")
print("=" * 70)

# Render PostgreSQL接続（.envから読み込み）
render_url = os.getenv("DATABASE_URL")
if not render_url:
    # .envファイルから直接読み込み
    with open('.env', 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                render_url = line.split('=', 1)[1].strip().strip('"')
                break

if not render_url:
    print("❌ DATABASE_URLが見つかりません")
    sys.exit(1)

print(f"\n[Render接続]")
print(f"  URL: {render_url[:50]}...")

render_engine = create_engine(render_url)

# ローカルSQLite接続
local_url = "sqlite:///./keiba.db"
local_engine = create_engine(local_url)

print(f"\n[ローカルSQLite]")
print(f"  URL: {local_url}")

# テーブル作成
print("\n[テーブル作成]")
Base.metadata.create_all(bind=local_engine)
print("  ✅ テーブル作成完了")

# セッション作成
RenderSession = sessionmaker(bind=render_engine)
LocalSession = sessionmaker(bind=local_engine)

render_db = RenderSession()
local_db = LocalSession()

try:
    # テーブルごとにデータをコピー
    tables = [
        ('races', models.Race),
        ('horses', models.Horse),
        ('jockeys', models.Jockey),
        ('trainers', models.Trainer),
        ('results', models.Result),
        ('predictions', models.Prediction),
        ('matchups', models.Matchup),
        ('horse_number_advantages', models.HorseNumberAdvantage),
        ('race_returns', models.RaceReturn),
        ('sns_posts', models.SnsPost),
    ]
    
    print("\n[データコピー]")
    
    for table_name, model_class in tables:
        print(f"\n  {table_name}:")
        
        # Renderから全データ取得
        try:
            render_count = render_db.query(model_class).count()
            print(f"    Render: {render_count}件")
            
            if render_count == 0:
                print("    ⏭️  スキップ（データなし）")
                continue
            
            # ローカルの既存データ確認
            local_count_before = local_db.query(model_class).count()
            print(f"    ローカル（既存）: {local_count_before}件")
            
            # バッチでコピー
            batch_size = 1000
            offset = 0
            copied = 0
            
            with tqdm(total=render_count, desc=f"    {table_name}", unit="件") as pbar:
                while True:
                    batch = render_db.query(model_class).limit(batch_size).offset(offset).all()
                    if not batch:
                        break
                    
                    for item in batch:
                        # mergeで重複回避（既存IDは更新、新規IDは挿入）
                        local_db.merge(item)
                        copied += 1
                    
                    local_db.commit()
                    pbar.update(len(batch))
                    offset += batch_size
            
            local_count_after = local_db.query(model_class).count()
            print(f"    ✅ コピー完了: {copied}件処理、ローカル合計: {local_count_after}件")
            
        except Exception as e:
            print(f"    ❌ エラー: {e}")
            continue
    
    print("\n" + "=" * 70)
    print("ダウンロード完了")
    print("=" * 70)
    
    # 既存レースIDのリストを保存（バックフィル時のスキップ用）
    existing_race_ids = [r.id for r in local_db.query(models.Race.id).all()]
    print(f"\n既存レースID数: {len(existing_race_ids)}")
    
    # ファイルに保存
    with open('existing_race_ids.txt', 'w') as f:
        f.write('\n'.join(existing_race_ids))
    print("  ✅ existing_race_ids.txt に保存しました")
    
finally:
    render_db.close()
    local_db.close()

print("\n次のステップ:")
print("1. .env のDATABASE_URLをローカルSQLiteに変更")
print("2. バックフィル実行")
