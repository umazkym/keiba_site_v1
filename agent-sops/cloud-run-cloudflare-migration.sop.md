# Cloud Run and Cloudflare Frontend Migration

## Overview

このSOPは、Vercelの使用量超過・アカウント停止から、Next.jsフロントエンドをCloud RunとCloudflareへ移行するときの標準手順です。Vercelのプラン変更に依存せず、Cloud Runのrequest-based billing、ゼロスケール、Cloudflareキャッシュ、検索公開数の自動ゲートで費用と負荷を抑えます。

## Parameters

- **migration_goal** (required): 復旧、段階移行、DNS切替、再発防止のどこまで行うか。
- **frontend_service** (optional, default: `keiba-frontend-v1`): Cloud Runのフロントエンドサービス名。
- **custom_domain** (optional, default: `uma-free.com`): 本番ドメイン。
- **cutover_stage** (optional, default: `prepare`): `prepare`、`bootstrap`、`proxy`、`harden`、`rollback`。

Constraints for parameter acquisition:

- You MUST treat a paused production site, DNS change, domain mapping, and default URL disablement as high-risk operations.
- You MUST infer that the existing Vercel route remains the rollback reference until Cloud Runでの本番確認が完了する。
- You MUST NOT assume Cloud Run is guaranteed free because its free tier is usage-based and overage can be billed.

## Steps

### 1. Confirm the failure chain and freeze risky changes

VercelのUsage、主要ルート、ISR、Edge Requests、検索ページ数を確認し、どの処理が使用量を押し上げたかを記録します。

**Constraints:**

- You MUST distinguish CPU、ISR writes、Edge Requests、転送量 because each has different remediation.
- You MUST preserve the current DNS record set and Vercel設定の控え before any cutover.
- You MUST NOT upgrade the Vercel plan when the user has rejected a plan upgrade because that changes the agreed operating model.

### 2. Prepare a reproducible Cloud Run origin

`frontend/Dockerfile`、standalone build、`/api/health`、手動デプロイworkflowを確認します。環境値はGitHub Variablesへ移し、秘密値をDockerイメージやリポジトリへ含めません。

**Constraints:**

- You MUST keep `min=0`、request-based billing、CPU throttling、bounded max instances.
- You MUST verify the health response contains the deployed release SHA.
- You MUST NOT attach the frontend service to the production database or restore a public DB IP because the frontend uses the public backend API and the DB remains on the existing internal/IAP path.
- You MUST NOT commit、push、or trigger production deployment from the agent because repository policy assigns those actions to the user.

### 3. Bootstrap before changing DNS

最初はCloud Runの既定URLを有効にしてデプロイし、主要ページ、静的資産、404、サイトマップ、noindex状態を確認します。

**Constraints:**

- You MUST use `disable_default_url=false` during bootstrap because domain mapping must exist before the default URL can be disabled.
- You MUST apply the publication table migration before enabling scheduled staged publication.
- You MUST NOT cut DNS to an unverified revision because a successful container build alone does not prove route or environment correctness.

### 4. Map the domain and enable Cloudflare in stages

Cloud Runのdomain mappingを作成し、Cloudflareでは最初にDNS-onlyでGoogle管理証明書を有効化します。その後にproxy、Full (strict)、キャッシュ、WAFを段階的に有効化します。

**Constraints:**

- You MUST copy every existing A、AAAA、CNAME、MX、TXT、CAA record before changing authoritative nameservers.
- You MUST wait for the Cloud Run certificate to become active before enabling Cloudflare proxy and Full (strict).
- You MUST keep Cloudflare `Always Use HTTPS` off for this mapping because Google warns that interception can prevent certificate validation or renewal.
- You MUST exempt verified bots from rate limiting because challenging search crawlers can damage indexing.
- You MUST NOT cache `/api/`、RSC、Next router prefetch、non-GET/HEAD traffic because that can mix protocol payloads or cache mutations.

### 5. Harden the origin after successful proxy verification

Cloudflare経由でhealth、主要HTML、資産、広告・計測、サイトマップを確認した後、再デプロイ時に`disable_default_url=true`を選び、`run.app`の迂回経路を閉じます。

**Constraints:**

- You MUST verify the custom domain health response reports the expected release before disabling the default URL.
- You MUST keep a documented `--default-url` recovery command because disabled default URLs also disable several Google service invocation paths.
- You MUST NOT disable the default URL before the domain mapping exists because Cloud Run cannot create the mapping in that state.

### 6. Gate search publication against capacity

品質基準を満たす詳細ページを候補化し、Cloud RunとCloudflareの直近7日指標から1日あたりの新規公開数を決定します。

**Constraints:**

- You MUST fail closed when Cloud Run metrics are unavailable.
- You MUST keep未公開候補を`noindex, nofollow`かつサイトマップ外にする。
- You MUST shard sitemap output deterministically and avoid a fixed 5,000 URL ceiling.
- You MUST NOT publish new pages in red mode because search expansion must never outrun available origin capacity.

### 7. Validate, observe, and roll back safely

切替後はCloudflare cache hit、Cloud Run vCPU秒・5xx・p95・最大インスタンス、GSCクロール、広告・GA4を確認します。異常時は新規公開を止め、CloudflareをDNS-onlyへ戻すか前リビジョンへトラフィックを戻します。

**Constraints:**

- You MUST retain the previous Cloud Run revision and DNS snapshot during the observation period.
- You MUST verify both proxied and DNS-only recovery paths before declaring migration complete.
- You MUST NOT claim zero cost solely from configuration because egress、Artifact Registry、Cloud Run超過は実測が必要。

## Source references

- `AGENTS.md`
- `docs/cloud_run_cloudflare_migration_20260804.md`
- `.github/workflows/deploy-frontend-cloud-run.yml`
- `.github/workflows/keiba-data-page-publication.yml`
- `frontend/Dockerfile`
- `backend/scripts/agents/cloud_run_capacity.py`
- `backend/scripts/agents/data_page_publication.py`
- `agent-sops/cost-performance-isr-review.sop.md`
- `agent-sops/frontend-build-release-verification.sop.md`
- `agent-sops/production-db-iap-maintenance.sop.md`

## Examples

### Example Input

```text
migration_goal: Vercel停止からCloud Run + Cloudflareで復旧し、同じ使用量超過を防ぐ
cutover_stage: bootstrap
```

### Example Output

```text
確認:
- disable_default_url=falseで初回デプロイ
- /api/healthのrelease SHA一致
- domain mapping前はDNSを変更しない
- publication workflowはdry-runから開始
```

## Troubleshooting

### Cloud Runの証明書が発行されない

Cloudflare proxyをDNS-onlyへ戻し、`Always Use HTTPS`を無効にして、domain mappingが提示した全DNSレコードを確認します。証明書発行には最大24時間かかる場合があります。

### Cloudflareで526になる

Cloud Runの証明書がActiveか、DNSが正しいmappingへ到達しているかを確認します。証明書が有効になる前にFull (strict)を有効化しません。

### 次回デプロイ後にhealth確認が失敗する

default URLを無効にした状態ではworkflowは`https://uma-free.com/api/health`を検証します。Cloudflare、domain mapping、証明書のいずれかが不調なら、まず既定URLを再有効化して診断します。
