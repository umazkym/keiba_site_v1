# Frontend Build and Release Verification

## Overview

このSOPは、Next.js/React/Tailwindを含むフロントエンド変更で、表示崩れ、型エラー、広告CLS、過剰なプリフェッチ、計測イベントの混線、UI反パターンの再発を防ぐための確認手順です。

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

### 3. Apply the design system

`DESIGN.md`を読み、画面の主役、色の役割、文字、角丸、影、動きを既存のUMA-FREE設計へ合わせます。

**Constraints:**

- You MUST define one primary information target for each changed page and keep the order `first see -> compare -> act` clear.
- You MUST use Navy for structure, Blue for actions/selections, Amber for AI analysis, Rose for Rakuten Keiba PR, and domain colors only for their documented meanings.
- You MUST keep normal radii at 8-12px, reserve pills for tags or states, and reserve broad shadows for sticky UI, menus, and overlays.
- You MUST use explicit color, background, border, opacity transitions instead of `transition-all`, and respect reduced motion and reduced transparency preferences.
- You MUST test real operational edges such as long horse names, 18 runners, missing scores, zero/many grade races, long article titles, wide tables, and unfilled ads when they intersect the changed surface.
- You MUST NOT add hover lift, image zoom, press scaling, decorative glass, or decorative gradients because those patterns weaken information hierarchy and make the UI look templated.

### 4. Preserve routing and cache behavior

Next.js App Router、ISR、prefetchの意図を確認します。

**Constraints:**

- You MUST preserve `prefetch={false}` on dynamic race and article links unless there is a measured reason to change it.
- You MUST check `revalidate`, `dynamicParams`, and fetch cache changes when touching `frontend/app/races/` or the home page.
- You MUST NOT turn race date/detail routes back into always-dynamic pages without documenting the cost and cache impact because these routes previously caused excess Function usage and cache misses.

### 5. Validate locally

変更範囲に応じて型検査とビルドを実行します。

**Constraints:**

- You MUST run `npx tsc --noEmit` from `frontend/` for TypeScript changes.
- You MUST run `npm run design:audit` from `frontend/` when changing the home, race, article, header, global CSS, or shared design rules.
- You SHOULD run `npm run build` from `frontend/` for App Router, middleware, sitemap, ad, or page-level changes.
- You SHOULD run `npm run article:validate-links` when article rendering or content links are affected.
- You MUST NOT run `next dev`, `next build`, and `tsc` concurrently because they can replace `.next/types` while another process reads it and cause misleading `TS6053` missing-file failures.
- You MUST NOT raise a `design:audit` allowance without documenting the narrow exception in the audit script because broad exceptions make the regression gate ineffective.
- You MUST report validation commands that could not be run and why.

### 6. Review final user-visible behavior

完了前に、表示・導線・計測の意図が保たれているか確認します。

**Constraints:**

- You MUST verify that affiliate links retain PR disclosure and sponsored/nofollow/noopener/noreferrer rel values when touched.
- You MUST verify that GA4/Clarity event names remain distinct from real `page_view` when touching analytics.
- You SHOULD inspect likely mobile breakpoints when layout risk is meaningful.
- You SHOULD inspect 375px, 390px, 768px, 1024px, and 1440px for broad page-level changes, with 390x844 used to confirm race-table reachability.
- You SHOULD measure fixed race UI after changes: the mobile race selector should remain within 56px excluding the site header, the closed mobile article-theme bar within 44px, and the article switcher within 52px.
- You MUST NOT claim visual verification if no browser or screenshot check was performed because build success alone does not prove mobile layout or ad spacing is correct.

## Source references

- `AGENTS.md`
- `DESIGN.md`
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
