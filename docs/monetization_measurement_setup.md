# UMA-FREE 収益計測・外部設定手順

更新日: 2026-08-03

## この手順の位置づけ

コード側の計測契約と週次レポートは実装済み。2026-08-03にGA4–AdSenseの既存リンクとGA4カスタム定義を実画面で確認し、観測済みパラメータの不足定義を追加した。同日、AdSenseのURLチャネル7件と配置別カスタムチャネル8件を作成し、VercelのProduction環境へ配置別IDを登録した。リンク前のデータを遡及して収益帰属へ使わず、設定変更日を台帳へ記録する。新しい収益実験は、この文書の品質ゲートを満たすまで開始しない。

## 1. GA4とAdSenseの正式リンク

2026-08-03の実画面確認では、GA4プロパティとコンテンツ向けAdSenseは2026-03-15付でリンク済みで、GA4の収益化レポートにも広告収益が表示されていた。リンクを作り直さない。将来リンクが解除された場合だけ、次の手順で復旧する。

1. GA4の「管理 > サービス間のリンク設定 > AdSenseのリンク」を開く。
2. UMA-FREEで利用中のAdSenseパブリッシャーを選び、対象のウェブデータストリームを指定する。
3. AdSense側のサイトが`uma-free.com`であることを確認して送信する。
4. 設定日時を`docs/monetization_experiments.md`へ記録する。
5. 最大24時間待ち、GA4探索で`publisherAdRevenue`と`publisherAdImpressions`を取得できるか確認する。

