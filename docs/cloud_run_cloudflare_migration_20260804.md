# Vercel停止からCloud Run + Cloudflareへ移行する実装・運用手順

作成日: 2026-08-04  
対象: UMA-FREEフロントエンド  
状態: コード、再利用可能workflow、合算容量ゲート、DB起動保護、手順を実装。本番デプロイ、DNS切替、Cloudflare・秘密情報設定は未実施。

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

Cloud Runは従量課金であり「必ず0円」ではない。request-based billingの無料枠は月180,000 vCPU秒、360,000 GiB秒、200万リクエストだが、同一請求先の他プロジェクトを含めて集計され、外向き通信やArtifact Registryも別に費用が生じ得る。実装した容量ゲートはフロントとAPIのCPU、割当メモリ、リクエスト、internet egressを合算し、公式無料枠や許容費用より手前で新規検索公開だけを止める。

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
- `.github/workflows/deploy-frontend-cloud-run.yml`: 手動、対象pathのmain push、記事・GSC workflowから呼べるbuild・push・deploy・release一致確認。
- 記事・GSC workflowは実際にcommitが作られた時だけ公開後SHAを渡す。`GITHUB_TOKEN`による自動pushが別workflowを発火しない制約を回避する。
- `CLOUD_RUN_FRONTEND_AUTO_DEPLOY_ENABLED=false`では通常pushと記事からの自動デプロイを行わず、移行完了後だけ`true`にする。
- `min=0`、`max=2`、1 vCPU、1 GiB、concurrency 40、CPU throttling、startup CPU boost無効、timeout 30秒。

デプロイworkflowの`disable_default_url`は二段階で使う。

| 段階 | 値 | 目的 |
| --- | --- | --- |
| 初回bootstrap | `false` | `run.app`で主要ページとreleaseを確認し、domain mappingを作成できる状態にする |
| Cloudflare疎通後 | `true` | 独自ドメインで同一SHAを確認してから`run.app`直アクセスを閉じる。無効化後に失敗した場合は自動復旧 |

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

デプロイ用SAにはプロジェクトで`roles/run.admin`、`roles/artifactregistry.writer`を付け、runtime SAに対する`roles/iam.serviceAccountUser`を付ける。Workload Identity Poolのrepository条件は`umazkym/keiba_site_v1`へ限定する。既存の`github-actions-iap-db` SAには段階公開workflow用に`roles/monitoring.viewer`を追加する。DB送信量の収集では、同SAがIAP接続用に保持する`keiba-db`のinstance参照権限でinstance IDを解決し、指標収集後にCloud Runデプロイ用SAへ再認証してガード状態だけを更新する。権限は対象SA・対象repositoryへ限定し、OwnerやEditorを付けない。

GitHub Actionsで使う既存provider:

```text
projects/761440273070/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
```

### 4.3 GitHub Repository Variables / Secrets

Repository Variables:

- `CLOUD_RUN_FRONTEND_AUTO_DEPLOY_ENABLED`（初回は必ず`false`、切替・hardening完了後だけ`true`）
- `GCP_FRONTEND_DEPLOY_SERVICE_ACCOUNT`
- `GCP_FRONTEND_RUNTIME_SERVICE_ACCOUNT`
- `GSC_SITE_URL`（未設定時は`sc-domain:uma-free.com`）
- `CLOUDFLARE_ZONE_ID`
- 現行Vercel Productionにある全`NEXT_PUBLIC_*`

最低限、`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_GA_ID`、`NEXT_PUBLIC_CLARITY_PROJECT_ID`、広告モード、広告チャネル8件、楽天競馬URL・モード、公式SNS URL、計測release/experiment系を漏らさない。`NEXT_PUBLIC_*`はブラウザへ公開される値であり、API secretやprivate keyを置いてはいけない。

Repository Secrets:

