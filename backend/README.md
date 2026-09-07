# バックエンドと自動処理

| ディレクトリ・入口 | 役割 |
| --- | --- |
| `main.py` → `api/v1/endpoints/` | 本番で登録するFastAPIルータ |
| `crud/` | 読取・集計・API用キャッシュ |
| `database/`、`schemas/`、`core/` | DBモデル、接続、レスポンス型、共通設定 |
| `run_pipeline.py` → `scripts/scraper.py`、`parser.py` | 出馬表・過去成績・確定結果の収集 |
| `scripts/predictor.py`、`db_handler.py`、`scripts/database_loader.py` | 統計スコア計算とDB保存 |
| `scripts/sns_poster.py` | X・Threadsの画像・文章投稿と重複管理 |
| `scripts/youtube_video_pipeline.py`、`scripts/social_video/` | 動画データ整形、描画、権利確認、投稿台帳、YouTube公開管理 |
| `scripts/social_video_distribution.py` | 他SNSへの動画配信。媒体別モードで制御 |
| `scripts/agents/` | 記事企画、データ監査、検索・収益分析、公開容量判定 |
| `fonts/`、`scripts/social_video/assets/` | SNSと動画の描画資産。権利台帳を含む |
| `tests/` | 外部投稿を模擬し、SQLite等で検証する回帰テスト |
| `scripts/maintenance/` | 指定日の予測再生成、全期間の有利不利再計算、DB健全性確認 |
| `scripts/analysis/` | 記事用グラフとAPIデータの手動出力 |

旧`routers/races.py`は登録・importがないことを確認して[アーカイブ](../archive/legacy-tools/backend/routers/races.py.txt)へ移動しました。現行APIは`api/v1/endpoints/`を読んでください。互換・手動保守ファイルは、名前だけで削除しません。

`scripts/maintenance/generate_predictions.py`、`scripts/maintenance/recalculate_advantages.py`、`scripts/repair_mojibake_race_day.py`、`scripts/migrate_*.py`、`scripts/add_*`などは手動保守です。起動するとDB更新が起こり得ます。

## 配布と依存関係

`Dockerfile.api`と`requirements-api.txt`はWeb API用です。APIの5ディレクトリと`main.py`のみをコピーし、Chrome・動画・フォント・試験資産を含めません。`Dockerfile.api.dockerignore`はそのビルドだけの送信範囲を限定します。

`Dockerfile`と`requirements.txt`は収集・計算などのバッチ用です。GitHub Actionsでは通常、このDockerfileを使わずrunnerへ依存関係をインストールしてPythonを実行します。動画のFFmpegと日本語フォント、権利確認済みBGMは動画Workflowが別に準備します。

依存関係は現状、一部を除きバージョン範囲が固定されていません。構成整理と同時に一括更新・固定は行わず、本番と同じPythonで検証してから別途固定するのが適切です。

## テスト

リポジトリルートで実行します。

```powershell
python -m pip install -r backend/requirements.txt pytest pytest-subtests httpx
$env:DATABASE_URL = 'sqlite:///:memory:'
$env:PYTHON_DOTENV_DISABLED = '1'
python -m pytest backend/tests
```

FFmpeg/ffprobeがない環境では実動画エンコードのテストがskipになります。通常の描画・投稿状態・予測・API検証とは分けて結果を確認してください。

本番接続は[DB保守SOP](../agent-sops/production-db-iap-maintenance.sop.md)、機能横断のつながりは[機能ガイド](../docs/operations/system-guide.md)を参照してください。
