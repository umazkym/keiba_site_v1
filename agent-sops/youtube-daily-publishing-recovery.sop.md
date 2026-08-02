# YouTube Daily Publishing Recovery

## Overview

YouTube日次統合投稿の認証、データ欠損、途中失敗を安全に切り分け、横長1本とShort 1本を重複なく復旧する手順です。日次自動運用では午後の翌日データ更新完了を起点とし、18:20 JSTの予備起動とDBレジストリで停止・再実行に耐えます。

## Parameters

- **target_date** (required): 投稿対象のレース日。手動復旧では`YYYY-MM-DD`を明示します。
- **publication_mode** (required): `private_review`または`scheduled_public`。
- **failed_run_url** (optional): 原因を特定するGitHub Actions実行URL。
- **expected_venues** (optional): データ更新後に公開APIまたはDBで確認した開催会場。

## Steps

### 1. 原因を生成・認証・データ・アップロードへ分類する

Actions Summaryと失敗ステップを確認し、生成本数、保留会場・欠損R、OAuth事前検証、アップロード本数、予約・公開本数、実効公開時刻を照合します。

**Constraints:**

- You MUST distinguish OAuth失効、データ不足、動画生成失敗、YouTubeアップロード失敗 because復旧方法と重複リスクが異なります。
- You MUST confirm the target date from the workflow event source because遅延した実行時刻だけで日付を推測すると別日を投稿するおそれがあります。
- You MUST NOT regenerate missing predictions or invent empty values because 架空データの動画公開は禁止です。

### 2. OAuth失効を復旧する

Google Auth Platformの対象プロジェクト、OAuthクライアント、認証アカウント、YouTube管理スコープを確認します。外部アプリは本番環境で運用し、単一管理アカウントを再認証して新しいrefresh tokenを発行します。

**Constraints:**

- You MUST keep the scope at `https://www.googleapis.com/auth/youtube` because予約解除と公開状態同期にも管理権限が必要です。
- You MUST update only `YOUTUBE_REFRESH_TOKEN` when the existing client ID and secret remain usable because不要なクライアント再発行は障害範囲を広げます。
- You MUST update `YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`、`YOUTUBE_REFRESH_TOKEN` together only when the existing client is unusable because組み合わせ不一致ではtoken refreshが成功しません。
- You MUST NOT print or save OAuth client secrets or tokens in files, logs, summaries, or screenshots because 認証情報が漏えいします。
- You MUST validate the authenticated channel against `YOUTUBE_CHANNEL_ID` before rendering because別チャンネル投稿と長時間生成後の認証失敗を防ぐ必要があります。

### 3. 対象日のデータ完全性を確認する

データ更新Workflowの完了後、対象日の会場、1Rから最終Rまでの連続性、AI偏差値の算出対象外となる新馬戦・障害戦を除く各Rの有効な予測を確認します。

**Constraints:**

- You MUST stop before rendering or uploading the daily compilation when any venue has missing races or predictions because欠損会場を除いた不完全版を同じ日次stable IDで公開すると安全に差し替えられません。
- You MUST include missing race numbers in Actions Summary because会場名だけではデータ更新側の復旧対象を特定できません。
- You MUST require the upstream prediction workflow to retry only incomplete races once and fail its final completeness audit when an eligible race still has no AI deviation score because a false-success starts YouTube with known-missing data.
- You MUST verify newcomer and obstacle exclusions by their explicit `unpredictable_reason` because an all-null prediction caused by a calculation error is not a valid exclusion.
- You MUST preserve IAP-only database access because本番PostgreSQLを外部公開してはいけません。

### 4. 非公開で重複なく再実行する

失敗がDB予約前であること、または既存`video_publications`の動画IDを再利用できることを確認し、`target_date`、`publication_mode=private_review`、`dry_run=false`で手動実行します。

**Constraints:**

- You MUST keep the DB registry and content hash checks enabled because再実行時の重複投稿を防ぎます。
- You MUST NOT use `--force` or disable the registry because 既存動画IDを見失い外部投稿が重複します。
- You MUST resume from the saved remote video ID after an upload-stage failure because同じ動画を作り直す必要はありません。
- You MUST verify generated and uploaded counts as one daily long video plus one daily Short before opening visibility.

### 5. Studio確認後に公開し、次回同期を確認する

YouTube Studioで処理完了、日付、中央各場から地方各場への章順、総収録R数、Shortの全対象、説明欄先頭URL、映像、音声を確認します。緊急復旧では過去の予約時刻を再利用せず、通知なしで即時公開します。

**Constraints:**

- You MUST verify every expected video before changing visibility because一括公開後の差し戻しを避けます。
- You MUST NOT publish a compilation that omits a held venue or an unprocessed video because 不完全な情報や再生不能動画が公開されます。
- You MUST compare video IDs with `video_publications` on the next daily run becauseStudioで手動公開した状態をDBの`published`へ同期する必要があります。

### 6. 次の1開催日を監視する

午後データ更新成功後の`workflow_run`、18:20 JSTの予備cron、単一concurrency、同一公開時刻、部分保留のSummaryを確認します。

**Constraints:**

- You MUST treat the upstream run start date in JST plus one day as the workflow-run target because完了が日付をまたいでも対象日は変わりません。
- You MUST keep all publish offsets at zero and a 45-minute minimum lead because連続アップロード中の公開時刻超過を避けながら同時公開を維持します。
- You MUST NOT delete registry rows to clear an error because 履歴と重複防止情報を失います。

## Source references

- `docs/youtube_video_pipeline.md`
- `.github/workflows/keiba-youtube-video-pipeline.yml`
- `.github/workflows/keiba-data-fetch-friday-weekend.yml`
- `backend/scripts/youtube_video_pipeline.py`
- `backend/scripts/social_video/youtube_client.py`
- `backend/scripts/social_video/workflow_dates.py`

## Examples

手動復旧の入力:

```text
target_date: 2026-08-01
publication_mode: private_review
dry_run: false
```

## Troubleshooting

### `invalid_grant`で事前検証が止まる

Google Auth Platformが本番環境か、管理スコープで再認証したか、Repository Secret `YOUTUBE_REFRESH_TOKEN`だけを新しい値へ交換したかを確認します。動画生成やDB予約は開始しません。

### 欠損会場のため生成本数0でWorkflowが失敗になる

想定どおりの完全性停止です。Actions Summaryの保留会場・欠損Rをデータ更新側で修復し、同じ対象日を再実行します。アップロード前停止のため、不完全な日次動画は作成されません。

### 午後データ更新が成功したのに欠損会場が繰り返し保留される

午後予測処理の最終ログで対象日の完全性監査が実行され、欠損レースだけが1回再取得されているか確認します。対象レースが未復旧なら午後Workflow自体が失敗し、成功時の`workflow_run`でYouTubeを起動してはいけません。18:20 JSTの予備cronでも欠損が残る場合は、日次統合動画を生成せずに停止します。

### 連動起動と予備cronが両方動く

単一concurrencyで直列化されます。後続実行はDBレジストリとcontent hashを照合し、既存動画IDを再利用します。
