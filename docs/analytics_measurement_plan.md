# UMA-FREE 収益ファネル計測設計

更新日: 2026-07-30

## 目的

GA4の実ページ表示、レース画面内の操作、記事読了、収益につながるクリックを分離し、広告追加に頼らず改善効果を判断できる状態にする。

## ページビューの扱い

- `page_view` は実際にページが表示された場合だけ使用する。
- 中央・地方タブ、競馬場タブ、同一競馬場内のレース切り替えでは送信しない。
- レース切り替えは `race_view` と `race_navigation` で評価する。

## イベント一覧

| イベント名 | 発火条件 | 主なパラメータ | 用途 |
| --- | --- | --- | --- |
| `race_group_select` | 中央・地方タブを選択 | `race_date`, `race_type` | 開催区分の利用状況 |
| `home_race_entry_click` | ホームから当日レースへ移動 | `race_date`, `entry_method`, `race_type`, `venue_name` | ホーム入口別の送客 |
| `race_venue_select` | 競馬場タブを選択 | `race_date`, `race_type`, `venue_name` | 競馬場間の巡回 |
| `race_view` | レースデータを表示 | `race_id`, `race_date`, `race_type`, `venue_name`, `race_number`。記事流入時は`entry_source=article`, `source_article_slug`, `article_entry_method`, `article_destination_type`。旧YouTube UTM流入時は`entry_source=youtube`, `source_video_key`, `video_format`, `source_venue`。SNS動画流入時は`entry_source=social_video`, `source_platform`, `source_content_key`, `video_format`, `source_venue` | 1セッション当たりの閲覧レース数と記事・動画送客後の到達 |
| `race_navigation` | 前後レースやレース番号から移動 | `from_race_number`, `to_race_number`, `navigation_method` | 次レース導線の比較 |
| `prediction_table_view` | AI偏差値表が画面内に入る | `race_id`, `race_number`, `page_path` | 予想表の実閲覧 |
| `article_read_complete` | 記事本文の末尾へ到達 | `article_slug`, `article_category`, `reading_time_min` | 記事読了率 |
| `article_race_preview_view` | 検証済みレースブリッジの50%以上が初回表示 | `article_slug`, `race_id`, `race_name`, `race_date`, `preview_state`, `link_placement` | 有効な導線表示セッションの母数 |
| `article_race_click` | 記事からレースページへ移動 | `article_slug`, `link_path`, `link_placement`, `destination_type`, `race_id`, `race_name`, `race_date`, `preview_state` | 記事から正確なレースへの送客 |
| `ad_impression_custom` | AdSenseが広告を配信 | `ad_placement`, `ad_format`, `ad_slot`, `ad_page_type` | 配信済み広告の母数 |
| `ad_viewable_custom` | 広告枠の50%以上が1秒間画面内に表示 | `ad_placement`, `ad_format`, `ad_slot`, `ad_page_type` | 配置別の実視認と収益性 |
| `affiliate_impression` | アフィリエイト枠の40%以上が表示 | `campaign_id`, `link_id`, `provider`, `providers`, `context`, `campaign_type`, `link_count`, `race_type`, `venue_name` | アフィリエイト表示母数 |
| `affiliate_click` | アフィリエイトリンクをクリック | `campaign_id`, `link_id`, `provider`, `context`, `campaign_type`, `race_type`, `venue_name` | アフィリエイト送客 |
| `premium_data_view` | 詳細データを表示 | `race_id`, `result` | 詳細データの利用状況 |
| `web_vital` | 固定20%サンプルのセッションでWeb Vitalsを計測 | `metric_name`, `metric_id`, `value`, `rating`, `navigation_type`, `page_path`, `page_type`, `release_id` | リリース・ページ種別ごとのLCP、INP、CLS |
| `adsense_offerwall_view` | AdSense Offerwallが非表示から表示へ変わった時に1回 | `path_group`, `page_path`, `page_type` | Offerwall到達後のレース操作・離脱との比較 |
| `ad_experiment_exposure` | サイト側で広告実験のバリエーションが確定 | `experiment_id`, `variant`, `slot_id`, `page_type` | セッション固定広告実験の母数 |

## GA4初期化順

- Root LayoutのheadでConsent Mode、`gtag('js')`、`gtag('config')`をこの順にdataLayerへ積む。
- Client Componentが初期化前に発生させたカスタムイベントは最大100件の内部キューへ保持し、`uma:ga-ready`後に一度だけ送信する。
- GA4スクリプトをbody末尾で初期化しない。流入元確定前のカスタムイベント送信を避け、`(not set)`セッションを抑えるためである。
- `web_vital`は個人情報を含めず、セッション単位の固定20%サンプルとする。

## GA4管理画面でキーイベントに指定する項目

コードからキーイベント指定そのものは変更できないため、GA4管理画面で次をキーイベントとして設定する。

1. `affiliate_click`
2. `article_race_click`
3. `reward_ad_granted`（リワード広告を再開した場合のみ）

`article_read_complete`と`race_view`は利用状況を見る指標であり、キーイベントにはしない。

`affiliate_impression`の`provider`は表示枠の主リンク提供元を表し、`affiliate_click`の`provider`と同じ値を使う。`providers`は複数リンクを持つ既存枠との互換用に残すが、配置別CTRは単数の`provider`、`context`、`campaign_id`、`link_id`で集計する。TrafficGateの日別レポートに表示回数がない場合も、サイト側の`affiliate_impression`を母数にする。

