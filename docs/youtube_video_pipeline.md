# YouTube自動集客基盤 v7

UMA-FREEへの検索外流入を増やすため、翌日開催分の確定済みレースデータから動画を生成し、YouTubeへ非公開投稿または予約公開します。映像、画像、音声、文章の生成AIは使用せず、Pillow、FFmpeg、UMA-FREEの実データ、権利確認済み素材だけを利用します。

## 日次の生成内容

- 会場別長尺: 開催会場ごとに1本。1Rから最終Rまで、各レース約7.4秒でAI偏差値上位5頭と位置取りを表示します。
- Short: 1日1本。G1、Jpn1、G2、Jpn2、G3、Jpn3、その他重賞の順で優先し、重賞がない日は11R、出走頭数、会場コードの順で決定します。
- 公開時刻: Shortは20:10 JST、最優先会場は20:30、残りの会場は20:40から10分間隔です。
- GitHub Actionsは毎日19:17 JSTに開始し、翌日データが不完全な場合は10分間隔で最大3回確認します。

会場は1Rから最大レース番号までが連続し、すべてのレースに実在馬名と有効なAI偏差値がある場合だけ公開対象になります。WorkflowではIAPトンネル経由のDBを正本とし、レース表に存在して予測表に存在しないレースも欠損として検知します。不完全な会場は会場単位で保留し、正常な会場は維持します。保留が発生したWorkflowは正常会場の処理後に失敗終了し、GitHubの通知とActions Summaryで把握できるようにします。

Actions遅延などで予約時刻が5分以内または過去になった場合、別の時刻へ自動変更しません。その日の投稿を失敗終了し、固定時刻を守れない動画が意図せず公開されることを防ぎます。

## デザイン

- 現行のRace Editorialを維持し、紙面色、チャコール、深緑、ゴールド、Noto Sans JP、Interを使用します。
- 横長動画は1920×1080、Shortは1080×1920、H.264、AAC 48kHzで生成します。
- 横長冒頭は日付、会場または重賞、代表馬、AI偏差値・位置取りの収録内容に限定します。汎用的な機能紹介画面は挟みません。
- AI偏差値画面は横長が上位5頭、Shortが上位3頭です。長い馬名は省略記号を使わずフォントを縮小します。
- 位置取りは先行、中団、後方、位置未確定を分離し、最大18頭を一度ずつ表示します。
- サムネイルは重賞名を最優先し、会場、日付、全レース収録、代表馬を補助情報にします。JPEG quality 90で保存し、YouTube上限の2MB未満を検証します。
- ShortはカスタムサムネイルAPIを呼びません。最初のフレームをレース固有の表紙にし、縦動画の最後は「プロフィールのリンクから全頭データを確認」と表示します。
- 拡大、Ken Burns、派手な演出は使わず、約0.16秒のクロスフェードだけを使用します。

素材は`backend/scripts/social_video/assets/`で管理します。写真、コース図、BGMは`credits.json`の`credit`と`license`を必須とし、不足時は投稿を停止します。BGM原本はGitへ含めず、既存の非公開Cloud StorageからActions実行時だけ取得します。

## サイト導線と計測

動画の遷移先は必ず既存のレース詳細URLです。

```text
https://uma-free.com/races/YYYY-MM-DD/{venueSlug}/{raceNumber}
```

競馬場slugは`frontend/lib/venue-slugs.json`をPythonとNext.jsで共有します。会場別動画は重賞または代表レース、Shortは収録レースへ直接移動します。旧クエリ型の`?venue=...&race=...`は生成しません。

横長動画の説明欄1行目に次のUTM付きURLを置きます。

```text
utm_source=youtube
utm_medium=video
utm_campaign=YYYYMMDD_preview
utm_content={stable_video_key}
```

Shortsの説明欄URLは主要導線にせず、チャンネルプロフィールのUMA-FREEリンクを利用します。プロフィールには次を一度設定してください。

```text
https://uma-free.com/?utm_source=youtube&utm_medium=profile&utm_campaign=channel
```

サイトでは最初の`race_view`へ`entry_source=youtube`、`source_video_key`、`video_format`、`source_venue`を付けます。プロフィールリンクでホームや記事へ入った場合も、`channel_profile`を最大30分保持して次のレース到達へ引き継ぎます。タブやレース切り替えによる仮想`page_view`は送信しません。

## 投稿モード

Repository Variable `YOUTUBE_PUBLICATION_MODE`で状態を切り替えます。

| 値 | 動作 |
| --- | --- |
| `disabled` | 動画生成だけを行い、YouTubeへ送信しない |
| `private_review` | `privacyStatus=private`で投稿し、`publishAt`は設定しない |
| `scheduled_public` | `privacyStatus=private`で投稿し、`publishAt`により予約公開する |

Workflowの安全な既定値は`private_review`です。`YOUTUBE_UPLOAD_ENABLED=true`も設定されている場合だけAPIへ送信します。`scheduled_public`へ切り替える前に3開催日連続で非公開検証を行います。

