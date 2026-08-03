# Vercel停止からCloud Run + Cloudflareへ移行する実装・運用手順

作成日: 2026-08-04  
対象: UMA-FREEフロントエンド  
状態: コードと手動workflowは実装・検証済み。本番デプロイ、DNS切替、Cloudflare設定は未実施。

## 1. 結論

Vercel Hobbyのアップグレードは行わず、Next.jsフロントエンドを次の構成へ移す。

```text
利用者・検索クローラー
          │
          ▼
Cloudflare Free（DNS / CDN / WAF）
          │
          ▼
Cloud Run keiba-frontend-v1（Next.js standalone）
          │
          ▼
Cloud Run keiba-site-v1（既存FastAPI）
          │
          ▼
GCE keiba-db（内部IP 10.138.0.2、IAP保守のみ）
```

フロントはCloud RunからDBへ直接接続しない。既存バックエンドAPIを利用し、DBの外部IPv4や公開ファイアウォールを復活させない。

Cloud Runは従量課金であり「必ず0円」ではない。request-based billingの無料枠は月180,000 vCPU秒、360,000 GiB秒、200万リクエストだが、同一請求先の他プロジェクトを含めて集計され、外向き通信やArtifact Registryも別に費用が生じ得る。実装した容量ゲートはフロント単体の月間換算が72,000 vCPU秒未満をgreen、120,000 vCPU秒以上をredとして、公式無料枠より手前で新規検索公開を止める。

## 2. 原因と再発経路

2026-08-04時点のVercel rolling 30 daysでは、主に次の上限超過を確認した。

| 指標 | 実績 | Hobby枠 | 状態 |
| --- | ---: | ---: | --- |
| Fluid Active CPU | 約12時間7分 | 4時間 | 約303% |
| ISR Writes | 約177.6万 | 20万 | 約888% |
| Edge Requests | 約115.6万 | 100万 | 約116% |

負荷の連鎖は以下だった。

1. `/races/[date]/[venue]/[race]`の高カーディナリティな詳細ページがISR writeの大半を発生。
2. 競走馬などのデータ詳細ページが大量に検索・内部リンク・サイトマップへ露出。
3. 一部ページはEdge cacheされず、クローラーや通常アクセスがorigin処理へ到達。
4. Edge Requests上限に加えCPU上限を大幅超過し、チーム全体がpauseされた。

単にVercelから移すだけでは同じ負荷がCloud Runへ移るため、CDNキャッシュ、origin上限、noindex初期値、容量連動の段階公開を同時実装した。

## 3. 実装済みの変更

### 3.1 Cloud Run用フロントエンド

- `frontend/next.config.mjs`: `output: 'standalone'`、route別共有キャッシュ、`poweredByHeader`無効化。
- `frontend/Dockerfile`: Node 20 multi-stage build、非root実行、port 8080。
- `frontend/app/api/health/route.ts`: `status`、service、release SHAを返す非キャッシュhealth。
- `.github/workflows/deploy-frontend-cloud-run.yml`: 手動実行だけのbuild・push・deploy・release一致確認。
- `min=0`、`max=2`、1 vCPU、1 GiB、concurrency 40、CPU throttling、timeout 30秒。

デプロイworkflowの`disable_default_url`は二段階で使う。

| 段階 | 値 | 目的 |
| --- | --- | --- |
| 初回bootstrap | `false` | `run.app`で主要ページとreleaseを確認し、domain mappingを作成できる状態にする |
| Cloudflare疎通後 | `true` | `run.app`直アクセスによるCloudflare WAF迂回を閉じる |

### 3.2 検索公開の段階制御

`data_page_publications`テーブルで、course、horse、jockey、trainerの公開状態を管理する。

| 状態 | robots | sitemap | 用途 |
| --- | --- | --- | --- |
| `candidate` | `noindex, nofollow` | 除外 | 品質は計算できるが未公開 |
| `published` | 品質条件を満たす場合だけindex | 掲載 | 検索公開済み |
| `held` | `noindex, nofollow` | 除外 | 品質低下・運用保留 |
| `retired` | `noindex, nofollow` | 除外 | 廃止 |

公開スコアは標本数40点、鮮度30点、GSC需要20点、完全性10点。50点以上を候補とする。初回シードは最大500件、通常はgreen 100件/日、yellow 25件/日、red 0件/日。Cloud Run指標を取得できない場合もredとなり、初回シードを含め0件に縮退する。

データサイトマップは固定5,000件上限を廃止し、1,000 URL単位の安定shardへ変更した。

- index: `/sitemap-data.xml`
- shard: `/sitemaps/data/{entity_type}/{shard}.xml`
- backend manifest: `/api/v1/data/sitemap-manifest`
- backend shard: `/api/v1/data/sitemap-shards/{entity_type}/{shard}`

