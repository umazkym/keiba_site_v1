# GSC週次SEO監査・手動改稿 運用手順

## 目的

Search Consoleの確定データから既存記事の低CTR候補を見つけ、記事URLと事実部分を守ったまま検索結果上の伝わり方だけを改善する。重賞記事の新規生成と同年度更新は、従来どおり重賞カレンダーを優先する。

## 初回実行前の設定

1. Google Cloudプロジェクト`keiba-api-project`でSearch Console APIを有効化する。
2. Search Consoleの`sc-domain:uma-free.com`プロパティで、`github-actions-iap-db@keiba-api-project.iam.gserviceaccount.com`を閲覧権限のユーザーとして追加する。所有者権限は付与しない。
3. GitHubリポジトリのSettings → Secrets and variables → Actions → Variablesへ、`GSC_SITE_URL=sc-domain:uma-free.com`を登録する。
4. 実装変更をcommit・pushした後、次の水曜09:15 JSTの`Keiba GSC Weekly SEO Audit`を待つ。定期実行は監査だけで、記事を変更しない。

Search Console取得コードが要求するOAuth scopeは`https://www.googleapis.com/auth/webmasters.readonly`だけである。API失敗、403、429、データ不足はGSC監査workflowだけを失敗させ、通常の記事生成workflowには影響しない。

## 週次レポートの確認

Actions Summaryと`gsc-seo-audit-{run_id}` artifactで次を確認する。

- 直近の確定済み28日と直前28日の期間
- 表示100以上、平均順位4〜20位の候補
- 同順位帯CTR中央値と推定取りこぼしクリック
- 上位検索クエリから読み取れる検索意図
- 開催7日前から開催後3日までの季節重賞
- 同一クエリで複数canonicalが各20表示以上のカニバリ候補

季節重賞は通常改稿へ回さない。カニバリ候補も自動統合・リダイレクトせず、別途内容と流入を確認する。

## 手動改稿

1. artifactの`candidates`にある`source_slug`を正確に1件選ぶ。
2. Actionsの`Keiba GSC Weekly SEO Audit`をmainブランチから`workflow_dispatch`で実行し、`article_slug`へ選んだslugを入力する。
3. workflowが同じ実行内で最新GSCレポートを作り直し、そのslugが候補に一意一致する場合だけ改稿する。
4. title、description、keywords、導入文、H2文言以外に差分があれば公開前に失敗する。
5. 成功後は、同じslugの再改稿を28日間行わない。

改稿時も数値、表、H2配下本文、リンク、canonical、公開日、entity情報、`update_stage`、広告関連メタデータ、検証済みレースブリッジは維持する。GSCクエリは検索意図の参考に限り、競馬成績や記事本文の根拠にはしない。

## D+28確認

改稿日から28日後以降の週次artifactで、改稿前と同じ28日幅を使い、表示回数、CTR、平均順位を比較する。CTRだけでなく表示と順位の変化も併記し、母数が小さい場合は追加改稿せず次の確定期間を待つ。
