# 公開サイトと記事生成

全体の入口は[ルートREADME](../README.md)、処理の流れは[機能ガイド](../docs/operations/system-guide.md)、公開URLは[自動生成一覧](../docs/operations/automation-map.md)を参照してください。本番はCloud Run + Cloudflareで、`Dockerfile`のstandalone出力を配布します。

| 場所 | 内容 |
| --- | --- |
| `app/` | Next.js App RouterのページとRoute Handler |
| `components/`、`hooks/` | 共通表示、広告・PR、計測、端末内操作 |
| `lib/` | APIアクセス、記事読込、URL・SEO、計測、マイデータ |
| `content/articles/` | 公開Markdown。URLと記事メタデータを維持する |
| `content/reference/` | 重賞の識別・代表URL・301転送・検索需要の台帳 |
| `content/templates/` | 記事生成テンプレート |
| `scripts/agents/` | Writer・Editor・品質ゲート・Publisher・記事監査 |
| `scripts/` | 広告リリース検証、表示監査、保守スクリプト |
| `public/` | 公開画像・PWA資産。ファイルパスはURLになる |

`scripts/agents/test_pipeline.ts`は名称にtestを含みますが、**本番の記事生成の入口**です。`npm run article:pipeline`や`article:publish`を一般のテストとして起動しないでください。

開発は`npm ci` → `npm run dev`、配布確認は`npm run build`です。ビルドには広告・アフィリエイトのリリース検査も含まれます。

`.env.local`は端末の設定、Workflowが作る`.env.production`は公開用設定です。秘密のAPIキーを`NEXT_PUBLIC_*`へ設定しません。

公開URL・ISR・prefetch・広告枠・お気に入りの保存キーは、ディレクトリ整理を理由に変更しません。表示規則は[DESIGN.md](../DESIGN.md)、変更後の確認は[フロントSOP](../agent-sops/frontend-build-release-verification.sop.md)を参照してください。
