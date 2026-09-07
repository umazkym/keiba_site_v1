# UMA-FREE

中央・地方競馬のデータ収集、統計計算、無料の閲覧サイト、記事生成、SNS・YouTube配信をまとめたリポジトリです。

初めて見る方は[機能とデータの流れ](docs/operations/system-guide.md)から読むと、サイト外の自動処理も含めて把握できます。[自動処理・公開ルート一覧](docs/operations/automation-map.md)は実際のファイルから生成しています。

## ディレクトリの役割

| 場所 | 何があるか |
| --- | --- |
| [frontend/](frontend/README.md) | Next.jsの公開ページ・部品・記事本文・記事生成エージェント |
| [backend/](backend/README.md) | FastAPI、DBモデル、収集・予測・SNS・動画・分析ジョブ |
| [.github/](.github/README.md) | 自動実行の時刻・起動条件・権限・成果物の保存設定 |
| [docs/](docs/README.md) | 現行仕様、運用手順、調査記録。まず索引から読む |
| [agent-sops/](agent-sops/INDEX.md) | 分野ごとの保守手順。作業に関係するものを選ぶ |
| [scripts/](scripts/README.md) | 構成検査・SOP検証・手動レポート補助 |
| [archive/](archive/README.md) | 未使用の旧診断・試作・当時の資料。実運用から分離 |
| `data/`、`sns_images_dist/`、`youtube_video_dist/` | 処理中に生成するキャッシュ・画像・動画。Git管理外 |
| `.local/`、`.tmp/`、`.runtime/` | 手動分析・ソース出力、今回の検証作業、検証用Python環境。Git管理外 |

手動分析は`scripts/analysis/`、DB保守は`backend/scripts/maintenance/`、グラフ・APIデータ出力は`backend/scripts/analysis/`にまとめています。`scripts/analysis/run_analysis_examples.py`はDB付きの手動実行例で、自動テストではありません。`scripts/maintenance/export_source.py`はソースを`.local/exports/`へ出力します。

中央・地方の重賞一覧・コース一覧・ジョッキーリーディングTXTは`data/reference/`へ集約し、記事企画の読み込み先も更新しました。Git管理外の補助資料です。GitHubでも使用する主資料は[参照データ要約](docs/content/reference_data_summary.md)です。

詳しい配置と移動先は[ディレクトリ案内](docs/operations/directory-layout.md)を参照してください。

## ローカル開発

Python 3.11以上とNode.js/npmを使用します。本番の動画WorkflowとDockerのバージョンは各定義を確認してください。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cd backend
$env:DATABASE_URL = 'sqlite:///./data/keiba.db'
$env:ALLOW_SCHEMA_CREATE = 'true'
python -m uvicorn main:app --reload
```

別ターミナルでフロントを起動します。

```powershell
cd frontend
npm ci
npm run dev
```

`http://localhost:3000`から確認できます。開発時のAPI既定値は`http://127.0.0.1:8000`です。新しいSQLiteには本番データがないため、レースが空でも起動異常とは限りません。既存の`.env`を使う際は接続先を確認してから起動してください。

## 変更後の確認

ルートから`npm run repository:check`を実行すると、全Workflowの登録、実行ファイル、作業ディレクトリ、アーカイブの保持、自動生成一覧との一致を検査します。Workflowやページを追加したら[機能台帳](docs/operations/features.json)を更新し、`npm run repository:map`で一覧を再生成します。フロント依存のインストールが必要です。

Pythonのテストは`python -m pytest backend/tests`、フロントの配布検査は`cd frontend`の後に`npm run build`です。`pytest.ini`は通常のテスト探索を`backend/tests`へ限定し、昔の試験スクリプトの誤実行を防ぎます。追加依存は[backend/README.md](backend/README.md)を参照してください。

PowerShellで`npm.ps1`の実行が禁止されている環境では`npm.cmd`を使用できます。`next dev`と`next build`、型検査は同時に実行しません。

## 本番との境界

フロント・APIはCloud Run、CDNはCloudflare、DBはGCE上のPostgreSQLです。保守用DB接続はIAPのみを使います。定期処理や記事Publisherの実行は、DB更新・課金API呼び出し・外部投稿につながります。

コミット・push・デプロイはユーザーが行います。今回の[整理と調査の記録](docs/operations/repository-review-2026-09-07.md)には、確認済みの範囲と残る検証事項を記載しています。
