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
- You MUST check whether the task affects `news_context`, `grade_race_preview`, `race_update`, `course_venue`, `jockey_profile`, or `beginner_guide`.
- You MUST NOT treat all article types the same because external research, evidence needs, and seasonal freshness differ.

### 2. Preserve evidence discipline

本文に出す数値と主張の根拠を確認します。

**Constraints:**

- You MUST require DB, prediction data, or explicit Evidence Pack for win rate, place rate, return rate, sample count, AI score, frame data, leg type data, and jockey metrics.
- You MUST keep Tavily or web research as context only, not as a source for invented performance metrics.
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
- You SHOULD run `npx tsc --noEmit` when TypeScript agent scripts or article rendering types change.

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