公式仕様: [Google AnalyticsとAdSenseをリンクする](https://support.google.com/analytics/answer/13610380?hl=ja)

リンク後のデータだけを使う。リンク前のAdSense収益とGA4セッションを同一ユーザー単位へ推定結合しない。

## 2. GA4カスタム定義

イベントスコープで次を登録する。カスタム定義は遡及適用されないため、高速・標準どちらの品質ゲートも定義作成と対象リリースの本番反映後から数える。

| 表示名 | イベントパラメータ | 2026-08-03時点 |
| --- | --- | --- |
| 収益ページ種別 | `page_type` | 登録済み（8月3日追加） |
| コンテンツ群 | `content_group` | 登録済み（8月3日本番反映後） |
| レース段階 | `race_phase` | 登録済み（8月3日本番反映後） |
| 計測リリース | `measurement_release_id` | 登録済み（8月3日追加） |
| 広告配置 | `ad_placement` | 登録済み |
| 広告形式 | `ad_format` | 登録済み |
| 広告スロット | `ad_slot` | 登録済み |
| 広告variant | `ad_variant` | 登録済み |
| 実験ID | `experiment_id` | 登録済み（8月3日追加） |
| variant | `variant` | 対象イベント観測後に登録 |
| アフィリエイト提供元 | `provider` | 登録済み |
| アフィリエイト配置 | `context` | 登録済み |
| アフィリエイト施策 | `campaign_id` | 登録済み（8月3日追加） |
| アフィリエイトリンク | `link_id` | 登録済み（8月3日追加） |
| アフィリエイトページ種別 | `affiliate_page_type` | 登録済み |
| 記事slug | `article_slug` | 登録済み |
| 流入起点 | `entry_source` | 登録済み（8月3日追加） |
| SNS媒体 | `source_platform` | 対象イベント観測後に登録 |
| SNSコンテンツキー | `source_content_key` | 対象イベント観測後に登録 |
| 動画形式 | `video_format` | 対象イベント観測後に登録 |

`page_type`は`home / article / article_index / race_day / race_detail / data / other`、`content_group`は`grade_race / evergreen_guide / race_data / entity_data / utility`だけを使う。自由入力、検索語、馬名、保存内容はカスタム定義へ送らない。

`content_group`と`race_phase`は2026-08-03の本番反映後、GA4のイベントスコープ定義へ正しいパラメータ名を直接指定して登録した。本番反映は2026-08-03 10:56 JST、ホーム・記事・レース・データページの初回表示確認も同日に完了した。最初の完全日は2026-08-04とする。

## 3. AdSense URLチャネル

2026-08-03に次の7 URLチャネルを登録済み。削除・再作成せず、この日以降の集計に使用する。

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

2026-08-03に配置別カスタムチャネル8件を作成した。既存広告ユニットを複数チャネルへ紐付けると集計が重複するため、AdSense管理画面では広告ユニットを選択せず、コードの`data-ad-channel`で1広告表示につき1チャネルだけを指定する。

| 配置 | AdSenseチャネル名 | チャネルID | Vercel環境変数 |
| --- | --- | --- | --- |
| 記事読了後 | `uma_article_after_body` | `9574367563` | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_BODY` |
| 記事導入後 | `uma_article_after_intro` | `4785075314` | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_INTRO` |
| 記事中盤 | `uma_article_mid_content` | `3634665239` | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_CONTENT` |
| 長文記事中盤 | `uma_article_mid_long` | `8261285891` | `NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_LONG_CONTENT` |
| エンティティ記事末尾 | `uma_entity_after_body` | `3471993648` | `NEXT_PUBLIC_AD_CHANNEL_ENTITY_AFTER_BODY` |
| レース分析後試作 | `uma_race_engaged` | `2321583566` | `NEXT_PUBLIC_AD_CHANNEL_RACE_ENGAGED` |
| レース末尾 | `uma_race_end` | `3838825159` | `NEXT_PUBLIC_AD_CHANNEL_RACE_END` |
| ホーム開催後 | `uma_home_races` | `5151906821` | `NEXT_PUBLIC_AD_CHANNEL_HOME_RACES` |

コードは数値だけを`data-ad-channel`へ出し、空欄・不正値は属性自体を出さない。`NEXT_PUBLIC_*`はビルド時に確定するため、VercelのProductionへ8値を追加し、2026-08-03 11:30:25 JSTに再デプロイ`FGYUmBGJ6ZNqs1isCJYhgiGR8v7z`がReadyになった。本番DOMではホーム開催後の`5151906821`と記事導入後の`4785075314`を確認した。レース末尾はOfferwallの広告視聴を回避して未確認とし、広告を操作せず、環境設定・コード対応・本番ビルド成功を証跡とする。公式仕様: [カスタムチャネル](https://support.google.com/adsense/answer/10078316?hl=ja)

## 5. 表示モードと開始前の固定値

開始前は次を維持する。

```text
NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE=legacy
NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE=off
NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE=control
NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=legacy
```

記事ブリッジはPublisherが`race_bridge_eligible=true`を保存しても、表示モードが`off`ならDOMも予約高も出さない。記事広告の`control`は現行順序の「関連記事→記事読了後広告」を維持する。

## 6. 二段階の品質ゲート

2026-08-03の運用承認により、早期開始と標準確認を併用する。`measurement_release_id`ごとに日次集計し、次のどちらかを満たした場合だけ開始候補とする。

- 高速ゲート: 連続3完全日で`page_type`、`content_group`、`measurement_release_id`欠損と`Unassigned`が各2%未満、かつ3日合計500セッション以上。
- 標準ゲート: 連続7完全日で同じ4指標が各5%未満。高速ゲートが未達でも観測を継続する。

どちらの経路でも次をすべて満たす。

- 初回表示の`page_view`は1回、通常遷移は1回、レース内切替は0回。
- 広告の`ad_impression_custom`、`ad_viewable_custom`、実験露出が同一枠・同一セッションで重複していない。
- `publisherAdRevenue`が取得可能で、リンク設定日より前を含めていない。

週次workflowはGA4 Data APIを使い、完全日ごとに4つの欠損率を計算して`monetization-report.v1.json`へ保存する。高速・標準それぞれの連続日数、3日窓のセッション数、採用された`gate_mode`を保持する。日付が連続しない場合や閾値以上の場合は該当経路の連続日数をリセットする。`ready_for_new_experiment=true`になっても実験を自動開始せず、運用者がGA4探索で同じ期間を確認する。

## 7. 実験リリースゲート

実験モードへ変更する本番ビルドでは、次のサーバー側環境変数も必須となる。通常運用の固定値では不要。値が不足する、対象リリースが異なる、最終確認日が古い、複数実験が有効な場合は`npm run build`が失敗する。

```text
MONETIZATION_ACTIVE_EXPERIMENT_ID=MOBILE-RACE-ENGAGED-AD-2026-08
MONETIZATION_QUALITY_GATE_STATUS=passed
MONETIZATION_QUALITY_GATE_MODE=accelerated
MONETIZATION_QUALITY_GATE_OBSERVED_DAYS=3
MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE=0.019
MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS=500以上の実測値
MONETIZATION_QUALITY_GATE_RELEASE_ID=2026-08-01-ga-route-v2
MONETIZATION_QUALITY_GATE_END_DATE=YYYY-MM-DD
MONETIZATION_EXPERIMENT_STARTED_AT=YYYY-MM-DDTHH:mm:ss+09:00
MONETIZATION_EXPERIMENT_DECISION_DATE=D+7の日付
MONETIZATION_EXPERIMENT_REMINDER_ID=D+7の作成済みリマインドID
MONETIZATION_EXPERIMENT_FINAL_DECISION_DATE=D+14の日付
MONETIZATION_EXPERIMENT_FINAL_REMINDER_ID=D+14の作成済みリマインドID
```

高速ゲートでは`MODE=accelerated`、3日以上、最大実測率2%未満、合計500セッション以上が必須。標準ゲートでは`MODE=standard`、7日以上、最大実測率5%未満が必須となる。`MONETIZATION_QUALITY_GATE_END_DATE`は実験開始日の1〜3日前でなければならない。開始日時はタイムゾーン付きISO日時、モバイル広告・記事系はD+7の早期判断とD+14の最終判断を両方登録し、楽天はD+28以降にする。検査処理はNext.jsと同じ`.env.local`も先に読み込み、ローカルビルドからの迂回も防ぐ。最初の実験では`NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE=split`と`NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT=7550236816`を同時に設定する。記事ブリッジ、記事広告、楽天を非既定値にしたままでは排他検査に失敗する。

## 8. 本番反映後の確認

1. DebugViewでホーム、記事、日付レース、個別レース、データページを各1回表示する。
2. 記事ブリッジ`off`、記事広告`control`、レース広告`legacy`を確認する。
3. 375、390、768、1024、1440pxで広告未配信時も予約高が維持されることを確認する。
4. AdSenseポリシーセンター、GA4リアルタイム、Clarityのイベントを確認する。
5. 品質ゲート通過後、先行する1実験だけに開始日時Dと判断リマインドを登録し、台帳へIDを書いてからモードを変更する。

Search Console APIの`page × query × device`が50,000行へ達した場合に限り、BigQuery一括エクスポートへ移す。それまでは現行APIを継続する。