- `DATABASE_URL`（既存。IAP actionが実行時だけlocalhostへ変換）
- `CLOUDFLARE_ANALYTICS_API_TOKEN`（Cloudflare GraphQL用のAccount Analytics readだけ。値が表示・記録された場合は即時失効し、再発行する）
- `GEMINI_API_KEY`（GitHub自動処理専用、Generative Language APIだけを許可）

Vercelから値を移す際は画面上で一件ずつ照合し、文書やActionsログへ値そのものを出力しない。

## 5. 反映順序

### 5.1 DB schema

1. `Database Schema Migration` workflowを`dry_run=true`で実行。
2. 対象が`data_page_publications`だけであることを確認。
3. `dry_run=false`で再実行。
4. 外部DB IPを作らず、`.github/actions/setup-iap-db`経由で接続できたことを確認。

### 5.2 backend DB資格情報の無停止分離

API起動時の`Base.metadata.create_all()`は、未設定のSQLiteだけで動くよう変更した。PostgreSQLとCloud Runでは`ALLOW_SCHEMA_CREATE`未設定でもDDLを実行しない。最初にこのコードを現在のDB資格情報でデプロイし、APIが正常なことを確認してからruntimeロールへ切り替える。

1. backendを現行資格情報のままデプロイし、ログに次が出ることを確認する。

   ```text
   [DB] Schema auto-create skipped for postgresql
   ```

2. IAPトンネルを開始する。旧外部IPを使用しない。

   ```bash
   gcloud compute start-iap-tunnel keiba-db 5432 --project=keiba-api-project --zone=us-west1-b --local-host-port=127.0.0.1:15432
   ```

3. 別ターミナルからDB所有者で`127.0.0.1:15432`へ接続し、DB名とschema ownerを確認する。

   ```sql
   SELECT current_database(), current_user;
   SELECT nspname, pg_get_userbyid(nspowner) AS schema_owner
     FROM pg_namespace
    WHERE nspname = 'public';
   ```

4. `<DB_NAME>`と`<SCHEMA_OWNER>`を確認結果へ置換し、runtimeロールを作る。パスワードはSQLやshell履歴へ書かず、psqlの`\password keiba_app_runtime`で対話入力する。

   ```sql
   CREATE ROLE keiba_app_runtime LOGIN;
   \password keiba_app_runtime

   GRANT CONNECT ON DATABASE <DB_NAME> TO keiba_app_runtime;
   GRANT USAGE ON SCHEMA public TO keiba_app_runtime;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO keiba_app_runtime;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO keiba_app_runtime;

   ALTER DEFAULT PRIVILEGES FOR ROLE <SCHEMA_OWNER> IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO keiba_app_runtime;
   ALTER DEFAULT PRIVILEGES FOR ROLE <SCHEMA_OWNER> IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO keiba_app_runtime;

   REVOKE CREATE ON SCHEMA public FROM keiba_app_runtime;
   ```

5. Secret Managerで`keiba-backend-database-url`を作り、runtimeロールの内部IP接続URLを新しいversionとして画面から登録する。値をCloud Shell履歴、Issue、Actionsログへ貼らない。
6. backendのruntime service accountへ、このSecretだけの`Secret Manager Secret Accessor`を付与する。
7. Cloud Runの`keiba-site-v1`を編集し、同一revision内で次を変更する。
   - 平文`DATABASE_URL`を削除し、確認済みの固定version（初回は`keiba-backend-database-url:1`）を参照するSecret環境変数`DATABASE_URL`へ置換。
   - `ALLOW_SCHEMA_CREATE=false`を追加。
   - CPU、メモリ、concurrency 80、min 0、max 3、VPC設定は変更しない。
   - `gcloud run services update`で平文環境変数から同名Secretへ変更する場合は、型競合を避けるため、削除とSecret追加を必ず同一更新で実行する。`--remove-env-vars=DATABASE_URL`だけを単独実行しない。

   ```bash
   gcloud run services update keiba-site-v1 \
     --project=keiba-api-project \
     --region=us-west1 \
     --remove-env-vars=DATABASE_URL \
     --update-secrets=DATABASE_URL=keiba-backend-database-url:1 \
     --update-env-vars=ALLOW_SCHEMA_CREATE=false \
     --quiet
   ```
