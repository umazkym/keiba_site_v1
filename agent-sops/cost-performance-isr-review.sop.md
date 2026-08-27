# Cost Performance and ISR Review

## Overview

クラウド費用を調べる、請求額の増減の原因を特定する、Cloud RunやCloudflareのキャッシュ挙動を変える、Next.jsのISR設定を触る、API応答やDBクエリの量を変える、段階公開ゲートの判定を確認する——これらのときに使う手順です。低コスト自動運用が前提のため、表示やAPIの変更は無料枠の消費と実際の請求額に直接効きます。

フロントエンドは2026-08-04にVercelからCloud Run `keiba-frontend-v1` + Cloudflareへ移行済みです。無料枠の判定はCloud RunとCloudflareを対象とし、Vercel固有の指標（Fast Origin Transfer、Function Invocations、ISR Writes）はもう存在しません。費用の実額は`docs/cloud_cost_monitoring_operations.md`の手順で確認します。

## Parameters

- **cost_task** (required): コスト調査、性能改善、ISR変更、API応答変更などの作業内容。
- **affected_routes** (optional): 影響するNext.jsルートまたはAPIエンドポイント。
- **traffic_sensitivity** (optional, default: "auto"): `low`、`medium`、`high`、`auto` のいずれか。

Constraints for parameter acquisition:

- You MUST infer high traffic sensitivity for home page, race date pages, race detail pages, article archive pages, and shared header/footer links.
- You MUST treat prefetch, sitemap, ISR, and API payload changes as cost-sensitive.
- You MUST NOT assume build output comments reflect actual production caching because previous regressions came from routes remaining dynamic.

## Steps

### 1. Locate cost drivers

変更がフロント転送量、Function起動、Cloud Run、DB、APIサイズのどれに影響するか分類します。

**Constraints:**

- You MUST inspect route files under `frontend/app/` when Next.js caching behavior is involved.
- You MUST inspect shared links in header, footer, related content, race navigation, and article cards when prefetch risk is involved.
- You MUST inspect backend endpoint loading strategy when API payload size or DB query count changes.
- You MUST NOT optimize one layer while ignoring another because Vercel, Cloud Run, and DB costs interact through page fetching and API size.

### 2. Preserve ISR behavior

日付ページ・詳細ページのキャッシュ意図を保ちます。

**Constraints:**

- You MUST preserve on-demand ISR behavior for race date and detail pages unless the user explicitly accepts higher Function usage.
- You MUST keep near-current race data fresh enough for repaired data to appear, while allowing older pages longer caching.
- You SHOULD test cache headers or build route classification when changing route-level metadata, search params, or fetch options.
- You MUST NOT add searchParams-driven metadata or dynamic-only reads to ISR routes without considering whether they force dynamic rendering because this has previously turned intended ISR pages into per-request Function work.

### 3. Minimize unnecessary fetching

ページ初期データとClient Component propsを必要最小限にします。

**Constraints:**

- You MUST avoid passing all races and all horses to broad home or listing components when summaries are sufficient.
- レース詳細で同一競馬場の1〜12R導線が必要な場合も、選択レースの完全データへ他レースの`raceNumber`と`href`だけを添え、操作性のために全レース・全馬データをClient Componentへ再送しない。
- You MUST preserve `prefetch={false}` for dynamic race/article links that can trigger expensive route work before user intent.
- You SHOULD avoid sitemap expansion to low-value dynamic detail pages.
- You MUST NOT reintroduce large RSC or HTML payloads for convenience because transfer usage has already hit Vercel Hobby limits.

### 4. Preserve backend efficiency

APIとDBの通信量を抑えます。

**Constraints:**

- You MUST preserve gzip middleware behavior for large API responses.
- You MUST prefer `selectinload` or otherwise bounded ORM loading where joined eager loading can create row multiplication.
- You SHOULD verify response compatibility when changing API serialization.
- You MUST NOT trade a small frontend simplification for large backend payload or DB memory growth without measurement because this project optimizes total free-tier cost, not only component simplicity.

