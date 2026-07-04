# SOP Authoring and Maintenance

## Overview

このSOPは、UMA-FREEの反復作業や失敗知を新しいAgent SOPとして作成・更新するための手順です。SOPは作業ログの圧縮ではなく、今後も再利用される判断基準と手順だけを残します。

## Parameters

- **sop_goal** (required): 作成または更新したいSOPの目的。
- **source_materials** (optional): 根拠にする作業ログ、docs、コード、workflow、過去の失敗。
- **target_sop** (optional): 更新対象の `.sop.md`。新規の場合は未指定。

Constraints for parameter acquisition:

- You MUST infer likely source materials from `AGENTS.md`, `docs/`, `.github/`, and code search when the user does not provide them.
- You MUST ask before deleting or radically rewriting an existing SOP.
- You MUST NOT turn one-off investigation notes into SOPs because SOPs should encode repeatable procedures.

## Steps

### 1. Decide whether a SOP is warranted

対象作業が再利用可能な手順か、単なる記録かを判定します。

**Constraints:**

- You MUST require at least one repeat trigger such as recurring operations, repeated bugs, policy-sensitive edits, or high-risk maintenance.
- You SHOULD prefer updating an existing SOP over adding a near-duplicate SOP.
- You MUST NOT create a SOP for a purely strategic memo or one-time research report because it will dilute the routing index.

### 2. Gather evidence

過去ログ、現行コード、workflow、docsを確認します。

**Constraints:**

- You MUST inspect current code or workflow files when the SOP mentions commands, paths, or operational behavior.
- You SHOULD extract past failures as negative constraints with reasons.
- You MUST NOT copy large historical logs into SOPs because SOPs should be concise procedural artifacts.

### 3. Write the SOP in standard structure

SOPを `agent-sops/{kebab-case}.sop.md` に作成または更新します。

**Constraints:**

- You MUST include `# Title`, `## Overview`, `## Parameters`, and `## Steps`.
- You MUST include at least one `**Constraints:**` block under steps.
- You MUST write prohibitions using `You MUST NOT ... because ...` or an equivalent reason-bearing form.
- You SHOULD include `## Source references`, `## Examples`, and `## Troubleshooting` when they improve reuse.
- You MUST NOT include secrets, private tokens, or live credentials in the SOP because SOPs are reusable project documents and may be shared across tools.

### 4. Update routing and docs

索引と利用案内を更新します。

**Constraints:**

- You MUST update `agent-sops/INDEX.md` when adding, renaming, or removing a SOP.
- You SHOULD update `agent-sops/README.md` if the directory-level usage changes.
- You MUST NOT require agents to read every SOP as part of routine startup because progressive loading is the point of this system.

### 5. Validate

形式と参照性を確認します。

**Constraints:**

- You MUST run `npm run agent-sops:validate` after changing SOP files.
- You SHOULD run `npm run agent-sops:skills -- --dry-run` when changes affect Skill conversion.
- You MUST fix validation errors before considering the SOP ready.

## Source references

- `agent-sops/README.md`
- `agent-sops/INDEX.md`
- `AGENTS.md`
- `docs/archive_agents_history.md`

## Examples

### Example Input

```text
sop_goal: Clarity監査の反復手順をSOP化したい
source_materials: docs/clarity_optimization_audit_20260620.md, docs/clarity_completeness_review_20260621.md
```

### Example Output

```text
作成:
- agent-sops/analytics-clarity-ga4-audit.sop.md

索引:
- INDEX.mdにGA4/Clarity関連タスクの読み分けを追加
```

## Troubleshooting

### SOPが長くなりすぎる

背景説明を `docs/` に残し、SOPには作業順、判断基準、禁止理由、検証方法だけを残します。
