# クラウド課金の月次監視

更新日: 2026-08-27

## 目的

請求先アカウント `011792-1B921B-D482B0` の実費を月1回確認し、想定外の増加を早期に見つける。
Cloud Monitoring の推定値ではなく、**課金レポートの確定値**で判断する。

推定と実額は食い違う。`12_コスト最適化アーキテクチャ.md` §9.7 は「GCE→Cloud Run 転送が課金対象か」を
推定のまま未確定で残し、§11.4 で課金レポートを読んで初めて決着した。同じことを繰り返さない。

## 月次で確認する手順

1. [請求先アカウント一覧](https://console.cloud.google.com/billing) を開き、「過去 30 日間の費用」を見る。
   請求先アカウントには4プロジェクトがぶら下がっており、Cloud Run の無料枠は**プロジェクト単位ではなく
   請求先アカウント単位で共有される**（`12_コスト最適化アーキテクチャ.md` §10.1）。keiba だけを見ても判断できない。
2. [レポート](https://console.cloud.google.com/billing/011792-1B921B-D482B0/reports) を開き、
   「グループ化」を **SKU** に変更する。サービス単位では原因が特定できない。
3. 増えている SKU を1件だけ選んで SKU フィルタで絞り、**日次グラフの形を見る**。
   月次の合計額では「継続中の高額コスト」と「既に終息したバースト」が区別できない。
4. 「今月末の予想」と「25日時点の実績」を比べる。差が小さければ、その支出は既に止まっている。

`gcloud` からも読める。ポリシーや設定の現況確認にはこちらが速い。

```bash
gcloud artifacts repositories list --project=keiba-api-project
```

```bash
gcloud run services list --project=keiba-api-project --region=us-west1
```

## 判定基準

| 観測 | 疑うもの |
| :--- | :--- |
| `Network Inter Zone Data Transfer Out` が増加 | Cloud Run から GCE PostgreSQL への問い合わせ量。1リクエストあたりのDB送信量を疑う（§9.2、§9.3） |
| `Services CPU (Request-based billing)` が増加 | オリジン到達の増加。Cloudflare のキャッシュヒット率とクローラー流入を見る（§9.4） |
| `Artifact Registry Storage` が増加 | クリーンアップポリシーの失効。`deploy-frontend-cloud-run.yml` は commit SHA タグのみを打つため、**untagged 条件のポリシーでは1バイトも減らない**。`keep-recent-N` と `olderThan` で管理する |
| `E2 Instance Core / Ram` の増加 | DB VM の稼働時間。無料枠を他プロジェクトと食い合っていないか |
| keiba は健全なのに請求先全体が増加 | 他プロジェクト。`kotoba-map-demo` の Cloud Scheduler が過去に24時間課金を起こした（§10.2） |

## 予算アラートの構成

| 予算名 | 対象 | しきい値 |
| :--- | :--- | :--- |
| 請求先全体 ¥1,000 | 請求先アカウント全体 | 実額 + 予測100% |
| `UMA-FREE Project 300 JPY` | `keiba-api-project` | 実額 30% / 60% / 100% + 予測100% |
| `Gemini API (gen-lang) 100 JPY` | AI Studio の2プロジェクト | 実額 50% / 100% + 予測100% |

いずれも通知のみで、サービスの停止処理は行わない。

## 現行の実費（2026-08 実測）

| 対象 | 金額 |
| :--- | :--- |
| GCP | 8/1〜8/25 ¥551、月末予想 ¥1,017（7月確定請求は ¥2） |
| お名前.com（`uma-free.com`） | 1,788円/年 |
| Render | $0（全サービス Suspended、Hobbyプラン） |
| Vercel | $0（チームは Paused、Hobbyプラン） |

GCP の中心は e2-micro の実費（Core ¥500 + RAM ¥268）で、DBを動かす以上避けられない。

## 落とし穴

`backend/scripts/agents/cloud_run_capacity.py` を**ローカルで実行して容量判定を確かめてはいけない。**
`google-cloud-monitoring` は `backend/requirements.txt` にも `requirements-api.txt` にも入っておらず、
各ワークフローが `pip install` ステップで個別に導入している。ローカルでは import に失敗し、
`cloud_run_metrics_available: false` が返る。`data_page_publication.py` の `determine_capacity_mode()` は
これを無条件で red と判定するため、本番が正常でも「壊れている」ように見える。

本番の判定値は GitHub Actions の artifact `data-page-publication-{run_id}` に含まれる
`capacity.json` / `summary.md` で確認する。

## 検討して見送った選択肢

| 選択肢 | 判断 | 理由 |
| :--- | :--- | :--- |
| ドメインを Cloudflare Registrar へ移管 | 見送り | お名前.com 1,788円/年に対し Cloudflare は原価提供で $10.4〜11.2/年 + 海外事務手数料。差はほぼ無く、為替次第で逆転する |
| DB を Cloud SQL へ移行、または停止時間帯の導入 | 見送り | 月数百円のために可用性を落とす価値がない |
| Cloud Run 間の内部経路化 | 見送り | 削減見込みは月4.2GB（約¥75）にとどまる（§9.5） |
| BigQuery 請求エクスポートの設定 | 不要 | 課金レポートの SKU 別 + 日次グラフで確定できる（§11.4） |

## 関連

- [`system-documentation/12_コスト最適化アーキテクチャ.md`](./system-documentation/12_コスト最適化アーキテクチャ.md) — 構成の選定理由、インシデントの積層記録（§8〜§11）
- [`system-documentation/08_デプロイメント.md`](./system-documentation/08_デプロイメント.md) — デプロイ手順と監視用コンソールURL
- [`cloud_run_cloudflare_migration_20260804.md`](./cloud_run_cloudflare_migration_20260804.md) — Cloudflare 側の設定とロールバック
- `agent-sops/cost-performance-isr-review.sop.md` — エージェント向けの実行手順
