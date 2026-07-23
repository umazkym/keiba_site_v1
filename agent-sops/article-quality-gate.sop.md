# Article Quality Gate

## Overview

このSOPは、UMA-FREEの記事生成・記事編集・記事公開パイプラインを変更するときに、検索流入、AdSense審査、読者信頼、データ正確性を同時に守るための確認手順です。

## Parameters

- **article_task** (required): 記事生成、記事編集、品質監査、パイプライン修正などの作業内容。
- **affected_files** (optional): 変更対象ファイル。
- **publication_risk** (optional, default: "auto"): `low`、`medium`、`high`、`auto` のいずれか。

Constraints for parameter acquisition:

- You MUST treat changes to Writer, Editor, SEO Checker, Publisher, article workflow, or published Markdown as medium or high risk.
- You MUST infer affected files with local search when not supplied.
- You MUST NOT publish or un-draft articles unless the user explicitly asks because publication state affects live SEO and monetization.

## Steps

### 1. Determine the article surface

作業が記事本文、生成ロジック、topic planner、quality checker、publisher、GitHub Actionsのどこに関わるか確認します。

**Constraints:**

- You MUST inspect relevant files under `frontend/scripts/agents/`, `backend/scripts/agents/`, `.github/workflows/keiba-article-pipeline.yml`, or `frontend/content/articles/`.
- You MUST check whether the task affects `grade_race_preview`, `race_update`, `course_venue`, `jockey_profile`, or `beginner_guide`.
- You MUST reject legacy `news_context` orders before Writer execution and reclassify them into a horse-racing-specific article type.
- You MUST NOT treat all article types the same because external research, evidence needs, and seasonal freshness differ.

### 2. Preserve evidence discipline

本文に出す数値と主張の根拠を確認します。

**Constraints:**

- You MUST require DB, prediction data, or explicit Evidence Pack for win rate, place rate, return rate, sample count, AI score, frame data, leg type data, and jockey metrics.
- You MUST use Tavily or web research only for topic discovery and independent verification of official facts. External media titles, URLs, summaries, recommendations, and comments MUST NOT enter Writer input.
- You MUST limit WriterEvidence origins to `official` and `uma_free`, with `facts`, `metrics`, and `as_of` explicitly separated.
- You MUST preserve verified internal `key_metrics` in both legacy `label/value` form and multi-column table form. Multi-column rows keep their original scalar column names and values, while provenance, source URLs, media names, and production metadata are removed before Writer execution.
- You MUST reject articles containing external media names, column names, quote-like attribution, third-party recommendations/comments, production meta language, or off-topic analogies.
- You MUST preserve freshness checks for date-specific news and race context.
- You MUST NOT allow the LLM to invent missing prediction values, race results, odds, rankings, or threshold claims because this directly damages trust and search quality.

### 3. Preserve tone and policy guardrails

競馬メディアとして自然で控えめな文体を維持します。

**Constraints:**

- You MUST keep banned and discouraged expressions aligned with `AGENTS.md`, `docs/reference_data_summary.md`, and tone checker code.
- You MUST avoid strong betting, certainty, sensational, and finance-like expressions in generated text.
- You MUST keep article endings from falling into generic summary or sales-like instruction.
- You MUST NOT add phrases such as strong guarantees, aggressive exclusion labels, or invented AI-score thresholds because they can harm AdSense review and reader trust.

### 4. Preserve anti-cannibalization and seasonal routing

検索カニバリと季節外れ記事を防ぎます。

**Constraints:**

- You MUST preserve one-run one-race topic limits unless the user explicitly changes the strategy.
- You MUST check `posted_history.json`, existing Markdown, pending write orders, and topic history when changing planner behavior.
- You MUST keep local reference data from `docs/reference_data_summary.md` as the primary maintainable source for evergreen planner inputs.
- You MUST NOT generate result-review framing for future races because it creates misleading content before the event is held.

### 5. Validate the pipeline surface

変更に応じて機械検査を実行します。

**Constraints:**

- You MUST run Python syntax checks for changed backend article scripts.
- You SHOULD run targeted backend unit tests such as `test_news_topic_planner.py` or `test_editorial_evergreen_planner.py` when planner behavior changes.
- You SHOULD run `npm run article:validate-links` and `npm run article:audit-quality` from `frontend/` when article Markdown or article validation logic changes.
- You SHOULD run `npm run article:test-independence` when planner, Writer, Editor, SEO Checker, Publisher, or evidence sanitization changes.
- Evidence sanitization tests MUST cover a verified multi-column row that produces `evidence_rows > 0` and an external-source-only row that remains rejected.
- You SHOULD run `npx tsc --noEmit` when TypeScript agent scripts or article rendering types change.

### 6. Gate grade-race URLs and race bridges

重賞記事では共有レジストリの`entity_key`と`season_year`を使い、同一年度の記事を更新します。Writerが本文へ個別レースCTAを直接埋め込むことは禁止し、Publisherだけが軽量プレビューAPIの一意一致、正確なrace IDとURL、予測1頭以上、年度一致を確認して`race_bridge_enabled=true`にできます。

**Constraints:**

- You MUST keep `race_bridge_enabled=false` when the race, venue, year, URL, or prediction data is missing or ambiguous.
- You MUST render no bridge DOM, loading state, placeholder, or reserved space while the gate is false.
- You MUST NOT infer a race from article title text in the browser or fall back to another race or `/races/today` because an incorrect destination breaks search intent and attribution.
- You MUST preserve the verified exact race link during a temporary API failure, but hide unverified prediction values.
- You MUST use a dry-run inventory before adding metadata to existing articles and leave ambiguous articles unchanged.
- You MUST require `ARTICLE_RACE_BRIDGE_EXPERIMENT_ACTIVE=true` and a non-empty `ARTICLE_RACE_BRIDGE_REMINDER_ID` before Publisher enables a bridge because reminders are a mandatory revenue-protection gate.
- You MUST protect existing URLs with at least one Search Console click or 100 impressions in the last 28 days; migrations require a direct, loop-free 301 and a self-canonical destination.

## Source references

- `AGENTS.md`
- `docs/article_creation_flow.md`
- `docs/reference_data_summary.md`
- `docs/system-documentation/13_記事生成AIトーンマナー定義書.md`
- `docs/system-documentation/14_自動記事生成システム全体仕様書.md`
- `.github/workflows/keiba-article-pipeline.yml`

## Examples

### Example Input

```text
article_task: SEO Checkerに禁止語を追加する
```

### Example Output

```text
確認:
- Writer/Editor/SEO Checkerの禁止語が矛盾しない
- validate-linksとarticle品質監査を実行
- 公開状態の変更は行わない
```

## Troubleshooting

### 品質監査が既存記事で大量に警告を出す

今回変更で新しく悪化したものと既存の残課題を分けて報告します。既存記事を一括修正する場合は、検索流入やcanonicalの影響があるため別作業として扱います。

### 外部媒体依存が既存記事へ残っている

`npm run article:remediate-independence` で対象を確認し、記事単位で意味を保てる場合のみ `npm run article:remediate-independence:apply` を実行します。媒体依存が主題そのものの場合は、単純置換せず公式事実・UMA-FREE掲載データで全面改稿するか、関連性の高い記事へ統合して301転送します。