## 広告収益の判定基準

- AdSenseが配信済みと判断した時点は`ad_impression_custom`、実視認は`ad_viewable_custom`として区別する。
- 配置別の収益判断は、AdSenseのPublisher Adsレポートと`ad_viewable_custom`を同じ期間・同じページ種別で比較する。
- GA4で登録するイベントスコープのカスタム定義は、`ad_placement`、`ad_format`、`ad_slot`、`ad_page_type`、既存の`context`・`provider`、追加した`affiliate_page_type`とする。
- 新しい広告実験はGA4の`(not set)`比率が7日連続で5%未満になってから開始する。
- モバイルp75の合格基準はLCP 2.5秒以下、INP 200ms以下、CLS 0.1以下とし、リリース後の実測で確認する。

## 推奨ファネル

### 記事からレース

1. 記事の`page_view`
2. `article_race_preview_view`
3. `article_race_click`
4. 記事流入属性付き`race_view`
5. `prediction_table_view`
6. `race_navigation`
7. `article_read_complete`と記事広告イベントは離脱・収益保護の並行指標として比較する

`article_race_preview_view`の母数には`race_bridge_enabled=true`で正常表示された記事だけを含める。予測未作成や曖昧一致でブリッジを描画しない記事をCTRの母数へ入れない。

クリック時の流入属性は`sessionStorage`へ30分だけ保持し、最初の対応する`race_view`へ付与後に削除する。別の`race_id`へ到達した場合は誤帰属せず破棄する。URLクエリへ流入情報を付けない。

### レース巡回

1. ホームの`page_view`
2. `home_race_entry_click`
3. レースページの`page_view`
4. `race_view`
5. `prediction_table_view`
6. `race_navigation`
7. 次レースの`race_view`

### YouTubeからレース

1. YouTube動画またはShortの説明欄にある`https://uma-free.com`
2. トップページの実`page_view`
3. ホームからレースページへの遷移
4. `race_view`
5. `prediction_table_view`
6. `race_navigation`

2026-07-28以降に生成する横長動画とShortは、説明欄URLを`https://uma-free.com`へ統一し、UTMクエリを付けない。GA4ではブラウザから参照元が渡された場合のYouTube流入を標準の参照元・メディアで確認する。動画別の`utm_content`、`source_video_key`、`video_format`、`source_venue`は新規リンクから取得できないため、廃止前のデータと連続した動画別指標として扱わない。既存のUTM付きリンクから入ったセッションに対する互換処理は残し、タブ・レース切り替えによる仮想`page_view`は送らない。

### SNS動画からレース

1. Threads、Instagram、Facebook、TikTok、Pinterest、Blueskyのネイティブ動画
2. 個別レースURL、またはInstagram/TikTokのプロフィールURL
3. サイトの実`page_view`
4. `entry_source=social_video`付き`race_view`
5. `prediction_table_view`
6. `race_navigation`
7. `ad_viewable_custom`

SNS用UTMは`utm_medium=organic_social`、`utm_campaign=daily_race_video`へ統一する。Instagram/TikTokのプロフィールリンクだけは`utm_campaign=profile`とする。属性は`sessionStorage`へ30分保持し、最初の`race_view`へ一度だけ付与して削除する。YouTube互換処理と同様に仮想`page_view`は追加しない。

GA4ではイベントスコープのカスタム定義へ`source_platform`、`source_content_key`、`video_format`を登録する。媒体別の効果は再生数だけで判断せず、SNSセッションから`race_view`、`prediction_table_view`、`race_navigation`、`ad_viewable_custom`へ進んだ割合で比較する。

## レポート上の注意

- 2026-06-18以前のGA4ページビューには、タブ・競馬場切り替えによる仮想PVが含まれる。
- 旧`read_complete`は記事読了ではなく予想表の表示を表していたため、新しい`article_read_complete`と比較しない。
- リワード広告を意図的に停止している期間は、通常公開を`premium_data_view.result=open_access`として扱う。
- 2026-07-20〜21のUI変更が30日集計へ混在するため、広告・CTA判断では2026-07-22以降の期間を分離する。
- 2026-07-23実装のレースブリッジは、本番デプロイ日Dより前の汎用CTAと同一期間へ混在させない。`metadata_only`は一時API障害時の静的リンク表示であり、上位3頭が表示された`available`と分けて集計する。
- YouTube v7の公開開始日Dまでは`private_review`期間として扱い、通常流入の評価対象へ含めない。2026-07-28のURL統一後はYouTube参照元のトップページ流入、ホームからレースへの遷移、`race_view`、`prediction_table_view`を同じ期間で比較し、旧`utm_content`別集計とは期間を分ける。
- SNS動画は媒体ごとの`public`切り替え日をDとして別々に集計する。`validate`と`draft`期間は流入効果の母数へ含めず、複数媒体を同日に公開開始した場合は因果分離できないことを明記する。
- 楽天競馬の適格化実験は`NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=qualified_nar`へ切り替えた本番反映日をDとする。Dより前のレガシー導線、ヘッダー、JRA、日別ページ下部の表示・クリックを実験母数へ混ぜない。