### 3.3 クローラー・内部リンク抑制

- 未公開データページは安全側でnoindex/no-follow。
- 古い非重賞レース、無効なレースURLはfollowしない。
- データ詳細内の過去レース・予測履歴リンクは`rel="nofollow"`。
- race、entity、sitemapへroute別の`Cache-Control`を付与。
- `/races/today`はアクセス時JSTリダイレクトのため`private, no-store`を維持。

## 4. 本番反映前のGoogle Cloud準備

以下はユーザーがGoogle CloudまたはCloud Shellで実行する。実行前に`gcloud config get-value project`が`keiba-api-project`であることを確認する。

### 4.1 APIとArtifact Registry

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com monitoring.googleapis.com --project=keiba-api-project
gcloud artifacts repositories create keiba-containers --repository-format=docker --location=us-west1 --description="UMA-FREE containers" --project=keiba-api-project
```

既にrepositoryがある場合、createは実行せず次で確認する。

```bash
gcloud artifacts repositories describe keiba-containers --location=us-west1 --project=keiba-api-project
```

Artifact Registryには未タグimageや古いrevision向けimageのcleanup policyを設定し、保存量だけで課金が増え続けないようにする。

### 4.2 サービスアカウント

```bash
gcloud iam service-accounts create github-actions-cloud-run --display-name="GitHub Actions Cloud Run deploy" --project=keiba-api-project
gcloud iam service-accounts create keiba-frontend-runtime --display-name="UMA-FREE frontend runtime" --project=keiba-api-project
```

デプロイ用SAにはプロジェクトで`roles/run.admin`、`roles/artifactregistry.writer`を付け、runtime SAに対する`roles/iam.serviceAccountUser`を付ける。Workload Identity Poolのrepository条件は`umazkym/keiba_site_v1`へ限定する。既存の`github-actions-iap-db` SAには段階公開workflow用に`roles/monitoring.viewer`を追加する。権限は対象SA・対象repositoryへ限定し、OwnerやEditorを付けない。

GitHub Actionsで使う既存provider:

```text
projects/761440273070/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
```

### 4.3 GitHub Repository Variables / Secrets

Repository Variables:

- `GCP_FRONTEND_DEPLOY_SERVICE_ACCOUNT`
- `GCP_FRONTEND_RUNTIME_SERVICE_ACCOUNT`
- `GSC_SITE_URL`（未設定時は`sc-domain:uma-free.com`）
- `CLOUDFLARE_ZONE_ID`
- 現行Vercel Productionにある全`NEXT_PUBLIC_*`

最低限、`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_GA_ID`、`NEXT_PUBLIC_CLARITY_PROJECT_ID`、広告モード、広告チャネル8件、楽天競馬URL・モード、公式SNS URL、計測release/experiment系を漏らさない。`NEXT_PUBLIC_*`はブラウザへ公開される値であり、API secretやprivate keyを置いてはいけない。

Repository Secrets:

- `DATABASE_URL`（既存。IAP actionが実行時だけlocalhostへ変換）
- `CLOUDFLARE_ANALYTICS_API_TOKEN`（Zone Analytics readだけ）

Vercelから値を移す際は画面上で一件ずつ照合し、文書やActionsログへ値そのものを出力しない。

## 5. 反映順序

### 5.1 DB schema

1. `Database Schema Migration` workflowを`dry_run=true`で実行。
2. 対象が`data_page_publications`だけであることを確認。
3. `dry_run=false`で再実行。
4. 外部DB IPを作らず、`.github/actions/setup-iap-db`経由で接続できたことを確認。

### 5.2 backend

既存の手動手順でbackendを先に反映し、次を確認する。

```text
/api/v1/data/sitemap-manifest
/api/v1/data/sitemap-shards/course/1
/api/v1/data/horses/{既知ID}
```

publication rowがない状態ではデータ詳細の`indexable=false`が正しい。フロントを先に反映すると旧APIが新フィールドを返さないが、frontend側も安全側のcandidate/noindexへ縮退する。

### 5.3 frontend bootstrap

`Deploy Frontend to Cloud Run` workflowを次で手動実行する。

```text
disable_default_url=false
```

workflowが出力するCloud Run URLで確認する。

- `/api/health`の`release`が実行commit SHAと一致。
- `/`、当日レース、過去レース、記事、競走馬、騎手、調教師、コースが200。
- `/_next/static/` assetが200。
- 未公開entityのmetadataがnoindex/no-follow。
- `/sitemap-data.xml`がsitemap index形式。
- 存在しないentityとsitemap shardが404かつ短いnegative cache。

## 6. Cloud Run domain mappingとCloudflare切替

Cloud Runの直接domain mappingは2026-08-04時点でPreviewであり、Googleは本番用途に推奨していない。ただし`us-west1`では利用可能で、外部Load Balancerの固定費・構成増を避ける今回の制約下では、DNS rollbackを維持して採用する。証明書や遅延が安定しない場合は、無理に継続せず外部Application Load Balancer案を別途費用評価する。

### 6.1 DNS snapshotとCloudflare zone

1. 現行DNSのA、AAAA、CNAME、MX、TXT、CAAをすべてexportまたは画面保存。
2. Cloudflare Freeへ`uma-free.com`を追加し、import後の全recordを原本と照合。
3. メール認証、Google verification、AdSense、Search Console等のTXTを削除しない。
4. registrarのauthoritative nameserverをCloudflare指定値へ変更。
5. 切替直後は既存origin recordをDNS-onlyに保ち、Cloudflareがauthoritativeになったことだけを確認。

### 6.2 domain mapping

```bash
gcloud domains list-user-verified
gcloud beta run domain-mappings create --service=keiba-frontend-v1 --domain=uma-free.com --region=us-west1 --project=keiba-api-project
gcloud beta run domain-mappings describe --domain=uma-free.com --region=us-west1 --project=keiba-api-project
```

`resourceRecords`に表示された全A/AAAA recordをCloudflareへDNS-onlyで登録する。Cloud Runの証明書がActiveになるまでproxyを有効にしない。通常は約15分、最大24時間かかる。

CloudflareをCloud Run domain mappingの前段に置く場合、Google公式注意に従い`SSL/TLS > Edge Certificates > Always Use HTTPS`はOFFのままにする。証明書更新まで含めた運用上の制約であり、安易にONへ戻さない。

### 6.3 Cloudflare proxyとTLS

証明書Active後:

1. apexのCloud Run mapping recordsをProxiedへ変更。
2. `www`はapexへのProxied CNAMEを作り、Single Redirectで`https://uma-free.com/${path}`へ301。
3. SSL/TLS modeを`Full (strict)`へ設定。
4. `curl -I https://uma-free.com/api/health`で200、`Cache-Control: private, no-store`を確認。
5. `curl -I https://uma-free.com/`を2回実行し、`CF-Cache-Status`と`Age`を確認。

