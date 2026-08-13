# Analytics Clarity and GA4 Audit

## Overview

このSOPは、GA4、Microsoft Clarity、収益ファネル、記事からレースへの導線、アフィリエイト計測を調査・修正するときの手順です。実ページビューと画面内操作を混同せず、収益につながる行動を録画やイベントで追える状態を維持します。

## Parameters

- **audit_goal** (required): 調査または修正の目的。
- **target_events** (optional): 対象イベント名の一覧。
- **time_window** (optional): 分析対象期間。

Constraints for parameter acquisition:

- You MUST infer target events from files and docs if the user names a funnel or page rather than exact event names.
- You MUST treat new analytics events as contract changes that may require docs updates.
- You MUST NOT request analytics tokens unless live API export is explicitly needed because tokens are sensitive and routine code inspection does not require them.

## Steps

### 1. Identify the measurement contract

現在のイベント名、発火条件、主なパラメータを確認します。

**Constraints:**

- You MUST read `docs/analytics_measurement_plan.md` before changing GA4 or Clarity event behavior.
- You MUST distinguish real `page_view` from in-page interactions such as race group selection, venue selection, and race navigation.
- You MUST identify key events such as `affiliate_click` and `article_race_click` when revenue funnel work is involved.
- You MUST NOT reintroduce virtual `page_view` for tab or race switching because it previously distorted GA4 versus AdSense comparison.

### 2. Inspect implementation

イベント発火箇所とパラメータをコードで確認します。

**Constraints:**

- You MUST inspect `frontend/lib/analytics.ts` and relevant components before editing event behavior.
- You MUST check race page, article page, home page, and affiliate components when the funnel crosses pages.
- You SHOULD preserve event parameter names used as GA4 custom dimensions unless intentionally migrating them.
- You MUST NOT drop campaign, provider, context, article slug, venue, or navigation method parameters without documenting the reporting impact because GA4 custom dimensions and historical comparisons depend on stable parameters.

### 3. Check Clarity usefulness

録画で改善判断できる粒度になっているか確認します。

**Constraints:**

- You MUST preserve Clarity custom events for affiliate and home/race entry analysis when touching those flows.
- You SHOULD keep bot and human-session separation in mind when interpreting Clarity exports.
- You SHOULD compare dead clicks, quick backs, JavaScript errors, and page/session signals by device and URL for UX questions.
- You MUST NOT declare a UX issue fixed from aggregate metrics alone when the time window mixes pre-fix and post-fix sessions because the measured sessions do not isolate the change.

### 4. Validate code and reporting docs

実装変更後、型検査とドキュメントの整合性を確認します。

**Constraints:**

- You MUST run `npx tsc --noEmit` for TypeScript analytics changes.
- You SHOULD run `npm run build` when page-level tracking components or App Router pages change.
- You MUST update `docs/analytics_measurement_plan.md` if event names, parameters, or key-event recommendations change.
- You MUST NOT rename events casually because GA4 historical reporting and key-event settings depend on stable names.

### 5. Report analysis with caveats

分析結果は日付、期間、対象、未確認点を明示します。

**Constraints:**

- You MUST state the exact time window and data source for any metric.
- You MUST separate confirmed live firing, code presence, and dashboard reflection because they occur at different times.
- You SHOULD identify remaining validation such as ad-filled `ad_impression_custom` if ads did not fill in test.
- You MUST NOT overstate causality from analytics correlations because traffic source, device mix, and ad fill can change independently.

## Source references

- `docs/analytics_measurement_plan.md`
- `docs/clarity_optimization_audit_20260620.md`
- `docs/clarity_completeness_review_20260621.md`
- `frontend/lib/analytics.ts`
- `frontend/components/ArticleEngagementTracker.tsx`
- `frontend/components/AffiliateSlot.tsx`

## Examples

### Example Input

```text
audit_goal: 記事からレースへの送客が測れているか確認する
target_events: article_read_complete, article_race_click, race_view
```

### Example Output

```text
確認:
- article_race_clickが記事slug、link_path、link_placementを送る
- page_viewは記事表示とレースページ表示のみ
- GA4管理画面の反映遅延を説明
```

## Troubleshooting

### 週次Workflowで一つの媒体取得だけが失敗した

- GA4、Clarityなど個別媒体の取得失敗で、取得済みGSC原本や記事台帳を破棄してはいけません。
- 個別媒体の取得ステップは失敗結果を記録して後続へ進み、`source-status.json`と取得済みファイルを必ずartifactへ保存します。
- artifact保存後にWorkflowを失敗扱いへ戻し、通知と再実行可能性を維持します。
- 定期実行の再実行時は`github.event_name`が元の`schedule`のままであることを確認し、手動改稿・commit・deploy工程が起動しない場合だけ実行します。
- Google Analytics Data APIの無効化エラーを確認した場合は、対象Google CloudプロジェクトでAPIを有効化してから同じrunを再実行します。ローカルOAuthがGoogleにブロックされる場合は、権限を迂回せずWorkload Identityのサービスアカウント経路を使用します。

### GA4でイベントが未検出に見える

コード発火、DebugView/Tag Assistant、通常レポート反映を分けて確認します。通常レポートは遅延するため、未検出表示だけで実装失敗と判断しないでください。
