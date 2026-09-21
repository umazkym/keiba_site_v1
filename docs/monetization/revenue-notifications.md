# 自動確認とメール通知

GitHubのIssueを通知先として使う。追加の有料サービス、メール配信用API、生成AIの定期呼出しは使わない。公開先には金額・アクセス数・検索語を載せず、状況と次に確認することだけを投稿する。

## 普段の受け取り方

| いつ | 届く内容 | 必要な確認 |
| --- | --- | --- |
| 水曜09:30 JST以降 | 目標への進み具合、対応の要否、自動改善の候補 | 「確認が必要」とある場合だけ確認する |
| 毎日10:00 JST以降の確認で異常を検出 | 広告表示・訪問の大幅な減少、参照元不明の増加、取得失敗 | 通知に記載された対象を確認する |
| 異常が変化・解消したとき | 状態が変わったこと | 解消なら原則として追加確認は不要 |

正常な日の日次メールは送らない。同じ異常が続く間も毎日再送しない。週次のお知らせは続ける。週次は媒体の反映待ちを避けるため、実行日から3日以上経過した最新の日曜までを対象にする。月・火の手動実行では一つ前の日曜、水曜以降は直前の日曜を使う。水曜の取得が不足した場合だけ木・金に自動再試行し、揃っていれば再集計を省く。GitHubの実行待ちがあるため、時刻は予定であり即時監視ではない。

公開通知の例：

> 目標への進み具合：まだ届いていません（直近実績の単純換算）
>
> あなたの対応：確認不要
>
> 次に進めること：自動集計を継続します。

取得が不足する場合は「未判定」とし、金額ゼロや目標未達に置き換えない。直近実績の単純換算が目標水準に達しても、その月の確定収益や将来の達成を保証するものではない。

## 初回だけ行うこと

1. 通知の変更を通常どおりコミット・pushして、`main`へ反映する。サイトのデザイン変更は含まれない。既存のデプロイ設定により、push時にサイトのデプロイが走る場合がある。
2. 作成済みの[「UMA-FREE 自動運用のお知らせ」Issue](https://github.com/umazkym/keiba_site_v1/issues/24)を開き、Subscribeを確認する。Unsubscribeと表示されていれば購読済み。
3. [GitHubの通知設定](https://github.com/settings/notifications)で、参加・購読している会話のEmail通知を有効にし、送付先を確認する。
4. 最初の疎通確認として、Actionsの `UMA-FREE Ad Safety Daily Evidence` と `Keiba Monetization History and Weekly Cycle` をRun workflowで実行する。週次は `weekly`、開始日・終了日は空欄にする。月・火は反映済みの前週が選ばれる。日次が正常ならコメントがなくても正常。週次のコメントとメール受信を確認する。

メール通知は受信者の設定に依存する。Issueのコメントを作成しただけでは受信を保証できない。GitHub公式の[通知設定の説明](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)を参照。メールへ返信すると公開コメントになるため、金額や秘密情報を返信しない。

通知用Issueを閉じると投稿を停止し、再度開くと再開する。収集は継続する。Repository Variable `UMA_REVENUE_NOTIFICATIONS=disabled` でも投稿だけを停止できる。

## 何を自動化するか

- 日次は既存のGoogle認証でAdSense日次とGA4日次・流入内訳を読む。広告設定・記事・サイトUIは変更しない。
- 週次は既存の媒体横断分析を再利用し、取得品質と目標への進捗を整理する。
- 通知のために新しい記事審査や全画面チェックを要求しない。異常が通知された場合の原因調査・修正と、収益を伸ばす施策の採否は別作業である。
- 監視処理そのものの失敗は別ジョブから通知する。ただしGitHub全体の障害、定期実行自体の未起動、投稿権限エラーは、この通知経路だけでは検知・送信できない。補助として[Actionsの失敗メール](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)を有効にできる。

## 検知条件

日次は当日・前日を除外し、直近の二日をそれぞれ前週の同じ曜日と比較する。

- 訪問急減：前週の各日が50 sessions以上、今回がそれぞれ前週比20%以下の場合。
- 広告表示急減：前週の各日が50 impressions以上、今回は20 sessions以上かつ前週sessionsの50%以上を保ちながら、広告表示はそれぞれ前週比20%以下の場合。
- 参照元不明：GA4流入内訳のsessionsが各日30以上あり、同じ内訳内の `(not set)` が両日とも20%を超える場合。GA4全体のsessionsを分母に混ぜない。
- 必要な日付・指標の欠損、部分取得、API失敗は正常判定と区別する。欠損をゼロへ補完しない。

この条件は小規模サイトでの誤報を抑える初期設定である。Adsense管理画面の配信制限そのものを読む仕組みではなく、集計上の変化を捉える。緩やかな減少や条件未満の小さな異常をすべて検出するものではない。

## データの公開範囲

今回変更する日次監視・週次収益分析の二つのWorkflowは、公開リポジトリでは詳細データを一時実行領域で計算し、検査済みの `notification.json` だけをartifactへ保存する。金額入りの週次Markdown・XLSX・rawは新規公開しない。過去に保存済みの成果物と、他のWorkflowの保存方針は今回変更しない。

非公開リポジトリでは従来の詳細成果物を保持する。公開環境で金額を詳しく調べる場合はAdSense管理画面、またはローカルの認証済み環境で既存集計を使う。公開通知は表示する情報を減らしたものであり、秘密の詳細画面へのリンクではない。

Issue投稿は組込みの `GITHUB_TOKEN` と投稿ジョブ限定の `issues: write` を使用する。収集ジョブへIssue書込権限を渡さず、投稿ジョブへGoogle等のSecretsを渡さない。実装：[GitHubの最小権限設定](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)。

## 検証コマンド

```powershell
.runtime/repository-audit-venv/Scripts/python.exe -X utf8 -m unittest backend.tests.test_revenue_digest backend.tests.test_revenue_notifications backend.tests.test_ad_safety_daily
node --test scripts/notifications/test_revenue_notice.cjs scripts/notifications/test_notification_workflows.cjs
npm.cmd run repository:check
npm.cmd run agent-sops:validate
```

Python環境の場所は手元の環境に合わせる。テストはAPIやIssue投稿をモックに置き換え、実メールを送らない。
