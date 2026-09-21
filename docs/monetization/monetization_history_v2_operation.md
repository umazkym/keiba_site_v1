# 3月14日以降の収益分析・週次改善サイクル

## 完成状態

`monetization-history.v2`は、2026年3月14日を収益開始日、3月15日をGA4–AdSense連携境界として、AdSense・GA4・Search Console・Clarity・YouTube・GitHub Actions・Cloud Run・Cloudflareを同じ履歴契約へ正規化する。毎週水曜09:30 JSTに、3日以上経過した最新の日曜までの前週（月曜〜日曜）、前週比、直近28日、3月14日以降累積を生成する。取得不足の場合だけ木・金の同時刻に再試行し、取得済みなら省略する。木曜09:00 JSTのCodexタスクは最重要仮説を1件だけ選ぶ。

収集処理は外部サービスへの書込み、広告変更、記事公開、SNS投稿、Git操作、デプロイを行わない。ユーザー指定の[簡易通知](revenue-notifications.md)のみ、別ジョブからGitHub Issueへ投稿する。自動修正はユーザー確認前のローカル変更と検証までとする。

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

Repository Variablesは`GA4_PROPERTY_ID`、`GSC_SITE_URL`、必要なら`ADSENSE_ACCOUNT`を使う。収集ジョブ権限は`contents: read`、`actions: read`、Google WIFに必要な`id-token: write`。通知ジョブは別に`issues: write`を使い、Google等のSecretsとOIDC権限は持たない。

## 初回バックフィル

Actionsの`Keiba Monetization History and Weekly Cycle`を手動実行し、`mode=backfill`、`start_date=2026-03-14`を指定する。`end_date`は空欄なら最新完全日曜になる。

3月14〜15日は部分期間で、最初の完全週は3月16〜22日になる。Clarityは公式APIで遡れない期間を`unavailable`として残し、0へ変換しない。Search Consoleは`dataState=final`で取得し、行上限到達時は`partial`とする。

## 毎週の成果物

非公開リポジトリではWorkflow artifact `monetization-cycle-YYYY-MM-DD`に次を保存する。公開リポジトリでは金額を含まない`revenue-notice-weekly`のみを保存し、以下の詳細は一時実行領域での集計に留める。過去の公開済み成果物を自動削除する変更ではない。

- `monetization-history.v2.json`: 正規化履歴と媒体別lineage
- `source-status.v2.json`: `complete` / `partial` / `unavailable` / `failed`
- `monetization-cycle-analysis.v1.json`: 7日、前週、28日、累積、収益照合、原因候補、`measurement_quality`
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
- `measurement_quality`は既存の`monetization-history.v2`正規化rawを再利用する。GA4の明示された`(not set)`（参照元・チャネル・キャンペーン）、`Unassigned`、landingの`(not set)`について、日別の分子・分母・取得期間・欠損日・`complete` / `partial` / `unavailable`を出力する。空・欠損したディメンションは`(not set)`と推定せず、欠損として別記する。欠損日、指標欠損、partialな正規化行は0に補完せず、その日の日次率・差分・完全期間合計を算出しない。GA4のacquisition（`date, sessionDefaultChannelGroup, sessionSourceMedium, sessionCampaignName`）には端末ディメンションがないため、参照元の端末別分析は出力しない。
- `overall_status`はGA4日次・acquisition・landing、AdSense日次のrequests・coverage・viewabilityの必須品質を統合する。GA4日次とacquisition/landing内訳の合計差は日別に表示するが、GA4のスコープ・集計差を含み得るため一致を必須条件にせず、差だけで原因を断定しない。AdSenseは日別原本から`ad_requests`、`ad_requests_coverage`、`active_view_viewability`を確認し、単価やPage RPMだけで収益変動を説明しない。Active View measurable impressionsが原本にないため、viewabilityの期間値は`null`とし、日別率だけを残す。
- AdSense `payments`は週次の広告実績ではなく任意の補助取得である。`payments`のみが失敗した場合、失敗内容（アカウント警告を含む）は`source-status.v2`のreport内訳に残し、日別広告実績が揃っていれば広告実績のsource statusをpartialへ変更しない。日別広告実績の取得失敗は従来どおりpartial/failedとして扱う。

## 変更してよい範囲

毎週1仮説・1変更に限定する。分析・取得・計測コードの不具合、イベント名を変えない計測欠損、根拠が確認できた重賞台帳、条件を満たす既存記事1件のtitle・description・導入・既存H2だけが候補になる。広告配置・広告数、アフィリエイトURL、外部投稿、公開、本番DB、Secrets、Git、デプロイは対象外である。
