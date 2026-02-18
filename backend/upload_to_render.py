"""
ローカルSQLiteからRender PostgreSQLにデータをアップロード

Phase 4: UPSERTでRenderに反映
"""
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import insert
from tqdm import tqdm

sys.path.insert(0, '.')
from database import models

print("=" * 70)
print("ローカルSQLiteからRender PostgreSQLへのアップロード")
print("=" * 70)

# ローカルSQLite接続
local_url = "sqlite:///./keiba.db"
local_engine = create_engine(local_url)
LocalSession = sessionmaker(bind=local_engine)

# Render PostgreSQL接続
render_url = os.getenv("DATABASE_URL")
if not render_url:
    # .envファイルから直接読み込み（コメントアウトされたRender URLを取得）
    with open('.env', 'r') as f:
        for line in f:
            if 'postgresql://' in line and not line.strip().startswith('#'):
                render_url = line.split('=', 1)[1].strip().strip('"')
                break
            elif line.strip().startswith('# DATABASE_URL="postgresql://'):
                # コメントアウトされたRender URLを使用
                render_url = line.split('=', 1)[1].strip().strip('"')
                break

if not render_url or 'sqlite' in render_url.lower():
    print("❌ Render DATABASE_URLが見つかりません")
    print("\n.envファイルのコメントを解除してRender URLを有効にしてください:")
    print('DATABASE_URL="postgresql://keiba_db_user:...')
    sys.exit(1)

print(f"\n[Render接続]")
print(f"  URL: {render_url[:50]}...")

render_engine = create_engine(render_url)
RenderSession = sessionmaker(bind=render_engine)

local_db = LocalSession()
render_db = RenderSession()

try:
    # テーブルごとにUPSERT
    tables = [
        ('races', models.Race, 'id'),
        ('horses', models.Horse, 'id'),
        ('jockeys', models.Jockey, 'id'),
        ('trainers', models.Trainer, 'id'),
        ('results', models.Result, 'id'),
        ('predictions', models.Prediction, 'id'),
        ('matchups', models.Matchup, 'id'),
        ('horse_number_advantages', models.HorseNumberAdvantage, 'id'),
        ('race_returns', models.RaceReturn, 'id'),
        ('sns_posts', models.SnsPost, 'id'),
    ]
    
    print("\n[データアップロード（UPSERT）]")
    
    for table_name, model_class, pk_column in tables:
        print(f"\n  {table_name}:")
        
        # ローカルから全データ取得
        try:
            local_count = local_db.query(model_class).count()
            print(f"    ローカル: {local_count}件")
            
            if local_count == 0:
                print("    ⏭️  スキップ（データなし）")
                continue
            
            # Renderの現在の件数
            render_count_before = render_db.query(model_class).count()
            print(f"    Render（既存）: {render_count_before}件")
            
            # バッチでUPSERT
            batch_size = 500
            offset = 0
            uploaded = 0
            
            with tqdm(total=local_count, desc=f"    {table_name}", unit="件") as pbar:
                while True:
                    batch = local_db.query(model_class).limit(batch_size).offset(offset).all()
                    if not batch:
                        break
                    
                    # データを辞書に変換
                    batch_data = []
                    for item in batch:
                        # SQLAlchemyオブジェクトを辞書に変換
                        item_dict = {}
                        for column in model_class.__table__.columns:
                            value = getattr(item, column.name)
                            item_dict[column.name] = value
                        batch_data.append(item_dict)
                    
                    # PostgreSQLのUPSERT構文
                    stmt = insert(model_class.__table__).values(batch_data)
                    
                    # ON CONFLICT DO UPDATE
                    update_dict = {
                        c.name: stmt.excluded[c.name]
                        for c in model_class.__table__.columns
                        if c.name != pk_column
                    }
                    
                    if update_dict:
                        stmt = stmt.on_conflict_do_update(
                            index_elements=[pk_column],
                            set_=update_dict
                        )
                    else:
                        # 更新するカラムがない場合はDO NOTHING
                        stmt = stmt.on_conflict_do_nothing(
                            index_elements=[pk_column]
                        )
                    
                    render_db.execute(stmt)
                    render_db.commit()
                    
                    uploaded += len(batch)
                    pbar.update(len(batch))
                    offset += batch_size
            
            render_count_after = render_db.query(model_class).count()
            print(f"    ✅ アップロード完了: {uploaded}件処理、Render合計: {render_count_after}件")
            
        except Exception as e:
            print(f"    ❌ エラー: {e}")
            render_db.rollback()
            continue
    
    print("\n" + "=" * 70)
    print("アップロード完了")
    print("=" * 70)
    
    # PostgreSQLシーケンスをリセット（autoincrement IDの同期）
    print("\n[シーケンスリセット]")
    sequences_to_reset = [
        ('predictions', 'predictions_id_seq'),
        ('results', 'results_id_seq'),
        ('matchups', 'matchups_id_seq'),
        ('horse_number_advantages', 'horse_number_advantages_id_seq'),
        ('race_returns', 'race_returns_id_seq'),
        ('sns_posts', 'sns_posts_id_seq'),
    ]
    
    from sqlalchemy import text
    for table_name, seq_name in sequences_to_reset:
        try:
            # 最大IDを取得
            result = render_db.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}"))
            max_id = result.fetchone()[0]
            
            # シーケンスをリセット
            render_db.execute(text(f"SELECT setval('{seq_name}', {max_id + 1}, false)"))
            render_db.commit()
            print(f"  ✅ {table_name}: シーケンスを {max_id + 1} にリセット")
        except Exception as e:
            print(f"  ⚠️ {table_name}: シーケンスリセットをスキップ ({e})")
    
    print("\n✅ アップロードとシーケンスリセットが完了しました")
    
finally:
    local_db.close()
    render_db.close()

print("\n次のステップ:")
print("1. Renderで動作確認")