### 5. Validate and report

ビルド、型、サイズ、キャッシュを確認します。

**Constraints:**

- You MUST run `npx tsc --noEmit` for TypeScript route or data-shape changes.
- You SHOULD run `npm run build` for caching, route, sitemap, or payload changes.
- You SHOULD report before/after payload size or route classification when the task is cost-oriented.
- You MUST NOT claim a Vercel or Cloud Run cost reduction without a measurement, build artifact, or clear code-level reason because usage reductions must be distinguishable from traffic fluctuation.

### 6. Aggregate shared Cloud Run capacity

Cloud Runへ複数サービスを置く場合、フロント単体ではなく同一請求先の共有無料枠へ影響するサービスを合算します。

**Constraints:**

- You MUST collect `billable_instance_time`、割当CPU・メモリ、request count、`network/sent_bytes_count`の`kind=internet`、5xx、p95、active instance count for every required service.
- You MUST treat missing metrics for any required service as red rather than estimating zero usage.
- You MUST keep the publication gate limited to new indexable data pages; existing pages and APIs must remain available.
- You MUST use green thresholds below free-tier boundaries and red thresholds before a likely overage: CPU 72,000/120,000秒、メモリ144,000/240,000 GiB秒、request 800,000/1,400,000、internet egress 2/10 GiB.
- You MUST NOT configure a Cloud Run hard spend cap when continuous site availability is the agreed priority because reaching it can pause the frontend and API together.

### 7. Monitor database inter-zone transfer and degrade only archive bot misses

GCE PostgreSQLからCloud Runへのゾーン間転送は、APIの外向き応答が小さくてもORMが日付全体を読み込むと課金要因になります。レース詳細は`GET /api/v1/predictions/detail/{target_date}/{venue_slug}/{race_number}`を使い、対象1レースと同会場のレース番号だけを取得します。

**Constraints:**

- You MUST collect `compute.googleapis.com/instance/network/sent_bytes_count` for `keiba-db` over the latest 24 hours and 7 days.
- You MUST warn at 0.5 GiB/24h and treat 2 GiB/24h or 10 GiB/7d, or missing DB metrics, as red.
- You MUST keep red mode limited to bot cache misses on race archives older than 14 days and unpublished data pages; humans, current races, articles, and already cached stale pages remain available.
- You MUST require 24-hour transfer to fall below 0.5 GiB before automatically leaving red mode; a short-lived drop is not sufficient.
- You MUST keep DB `e2-micro`, internal IP, Direct VPC egress, and IAP-only maintenance access unless an explicit cost review approves a topology change.
- You MUST NOT introduce Cloud SQL, Redis, a VPC Connector, public DB IP, or broad firewall rules as a transfer-cost workaround because they add fixed cost or reopen network exposure without removing the oversized query root cause.

### 8. Confirm billed amounts from the billing report, not from estimates

コストの結論はCloud Monitoringの推定ではなく、課金レポートの確定値で出します。`12_コスト最適化アーキテクチャ.md` §9.7 が「GCE→Cloud Run転送が課金対象か」を推定のまま未確定で残し、§11.4 で課金レポートを読んで初めて決着した経緯があります。

**Constraints:**

- You MUST group the billing report by SKU rather than by service, because a service total hides which mechanism is actually charging.
- You MUST read the daily bar chart for the SKU in question before concluding that a cost is ongoing, because a burst that already ended looks identical to a steady cost in a monthly total.
- You MUST compare the month-end forecast against the running total; a small gap means the spend has already stopped.
- You MUST inspect the whole billing account rather than `keiba-api-project` alone, because the Cloud Run free tier is shared per billing account and another project can consume it.
- You MUST verify that an item documented as 未対応 or 未実施 is still open before acting on it, because this repository's cost documents have repeatedly lagged behind the actual GCP state.
- You MUST read the production capacity verdict from the GitHub Actions artifact `data-page-publication-{run_id}` (`capacity.json` / `summary.md`).
- You MUST NOT run `cloud_run_capacity.py` locally to judge the production gate, because `google-cloud-monitoring` is absent from `backend/requirements.txt` and `backend/requirements-api.txt` and the script degrades to `cloud_run_metrics_available: false`, which `determine_capacity_mode()` reports as red even when production is healthy.
- You MUST NOT apply an untagged-image cleanup policy to `keiba-containers` as a storage countermeasure, because `deploy-frontend-cloud-run.yml` tags every image with the commit SHA and never overwrites a tag, so no untagged image is ever produced; use `keep-recent-N` and `olderThan` conditions instead.
- You MUST NOT set up a BigQuery billing export solely to identify which SKU is charging, because the billing report's SKU grouping combined with the daily chart already answers it.

