# マイデータプラス 課金開始ゲートと実装仕様

更新日: 2026-07-31

## 状態

`マイデータプラス`は未販売・未実装である。無料データの価値検証を28日間行い、すべての開始条件を満たして人が承認するまで、Firebase Authentication、Stripe Checkout、Stripe Billing、Customer Portal、購読テーブル、通知メール送信を本番へ追加しない。

販売前アンケートは`NEXT_PUBLIC_DATA_PRICING_SURVEY=enabled`のときだけ表示する。既定は無効とし、画面には「販売前の機能アンケート」「申込み・請求は発生しない」と明記する。

## 無料版と有料版の境界

| 無料で維持する機能 | 月390円で提供を検討する便利機能 |
| --- | --- |
| データ検索とSEO対象の個別成績 | 端末間のマイデータ同期 |
| 2〜5頭の基本比較 | 名前を付けた比較セットの保存 |
| 端末内のお気に入り・比較保存 | 保存馬の出走予定を前日1回のメールに集約 |
| 当日レースの同条件比較 | 当日出走馬の同条件比較を自動作成 |
| 出走数、勝率、3着以内率、直近5走 | 条件フィルター付き比較履歴 |
| 登録不要の閲覧 | 週末用の保存馬・コース確認一覧 |

無料データを課金壁へ移さず、毎週の確認作業を減らす機能だけを課金対象とする。

## 課金開発へ進む条件

28日間の同一観測期間で、次のすべてを満たす。

- データ関連ページで1,000人間セッション以上。
- 2頭以上の`compare_result_view`が100回以上。
- `data_favorite.action=add`が50回以上。
- 保存利用者の7日以内再訪率が15%以上。
- `upcoming_race_click`から対応する`race_view`への遷移率が8%以上。
- `pricing_survey_response.response=use_at_390`が30件以上、かつアンケート対象セッションの5%以上。
- 無料データ流入とAdSense収益／1,000人間セッションが開始前基準から10%以上低下していない。

いずれかが未達なら課金基盤を作らず、検索、同条件比較、保存、再訪導線を改善して別の28日観測を行う。

## 承認後の認証・決済構成

1. フロントエンドはFirebase AuthenticationのGoogleログインとメールリンク認証を利用する。
2. Cloud RunはFirebase IDトークンを検証し、検証済み`uid`だけを内部ユーザーIDへ関連付ける。
3. 購入はStripe Checkout、契約変更はCustomer Portalを利用する。カード情報をUMA-FREEで保持しない。
4. 購読状態の正はStripe Webhookとし、画面復帰URLやCheckout完了画面だけで権限を付与しない。
5. WebhookイベントIDを一意保存し、再送を冪等に処理する。
6. ログイン初回だけ端末内保存をクラウドへ統合し、同一対象は重複させない。端末側データは統合成功後も利用者が確認するまで削除しない。
7. 初期版は無料体験、年額、複数プラン、クーポンを設けない。

## 承認後に追加するデータ

| テーブル | 主な列 | 制約 |
| --- | --- | --- |
| `app_users` | `id`, `firebase_uid`, `email_hash`, `created_at` | `firebase_uid`一意。平文メールを分析用途に複製しない |
| `billing_customers` | `user_id`, `stripe_customer_id` | 双方一意 |
| `subscriptions` | `user_id`, `stripe_subscription_id`, `status`, `current_period_end`, `cancel_at_period_end` | Stripe Webhookだけが状態更新 |
| `stripe_webhook_events` | `stripe_event_id`, `event_type`, `processed_at`, `result` | `stripe_event_id`一意 |
| `saved_entities` | `user_id`, `entity_type`, `entity_id`, `created_at` | 1利用者・1対象で一意 |
| `saved_comparison_sets` | `id`, `user_id`, `name`, `conditions_json`, `created_at` | 1セット2〜5頭、名称長を制限 |
| `notification_preferences` | `user_id`, `email_enabled`, `timezone` | 既定OFF、明示同意 |
| `notification_deliveries` | `user_id`, `target_date`, `content_hash`, `status` | 1利用者1日前日通知を保証 |

## 承認後に追加するAPI

- `POST /api/v1/auth/session`: Firebase IDトークン検証と内部セッション開始。
- `POST /api/v1/billing/checkout`: 月390円の単一Priceに対するCheckout Session作成。
- `POST /api/v1/billing/portal`: 所有CustomerのPortal Session作成。
- `POST /api/v1/billing/webhook`: Stripe署名検証、イベントID重複排除、購読状態更新。
- `GET /api/v1/my-data`: 認証済み利用者の保存データ取得。
- `POST /api/v1/my-data/import`: ログイン初回の端末データ統合。
- `POST /api/v1/my-data/comparison-sets`: 2〜5頭と条件を持つ比較セット保存。
- `PUT /api/v1/my-data/notifications`: 前日メールの明示同意更新。

権限判定は`active`または猶予中の`past_due`など、Stripe状態ごとの明文化した関数へ集約する。`canceled`、`unpaid`、期限切れは有料権限を外し、無料データはそのまま閲覧可能とする。

## Webhook受入条件

- `checkout.session.completed`だけでなく`customer.subscription.created/updated/deleted`と`invoice.payment_failed/paid`を処理する。
- 同じイベントを3回送っても購読状態と副作用が1回分である。
- 返金、支払失敗、解約、期間末解約、期限切れで権限が期待どおり変わる。
- 署名不正、未知Customer、DB失敗は2xxで握りつぶさず、再送可能な失敗として記録する。
- 通知メールは購読状態、明示同意、対象レース、同一content hashを再確認してから1日1通にまとめる。

## 収益・費用ゲート

- 30,000人間セッション × 392円／1,000 = 約11,760円。
- 有料会員111人 × 手数料差引後概算373円 = 約41,403円。
- 合計約53,163円から追加インフラ費上限3,000円を引き、月約50,163円を目標とする。
- アフィリエイトとOfferwallは計画へ算入しない。
- Firebase、メール、Stripe関連の月追加費が3,000円を超える見込みなら、正式提供前に構成か通知頻度を見直す。

## 有料βの採用条件

- βは50人まで。
- 2回目更新率70%以上。
- 30日以内の有料機能利用率50%以上。
- 返金・解約合計10%以下。
- 無料データ流入またはAdSense収益／1,000人間セッションが10%以上低下した場合、有料導線だけを停止し無料機能を維持する。

価格変更、公開、課金停止、広告設定変更はAIが実行せず、集計結果を受けた人の承認を必須とする。