8. 新revisionへ100%を流し、レース一覧、予測、データ検索、楽天URL解決、ログのDB権限エラーがないことを確認する。
9. `Database Schema Migration`を`dry_run=true`で実行する。成功後、DB所有者のパスワードをpsqlの`\password <OWNER_ROLE>`で変更し、GitHub Secret `DATABASE_URL`を更新する。
10. 以後はSecret参照済みrevisionより前へロールバックしない。旧revisionは所有者パスワード変更後にDB接続できないため、ロールバック先のrevision名を記録する。

### 5.3 backend

既存の手動手順でbackendを先に反映し、次を確認する。

```text
/api/v1/data/sitemap-manifest
/api/v1/data/sitemap-shards/course/1
/api/v1/data/horses/{既知ID}
```

publication rowがない状態ではデータ詳細の`indexable=false`が正しい。フロントを先に反映すると旧APIが新フィールドを返さないが、frontend側も安全側のcandidate/noindexへ縮退する。

### 5.4 frontend bootstrap

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

レース系のorigin TTLはJSTの日付差で統一する。当日・前日・翌日は5分、2〜14日前は24時間かつstale 7日、15日以上前は30日かつstale/stale-if-error 90日。馬・騎手・調教師・コース詳細は24時間かつstale 7日とする。データ修復時は`Purge Race Date Cache` workflowで対象日だけを再検証し、Cloudflareも日付ページと同日のレース詳細URLだけをexact purgeする。purge用SecretはZone Cache Purge権限だけを持つ`CLOUDFLARE_CACHE_PURGE_API_TOKEN`とし、Analytics read-only tokenを流用しない。

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

24時間の正常稼働を確認したら、GitHub Repository Variable `CLOUD_RUN_FRONTEND_AUTO_DEPLOY_ENABLED`を`true`へ変更する。以後、記事・GSC補修の新commitとフロント関連のmain pushだけが自動デプロイされる。自動デプロイも独自ドメインの同一SHA確認後に`run.app`を閉じるため、hardening状態を維持する。

## 7. 段階公開workflow

1. `Keiba Data Page Publication`を`dry_run=true`で手動実行。
2. artifactの`capacity.json`と`report.json`を確認。
3. `schema_version=cloud-run-capacity.v3`、`required_services`に`keiba-frontend-v1`と`keiba-site-v1`、`cloud_run_metrics_available=true`、`db_network_metrics_available=true`であることを必須とする。
4. GSC障害は需要加点なしで継続できるが、Cloud Run指標障害はred・0件が正しい。
5. 初回applyは手動dispatchの`dry_run=false`。
6. 以後、毎日09:45 JSTに自動評価。

容量判定:

| mode | 条件 | 新規公開 |
| --- | --- | ---: |
| green | CPU<72,000秒、メモリ<144,000 GiB秒、request<800,000、internet egress<2GiB、5xx<0.5%、p95<1.5秒、CF hit>=80%、max未飽和 | 100/日 |
| yellow | red未満だがgreen条件を満たさない。CF指標未設定もyellow | 25/日 |
| red | 必須サービス指標取得不能、CPU>=120,000秒、メモリ>=240,000 GiB秒、request>=1,400,000、internet egress>=10GiB、5xx>=1%、p95>=2.5秒、max飽和、CF hit<65% | 0/日 |

初回のみ最大500件だが、redでは0件。初回500件は既存品質ページの再登録用であり、指標が取れない状態で強行しない。

### 7.1 DBゾーン間転送ガード

