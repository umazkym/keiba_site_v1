# Production DB IAP Maintenance

## Overview

このSOPは、UMA-FREEの本番PostgreSQL、GCE VM `keiba-db`、IAP TCPトンネル、GitHub ActionsのDB接続を扱うときの安全手順です。外部IPv4を復活させず、Cloud RunとActionsの現在の接続方式を維持します。

## Parameters

- **db_task** (required): DB保守、migration、データ修復、workflow修正、接続確認などの作業内容。
- **execution_context** (optional, default: "local_or_actions"): `local`、`github_actions`、`cloud_run`、`cloud_shell`、`unknown` のいずれか。
- **data_mutation** (optional, default: "auto"): `none`、`read_only`、`write`、`migration`、`auto` のいずれか。

Constraints for parameter acquisition:

- You MUST classify whether the task reads, writes, repairs, or migrates production data.
- You MUST ask the user before destructive or broad production data changes.
- You MUST NOT request or expose secrets in logs or generated docs because production credentials must remain in GitHub, Vercel, or GCP secret stores.

## Steps

### 1. Confirm current architecture

DB接続経路が現行のIAP/内部IP前提に合っているか確認します。

**Constraints:**

- You MUST treat `keiba-db` on GCE as the production DB host.
- You MUST preserve Cloud Run private-range access to internal IP `10.138.0.2:5432`.
- You MUST preserve GitHub Actions access through IAP tunnel on `127.0.0.1:15432`.
- You MUST NOT restore direct access to old external IP `34.182.6.97` because the project intentionally removed public DB exposure.

### 2. Inspect workflows and connection rewriting

Actionsや保守スクリプトが `DATABASE_URL` を安全に扱っているか確認します。

**Constraints:**

- You MUST inspect `.github/actions/setup-iap-db/action.yml` when changing workflow DB access.
- You MUST ensure Actions rewrite only the runtime `DATABASE_URL` to localhost while preserving credentials and database path.
- You MUST keep `id-token: write` where Google OIDC authentication is required.
- You MUST NOT commit hard-coded credentials or local tunnel URLs into source files because secrets must stay in GitHub/Vercel/GCP configuration.

### 3. Plan data changes

データ変更やmigrationが必要な場合、対象範囲と復旧方法を明確にします。

**Constraints:**

- You MUST identify affected tables, date ranges, and scripts before write or migration work.
- You SHOULD prefer idempotent repair scripts for data correction.
- You SHOULD dry-run or read-only inspect before write operations when feasible.
- You MUST NOT run broad updates without a scoped WHERE condition or explicit user approval because production race data is user-facing.

### 4. Execute safely

ローカル、Cloud Shell、Actionsのいずれでも、IAP経由の接続を維持します。

**Constraints:**

- You MUST use `gcloud compute start-iap-tunnel keiba-db 5432 --project=keiba-api-project --zone=us-west1-b --local-host-port=127.0.0.1:15432` for manual production DB access.
- You MUST verify the tunnel is ready before running DB-dependent scripts.
- You MUST keep high-load scraping or bulk external access out of DB maintenance tasks.
- You MUST NOT bypass IAP by opening firewall rules such as `allow-postgres` to public ranges because the current security model depends on IAP-only access.

### 5. Verify and document

作業後に、API・表示・キャッシュ反映の確認を行います。

**Constraints:**

- You MUST verify the corrected data path through the relevant API or page when the task affects public race data.
- You SHOULD account for the five-minute cache behavior for current, previous, and next-day race APIs.
- You MUST report exact scripts, date ranges, and validation performed.
- You MUST NOT leave temporary tunnel, debug, or secret output artifacts in tracked files because they can leak infrastructure details or stale credentials.

## Source references

- `AGENTS.md`
- `.github/actions/setup-iap-db/action.yml`
- `.github/workflows/db-migrate.yml`
- `.github/workflows/keiba-data-fetch-morning.yml`
- `docs/system-documentation/08_デプロイメント.md`
- `docs/system-documentation/10_運用保守.md`

## Examples

### Example Input

```text
db_task: GitHub Actionsのデータ取得workflowでDB接続が失敗する
execution_context: github_actions
data_mutation: none
```

### Example Output

```text
確認:
- setup-iap-db/action.ymlのOIDC/IAP設定
- DATABASE_URLのlocalhost書き換え
- firewallや外部IPを復活させていない
```

## Troubleshooting

### IAP tunnelがreadyにならない

OIDC認証、サービスアカウント権限、zone、instance、IAP firewall rule、local portの衝突を順に確認します。DBの外部公開で回避しないでください。
