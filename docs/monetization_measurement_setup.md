# UMA-FREE 収益計測・外部設定手順

更新日: 2026-08-07

## この手順の位置づけ

コード側の計測契約と週次レポートは実装済み。2026-08-03にGA4–AdSenseの既存リンクとGA4カスタム定義を実画面で確認し、観測済みパラメータの不足定義を追加した。同日、AdSenseのURLチャネル7件と配置別カスタムチャネル8件を作成した。2026-08-05のCloud Run移行後はGitHub Repository Variablesを本番設定の正本とする。リンク前のデータを遡及して収益帰属へ使わず、設定変更日を台帳へ記録する。2026-08-07以降は比較実験を開始せず、承認済みの4施策を固定ベースラインとして週次監視する。

## 1. GA4とAdSenseの正式リンク

2026-08-03の実画面確認では、GA4プロパティとコンテンツ向けAdSenseは2026-03-15付でリンク済みで、GA4の収益化レポートにも広告収益が表示されていた。リンクを作り直さない。将来リンクが解除された場合だけ、次の手順で復旧する。

1. GA4の「管理 > サービス間のリンク設定 > AdSenseのリンク」を開く。
2. UMA-FREEで利用中のAdSenseパブリッシャーを選び、対象のウェブデータストリームを指定する。
3. AdSense側のサイトが`uma-free.com`であることを確認して送信する。
4. 設定日時を`docs/monetization_experiments.md`へ記録する。
5. 最大24時間待ち、GA4探索で`totalAdRevenue`と`publisherAdImpressions`を取得できるか確認する。

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
| 投稿種別 | `post_type` | 対象イベント観測後に登録 |
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
| ホーム注目馬後 | `uma_home_pick`（未作成） | 未採番 | `NEXT_PUBLIC_AD_CHANNEL_HOME_PICK` |

ホーム注目馬後は2026-08-16に追加した枠。チャネルIDが未採番のあいだは`data-ad-channel`属性を出さず、広告自体は通常どおり配信される。AdSense管理画面でチャネルを作成し、Repository VariablesへIDを追加すれば配置別の計測が有効になる。

コードは数値だけを`data-ad-channel`へ出し、空欄・不正値は属性自体を出さない。`NEXT_PUBLIC_*`はビルド時に確定するため、VercelのProductionへ8値を追加し、2026-08-03 11:30:25 JSTに再デプロイ`FGYUmBGJ6ZNqs1isCJYhgiGR8v7z`がReadyになった。本番DOMではホーム開催後の`5151906821`と記事導入後の`4785075314`を確認した。レース末尾はOfferwallの広告視聴を回避して未確認とし、広告を操作せず、環境設定・コード対応・本番ビルド成功を証跡とする。公式仕様: [カスタムチャネル](https://support.google.com/adsense/answer/10078316?hl=ja)

## 5. 2026-08-07以降の固定運用値

GitHub Repository Variablesへ次を同時に設定する。Cloud Runのフロントエンドworkflowは`NEXT_PUBLIC_*`に加え、3つの`MONETIZATION_*`リリース値を`.env.production`へ渡す。

```text
MONETIZATION_RELEASE_POLICY=fixed
MONETIZATION_FIXED_ROLLOUT_ID=UMA-FREE-TRAFFIC-RECOVERY-2026-08
MONETIZATION_FIXED_ROLLOUT_APPROVED_AT=2026-08-07T03:24:39+09:00
NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE=engaged_display
NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT=7550236816
NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE=on
NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE=variant
NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=qualified_nar
```

記事ブリッジは表示モードが`on`でも、年度、レース名、日付、race ID、正確なrace URL、予測データが完全一致しなければDOMも予約高も出さない。記事広告は同じ1枠を本文・記事フッター直後、関連記事の前へ移し、MultiplexとOfferwallは変更しない。楽天競馬は地方開催のホーム枠と地方レース予想表後だけに限定する。

## 6. 週次品質観測

旧高速・標準ゲートは固定運用の開始条件としては終了する。ただし、計測品質の異常検知として`measurement_release_id`ごとの欠損率、`Unassigned`、収益取得、重複送信を週次で継続する。未取得値を0と置かず、原因と必要操作を警告へ残す。

- 対象は直前の完全な月曜〜日曜。前週、4週中央値、同曜日、中央開催・重賞日を比較する。
- `monetization-report.v1`は`adsense_daily`、`youtube`、`social_workflows`、`week_over_week`、`root_causes`、`applied_local_actions`を任意で保持する。
- AdSense日次データを提供した場合、7日が完全一致しなければ正式週ではなく参考集計とする。
- TrafficGate CSVがない週は楽天成果を0件にせず「未取得」とする。

継続して確認する送信条件は次のとおり。

- 初回表示の`page_view`は1回、通常遷移は1回、レース内切替は0回。
- 広告の`ad_impression_custom`、`ad_viewable_custom`、実験露出が同一枠・同一セッションで重複していない。
- `totalAdRevenue`が取得可能で、リンク設定日より前を含めていない。

週次のCodex自動運用はローカル修正までとし、commit、push、Cloud Run反映は行わない。

## 7. 固定運用リリースゲート

`MONETIZATION_RELEASE_POLICY=fixed`では、セクション5の4表示値、固定運用ID、承認日時、10桁の広告slotが必要となる。値不足、`split`混入、ID不一致、タイムゾーンのない承認日時では`npm run build`が失敗する。旧実験ゲートとD+7・D+14リマインドは要求しない。

```text
MONETIZATION_RELEASE_POLICY=fixed
MONETIZATION_FIXED_ROLLOUT_ID=UMA-FREE-TRAFFIC-RECOVERY-2026-08
MONETIZATION_FIXED_ROLLOUT_APPROVED_AT=2026-08-07T03:24:39+09:00
```

## 8. 本番反映後の確認

1. DebugViewでホーム、記事、日付レース、個別レース、データページを各1回表示する。
2. 記事ブリッジ`on`、記事広告`variant`、モバイルレース広告`engaged_display`、楽天`qualified_nar`を確認する。
3. 375、390、768、1024、1440pxで広告未配信時も予約高が維持されることを確認する。
4. AdSenseポリシーセンター、GA4リアルタイム、Clarityのイベントを確認する。
5. `release_policy=fixed`と固定運用IDが露出・アフィリエイトイベントへ付くことを確認する。

Search Console APIの`page × query × device`が50,000行へ達した場合に限り、BigQuery一括エクスポートへ移す。それまでは現行APIを継続する。