## 重複防止と再開

`video_publications`テーブルへ次の状態を保存します。

```text
planned
  -> uploaded
  -> thumbnail_set / thumbnail_skipped
  -> processing
  -> private_review / scheduled
  -> published
```

動画IDはアップロード直後、サムネイル設定より前に保存します。途中で失敗した場合は同じ動画IDから再開し、動画を作り直しません。同一の対象日、動画種別、stable IDで内容hashが変わった場合は自動投稿を停止します。`--force`と投稿時の`--disable-registry`は許可しません。

Shortは`thumbnail_skipped`、横長だけが`thumbnail_set`へ進みます。アップロード後は`videos.list`で処理完了、拒否、公開状態、予約時刻を確認し、確認できない動画を成功扱いにしません。

日次実行時には直近7日間の`scheduled`を照合し、公開済みなら`published`へ更新します。公開予定から1時間を過ぎても非公開、処理拒否、動画ID欠損のいずれかならエラーを保存します。素材・権利保留または直近7日間の投稿エラーが1件でもある日は、Repository Variableが`scheduled_public`でも当日分を自動的に`private_review`へ落とします。予測欠損だけの場合は該当会場を除外し、正常会場の予約は維持します。すでにYouTubeへ予約済みの同日動画がある場合は`videos.update`で`publishAt`を削除し、`videos.list`で非公開を再確認します。Actions Summaryには直近7日間の状態件数とエラー件数を表示します。

DB接続は既存のIAPトンネルと`127.0.0.1:15432`への実行時書き換えを維持します。旧外部IPや公開PostgreSQLは使用しません。

## 設定

### GitHub Secrets

- `DATABASE_URL`
- `API_BASE_URL`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_UPLOAD_ENABLED`

`YOUTUBE_REFRESH_TOKEN`は限定的な`youtube.upload`ではなく、予約解除にも対応する`https://www.googleapis.com/auth/youtube`スコープで発行したものを使います。3日間の非公開試験前に、認証チャンネルが`YOUTUBE_CHANNEL_ID`と一致することをWorkflowで確認します。

### Repository Variables

- `YOUTUBE_PUBLICATION_MODE`: 初期値`private_review`
- `YOUTUBE_PUBLISH_TIME_JST`: 初期値`20:30`
- `YOUTUBE_DAILY_QUOTA_BUDGET`: 初期値`8000`

ワークフローは1日1回、最大90分、Short 1本に固定します。アップロード前に動画本数、横長サムネイル数、状態確認回数からAPIクォータを概算し、設定上限を超える場合は投稿しません。MP4はartifactへ保存せず、権利検証、サマリー、サムネイル、コンタクトシート、Shorts安全領域だけを7日保存します。

## ローカル検証

素材検証:

```powershell
cd backend
python scripts/social_video/validate_assets.py
```

PNG、metadata、コンタクトシートだけを生成:

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-24 --publication-mode disabled --dry-run --skip-upload --skip-video
```

動画まで生成:

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-24 --publication-mode disabled --dry-run --skip-upload
```

非公開アップロード:

```powershell
cd backend
$env:YOUTUBE_UPLOAD_ENABLED="true"
python scripts/youtube_video_pipeline.py --target-date 2026-07-24 --publication-mode private_review
```

コンタクトシートの再生成:

```powershell
cd backend
python scripts/social_video/create_design_contact_sheet.py ..\youtube_video_dist\2026-07-24
```

## 3開催日の公開判定

各日について次を確認します。

1. すべての完成会場に長尺が1本あり、Shortがちょうど1本である。
2. YouTube上で処理が完了し、重複動画がない。
3. 横長説明欄の1行目が正しいレース詳細へ移動する。
4. Shortの表紙と上位3頭がスマートフォンで読める。
5. 246×138サムネイルで重賞名または会場名が読める。
6. 素材権利エラー、プレースホルダー、強い購入誘導表現がない。
7. GA4 DebugViewでYouTube属性付き`race_view`が一度だけ発火する。

3日すべて合格し、YouTube APIプロジェクトの公開制限とチャンネルの高度な機能を確認した後、Repository Variableを`scheduled_public`へ一度だけ変更します。既存の非公開試験動画は自動公開せず、切り替え後に生成する翌日分から予約公開します。

公開開始後7日間はActions Summaryの`published`件数、エラー件数、保留会場を毎日確認し、GA4では`utm_content`別セッション、YouTube属性付き`race_view`、その後の`prediction_table_view`を同じ日付範囲で確認します。GA4の集計値はAnalytics管理画面で確定値を確認し、Actions側のDB状態と混同しません。

## 将来のInstagram対応

レンダラーはプラットフォーム非依存の`VideoPackage`を返します。縦動画にはYouTube固有のUIや「概要欄」の表現を焼き込まず、動画、表紙、キャプション要素、遷移先、権利hashを分離しています。Instagram連携時は同じ1080×1920成果物へ投稿アダプターを追加し、レンダラーを複製しません。
