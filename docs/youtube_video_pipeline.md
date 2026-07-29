# YouTube自動集客基盤 v8

UMA-FREEへの検索外流入を増やすため、翌日開催分の確定済みレースデータから動画を生成し、YouTubeへ非公開投稿または予約公開します。映像、画像、音声、文章の生成AIは使用せず、Pillow、FFmpeg、UMA-FREEの実データ、権利確認済み素材だけを利用します。

## 日次の生成内容

- 会場別長尺: 開催会場ごとに1本。新馬戦を除く対象レースを実際のレース番号順に収録し、各レース約6秒の1シーン内でAI偏差値上位3頭と全馬の位置取りを表示します。
- Short: 1日1本。G1、Jpn1、G2、Jpn2、G3、Jpn3、その他重賞の順で優先し、重賞がない日は11R、出走頭数、会場コードの順で決定します。
- 長尺タイトルは`M/D 会場｜全○R AI予想｜重賞名開催｜YYYY`の順とし、スマートフォン一覧で後半が省略されても日付、会場、全レース動画であることが先頭に残るようにします。新馬戦を除外する日は`対象○R AI予想（新馬戦除く）`とし、実際の収録範囲を優先します。重賞名は最上位の1件だけを「開催」と明記し、重賞1レースだけの動画に見える表現を避けます。
- Shortタイトルは`M/D 会場○R｜AI予想TOP3｜レース名｜YYYY #Shorts`とし、1レース動画であることを明確に分離します。
- 基準公開時刻: Shortと全会場の横長動画を、すべて前日19:00 JSTに同時公開します。
- GitHub Actionsの起動が遅れた場合は、最初の公開まで20分の猶予を確保できる次の10分枠へ、全動画を同じ分数だけ後ろ倒しします。補正後も全動画は同時刻です。
- GitHub Actionsは毎日17:17 JSTに開始し、翌日データが不完全な場合は10分間隔で最大3回確認します。

会場は1Rから最大レース番号までが連続し、すべてのレースに実在馬名と有効なAI偏差値がある場合だけ公開対象になります。WorkflowではIAPトンネル経由のDBを正本とし、レース表に存在して予測表に存在しないレースも欠損として検知します。不完全な会場は会場単位で保留し、正常な会場は維持します。保留が発生したWorkflowは正常会場の処理後に失敗終了し、GitHubの通知とActions Summaryで把握できるようにします。

Actions遅延などで19:00まで20分未満になった場合、全動画を同じ10分枠へまとめて後ろへ移動します。補正が240分を超える場合だけ、古い内容の公開を避けるため失敗終了します。

## Broadcast Editorialデザイン

- 競馬中継の速度感と専門紙の信頼感を組み合わせ、チャコール、深緑、ゴールド、ウォームアイボリー、データブルー、Noto Sans JP、Interを使用します。
- 横長動画は1920×1080、Shortは1080×1920、H.264、AAC 48kHzで生成します。
- 横長冒頭は2.2秒で、日付、会場または重賞、収録レース数、代表馬のAI偏差値を提示します。汎用的な機能紹介画面は挟みません。
- 各レースは1画面・約6秒です。左側へ上位3頭、右側へ先行・中団・後方・不明の全馬馬番トークンを置き、AI偏差値と位置取りを別スライドに分けません。
- 各レース画面の下部には「その他の分析情報は概要欄のサイトから」を常時表示します。4視点（AI偏差値、対戦成績、展開・脚質、枠順傾向）は名称とミニグラフィックだけで示し、CTA内で内容を繰り返し説明しません。
- 横長の情報階層は「背景面、データカード、左アクセント線」の3要素に限定します。左右カラムとCTAを囲う外枠は描かず、カード枠・CTA枠・進行線が交差する二重囲みを禁止します。CTAは上部と同じ左右端`44–1876px`へ揃え、ゴールドの左線だけで強調し、4分析セルも面と役割色で区切ります。
- 位置取りレーンの馬番は、1行ならレーン中央、2行以上でも上下の余白が等しくなるよう行全体を垂直中央へ配置します。各行の頭数に応じてラベル右側の利用可能幅で水平中央も再計算し、少頭数の行が左へ偏らないようにします。
- 1位カードだけを大きくし、AI偏差値は約0.8秒で7段階カウントアップします。長い馬名は省略記号を使わずフォントを縮小します。
- 決勝線を模したゴールドワイプ、ease-outのカード表示、レーンの時間差表示、細い進行ラインを使用します。バウンド、点滅、Ken Burns、無意味なズームは使用しません。
- `SOCIAL_VIDEO_MOTION_PROFILE`は`standard`、`reduced`、`static`に対応します。本番は`standard`、確認用の動き抑制は`reduced`、FFmpegレイヤー障害時は`static`を使用します。
- サムネイルは重賞名を最優先し、会場、日付、全レース収録、代表馬を補助情報にします。JPEG quality 90で保存し、YouTube上限の2MB未満を検証します。
- ShortはカスタムサムネイルAPIを呼びません。最初のフレームをレース固有の表紙にし、縦動画でも「その他の分析情報は概要欄のサイトから」と表示します。
- Shortは15.5秒で、表紙、上位3頭、全馬位置取り、1位再提示、概要欄のサイト導線を同じ映像内で時間差表示します。
- Shortのカード面は左右108pxの864px幅で画面中央へ置きます。YouTube操作UIへの対応はカード全体を左へ寄せず、右側の重要文字・数値だけに追加余白を持たせます。主要情報は上部だけへ偏らないよう縦方向へ再配分し、下部には4分析を2×2で常時表示して概要欄のサイト導線まで同じ中央軸を維持します。
- Shortの表紙、ランキング、位置取り、1位、CTAは時間上で重ねません。FFmpegのレイヤー終了時刻は排他的に扱い、切替境界で前後コンテンツが同一フレームへ残らないようにします。フェーズ自体を画面外から移動させず、透明度だけで表示し、生成時には全主要レイヤーの透過領域が1080×1920内に収まることを検証します。

