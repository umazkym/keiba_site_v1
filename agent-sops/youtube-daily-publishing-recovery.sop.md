# YouTube Daily Publishing Recovery

## Overview

YouTube日次統合投稿の認証、データ欠損、途中失敗を安全に切り分け、利用可能なレースで横長1本とShort 1本を重複なく復旧する手順です。日次自動運用では午後の翌日データ更新完了を成否にかかわらず起点とし、18:20 JSTの予備起動とDBレジストリで停止・再実行に耐えます。

## Parameters

- **target_date** (required): 投稿対象のレース日。手動復旧では`YYYY-MM-DD`を明示します。
- **publication_mode** (required): `private_review`または`scheduled_public`。
- **failed_run_url** (optional): 原因を特定するGitHub Actions実行URL。
- **expected_venues** (optional): データ更新後に公開APIまたはDBで確認した開催会場。

## Steps

### 1. 原因を生成・認証・データ・アップロードへ分類する

Actions Summaryと失敗ステップを確認し、実収録R、除外Rと理由、データ取得元、再取得回数、重賞収録状況、OAuth事前検証、動画種別ごとのアップロードID、予約・公開本数、実効公開時刻を照合します。

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

### 3. 対象日の収録可能レースを確認する

データ更新Workflowの完了後、対象日の各レースについて、正常な馬名と有限なAI偏差値を持つ馬が3頭以上いるかを確認します。DBを第1ソース、公開予測APIを第2ソースとし、DB接続失敗時はAPIへ切り替えます。

**Constraints:**

- You MUST omit only the affected race when Prediction行なし、全馬スコアなし、予測計算エラー、3頭未満の有効スコア、または描画失敗がある because一部欠損で他会場と当日全体の投稿を止めません。
- You MUST continue rendering as soon as at least one race is publishable because投稿継続と流入獲得を会場・レース完全性より優先します。
- You MUST retry data loading twice at 120-second intervals only when all candidate races are empty because部分収録可能な状態で待機すると公開機会を失います。
- You MUST stop that target date after three total attempts only when no publishable race remains because前日データの流用や架空値の補完は禁止です。
- You MUST include race numbers, names, grades, omission reasons, source, and retry count in Actions Summary because部分公開の内容と上流の復旧対象を照合できるようにします。
- You MUST require the upstream prediction workflow to retry incomplete races once, but complete with warnings when at least one race remains renderable because上流の部分欠損をYouTube全停止へ波及させません。
- You MUST verify newcomer and obstacle exclusions by their explicit `unpredictable_reason` or recognized race classification because an all-null prediction caused by a calculation error is not a valid exclusion。
- You MUST treat `NewBeginning`を含む初出走レース and comparison-data shortage marked as `予測対象外` as expected exclusions because予測対象外は取得エラーではありません。
- You MUST compare placeholder horse names by normalized exact match and omit only that horse because`ウイングレイテスト`のような正常馬名を部分一致で拒否してはいけません。
- You MUST preserve IAP-only database access because本番PostgreSQLを外部公開してはいけません。

### 4. 非公開で重複なく再実行する

失敗がDB予約前であること、または既存`video_publications`の動画IDを再利用できることを確認し、`target_date`、`publication_mode=private_review`、`dry_run=false`で手動実行します。

**Constraints:**

- You MUST keep the DB registry and content hash checks enabled because再実行時の重複投稿を防ぎます。
- You MUST retry YouTube status reads, updates, thumbnail calls, and resumable upload chunks up to three times with exponential backoff for SSL切断、timeout、connection reset、5xx because一時的な通信障害で新しい動画IDを作ってはいけません。
- You MUST NOT retry confirmed authentication, permission, or quota errors because 同じ要求の反復では復旧せず、原因の判別を遅らせます。
- You MUST NOT use `--force` or disable the registry because 既存動画IDを見失い外部投稿が重複します。
- You MUST resume from the saved remote video ID after an upload-stage failure because同じ動画を作り直す必要はありません。
- You MUST verify each available output independently because横動画またはShortの片方が失敗しても成功済みの片方を取り消しません。
- You MUST treat remote `privacyStatus=public` as the terminal `published` state even when `publishAt` is absent because公開済み動画には予約日時が残りません。
- You MUST keep YouTube states monotonic from planned through processing to scheduled/private_review and finally published because確認失敗や安全モード切替で公開済み・予約済み動画を後戻りさせてはいけません。
- You MUST preserve an existing terminal scheduled/private_review/published record when another video or reconciliation check fails because成功済み成果物を非公開化しても復旧にはなりません。
- You MUST verify actual race counts, grade counts, duration, and uploaded video IDs before opening visibility becauseタイトルと概要欄を実収録内容へ一致させます。

