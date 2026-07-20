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
| `cost-performance-isr-review.sop.md` | ISR、prefetch、Vercel転送量、Cloud Runコスト | レースページ、トップページ、API応答、キャッシュ、ビルド負荷を扱う前 |
| `sop-authoring.sop.md` | SOPの作成・更新 | 反復手順を新規SOP化、または既存SOPを改訂するとき |

## ルーティングの原則

- 本番DB、広告収益、記事公開、計測、インフラコストに関わる作業では、該当SOPを必ず読む。
- 該当SOPが複数ある場合は、まず `task-intake-and-sop-routing.sop.md` を読み、作業の順番を決める。
- SOPが古い可能性がある場合は、関連するコードと `docs/` の現行仕様を確認してから判断する。
- SOPにない反復手順を見つけた場合は、完了報告でSOP化候補として明示する。
