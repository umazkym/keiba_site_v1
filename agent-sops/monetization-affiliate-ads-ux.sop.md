# Monetization Affiliate and Ads UX

## Overview

このSOPは、AdSense広告、楽天競馬などのアフィリエイト導線、PR表記、広告CLS、収益ファネル計測を変更するときに、収益機会と読者体験を両立するための手順です。

## Parameters

- **monetization_task** (required): 広告配置、アフィリエイト導線、計測、文言、キャンペーン設定などの作業内容。
- **page_context** (optional): `home`、`race`、`article`、`site_header`、`sidebar`、`other` のいずれか。
- **provider** (optional): `adsense`、`rakuten_keiba`、`amazon`、`rakuten_market`、`gam`、`unknown` のいずれか。

Constraints for parameter acquisition:

- You MUST infer `page_context` and `provider` from changed files when possible.
- You MUST treat any affiliate URL, ad slot, or PR disclosure change as policy-sensitive.
- You MUST NOT ask the user for tracking IDs or secrets unless the task explicitly requires configuration that is not present locally because most monetization changes can be reviewed from existing campaign config and code.

## Steps

### 1. Locate monetization surfaces

広告とアフィリエイトの表示箇所、設定、計測を確認します。

**Constraints:**

- You MUST inspect `frontend/components/AffiliateSlot.tsx`, `frontend/lib/affiliate-campaigns.ts`, `frontend/components/AdUnit.tsx`, `frontend/components/GlobalAdManager.tsx`, and relevant page components when affected.
- You MUST identify whether the surface appears before, inside, or after the main user task.
- You MUST check whether GA4/Clarity events are emitted for impression and click behavior.
- You MUST NOT place monetization UI inside prediction tables, sticky selectors, or dense race navigation because it increases accidental interaction and harms race browsing.

### 2. Preserve disclosure and link safety

アフィリエイトリンクの法令・ポリシー・読者信頼を守ります。

**Constraints:**

- You MUST keep visible PR disclosure near affiliate links.
- You MUST preserve `rel="sponsored nofollow noopener noreferrer"` on affiliate outbound links.
- You MUST keep 20歳未満向け注意や投票誤認を避ける文脈 when touching betting-related links.
- You MUST NOT make a central racing page imply Rakuten Keiba is a JRA betting destination because the current guidance separates central racing audience from local racing service.

### 3. Preserve current placement strategy

広告・PR枠は自然な区切りに置きます。

**Constraints:**

- You MUST keep article affiliate placement after the article body and before related articles unless a measured reason changes it.
- You MUST keep race page monetization after prediction or data explanation sections, not before the user can inspect the core race data.
- You SHOULD avoid adding net-new ad slots when replacing or repositioning can achieve the goal.
- You MUST NOT increase ad density around core data because past optimization intentionally reduced intrusive placements.

### 4. Protect CLS and mobile usability

広告空振りや遅延読込で本文や操作UIが動かないようにします。

**Constraints:**

- You MUST preserve reserved height or stable wrappers for ad slots.
- You MUST consider mobile vertical density and anchor ad interference when changing spacing.
- You SHOULD verify layout at narrow mobile widths when changing race or article monetization UI.
- You MUST keep Google dialog scroll locks while an Offerwall or consent dialog is visibly active, then restore stale `body/html` overflow and Google-injected top/bottom padding after the dialog or anchor is dismissed.
- You MUST centralize site-owned scroll locks so a mobile menu cleanup does not overwrite an active Google dialog lock, and vice versa.
- You MUST NOT rely on ad fill behavior for layout stability because unfilled ads can still alter parent styles.

### 5. Validate tracking and build

収益導線の変更は計測とビルドを確認します。

**Constraints:**

- You MUST preserve `affiliate_impression`, `affiliate_click`, and relevant context/campaign parameters when touching affiliate components.
- You SHOULD preserve or update Clarity custom event linkage when adding new monetization events.
- You MUST run `npx tsc --noEmit` for TypeScript changes.
- You SHOULD run `npm run build` when page-level ad or affiliate placement changes.

## Source references

- `AGENTS.md`
- `docs/analytics_measurement_plan.md`
- `docs/clarity_optimization_audit_20260620.md`
- `docs/clarity_completeness_review_20260621.md`
- `docs/system/05_広告収益化戦略.md`
- `docs/system-documentation/17_GA4広告収益最大化設定.md`

## Examples

### Example Input

```text
monetization_task: 記事末尾の楽天競馬枠を少し控えめな文言にする
page_context: article
provider: rakuten_keiba
```

### Example Output

```text
確認:
- PR表記とrelを維持
- 投票を煽る文言にしない
- affiliate_clickのcontextを維持
- tsc/buildを実行
```

## Troubleshooting

### クリックは多いが成約が伸びない

リンクを派手にする前に、Clarity録画、入口文言、ページ文脈、誤認の有無を確認します。中央競馬ページでは地方競馬サービスであることを控えめに明示します。