### 6.4 Cache Rules

Cloudflare FreeではCache Rulesを10件まで利用できる。次の順で作り、最後に危険なrequestをbypassする。複数ruleが一致した場合は後のruleが優先される。

1. `public-html`
   - Expression:
     ```text
     (http.request.method in {"GET" "HEAD"} and http.request.uri.query eq "" and not starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/_next/"))
     ```
   - Cache eligibility: Eligible
   - Edge TTL: Use cache-control header if present, bypass if absent
   - Browser TTL: Respect origin
2. `next-assets`
   - Expression:
     ```text
     (starts_with(http.request.uri.path, "/_next/static/") or starts_with(http.request.uri.path, "/_next/image") or starts_with(http.request.uri.path, "/images/") or starts_with(http.request.uri.path, "/assets/"))
     ```
   - Cache eligibility: Eligible
   - Edge/Browser TTL: Respect origin
3. `protocol-bypass`（最後）
   - Expression:
     ```text
     (not (http.request.method in {"GET" "HEAD"}) or starts_with(http.request.uri.path, "/api/") or any(http.request.headers["rsc"][*] eq "1") or any(http.request.headers["next-router-prefetch"][*] eq "1") or any(http.request.headers["next-action"][*] ne ""))
     ```
   - Cache eligibility: Bypass

custom cache keyでcookie、User-Agent、RSC headerを追加しない。高カーディナリティなkeyはhit率を下げ、単一URL purgeも難しくする。HTMLはoriginの`s-maxage`を正とし、Cloudflare側で一律長期TTLへ上書きしない。

### 6.5 WAFとbot対策

Free planのRate Limiting Ruleは1件、10秒period、IP単位である。verified botを除外し、詳細ページ群だけを対象にする。

```text
(not cf.client.bot and (starts_with(http.request.uri.path, "/races/") or starts_with(http.request.uri.path, "/horses/") or starts_with(http.request.uri.path, "/jockeys/data/") or starts_with(http.request.uri.path, "/trainers/") or starts_with(http.request.uri.path, "/courses/") or starts_with(http.request.uri.path, "/sitemaps/data/")))
```

- threshold: 40 requests / 10 seconds / IP
- action: Managed Challenge
- mitigation: 10 seconds（dashboardで選べるFree値）

Free planではcached assetをcount対象から外せないため、Security Eventsで正規利用者のchallenge率を確認し、誤検知があれば閾値を上げる。検索クローラーへ適用するとSEOへ影響するため、`not cf.client.bot`を外さない。

