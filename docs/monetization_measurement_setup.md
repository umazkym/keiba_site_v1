# UMA-FREE 収益計測・外部設定手順

更新日: 2026-08-03

## この手順の位置づけ

コード側の計測契約と週次レポートは実装済みだが、GA4–AdSenseリンク、GA4カスタム定義、AdSenseチャネル、Vercel環境変数、本番反映は管理画面の権限を持つ運用者が行う。リンク前のデータを遡及して収益帰属へ使わず、設定変更日を台帳へ記録する。新しい収益実験は、この文書の品質ゲートを満たすまで開始しない。

## 1. GA4とAdSenseの正式リンク

1. GA4の「管理 > サービス間のリンク設定 > AdSenseのリンク」を開く。
2. UMA-FREEで利用中のAdSenseパブリッシャーを選び、対象のウェブデータストリームを指定する。
3. AdSense側のサイトが`uma-free.com`であることを確認して送信する。
4. 設定日時を`docs/monetization_experiments.md`へ記録する。
5. 最大24時間待ち、GA4探索で`publisherAdRevenue`と`publisherAdImpressions`を取得できるか確認する。

公式仕様: [Google AnalyticsとAdSenseをリンクする](https://support.google.com/analytics/answer/13610380?hl=ja)

リンク後のデータだけを使う。リンク前のAdSense収益とGA4セッションを同一ユーザー単位へ推定結合しない。

## 2. GA4カスタム定義

イベントスコープで次を登録する。

| 表示名 | イベントパラメータ |
| --- | --- |
| 収益ページ種別 | `page_type` |
| コンテンツ群 | `content_group` |
| レース段階 | `race_phase` |
| 計測リリース | `measurement_release_id` |
| 広告配置 | `ad_placement` |
| 広告形式 | `ad_format` |
| 広告スロット | `ad_slot` |
| 広告variant | `ad_variant` |
| 実験ID | `experiment_id` |
| variant | `variant` |
| 記事slug | `article_slug` |
| 流入起点 | `entry_source` |
| SNS媒体 | `source_platform` |
| SNSコンテンツキー | `source_content_key` |
| 動画形式 | `video_format` |

`page_type`は`home / article / article_index / race_day / race_detail / data / other`、`content_group`は`grade_race / evergreen_guide / race_data / entity_data / utility`だけを使う。自由入力、検索語、馬名、保存内容はカスタム定義へ送らない。

## 3. AdSense URLチャネル

AdSenseの「レポート > 設定 > URLチャネル」で次を個別登録する。

- `https://uma-free.com/articles`
- `https://uma-free.com/races`
- `https://uma-free.com/keiba-data`
- `https://uma-free.com/courses`
- `https://uma-free.com/horses`
- `https://uma-free.com/jockeys`
- `https://uma-free.com/trainers`

公式仕様: [URLチャネル](https://support.google.com/adsense/answer/10075505?hl=ja)

## 4. 手動広告のカスタムチャネル

配置ごとにカスタムチャネルを作成し、発行された数値IDを次のVercel環境変数へ1つずつ設定する。1広告表示へ複数チャネルを割り当てない。

| 配置 | 環境変数 |
| --- | --- |
| 記事読了後 | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_BODY` |
| 記事導入後 | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_INTRO` |
| 記事中盤 | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_CONTENT` |
| 長文記事中盤 | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_LONG_CONTENT` |
| エンティティ記事末尾 | `NEXT_PUBLIC_AD_CHANNEL_ENTITY_AFTER_BODY` |
| レース分析後試作 | `NEXT_PUBLIC_AD_CHANNEL_RACE_ENGAGED` |
| レース末尾 | `NEXT_PUBLIC_AD_CHANNEL_RACE_END` |
| ホーム開催後 | `NEXT_PUBLIC_AD_CHANNEL_HOME_RACES` |

コードは数値だけを`data-ad-channel`へ出し、空欄・不正値は属性自体を出さない。公式仕様: [カスタムチャネル](https://support.google.com/adsense/answer/10078316?hl=ja)

## 5. 表示モードと開始前の固定値

開始前は次を維持する。

```text
NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE=legacy
NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE=off
NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE=control
NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=legacy
```

記事ブリッジはPublisherが`race_bridge_eligible=true`を保存しても、表示モードが`off`ならDOMも予約高も出さない。記事広告の`control`は現行順序の「関連記事→記事読了後広告」を維持する。

## 6. 7完全日の品質ゲート

`measurement_release_id`ごとに日次集計し、連続7完全日で以下をすべて満たす。

- `page_view`の`page_type`、`content_group`、`measurement_release_id`欠損が各5%未満。
- `sessionDefaultChannelGroup=Unassigned`がセッションの5%未満。
- 初回表示の`page_view`は1回、通常遷移は1回、レース内切替は0回。
- 広告の`ad_impression_custom`、`ad_viewable_custom`、実験露出が同一枠・同一セッションで重複していない。
- `publisherAdRevenue`が取得可能で、リンク設定日より前を含めていない。

週次workflowは`monetization-report.v1.json`を生成するが、日別7連続の最終判定はGA4探索で運用者が確認する。未確認時の`ready_for_new_experiment`は常に`false`である。

## 7. 本番反映後の確認

1. DebugViewでホーム、記事、日付レース、個別レース、データページを各1回表示する。
2. 記事ブリッジ`off`、記事広告`control`、レース広告`legacy`を確認する。
3. 375、390、768、1024、1440pxで広告未配信時も予約高が維持されることを確認する。
4. AdSenseポリシーセンター、GA4リアルタイム、Clarityのイベントを確認する。
5. 品質ゲート通過後、先行する1実験だけに開始日時Dと判断リマインドを登録してからモードを変更する。

Search Console APIの`page × query × device`が50,000行へ達した場合に限り、BigQuery一括エクスポートへ移す。それまでは現行APIを継続する。
