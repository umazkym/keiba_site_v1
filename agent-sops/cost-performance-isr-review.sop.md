# Cost Performance and ISR Review

## Overview

このSOPは、Vercel Hobby使用量、Fast Origin Transfer、Function Invocations、Cloud Run無料枠、Next.js ISR、API圧縮、prefetch抑制を扱うときの確認手順です。UMA-FREEは低コスト自動運用が前提のため、ページ表示やAPI変更は収益だけでなく無料枠消費にも影響します。

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

## Source references

- `AGENTS.md`
- `docs/system-documentation/12_コスト最適化アーキテクチャ.md`
- `docs/system-documentation/04_API仕様.md`
- `frontend/app/page.tsx`
- `frontend/app/races/[date]/page.tsx`
- `frontend/app/races/[date]/[venue]/[race]/page.tsx`
- `backend/main.py`

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

### `next build`で対象ルートがDynamicになる

metadata、cookies、headers、searchParams、fetch cache、notFoundの扱いを順に確認します。外部API失敗を安易に404へ変換すると、正常キャッシュ維持ができなくなる場合があります。
