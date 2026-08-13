# 3月14日以降の収益分析・週次改善サイクル

## 完成状態

`monetization-history.v2`は、2026年3月14日を収益開始日、3月15日をGA4–AdSense連携境界として、AdSense・GA4・Search Console・Clarity・YouTube・GitHub Actions・Cloud Run・Cloudflareを同じ履歴契約へ正規化する。毎週水曜09:30 JSTに前週（月曜〜日曜）、前週比、直近28日、3月14日以降累積を生成し、木曜09:00 JSTのCodexタスクが最重要仮説を1件だけ選ぶ。

外部サービスへの書込み、広告変更、記事公開、SNS投稿、Git操作、デプロイは行わない。自動修正はユーザー確認前のローカル変更と検証までとする。

## 初回セットアップ

GitHub EnvironmentまたはRepository Secretsへ、投稿用資格情報とは分離した読取専用OAuthを登録する。

| 名前 | 用途 |
| --- | --- |
| `ADSENSE_OAUTH_CLIENT_ID` | AdSense Management API読取OAuth |
| `ADSENSE_OAUTH_CLIENT_SECRET` | 同上 |
| `ADSENSE_OAUTH_REFRESH_TOKEN` | `adsense.readonly`スコープのrefresh token |
| `YOUTUBE_ANALYTICS_OAUTH_CLIENT_ID` | YouTube Analytics読取OAuth |
| `YOUTUBE_ANALYTICS_OAUTH_CLIENT_SECRET` | 同上 |
| `YOUTUBE_ANALYTICS_OAUTH_REFRESH_TOKEN` | `yt-analytics.readonly`・`youtube.readonly`のrefresh token |
| `CLARITY_API_KEY` | 直近72時間のClarity Data Export |
| `CLOUDFLARE_ZONE_ID` | Cloudflare分析対象zone |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | Account Analytics読取トークン |

Repository Variablesは`GA4_PROPERTY_ID`、`GSC_SITE_URL`、必要なら`ADSENSE_ACCOUNT`を使う。Workflow権限は`contents: read`、`actions: read`、Google WIFに必要な`id-token: write`だけである。

## 初回バックフィル

Actionsの`Keiba Monetization History and Weekly Cycle`を手動実行し、`mode=backfill`、`start_date=2026-03-14`を指定する。`end_date`は空欄なら最新完全日曜になる。

3月14〜15日は部分期間で、最初の完全週は3月16〜22日になる。Clarityは公式APIで遡れない期間を`unavailable`として残し、0へ変換しない。Search Consoleは`dataState=final`で取得し、行上限到達時は`partial`とする。

## 毎週の成果物

Workflow artifact `monetization-cycle-YYYY-MM-DD`に次を保存する。

- `monetization-history.v2.json`: 正規化履歴と媒体別lineage
- `source-status.v2.json`: `complete` / `partial` / `unavailable` / `failed`
- `monetization-cycle-analysis.v1.json`: 7日、前週、28日、累積、収益照合、原因候補
- `UMA-FREE_週次収益改善.md`: 人が読む週次要約
- `UMA-FREE_週次収益改善.xlsx`: 12シートの再計算・確認用ブック
- `raw/`: APIから受け取った変更前原本
- Clarity、インフラ、記事台帳、重賞日程の補助原本

XLSXは「経営ダッシュボード」「週次推移」「流入源」「検索機会」「重賞記事」「広告収益」「YouTube・SNS」「障害」「ファネル」「改善台帳」「取得品質」「原本」で構成する。ローカルの描画・数式検証はArtifact Tool版`build_monetization_workbook.mjs`を使い、Actionsでは同じ12シート契約のCI版を使う。

## 判定ルール

- AdSenseを収益の正本とし、GA4広告収益は帰属分析値とする。差が5%を超えても失敗にせず`review`とする。
- 正式週はAdSense・GA4・GSCの日別行が対象7日すべてに存在する場合だけ`formal=true`にする。
- 重賞はD-21〜D+3で、記事なし、公開遅延、検索表示なし、CTR不足、GA4到達未確認、収益効率不足、良好へ分類する。
- 原因候補は取得品質、障害、重賞機会損失、検索CTR、収益効率の順で評価し、根拠と反証を併記する。
- YouTube・SNSは媒体到達だけで評価せず、GA4の参照元・UTM、レース閲覧、広告表示と照合する。媒体API未提供値は未取得のまま残す。
- Workflow失敗と収益低下が同日に発生しても相関として記録し、因果とは断定しない。

## 変更してよい範囲

毎週1仮説・1変更に限定する。分析・取得・計測コードの不具合、イベント名を変えない計測欠損、根拠が確認できた重賞台帳、条件を満たす既存記事1件のtitle・description・導入・既存H2だけが候補になる。広告配置・広告数、アフィリエイトURL、外部投稿、公開、本番DB、Secrets、Git、デプロイは対象外である。
