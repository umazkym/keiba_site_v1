# UMA-FREE 固定運用・本番反映手順

更新日: 2026-08-07

## 目的

`UMA-FREE-TRAFFIC-RECOVERY-2026-08`を比較実験ではなく固定ベースラインとして本番反映する。モバイルレース広告、記事レース導線、記事広告位置、楽天地方競馬の4値は必ず同時に変更し、`split`を混在させない。

Codexはローカルのコード変更・検査・週次運用登録までを担当する。リポジトリ規約により、commit、push、Cloud Runデプロイと外部管理画面の設定はユーザーが実施する。

## 1. 反映前に確認すること

1. この変更一式をユーザー自身でcommitして`main`へpushする。
2. GitHubの`Settings > Secrets and variables > Actions > Variables`を開く。
3. 次の8値をRepository Variablesへ同時に登録または更新する。

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

4. 値の前後に空白や引用符がなく、`split`が1件もないことを確認する。
5. GitHub Actionsの`Deploy Frontend to Cloud Run`を実行する。固定値の不足・混在・承認日時不備があればビルドは失敗し、本番へ進まない。

## 2. GA4で追加するカスタム定義

本番イベントが1回以上観測された後、GA4の`管理 > データの表示 > カスタム定義 > カスタムディメンションを作成`を開き、イベントスコープで次を登録する。既に同じイベントパラメータがある場合は重複登録しない。

| 表示名 | イベントパラメータ |
| --- | --- |
| リリース方針 | `release_policy` |
| 固定運用ID | `fixed_rollout_id` |
| SNS媒体 | `source_platform` |
| SNSコンテンツキー | `source_content_key` |
| 投稿種別 | `post_type` |

## 3. 本番確認

キャッシュ更新後、次を確認する。

1. ホーム、恒常記事、重賞記事、JRAレース、地方レースを各1回開く。
2. 375、390、768、1024、1440pxで予想表、sticky選択、横スクロール、レース切替、記事広告順序を確認する。
3. モバイルレース広告は分析読了位置に1枠だけあり、旧末尾枠との重複がないことを確認する。
4. 記事広告が本文直後・関連記事より前にあり、広告数が増えていないことを確認する。
5. 記事レース導線は完全一致する記事だけに表示され、不一致・予測不足・API障害時は空白も出ないことを確認する。
6. 楽天競馬は地方開催のホーム枠と地方レースの予想表後だけに表示され、JRA・ヘッダーでは非表示であることを確認する。
7. 楽天リンクに`PR`、20歳未満への注意、`rel="sponsored nofollow noopener noreferrer"`があることを確認する。
8. GA4 DebugViewで`release_policy=fixed`、`fixed_rollout_id=UMA-FREE-TRAFFIC-RECOVERY-2026-08`、SNS流入時の`source_platform`、`source_content_key`、`post_type`を確認する。
9. レース切替で`page_view`が追加送信されず、初回`race_view`だけにSNS帰属が一度引き継がれることを確認する。
10. AdSenseポリシーセンター、Clarity、モバイルCLSを確認する。

## 4. 即時復元

AdSenseポリシー警告、広告重複、予想表閲覧・レース移動など主要操作の10%以上低下、モバイルCLS 0.1超のいずれかを確認した場合は、次の4値を同時に戻して再デプロイする。

```text
NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE=legacy
NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE=off
NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE=control
NEXT_PUBLIC_RAKUTEN_KEIBA_MODE=legacy
```

復元時は`MONETIZATION_RELEASE_POLICY=fixed`のままでは固定ゲートが失敗するため、障害復旧専用の変更として`MONETIZATION_RELEASE_POLICY=experiment`へ戻し、旧実験開始用の値を新規に作らず、復元理由と時刻を運用記録へ残す。復元後に固定運用へ戻す場合は、原因修正と全検査を完了してから4値を同時に再設定する。

## 5. 週次運用

毎週木曜09:00 JSTの`UMA-FREE 週次流入・収益改善`が、直前の完全な月曜〜日曜を更新する。ログイン切れやTrafficGate CSV不足は0件扱いせず未取得として通知する。安全なローカル修正だけを行い、commit、push、デプロイは実施しない。
