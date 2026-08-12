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

- You MUST inspect `frontend/components/AffiliateSlot.tsx`, `frontend/lib/affiliate-campaigns.ts`, `frontend/components/AdUnit.tsx`, `frontend/components/AdSensePageLevelScript.tsx`, and relevant page components when affected.
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
- You MUST send singular `provider` and `link_id` on both affiliate impression and click events. Keep `providers` on impressions only for compatibility with multi-link slots.
- You MUST verify mode-dependent placement behavior with the affiliate regression test during the production build; validating environment variable values alone does not prove that hidden placements are absent from the DOM.
- You SHOULD preserve or update Clarity custom event linkage when adding new monetization events.
- You MUST run `npx tsc --noEmit` for TypeScript changes.
- You SHOULD run `npm run build` when page-level ad or affiliate placement changes.

### 6. Protect revenue when running experiments

広告実験は設定変更だけでなく、終了判断日と復元手順までを一つの作業として扱います。

**Constraints:**

- You MUST record every monetization experiment in `docs/monetization_experiments.md` before changing production ad behavior.
- You MUST create a Codex reminder for 09:00 JST on the decision date and record its automation ID before starting a new experiment.
- You MUST verify in the management UI whether the treatment has a simultaneously measured control group and random allocation before calling it an A/B experiment.
- You MUST NOT use treatment-only impressions as proof of incremental revenue when no concurrent control exists because additional impressions cannot supply the missing counterfactual.
- You MUST NOT automatically end an AdSense experiment because dashboard data, day-of-week mix, and delayed revenue need human review.
- You MUST extend a controlled experiment and update the reminder together when its minimum sample has not been reached.
- You MUST NOT extend an uncontrolled rollout indefinitely only to reach a treatment-impression threshold because additional treatment impressions cannot create a missing control; after a predefined safety-observation date, record causal impact as undetermined and either restore the prior setting, fix the rollout as the operating baseline, or start a separate controlled experiment.
- You MUST apply the winning or original configuration in the same operation that ends the experiment so the site is not left without its intended ads.
- You MUST create follow-up reminders for 09:00 JST on the next day and seven days after ending an experiment.
- You MUST restore the original configuration immediately for policy warnings, broad ad delivery failures, an Offerwall that blocks access, or serious mobile interaction regressions.
- You MUST NOT start a second ad experiment while another monetization experiment is awaiting a decision because overlapping changes prevent reliable revenue attribution and make rollback unsafe.
- You MUST use AdSense revenue per 1,000 human sessions as the primary KPI and keep prediction-table use, race navigation, ad impressions, Clarity friction, and mobile CWV as revenue-protection guardrails.
- You MUST NOT start a new ad experiment until the GA4 `(not set)` share has remained below 5% for seven consecutive days because incomplete attribution can make a harmful variant appear profitable.
- You MUST normally wait for at least seven days and 500 target race sessions. After that point, restore the original only when revenue per 1,000 target sessions is at least 15% lower, same-weekday site revenue is also lower, `prediction_table_view` or `race_navigation` is at least 10% lower, and missing data cannot explain the result.
- You MUST adopt a variation only when revenue per 1,000 target sessions is at least 5% higher, both race-operation metrics decline by less than 10%, dead-click and quick-back rates worsen by less than 2 points each, mobile CLS is at most 0.1, and no policy or interaction problem exists.
- You MUST extend for seven days when the revenue difference is within ±5%, guardrails conflict, or the minimum sample has not been reached. A single estimated-revenue day is never sufficient.

### 7. Decide and verify on the scheduled day

09:00 JSTのリマインド後に、前日までの確定データだけで判断します。

**Constraints:**

- You MUST freeze the comparison periods in AdSense, GA4, Clarity, and Search Console and save screenshots of the experiment and original settings before ending anything.
- You MUST write variant revenue, target sessions, race-operation rates, and CWV into the ledger before deciding immediate stop, early stop, normal end, or extension.
- You MUST write `因果効果は判定不能` when the management UI has no concurrent control, and treat absolute treatment revenue only as operational evidence rather than uplift.
- You MAY keep an uncontrolled rollout as a fixed baseline when it has positive absolute revenue, no policy problem, and no material guardrail regression; record that this is a baseline decision, not a causal adoption result.
- You MUST verify production ad delivery, the prediction table, race switching, and mobile layout immediately after applying the selected setting.
- You MUST restore the original when the next-day or seven-day revenue per 1,000 human sessions is at least 10% below the pre-end baseline and traffic volume or weekday mix does not explain it.

### 8. Run article-to-race navigation experiments without changing ads

重賞記事から個別レースへのブリッジ実験は、既存AdSense枠、Offerwall、自動アンカー、広告除外設定を固定して行います。対象はPublisherが一意一致と予測ありを検証した記事だけとし、データ未準備記事を表示率やCTRの母数へ混ぜません。

**Constraints:**

- You MUST create the deployment-relative D+1 and D+14 09:00 JST reminders before enabling the experiment; reminder failure blocks activation.
- You MUST measure `article_race_preview_view → article_race_click → race_view → prediction_table_view → race_navigation` and pass exact attribution through sessionStorage only to the first matching race view.
- You MUST wait for 14 days and at least 500 eligible article sessions before the formal decision, unless an immediate safety condition is met.
- You MUST keep revenue per 1,000 human sessions from declining and restore the prior article display if revenue falls by at least 10% without a traffic, weekday, or AdSense-market explanation.
- You MUST disable the bridge, not the ads, when reverting this experiment.
- You MUST NOT increase ad count or move article ads while this experiment is running because simultaneous ad changes would invalidate revenue attribution.

## Source references

- `AGENTS.md`
- `docs/analytics_measurement_plan.md`
- `docs/clarity_optimization_audit_20260620.md`
- `docs/clarity_completeness_review_20260621.md`
- `docs/monetization_experiments.md`
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

リンクを派手にする前に、成果条件、提携状態、Cookie期間、反映時間、配置別リンクの発行可否、Clarity録画、入口文言、ページ文脈、誤認の有無を確認します。新規登録が成果条件なら、既存会員や投票画面閲覧だけの利用者へ広く露出せず、対象者と必要な登録情報を明示します。単一リンクの投票カードでも枠全体をリンクにせず、44px以上の明示CTAだけを操作対象にします。中央競馬ページでは地方競馬サービスへの導線を原則表示しません。

ASPの生クリック数がGA4の同期間`affiliate_click`を大きく上回る場合、生クリックには反復操作、クローラ、リンクスキャナが含まれ得ます。生クリックはリンク疎通の確認値に留め、成果件数・報酬はGA4のCTAクリック数とユーザー数を併記して判断します。テキストリンクでASP側の表示回数が0でも、表示ピクセルを埋め込んでいない構成なら障害とは扱いません。
