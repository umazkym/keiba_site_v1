# UMA-FREE Agent SOP

このディレクトリは、UMA-FREEの保守作業をAIエージェントが安定して再現するための標準作業手順書置き場です。

`AGENTS.md` は常に読む基本方針、`agent-sops/` は必要なときだけ読む作業手順、`docs/` は詳しい背景資料として分担します。SOPは会話ごとに全文を常時読み込ませるものではなく、ユーザーの依頼内容に合うものだけを選んで参照します。

## 使い方

1. 作業前に `agent-sops/INDEX.md` を確認する。
2. 依頼内容に合う `.sop.md` があれば、そのSOPを読んでから作業する。
3. SOP内の `Source references` にある背景資料は、必要なものだけ追加で読む。
4. 作業中に新しい反復手順や失敗パターンが見つかった場合は、既存SOPを更新するか、新しいSOP候補として残す。

## 設計方針

- SOPは手順の原本として扱う。
- ツール固有の設定やSkill変換物は派生物として扱う。
- 本番DB、広告、記事生成、計測、コストに関わる作業は、SOPの制約を優先的に確認する。
- `AGENTS.md`、ユーザー指示、システム指示と矛盾する場合は、より上位の指示を優先する。
- 禁止事項には理由を添える。過去に踏んだ失敗や審査・収益・運用上のリスクを根拠として書く。

## 検証

SOPの最低限の形式は次で確認できます。

```powershell
npm run agent-sops:validate
```

直接実行する場合は `node scripts/agent_sops/validate_sops.cjs` でも構いません。Pythonが使える環境向けに同等の `scripts/agent_sops/validate_sops.py` も置いています。

Claude Code向けのSkill形式へ簡易変換する場合は次を使います。`.claude/` はこのリポジトリではgit管理外なので、共有する原本は必ず `agent-sops/` に残します。

```powershell
npm run agent-sops:skills -- --output .claude/skills
```

## 初期SOP一覧

- `task-intake-and-sop-routing.sop.md`: 依頼受付、SOP選択、作業後の知識還元。
- `frontend-build-release-verification.sop.md`: Next.js/TypeScript変更の確認。
- `article-quality-gate.sop.md`: 自動記事生成・記事編集の品質ゲート。
- `monetization-affiliate-ads-ux.sop.md`: 広告・アフィリエイト導線のUX/審査確認。
- `production-db-iap-maintenance.sop.md`: 本番DB/IAPトンネル関連の保守。
- `analytics-clarity-ga4-audit.sop.md`: GA4/Clarity収益ファネル監査。
- `cost-performance-isr-review.sop.md`: Vercel/Cloud Run/ISR/転送量の低コスト運用確認。
- `sop-authoring.sop.md`: SOP自体の作成・更新。
- `social-video-multiplatform-publishing.sop.md`: 複数SNSへの動画配信、認証、重複防止、UTM計測。