素材は`backend/scripts/social_video/assets/`で管理します。写真、動画、コース図、BGM、効果音は`credits.json`の`credit`と`license`を必須とし、不足時は投稿を停止します。B-rollは任意で、未配置時は権利確認済み写真へフォールバックします。動画派生素材は合計40MB以内とし、Cloud RunのDockerコンテキストから除外します。BGM原本と再配布不可素材はGitへ含めず、既存の非公開Cloud StorageからActions実行時だけ取得します。

効果音は`audio/sfx/whoosh`、`data_tick`、`score_reveal`、`transition`、`cta`へ配置します。未配置時はBGMだけで生成を継続します。BGMと効果音は48kHzへ統一し、`loudnorm`とリミッターを通します。

## サイト導線と計測

横長動画とShortの説明欄1行目は、次のURLへ統一します。

```text
https://uma-free.com
```

動画種別、会場、レース、公開日によるURLの出し分けは行わず、UTMクエリも付与しません。チャンネルプロフィールに設定するURLも同じ`https://uma-free.com`とします。

説明欄には素材クレジットとデータ基準日を表示しません。素材の権利情報、ライセンス、権利ハッシュは内部の公開可否判定に必要なため、`credits.json`と動画メタデータで引き続き保持します。

UTMを付けないため、`utm_content`別の動画単位集計と、UTMを起点にした`race_view`のYouTube属性付与は新規動画では行えません。GA4ではYouTubeからトップページへ到達した実ページビューを、参照元が取得できた範囲で確認します。タブやレース切り替えによる仮想`page_view`は引き続き送信しません。

## 投稿モード

Repository Variable `YOUTUBE_PUBLICATION_MODE`で状態を切り替えます。

| 値 | 動作 |
| --- | --- |
| `disabled` | 動画生成だけを行い、YouTubeへ送信しない |
| `private_review` | `privacyStatus=private`で投稿し、`publishAt`は設定しない |
| `scheduled_public` | `privacyStatus=private`で投稿し、`publishAt`により予約公開する |

Workflowの安全な既定値は`private_review`です。`YOUTUBE_UPLOAD_ENABLED=true`も設定されている場合だけAPIへ送信します。`scheduled_public`へ切り替える前に3開催日連続で非公開検証を行います。

GitHub Actionsの`on.schedule`は指定時刻どおりに起動する保証がありません。`scheduled_public`でレンダリング完了時点から19:00まで20分未満の場合、全動画を同じ時刻のまま10分単位で後ろへ移動します。後ろ倒しが240分を超える場合は、古い翌日情報を深夜に公開しないため停止します。遅延補正の有無、補正分数、実効公開時刻はActions Summaryへ記録します。

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
- `YOUTUBE_PUBLISH_TIME_JST`: Workflowでは`19:00`に固定（既存のRepository Variableより優先）
- `YOUTUBE_PUBLISH_MIN_LEAD_MINUTES`: 初期値`20`
- `YOUTUBE_MAX_PUBLISH_SHIFT_MINUTES`: 初期値`240`
- `YOUTUBE_DAILY_QUOTA_BUDGET`: 初期値`8000`

ワークフローは1日1回、最大90分、Short 1本に固定します。アップロード前に動画本数、横長サムネイル数、状態確認回数からAPIクォータを概算し、設定上限を超える場合は投稿しません。日次実行ではMP4をartifactへ保存しません。手動`workflow_dispatch`かつ`dry_run=true`の場合だけ、横長19秒以内とShort 15秒の縮小レビューMP4を7日保存します。

コンタクトシートにはサムネイル、導入、1レース統合画面、終了画面、Short各段階に加え、最初のレースの0.0、0.6、1.5、3.0、5.5秒フレームを収録します。

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

公開開始後7日間はActions Summaryの`published`件数、エラー件数、保留会場を毎日確認し、GA4ではYouTube参照元のトップページ流入、そこからのレースページ遷移、`prediction_table_view`を同じ日付範囲で確認します。UTMを廃止した日より前の動画単位集計とは直接比較しません。GA4の集計値はAnalytics管理画面で確定値を確認し、Actions側のDB状態と混同しません。

## 将来のInstagram対応

レンダラーはプラットフォーム非依存の`VideoPackage`を返します。現在の縦動画には「概要欄」のCTAを焼き込むため、Instagram連携時はCTAテキストレイヤーだけを投稿先向けに差し替え、映像本体、表紙、メタデータ、権利hashを再利用します。