Bot Fight Modeはdomain全体へ作用し、WAF ruleで例外化できない。最初の24時間はRate Limitingだけで観測し、AdSense、GA4、Clarity、Search Console、通常操作に問題がないことを確認してからONにする。問題があれば直ちにOFFへ戻す。

### 6.6 origin hardening

Cloudflare経由の主要ページとhealthが正常になった後、`Deploy Frontend to Cloud Run`を再実行する。

```text
disable_default_url=true
```

workflowは`https://uma-free.com/api/health`のrelease SHA一致を検証する。完了後、以前の`run.app/api/health`へ直接アクセスできないことを確認する。これによりWAF・rate limitの迂回経路を閉じる。

## 7. 段階公開workflow

1. `Keiba Data Page Publication`を`dry_run=true`で手動実行。
2. artifactの`capacity.json`と`report.json`を確認。
3. `cloud_run_metrics_available=true`であることを必須とする。
4. GSC障害は需要加点なしで継続できるが、Cloud Run指標障害はred・0件が正しい。
5. 初回applyは手動dispatchの`dry_run=false`。
6. 以後、毎日09:45 JSTに自動評価。

容量判定:

| mode | 条件 | 新規公開 |
| --- | --- | ---: |
| green | 月間換算vCPU秒<72,000、5xx<0.5%、p95<1.5秒、CF hit>=80%、max未飽和 | 100/日 |
| yellow | red未満、CF hit>=65%。CF指標未設定もyellow | 25/日 |
| red | 指標取得不能、月間換算>=120,000、5xx>=1%、p95>=2.5秒、max飽和、CF hit<65% | 0/日 |

初回のみ最大500件だが、redでは0件。初回500件は既存品質ページの再登録用であり、指標が取れない状態で強行しない。

## 8. 切替後の確認

### 直後

- health release SHA、主要route、asset、robots、canonical、sitemap。
- `CF-Cache-Status`がHTMLで2回目以降HIT/REVALIDATEDになるか。
- RSC responseを通常HTMLとして返していないか。
- GA4、Clarity、AdSense、楽天リンクが本番domainで動作するか。
- Cloud Run max instanceが2を超えないか、5xxが急増しないか。

### 24時間

- Cloudflare Cache Analyticsのhit率。
- Cloud Run billable instance time、request count、p95、5xx、instance count。
- Search Consoleのクロール異常、robots拒否、sitemap取得。
- 広告収益のゼロ化やGA4イベント欠落。

### 7日間

- 月間換算vCPU秒と無料枠余力。
- Cloudflare challengeの正規利用者・verified bot誤検知。
- 公開されたentity数とsitemap shard数。
- 404、Soft 404、重複canonical、noindexの想定外増加。

Search Consoleでは`https://uma-free.com/sitemap-data.xml`を再送信し、sitemap indexと各shardの取得件数を確認する。

## 9. ロールバック

### Cloudflareだけが不調

1. apex recordをProxiedからDNS-onlyへ戻す。
2. Cache Rules、Rate Limiting、Bot Fight Modeを無効化。
3. DNS-onlyのcustom domainでhealthと主要ページを確認。

### 新revisionが不調

```bash
gcloud run revisions list --service=keiba-frontend-v1 --region=us-west1 --project=keiba-api-project
gcloud run services update-traffic keiba-frontend-v1 --to-revisions=PREVIOUS_REVISION=100 --region=us-west1 --project=keiba-api-project
```

### custom domainが不調

診断用に既定URLを一時復旧する。

```bash
gcloud run services update keiba-frontend-v1 --default-url --region=us-west1 --project=keiba-api-project
```

復旧後にDNS-only、証明書、mapping recordを確認する。mappingを削除する前にDNS snapshotを確認し、Cloudflare zoneやTXT/MXをまとめて削除しない。

### 容量超過

段階公開workflowがredで0件になることを確認する。既存公開ページを一括noindexへ落とすと検索資産を毀損するため、まずcache rule、bot、異常URL、originログを確認し、原因routeだけを止める。

## 10. 今回実行しない操作

リポジトリ運用規約により、AIは次を実行しない。

- git commit、push。
- production workflowの実行。
- Cloud Run本番デプロイ。
- authoritative nameserver、DNS、Cloudflare proxyの変更。
- Search Consoleサイトマップ再送信。

コード、workflow、schema、テスト、手順までは実装済み。外部変更はこの文書の順にユーザーが実施する。

## 11. 公式資料

- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Run custom domain mapping: https://cloud.google.com/run/docs/mapping-custom-domains
- Cloud Run default URL disable: https://cloud.google.com/run/docs/securing/ingress
- Cloudflare Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare Cache Rules settings: https://developers.cloudflare.com/cache/how-to/cache-rules/settings/
- Cloudflare Rate Limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/
- Cloudflare Bot Fight Mode: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- Cloudflare Full (strict): https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
