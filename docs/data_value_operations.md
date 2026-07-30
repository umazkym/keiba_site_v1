# データ価値の自動監査・週次集計

更新日: 2026-07-31

## 実装状態

`.github/workflows/keiba-data-value-operations.yml`は、外部サイトへのアクセスやデータ修復を行わない読み取り専用ジョブである。

- 毎日07:45 JST: IAPトンネル経由で本番DBを読み、更新停止、着順範囲外、馬名と所属接頭辞の混在、馬名欠損、5走未満の母数を報告する。
- 毎週水曜09:45 JST: GA4 Data APIから直近28日の比較、保存、再訪、出走予定遷移、価格意向、広告収益／1,000セッションをActions Summaryとartifactへ出す。
- 既存のGSC週次SEO監査は別workflowで維持する。
- 監査は修復、公開、価格変更、課金停止、広告変更を実行しない。

## 必要な外部設定

週次ファネルにはRepository Variable `GA4_PROPERTY_ID`が必要である。値は`properties/`を付けない数値IDとする。GitHub Actionsのサービスアカウントを該当GA4プロパティの閲覧者へ追加する。未設定時はworkflowを失敗させず、Actions Summaryへ不足設定を記録して集計をスキップする。

GA4のイベントスコープのカスタム定義として、少なくとも次を登録する。

- `action`
- `response`
- `entry_source`
- `search_surface`
- `condition_scope`
- `relative_date_bucket`
- `days_since_last_visit_bucket`

自由入力の検索語、馬名、保存内容、比較セット内容をカスタム定義へ登録しない。

## 出力

- `backend/scripts/agents/data_value_quality_audit.py`
  - `report.json`
  - `summary.md`
- `backend/scripts/agents/data_value_funnel_report.py`
  - `report.json`
  - `summary.md`

日次監査はcriticalを検出しても既定では報告だけを残す。手動調査で停止ゲートとして使う場合だけ`--fail-on-critical`を付ける。

## 課金承認前に実行しない運用

端末内の保存データはサーバーへ送信しないため、保存馬ごとの前日メール生成と月次の更新率・解約理由集計はまだ実行しない。これらは[`my_data_plus_gate_spec.md`](./my_data_plus_gate_spec.md)の開始条件を満たし、Firebase/Stripe/クラウド保存を人が承認した後に追加する。

開始条件を満たしてもworkflowは課金基盤を自動作成しない。`human_review_ready`はレビュー候補を示すだけである。
