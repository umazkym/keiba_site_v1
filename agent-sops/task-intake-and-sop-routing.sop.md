# Task Intake and SOP Routing

## Overview

このSOPは、UMA-FREEでユーザーから依頼を受けたときに、必要な作業知を選び、調査・実装・検証・知識還元までを一貫して行うための入口手順です。単発の修正でも、広告、記事生成、本番DB、計測、コストに関わる場合は、該当SOPを読み込んでから作業します。

## Parameters

- **user_request** (required): ユーザーの依頼内容。
- **repo_root** (optional, default: current working directory): リポジトリのルートディレクトリ。
- **risk_level** (optional, default: "auto"): `low`、`medium`、`high`、`auto` のいずれか。
- **change_mode** (optional, default: "implement"): `research`、`implement`、`review`、`document` のいずれか。

Constraints for parameter acquisition:

- You MUST infer missing optional parameters from the current task when doing so is safe.
- You MUST ask the user only when the missing information changes production data, money-related behavior, or publication state.
- You MUST NOT require the user to choose a SOP manually because routing is part of the agent's responsibility.

## Steps

### 1. Classify the request

ユーザー依頼を、コード変更、記事生成、広告/収益導線、本番DB、計測、コスト/性能、ドキュメント、調査のどれに該当するか分類します。

**Constraints:**

- You MUST identify whether the task touches production data, published content, ad policy, affiliate links, analytics, or build/deploy behavior.
- You MUST treat tasks involving `DATABASE_URL`, IAP, GitHub Actions DB workflows, AdSense, AffiliateSlot, article publishing, GA4, Clarity, ISR, or Vercel usage as at least medium risk.
- You MUST NOT start edits before identifying relevant SOPs because UMA-FREE has domain-specific guardrails that are easy to miss from code alone.

### 2. Select SOPs

`agent-sops/INDEX.md` を読み、依頼内容に合うSOPを選びます。複数領域にまたがる場合は、作業の影響が大きい順にSOPを読みます。

**Constraints:**

- You MUST read `agent-sops/INDEX.md` before choosing SOPs for non-trivial implementation or operations tasks.
- You MUST read every selected `.sop.md` completely before applying it.
- You SHOULD prefer one to three SOPs for a task to avoid loading unrelated context.
- You MUST NOT read all SOPs by default because unnecessary context increases the chance of stale or irrelevant guidance affecting the work.

### 3. Gather local context

選んだSOPの `Source references` と、対象コード周辺を確認します。

**Constraints:**

- You MUST use fast local search such as `rg` when locating files and patterns.
- You MUST inspect existing implementations before proposing new abstractions.
- You SHOULD read the smallest set of files that explains the behavior and risk.
- You MUST NOT rely only on historical notes when current code or workflow files can be inspected because the implementation may have changed.

### 4. Execute with project guardrails

既存の設計、文体、広告審査、低コスト運用、本番DB制約に合わせて作業します。

**Constraints:**

- You MUST keep Japanese user-facing explanations and project comments natural and restrained.
- You MUST preserve `rel="sponsored nofollow noopener noreferrer"` and PR disclosure when touching affiliate links.
- You MUST preserve IAP-only production DB access when touching DB maintenance workflows.
- You MUST NOT run `git commit`, `git push`, or deployment commands because AGENTS.md explicitly leaves those actions to the user.
- You MUST NOT reintroduce strong betting or sensational expressions because they can damage AdSense review quality and reader trust.

### 5. Verify and return knowledge

作業後に、該当SOPで求められる検証を実施します。反復可能な発見があればSOP更新候補として残します。

**Constraints:**

- You MUST run the narrowest meaningful validation for the changed surface when tooling is available.
- You SHOULD update or propose updates to a SOP when the task reveals a recurring step, a new failure mode, or a changed operational rule.
- You MUST report any skipped validation and the reason.
- You MUST NOT present unverified code as verified because this project treats build and policy regressions as high-cost failures.

## Source references

- `AGENTS.md`
- `agent-sops/INDEX.md`
- `docs/archive_agents_history.md`
- `docs/system-documentation/10_運用保守.md`

## Examples

### Example Input

```text
user_request: レースページの楽天競馬導線を少し目立たせたい
```

### Example Output

```text
読むSOP:
- monetization-affiliate-ads-ux.sop.md
- frontend-build-release-verification.sop.md

確認対象:
- frontend/components/AffiliateSlot.tsx
- frontend/components/RacePageClient.tsx
- docs/analytics_measurement_plan.md
```

## Troubleshooting

### 該当SOPが見つからない

既存コードと `docs/` を読んで通常の作業を行い、完了報告で新規SOP候補を示します。

### SOPと現行コードが矛盾している

現行コード、ワークフロー、ユーザー指示を優先し、SOPの更新候補を明示します。