`Keiba DB Egress Guard`を毎時実行し、`keiba-db`の`compute.googleapis.com/instance/network/sent_bytes_count`を24時間・7日間で集計する。

| 判定 | 条件 | 動作 |
| --- | --- | --- |
| warning | 24時間で0.5GiB以上 | artifactとJob Summaryへ警告。新規公開判定はyellow以上 |
| red | 24時間で2GiB以上、指標取得不能、または「7日で10GiB以上 かつ 24時間で0.5GiB以上」 | フロントの`ARCHIVE_COST_GUARD_MODE=stale-only`を有効化し、新規データページ公開は0件 |
| recovery | 24時間で0.5GiB未満 | ガードを`normal`へ戻す。24時間窓そのものを復旧確認期間として使う |

7日窓の条件には24時間窓の条件を掛け合わせている（2026-08-16変更）。
redが7日窓・recoveryが24時間窓という非対称のままだと、原因を修正しても
7日窓から古い実績が抜けるまで丸1週間データページの新規公開が止まる。
7日窓は「じわじわ増え続けている」状態を捕まえる保険なので、
直近24時間が既に収束しているケースでは縮退を維持しない。

ガード中も既存のCloudflare staleキャッシュ、人間の閲覧、当日ページ、記事、主要公開ページは維持する。15日以上前のレース、および未公開対象を含む馬・騎手・調教師・コース詳細に対する既知crawlerのorigin missだけが503と`Retry-After`になり、重いDB集計へ到達しない。公開済みページはCloudflareのstaleキャッシュが優先される。通常時はverified botを遮断しない。

### 7.2 予算通知（停止処理なし）

現在の請求先全体1,000円予算は残し、別に`keiba-api-project`の全サービスを対象とする月300円予算を設ける。クレジット・割引適用後の純額を監視し、実際の請求額が月300円へ近づく前に通知する。

| 通知 | 種別 | 金額換算 |
| --- | --- | ---: |
| 30% | Actual | 90円 |
| 60% | Actual | 180円 |
| 100% | Actual | 300円 |
| 100% | Forecasted | 300円予測 |

Billing管理者と運用者本人へのメール通知を有効にする。Cloud Run Spend Capや予算連動のサービス停止は設定しない。異常増加時もサイトを止めず、段階公開をyellow/redへ縮退させる。

2026-08-12に予算名を`UMA-FREE Project 300 JPY`へ変更し、対象を`keiba-api-project`の全サービス、クレジット・割引反映後へ更新済み。通知は実額30%・60%・100%と予測100%で、請求先全体1,000円予算は維持する。

### 7.3 Gemini APIキーの交換

1. Google Cloud CredentialsまたはGoogle AI StudioでGitHub自動処理専用キーを新規作成する。
2. API restrictionsを`Generative Language API`だけにする。GitHub hosted runnerのIPは固定でないためApplication restrictionsは`None`とし、API範囲を限定する。
3. GitHub Secret `GEMINI_API_KEY`を新しい値へ更新する。
4. `Gemini API Key Read-only Smoke Test` workflowを手動実行する。このworkflowはモデル一覧を読むだけで、記事公開・DB更新・Git操作を行わない。
5. 成功後、旧無制限キーを無効化する。24時間、自動記事・朝午後データworkflowに認証エラーがないことを確認してから削除する。
6. キー値をActionsログやローカルのコマンド履歴へ出力しない。

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
- Cloud Run Secret Manager integration: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Monitoring Cloud Run metrics: https://cloud.google.com/monitoring/api/metrics_gcp_p_z#gcp-run
- Google Cloud budgets: https://cloud.google.com/billing/docs/how-to/budgets
- GitHub Actions workflow triggering: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
- Cloudflare Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare Cache Rules settings: https://developers.cloudflare.com/cache/how-to/cache-rules/settings/
- Cloudflare Rate Limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/
- Cloudflare Bot Fight Mode: https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- Cloudflare Full (strict): https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
