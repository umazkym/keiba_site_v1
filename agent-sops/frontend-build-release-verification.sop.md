# Frontend Build and Release Verification

## Overview

このSOPは、Next.js/React/Tailwindを含むフロントエンド変更で、表示崩れ、型エラー、広告CLS、過剰なプリフェッチ、計測イベントの混線を防ぐための確認手順です。

## Parameters

- **change_summary** (required): 変更内容の要約。
- **changed_paths** (required): 変更予定または変更済みのファイル一覧。
- **verification_depth** (optional, default: "risk_based"): `quick`、`risk_based`、`full` のいずれか。

Constraints for parameter acquisition:

- You MUST infer `changed_paths` from the worktree when the user does not provide it.
- You MUST raise verification depth when changes touch race pages, article pages, ads, affiliate links, middleware, sitemap, or data fetching.
- You MUST NOT skip build-level validation for broad frontend changes because small JSX or App Router mistakes can break production pages.

## Steps

### 1. Identify affected surfaces

変更がどのページとユーザー行動に影響するか確認します。

**Constraints:**

- You MUST check whether files under `frontend/app/`, `frontend/components/`, `frontend/lib/`, `frontend/middleware.ts`, or `frontend/scripts/agents/` are affected.
- You MUST identify whether the change affects mobile race browsing, article reading, ad display, affiliate disclosure, analytics, or ISR.
- You SHOULD inspect nearby components before changing layout classes.
- You MUST NOT assume a component is isolated just because only one file changed because shared components are heavily reused in UMA-FREE.

### 2. Preserve UX and revenue guardrails

競馬ファンがレース情報を確認する導線を邪魔しないように、表示密度と広告配置を確認します。

**Constraints:**

- You MUST keep mobile layout compact and avoid unnecessary vertical whitespace.
- You MUST keep ad and affiliate blocks out of sticky race selectors, prediction table internals, and dense operation areas.
- You MUST preserve stable dimensions for ad slots and repeated race UI elements to reduce layout shift.
- You MUST NOT add flashy animations, excessive emoji, or marketing-like copy because the site depends on natural media quality and AdSense trust.

### 3. Preserve routing and cache behavior

Next.js App Router、ISR、prefetchの意図を確認します。

**Constraints:**

- You MUST preserve `prefetch={false}` on dynamic race and article links unless there is a measured reason to change it.
- You MUST check `revalidate`, `dynamicParams`, and fetch cache changes when touching `frontend/app/races/` or the home page.
- You MUST NOT turn race date/detail routes back into always-dynamic pages without documenting the cost and cache impact because these routes previously caused excess Function usage and cache misses.

### 4. Validate locally

変更範囲に応じて型検査とビルドを実行します。

**Constraints:**

- You MUST run `npx tsc --noEmit` from `frontend/` for TypeScript changes.
- You SHOULD run `npm run build` from `frontend/` for App Router, middleware, sitemap, ad, or page-level changes.
- You SHOULD run `npm run article:validate-links` when article rendering or content links are affected.
- You MUST report validation commands that could not be run and why.

### 5. Review final user-visible behavior

完了前に、表示・導線・計測の意図が保たれているか確認します。

**Constraints:**

- You MUST verify that affiliate links retain PR disclosure and sponsored/nofollow/noopener/noreferrer rel values when touched.
- You MUST verify that GA4/Clarity event names remain distinct from real `page_view` when touching analytics.
- You SHOULD inspect likely mobile breakpoints when layout risk is meaningful.
- You MUST NOT claim visual verification if no browser or screenshot check was performed because build success alone does not prove mobile layout or ad spacing is correct.

## Source references

- `AGENTS.md`
- `frontend/package.json`
- `docs/analytics_measurement_plan.md`
- `docs/clarity_completeness_review_20260621.md`
- `docs/hydration_and_ad_scroll_fix_walkthrough.md`

## Examples

### Example Input

```text
change_summary: レースページのアフィリエイト枠位置を調整
changed_paths: frontend/components/RacePageClient.tsx, frontend/components/AffiliateSlot.tsx
```

### Example Output

```text
確認:
- RaceTabs周辺の操作UIに広告を入れていない
- AffiliateSlotのPR表記とrelを維持
- npx tsc --noEmit と npm run build を実行
```

## Troubleshooting

### `npm run build` が既存警告で失敗する

失敗箇所が今回変更と関係するかを分けて報告し、今回変更由来なら修正します。無関係な既存問題は勝手に大きく直さず、ユーザーに残リスクとして伝えます。
