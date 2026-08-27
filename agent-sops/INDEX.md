# Agent SOP Index

この索引は、AIエージェントが必要な手順だけを素早く選ぶための入口です。作業前にこの表を見て、該当するSOPだけを読んでください。

| SOP | 主な対象 | 読むタイミング |
| --- | --- | --- |
| `task-intake-and-sop-routing.sop.md` | 依頼受付、作業分類、SOP選択 | 複数領域にまたがる依頼、調査から実装まで含む依頼 |
| `frontend-build-release-verification.sop.md` | Next.js、React、Tailwind、デザイン監査、広告表示を含むUI変更 | `frontend/`、`frontend/components/`、`frontend/app/`、`frontend/lib/`、`DESIGN.md` を触る前 |
| `article-quality-gate.sop.md` | 記事生成、記事編集、Writer/Editor/SEO Checker | `frontend/scripts/agents/`、`backend/scripts/agents/`、`frontend/content/articles/` を触る前 |
| `monetization-affiliate-ads-ux.sop.md` | AdSense、AffiliateSlot、楽天競馬導線、PR表記 | 広告枠、アフィリエイト、レースページ/記事ページの収益導線を変える前 |
| `production-db-iap-maintenance.sop.md` | 本番DB、IAPトンネル、GitHub ActionsのDB接続 | `DATABASE_URL`、DB保守、`.github/actions/setup-iap-db`、DB系workflowを扱う前 |
| `analytics-clarity-ga4-audit.sop.md` | GA4、Clarity、収益ファネル、イベント設計 | 計測イベント、Clarity監査、収益ファネル分析を扱う前 |
| `cost-performance-isr-review.sop.md` | ISR、prefetch、Cloud Run/Cloudflareのコスト、請求実額の確定 | レースページ、トップページ、API応答、キャッシュ、ビルド負荷、課金調査を扱う前 |
| `cloud-run-cloudflare-migration.sop.md` | Vercel停止、Cloud Runフロント、Cloudflare、DNS切替、段階公開 | フロントホスティング移行、ドメイン切替、CDN/WAF、検索公開容量を扱う前 |
| `sop-authoring.sop.md` | SOPの作成・更新 | 反復手順を新規SOP化、または既存SOPを改訂するとき |
| `social-video-multiplatform-publishing.sop.md` | Threads、Instagram、Facebook、TikTok、Pinterest、Blueskyの動画投稿 | SNS動画の追加・モード変更・認証・重複・計測を扱う前 |
| `youtube-daily-publishing-recovery.sop.md` | YouTube日次投稿、OAuth失効、部分投稿、再実行、公開状態同期 | YouTube Workflowの変更、投稿失敗の復旧、token再発行を扱う前 |

## ルーティングの原則

- 本番DB、広告収益、記事公開、計測、インフラコストに関わる作業では、該当SOPを必ず読む。
- 該当SOPが複数ある場合は、まず `task-intake-and-sop-routing.sop.md` を読み、作業の順番を決める。
- SOPが古い可能性がある場合は、関連するコードと `docs/` の現行仕様を確認してから判断する。
- SOPにない反復手順を見つけた場合は、完了報告でSOP化候補として明示する。