### 5. Studio確認後に公開し、次回同期を確認する

YouTube Studioで処理完了、日付、中央各場から地方各場への章順、実収録R数、Shortの収録重賞または各場11R・最終R、59.5秒以下の完成尺、説明欄先頭URL、映像、音声を確認します。緊急復旧では過去の予約時刻を再利用せず、通知なしで即時公開します。

**Constraints:**

- You MUST verify every successfully uploaded video before changing visibility because一括公開後の差し戻しを避けます。
- You MUST NOT describe omitted races as included or use `全重賞` when any grade race was omitted because 実収録内容を誤認させます。
- You MUST keep confirmed BGM rights and the 59.5-second Short duration gate enabled because1分超Shortの権利申し立て時の公開停止リスクを避けます。
- You MUST compare video IDs with `video_publications` on the next daily run becauseStudioで手動公開した状態をDBの`published`へ同期する必要があります。

### 6. 次の1開催日を監視する

午後データ更新後の成否を問わない`workflow_run`、18:20 JSTの予備cron、12:30 JSTの当日復旧cron、単一concurrency、同一公開時刻、部分収録のSummaryを確認します。

**Constraints:**

- You MUST treat the upstream run start date in JST plus one day as the workflow-run target because完了が日付をまたいでも対象日は変わりません。
- You MUST keep all publish offsets at zero and a 45-minute minimum lead because連続アップロード中の公開時刻超過を避けながら同時公開を維持します。
- You MUST NOT delete registry rows to clear an error because 履歴と重複防止情報を失います。
- You MUST let the 12:30 JST recovery cron re-attempt the current date when the previous evening produced no publication because上流データ欠損による欠測を手動`workflow_dispatch`だけに頼らせません。
- You MUST keep `--recovery-only` on that cron because投稿済みの日に再生成・再投稿を走らせてはいけません。
- You MUST use the recovery-specific publish shift cap when recovering the current date because予約基準は対象日前日19:00 JSTであり、通常の240分上限では必ず遅延ガードで停止します。
- You MUST NOT run a manual `workflow_dispatch` recovery of a past target date with `publication_mode=scheduled_public` because同じ遅延ガードでアップロード前に停止します。手動復旧は`private_review`で投稿し、Studioで公開します。

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

### SSL EOFまたは状態確認の一時失敗が出る

同じ対象日を`private_review`で再実行し、DBに保存済みの動画IDを再利用して状態を照合します。YouTube上ですでに`public`ならDBを`published`へ進め、予約済みなら予約状態を維持します。通信確認のためにレジストリ行を削除したり、同じ動画を新規アップロードしてはいけません。

### 一部レースの予測欠損がある

Actions Summaryの`coverage_status=partial`、除外R、理由、重賞収録状況を確認します。収録可能なレースが1件以上あれば正常な警告付き完了であり、横動画とShortの生成・投稿を継続します。上流側では欠損レースだけを次回取得対象にします。

### 全件ゼロでWorkflowが失敗になる

初回と120秒間隔の再取得2回が行われたか、DBからAPIへフォールバックしたかを確認します。3回後も正常な馬3頭以上の有限AI偏差値を持つレースが0件なら、その対象日だけ停止します。前日データは再利用しません。

### 午後データ更新Workflowが失敗した

YouTubeの`workflow_run`が起動し、部分保存済みDBまたは公開予測APIから収録可能レースを探索したか確認します。上流失敗そのものはYouTube停止理由にせず、全件ゼロ、両動画生成不能、素材権利検証失敗、認証チャンネル不一致、またはYouTube側の確定的拒否だけを停止理由とします。

### 連動起動と予備cronが両方動く

単一concurrencyで直列化されます。後続実行はDBレジストリとcontent hashを照合し、既存動画IDを再利用します。
