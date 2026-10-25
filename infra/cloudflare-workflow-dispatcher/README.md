# 定時の起動（Cloudflare Worker）

GitHub Actions の定時実行（schedule）は、このリポジトリで2〜6時間おくれる（2026-10 の実測。直前の SNS が菊花賞の発走のあとに動いた）。
この Worker は Cloudflare の無料の定時実行（Cron Triggers）から、予定の時刻に GitHub へ「今すぐ動いて」（workflow_dispatch）と頼む。

- 起動するときは入力 `trigger=cloudflare` を付ける。回の表示名に「(定時)」か「(定時 対象日)」が付く。
- GitHub の schedule は予備として残す。二重に動かないよう、各 Workflow の最初の段（`backend/scripts/maintenance/workflow_dispatch_gate.py`）が止める。
  - 予定の回：同じ枠の定時の起動が成功していれば止める。動いたときは警告を出す（定時の起動が来ていない合図）。
  - 定時の起動：同じ枠の予定の回か、同じ表示名の定時の起動が先に成功していれば止める。
  - 手で起こした回は止めない。記録が読めないときも止めない。
- 公開の URL は持たない（定時実行だけ）。費用は0円（Workers の無料枠）。
- 置き場は **umafree.ai@gmail.com の Cloudflare**（UMA-FREE 専用のアカウント）。wrangler は必ず `npm run wrangler -- …` から使う。PC 全体の `npx wrangler` は otofuya22（onomaui・koekurabe の Pages 用）にログインしているので、ここでは使わない。`scripts/wrangler.mjs` がログインの置き場を `%APPDATA%\umafree-wrangler` に分ける。

## 時刻と起動する Workflow

| JST        | UTC の cron | Workflow                                    | 対象日                   |
| ---------- | ----------- | ------------------------------------------- | ------------------------ |
| 05:00      | 0 20        | keiba-pipeline-runner.yml（結果の取り込み） | UTC の日付（JST の前日） |
| 06:30      | 30 21       | keiba-data-fetch-morning-today.yml          | UTC の翌日（JST の当日） |
| 07:00      | 0 22        | keiba-sns-morning-post.yml                  | なし                     |
| 10:00      | 0 1         | keiba-data-fetch-retry-today.yml            | UTC の日付（JST の当日） |
| 12:00      | 0 3         | keiba-sns-afternoon-post.yml                | なし                     |
| 13:30      | 30 4        | keiba-data-fetch-afternoon.yml              | UTC の翌日（JST の翌日） |
| 14:00 土日 | 0 5         | keiba-sns-pre-race.yml                      | なし                     |
| 19:00 土日 | 0 10        | keiba-sns-hit-immediate.yml                 | なし                     |
| 20:00      | 0 11        | keiba-sns-evening-post.yml                  | なし                     |

- 正は `src/index.js` の `SLOTS`。`wrangler.toml` の cron は3本にまとめてある（無料の枠は1アカウント5本まで）。
- 時刻を変えるときは、`SLOTS`・`wrangler.toml`・Workflow の `cron:`・`backend/scripts/workflow_dates.py` を一緒に直す。`npm test` が食い違いを見つける。
- YouTube は午後の取得（13:30）の成功から連動する（`keiba-youtube-video-pipeline.yml`）。

## はじめて入れる手順

1. **先に Workflow の変更を main へ push する。** 新しい入力（`trigger`）が main に無いと、GitHub は 422 を返して起動しない。
2. **GitHub で鍵を作る（5分ほど）。**
   1. umazkym で GitHub にログインし、右上の顔 → Settings → いちばん下の Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。
   2. Token name：`keiba-workflow-dispatcher`。Expiration：1年（Custom で日付を選ぶ）。
   3. Resource owner：umazkym。Repository access：Only select repositories → `keiba_site_v1` だけ。
   4. Permissions → Repository permissions → **Actions：Read and write**。ほかは触らない（Metadata の読み取りは自動で付く）。
   5. Generate token を押し、出た鍵をコピーする（画面を閉じると二度と見られない）。
3. **Cloudflare に入り、鍵を入れる。** 自分のターミナルで次を実行する。
   ```sh
   cd infra/cloudflare-workflow-dispatcher
   npm run wrangler -- login
   npm run wrangler -- secret put GITHUB_TOKEN
   ```

   - login はブラウザが開く。umafree.ai@gmail.com で入っていることを確かめて Allow を押す。
   - secret put は聞かれたら鍵を貼る（画面には出ない）。Worker がまだ無いときは「作りますか」と聞かれる。Yes で作られる。
   - アカウントで初めての Worker のときは、ダッシュボードの「Workers & Pages」を一度開いておく。開くと workers.dev の名前が自動で作られる。これが無いと、次の公開で時刻の登録だけ失敗する（code 10063）。
4. **公開する。**
   ```sh
   npm run wrangler -- deploy
   ```
5. **鍵の期限をメモする。** 期限が切れると定時の起動が止まり、予備（おくれる GitHub の予定）だけが動く。期限の1か月前に作り直して手順3を繰り返す。

## 動いているかの確かめ方

- Cloudflare の記録：`npm run wrangler -- tail`（次の時刻まで待つ）か、ダッシュボードの Workers → keiba-workflow-dispatcher → Logs。
- GitHub の記録：表示名に「(定時」の付いた回が、予定の時刻から数分以内にできているか。
  ```sh
  gh run list --repo umazkym/keiba_site_v1 --event workflow_dispatch --limit 20
  ```
- 予定の回（schedule）が「止める」で終わっていれば、二重の防ぎも効いている。予定の回が「動かす」と警告を出していたら、定時の起動が来ていない（鍵の期限切れ・Cloudflare の不調など）。

## 止め方

- 定時の起動だけ止める：`wrangler.toml` の `crons = []` にして `npm run wrangler -- deploy`。または `npm run wrangler -- delete`。
- 止めても GitHub の予定（予備）は動き続ける（おくれる元の動きに戻る）。

## 試験

```sh
npm test
```

時刻の換算（対象日）・土日だけの枠・`wrangler.toml` と Workflow の予定の食い違い・GitHub の一時的な失敗の出し直しを確かめる。
