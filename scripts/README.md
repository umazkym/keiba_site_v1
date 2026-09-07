# リポジトリ全体の補助ツール

| 場所 | 用途 |
| --- | --- |
| `maintenance/check_repository.cjs` | 機能・Workflow・実行ファイル・アーカイブを照合し一覧を生成 |
| `maintenance/export_source.py` | 環境設定・生成物を除いたソースを`.local/exports/`へ出力 |
| `analysis/` | 手動DB分析と実行例。結果は`.local/analysis/`へ保存 |
| `agent_sops/` | SOP形式検証とエージェント向けSkill変換 |
| `reports/` | 手動レポート作成の補助 |

通常の確認はルートで`npm run repository:check`、一覧更新は`npm run repository:map`です。フロントのnpm依存を先にインストールします。これらはDBに接続せず、記事・SNS・YouTubeへ投稿しません。

競馬データやSNSの業務処理は`backend/scripts/`、記事Writer・Publisherは`frontend/scripts/agents/`にあります。[機能ガイド](../docs/operations/system-guide.md)から辿ってください。