### 9. Judge Cloud Run health with request-weighted signals

Cloud Monitoring の系列分割とリデューサの選び方で、健全なサービスが「壊れている」ように見えることがある。2026-08-27 に段階公開ゲートが恒久的に閉じた原因はこれだった（`12_コスト最適化アーキテクチャ.md` §12）。

**Constraints:**

- You MUST filter `run.googleapis.com/request_latencies` to `metric.labels.response_code_class="2xx"` when judging user-facing latency, because the metric splits into one time series per response-code class and `REDUCE_PERCENTILE_95` reduces *across series* without weighting by request count, so a handful of timed-out 5xx responses sets the reported p95 for the whole service.
- You MUST treat failures through `error_rate` rather than through latency, because those are separate signals and double-counting failures in latency makes the gate impossible to satisfy.
- You MUST judge instance saturation from the proportion of intervals at the ceiling, not from a single `max()` over the window, because a zero-scale service legitimately touches its ceiling for a few minutes and `max()` keeps the gate closed for the full seven days afterwards.
- You MUST confirm a suspicious metric against Cloud Logging counts before acting on it; a p95 of 32 seconds against 113 5xx responses in 210,000 requests is an aggregation artifact, not an outage.
- You MUST NOT loosen a gate threshold in `determine_capacity_mode()` to work around a stuck metric, because the thresholds encode free-tier boundaries; fix how the value is measured instead and leave the decision logic and its tests untouched.

## Source references

- `AGENTS.md`
- `docs/system-documentation/12_コスト最適化アーキテクチャ.md`
- `docs/system-documentation/04_API仕様.md`
- `frontend/app/page.tsx`
- `frontend/app/races/[date]/page.tsx`
- `frontend/app/races/[date]/[venue]/[race]/page.tsx`
- `backend/main.py`
- `backend/scripts/agents/cloud_run_capacity.py`
- `backend/scripts/agents/data_page_publication.py`
- `docs/cloud_cost_monitoring_operations.md`
- `.github/workflows/deploy-frontend-cloud-run.yml`
- `.github/workflows/keiba-data-page-publication.yml`
- `.github/workflows/keiba-db-egress-guard.yml`
- `.github/workflows/purge-race-cache.yml`

## Examples

### Example Input

```text
cost_task: レース詳細ページの転送量を下げたい
affected_routes: /races/[date]/[venue]/[race]
```

### Example Output

```text
確認:
- 選択レース中心の初期データに絞る
- sitemapとprefetchを確認
- buildでdynamic/ISRの分類を確認
```

## Troubleshooting

### 公開中のデータページが0件で`sitemap-data.xml`が404を返す

`/api/v1/data/sitemap-manifest`が`[]`を返している状態です。`PUBLICATION_DAILY_LIMITS`はredで0件のため、`determine_capacity_mode()`がredを返しているかを先に確認します。redの理由は`p95_latency_ms >= 2500`（7日窓に遅い応答が残っている）か`projected_egress_gib >= 10`（恒久的に閉じる）か`max_instance_saturated`のいずれかです。判定はローカルではなくGitHub Actionsのartifactで読みます。

### `next build`で対象ルートがDynamicになる

metadata、cookies、headers、searchParams、fetch cache、notFoundの扱いを順に確認します。外部API失敗を安易に404へ変換すると、正常キャッシュ維持ができなくなる場合があります。
