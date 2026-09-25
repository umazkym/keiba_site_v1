# YouTube自動集客基盤 v10

UMA-FREEへの検索外流入を増やすため、翌日開催分の確定済みレースデータから動画を生成し、YouTubeへ非公開投稿または予約公開します。映像、画像、音声、文章の生成AIは使用せず、Pillow、FFmpeg、UMA-FREEの実データ、権利確認済み素材だけを利用します。

## 日次の生成内容

- 日次統合長尺: 1日1本。新馬戦・障害戦などAI偏差値の算出対象外レースを除き、中央競馬の各開催場を先に開催場単位で表示し、その後に地方競馬の各開催場を表示します。各開催場内は実際のレース番号順で、各レース約6秒の1シーンにAI偏差値の上位5頭と展開予測（序盤の位置取り）を収録します。
- 日次統合Short: 1日1本。当日にAI分析可能な重賞がある場合は中央・地方を問わず収録し、スコア不足の重賞だけを除外します。分析可能な重賞がない日は各開催場の11Rを選び、11Rがない開催場は最終レースをメインレースとして収録します。最後のレースだけにサイト案内を表示し、通常はそれ以前を1レース約12秒、最後を15.5秒とします。合計が59.5秒を超える場合は途中シーンを均等短縮します。
- 長尺タイトルは`M/D 全○レースAI分析｜中央・地方競馬予想｜重賞名`を基本とし、○には実収録数を入れ、重賞名は優先度順で最大2件にします。Shortタイトルは重賞日を`M/D 重賞名・重賞名ほか｜○重賞 AI競馬予想｜YYYY #Shorts`、重賞なしの日を`M/D 開催場 11R・最終R｜AI競馬予想TOP3｜YYYY #Shorts`とします。100文字以内で、日付、AI、競馬、予想、主要な重賞名を自然な文脈で前方へ置きます。重賞を1件でも除外した日は`全重賞`と表現しません。
- 長尺サムネイルは大きな日付`M/D`、`全○レース`、`AI分析`を主見出しとし、右下の白い札に最も格の高い重賞（重賞がない日は代表レース）とそのAI偏差値1位を載せます。
- 説明欄はサイトURL、タイトル、`【中央・地方競馬のAI分析をいつでも無料公開中】`、収録開催場または収録レース、重賞名、チャプター、注意書き、検索意図に沿ったハッシュタグの順で構成します。
- 基準公開時刻: 日次統合長尺と日次統合Shortを、前日19:00 JSTに同時公開します。
- GitHub Actionsの起動が遅れた場合は、最初の公開まで45分の猶予を確保できる次の10分枠へ、全動画を同じ分数だけ後ろ倒しします。補正後も全動画は同時刻です。
- GitHub Actionsは成功した定期の午後データ更新Workflowだけから連動起動します。手動Afternoonと失敗した定期実行は自動連動せず、18:20 JSTの予備cronで補完します。単一concurrencyグループで直列化し、連動時は前段の本来のUTC 04:30 cron日+1日、予備cronは本来のUTC 09:20 cron日+1日、手動実行は必須入力の対象日を正本とします。
- 対象日の予測対象レースにPrediction行なし、全馬スコアなし、予測計算エラー、または有効スコア3頭未満が1件でも残る場合、120秒間隔で再取得2回を行い、初回を含む計3回確認します。2回目以降は同一プロセスの予測キャッシュを破棄します。3回後も一時欠損が残る場合は動画生成・投稿前に停止し、明示的な予測対象外だけが残る場合は続行します。

判定単位は会場ではなく各レースです。正常な馬名と有限なAI偏差値を持つ馬が3頭以上いれば収録対象とします。出走頭数との差や位置取り指標の一部欠損は許容しますが、Prediction行なし、全馬スコアなし、予測計算エラー、または有効スコア3頭未満はデータ準備未完了として投稿を止めます。中央の新馬・障害、地方競馬の「ゴールデンデビュー」「スパーキングデビュー」「NewBeginning」などの初出走、比較可能な過去データ不足を明示した`予測対象外`は正常な除外です。プレースホルダー馬名はUnicode正規化後の完全一致で該当馬だけを除外し、`ウイングレイテスト`のような部分一致は拒否しません。

WorkflowはIAPトンネル経由のDBを第1ソース、公開予測APIを第2ソースとします。DB接続に失敗した場合はAPIへ自動フォールバックしますが、部分保存済みデータに予測対象レースの欠損が残る間は投稿しません。上流予測処理は欠損レースだけを1回再取得し、警告付き成功で終わった場合もYouTube側の完全性ゲートで再判定します。長尺の収録対象レース、Shortの対象レース、または必要な動画種別に描画失敗があれば、生成済みの部分成果物を外部投稿せず停止します。前日データは再利用しません。

Actions遅延などで19:00まで45分未満になった場合、全動画を同じ10分枠へまとめて後ろへ移動します。補正が240分を超える場合だけ、古い内容の公開を避けるため失敗終了します。

## デザイン（2026-09 デザイン改修・段階6）

見た目の正本は `DESIGN.md` とポートフォリオ「YouTube・縦動画」。サイト・SNS画像と同じ色（`backend/scripts/brand_tokens.py`）、書体（見出し・本文は Noto Sans JP のゴシック、ロゴ文字と写真の上の大きな見出しだけ M PLUS Rounded 1c、数字は Barlow Semi Condensed。`backend/fonts/`。2026-09-26）、部品（会場×Rの札・グレード・枠色の馬番・印・AI偏差値の行と棒・位置取り）で描きます。描画は `backend/scripts/social_video/brand_scenes.py`、組み立て・題名・概要欄・タグ・章・音は `renderer.py` です。`metadata.json` の `design_system` は `uma_free_brand_v10_daily_compilation`。

- 横長動画は1920×1080、Shortは1080×1920、H.264、AAC 48kHz。どの画像も2倍で描いて縮小し、角丸と円をなめらかにします。動く部分は要素ごとの透過PNGにし、`motion.py` が時間差で重ねます（透過の面の上でも文字の縁が黒ずまないよう、形をマスクに描いてから色を重ねる）。
- 長尺の構成（ポートフォリオの4場面）：
  1. 導入（2.2秒）：写真＋左の紺の幕、ロゴ、`2026年9月20日(日)`、`全○レース`／`AI分析`（琥珀）、収録の順（`阪神・中山・高知・佐賀の順に収録`）、伸びる棒。
  2. 競馬場の章（各2.2秒）：夜の紺。左に`○場目 · 中央競馬`、会場名、`全12レース · 芝・ダート`（対象外があれば`全12レース中10レースを収録`）、1R〜12Rの札の並び（対象外は薄く、注目のレースは白）、注目の重賞（無ければメインレース）の札。右に24場のコース図。左の固まりとコース図は上下の中央をそろえます。
  3. レース（各6秒）：上に会場×Rの札・日付・芝ダ距離・頭数・レース名・グレード・`○ / ○`、左にAI偏差値の上位5頭（1位は琥珀の行）、右に展開予測（序盤の位置取り。段ごとに馬番の小さい順・横の中央。AI偏差値の上位3頭に琥珀の輪。凡例・進行方向などの説明書きは置かない。2026-09-26）、下に`対戦成績・馬番の傾向は概要欄のサイトで確認できます`。左の5行と右の図は同じ高さ（246〜950px）にし、上下の端をそろえます。見出しは切り替えの瞬間から表示し（44回くり返してもちらつかない）、行は0.06秒ずつ、位置取りは0.34秒から入ります。見出しの下の細い棒が6秒かけて伸びます。
  4. 締め（3秒）：案内役の馬、`全頭のデータはサイトで`、4つの視点（AI偏差値・対戦成績・展開予測・馬番の傾向）、ロゴと`uma-free.com`、`登録不要 · 毎朝7時ごろ更新 · 概要欄のリンクから`。
- 位置取りの予測が無い馬は図に置きません（空の「不明 0頭」の段は出さない。凡例の行は 2026-09-26 に外した）。全馬に予測が無いレースは図の代わりにその旨を書きます。図を高くするときは、馬のいる段ほど広げます。
- サムネイルは1280×720のJPEG（quality 90、2MB未満を検証）。写真＋左の幕、大きな日付`M/D(曜)`、`全○レース`、`AI分析`（琥珀）、右下の白い札に最も格の高い重賞（無ければ代表レース）とAI偏差値1位。
- Shortは1レースを「表紙（0〜1.2秒。レース名とAI偏差値1位）→ 上位5頭（1.2〜5.0秒）→ 序盤の位置取り（5.0〜12.0秒）」で見せ、最後のレースだけ「締め（12.0〜15.5秒）」を付けます。途中のレースは12秒の型を収録数に合わせて縮めます（最大5重賞でも59.5秒以下）。位置取りの予測が無いレースは上位5頭を最後まで見せます。表紙は最初のフレームから全部見え（`000_intro.png`が縦型カバー）、場面は時間の上で重ねません。
- Shortの背景は、上と中央（見出しと中身）を夜の紺で静かにし、写真の馬群が見える下の方だけ幕を薄くします（写真の指定書：被写体は下35%）。上にロゴ、レースの見出し（`○ / ○`は収録数が2以上のとき）、その下に伸びる棒。
- Shortの中身の列は画面の中央（横90〜990px）に置き、場面ごとの中身の固まりを上下の中央にそろえます（場面が替わっても中心が跳ばない）。YouTubeの右の操作ボタンの下に数字が入らないよう、行や札の内側で右に余白を取り、数字の右端を948pxまでにします（列そのものは左へ寄せない）。文字・数字・札は縦230〜1540pxに収めます（`validate_short_layers`が生成時に止める）。長いレース名は2行にします。
- Shortの表紙の札：馬番と馬名、AI偏差値（大きな数字）、2位との差、序盤の位置取り（3つの点。サイトの位置取りの表示と同じ形）、偏差値の棒。
- TikTok用の版（`tiktok_clean`）は、ロゴ・案内役の馬・サイトへの案内を焼き込みません。締めは`対戦成績と馬番の傾向も／同じ基準で整理`と`過去データをもとにした参考情報です`。
- 写真：長尺の導入とサムネイルは、中央の開催がある日は芝（ホームの写真 hero-jra）、地方だけの日はダート（hero-nar-day）。Shortは各レースの馬場で芝（sns-turf）かダート（sns-dirt）。素材は`assets/images/surfaces/{turf|dirt}/{wide|vertical}/`で、写真は レース → 競馬場 → 馬場 → 共通 の順に探します。
- 案内役の馬と4つの視点のアイコンは`backend/assets/video/`（ポートフォリオの正本から書き出した透過PNG）、コース図は`frontend/lib/course-shapes.ts`（サイトのコース図と同じデータ。bboxは[左, 上, 右, 下]）を読みます。
- 場面の画像の名前は動画の中で一意にします（レースは`{会場の番号}_{会場内の順番}_{R番号}r`）。旧版は会場の番号が無く、同じ順番とR番号のレースが後の会場の絵で上書きされていました（2026-09-25 に修正）。
- `SOCIAL_VIDEO_MOTION_PROFILE`は`standard`、`reduced`、`static`に対応します。本番は`standard`、確認用の動き抑制は`reduced`、FFmpegレイヤー障害時は`static`を使用します。
- 新しい見た目の初日から7開催日で、視聴維持率と平均視聴時間を取り直します（旧デザインの観測とは比べない）。
- ShortはカスタムサムネイルAPIを呼びません（YouTube以外の縦型カバーには表紙の画像を使う）。FFmpegのレイヤーの終了時刻は排他的に扱い、場面の切り替えの境界で前後の内容が同じフレームに残らないようにします。

素材は`backend/scripts/social_video/assets/`で管理します。写真、動画、BGM、効果音は`credits.json`の`credit`と`license`を必須とし、不足時は投稿を停止します。B-rollは任意で、未配置時は権利確認済み写真へフォールバックします。動画派生素材は合計40MB以内とし、Cloud RunのDockerコンテキストから除外します。BGM原本と再配布不可素材はGitへ含めず、既存の非公開Cloud StorageからActions実行時だけ取得します。

効果音は`audio/sfx/whoosh`、`data_tick`、`score_reveal`、`transition`、`cta`へ配置します。未配置時はBGMだけで生成を継続します。BGMと効果音は48kHzへ統一し、`loudnorm`とリミッターを通します。

## サイト導線と計測

横長動画とShortの説明欄1行目は、`data_loader.build_video_url`が組み立てるURLで統一します。着地先は動画が扱う範囲に合わせて出し分けます。

| 動画種別 | `scope` | 着地先 |
|---|---|---|
| 日次統合長尺・日次統合Short | `date` | `https://uma-free.com/races/{対象日}` |

対象日が取得できない場合だけ`https://uma-free.com`へ戻します。チャンネルプロフィールに設定するURLは`https://uma-free.com`とします。

すべての説明欄URLに次のUTMを付与します。パラメータはこの4つだけで、増やしません。

```text
utm_source=youtube&utm_medium=video&utm_campaign=daily_race_video_v2&utm_content={動画別キー}
```

`utm_content`は動画ごとに`venue_long_{会場}`、`daily_long_all`、`short_{race_id}`、`daily_short_compilation`を割り当てます。

説明欄には素材クレジットとデータ基準日を表示しません。素材の権利情報、ライセンス、権利ハッシュは内部の公開可否判定に必要なため、`credits.json`と動画メタデータで引き続き保持します。

GA4では`utm_content`別の動画単位集計と、UTMを起点にした`race_view`のYouTube属性付与が行えます。属性はsessionStorageへ30分保持し、最初の`race_view`へ一度だけ引き継ぎます（`frontend/lib/analytics.ts`）。タブやレース切り替えによる仮想`page_view`は引き続き送信しません。

## 投稿モード

Repository Variable `YOUTUBE_PUBLICATION_MODE`で状態を切り替えます。

| 値 | 動作 |
| --- | --- |
| `disabled` | 動画生成だけを行い、YouTubeへ送信しない |
| `private_review` | `privacyStatus=private`で投稿し、`publishAt`は設定しない（非公開） |
| `scheduled_public` | `privacyStatus=private`で投稿し、`publishAt`により予約公開する（既定値） |
| `public` | `privacyStatus=public`で投稿し、即時公開する |

Workflowの既定値は`scheduled_public`です。`YOUTUBE_UPLOAD_ENABLED=true`も設定されている場合だけAPIへ送信します。

GitHub Actionsの`on.schedule`は指定時刻どおりに起動する保証がありません。`scheduled_public`でレンダリング完了時点から19:00まで45分未満の場合、全動画を同じ時刻のまま10分単位で後ろへ移動します。後ろ倒しが240分を超える場合は、古い翌日情報を深夜に公開しないため停止します。遅延補正の有無、補正分数、実効公開時刻はActions Summaryへ記録します。

動画レンダリング前にDBレジストリ、YouTube OAuth、認証チャンネルを事前検証します。`invalid_grant`は動画生成やDB予約を始めずに停止し、Actions Summaryへ認証失敗と復旧先のSecret名を記録します。OAuthアプリは単一管理アカウント向けの外部・本番環境で運用し、`https://www.googleapis.com/auth/youtube`スコープで再認証します。token値やclient secretはログ、artifact、文書へ残しません。

## 重複防止と再開

`video_publications`テーブルへ次の状態を保存します。

```text
planned
  -> uploaded
  -> thumbnail_set / thumbnail_skipped
  -> processing
  -> private_review / scheduled / published
  -> published

scheduled / private_review
  -> superseded（不完全な未公開動画の明示的な差し替え時だけ）
```

動画IDはアップロード直後、サムネイル設定より前に保存します。途中で失敗した場合は同じ動画IDから再開し、動画を作り直しません。同一の対象日、動画種別、stable IDで内容hashが変わった場合は自動投稿を停止します。`--force`と投稿時の`--disable-registry`は許可しません。不完全な予約動画を差し替える場合だけ、全レース収録可能なdry-runを先に通し、旧動画を非公開の`superseded`として保持して、`{stable_id}__{replacement_revision}`の新しい台帳キーと動画IDを作ります。同じYouTube動画IDの本体差し替えや旧台帳行の削除は行いません。

Shortは`thumbnail_skipped`、横長だけが`thumbnail_set`へ進みます。アップロード後は`videos.list`で処理完了、拒否、公開状態、予約時刻を確認します。アップロード直後に動画一覧への反映が遅れて空応答になった場合は、処理確認の上限時間まで同じ動画IDを再照会します。`processing`は再開可能な中間状態として扱い、再実行時に新しい動画を作りません。既存動画が元の予約時刻を過ぎて公開済みなら`published`へ確定し、未処理の後続動画から再開します。安全ゲート等で`private_review`になった動画をYouTube Studioから手動公開した場合も、次回実行時にYouTube上の公開状態を照合してDBを`published`へ同期します。

生成サマリーのShort項目には、代表遷移先用の`target_date`、`venue_name`、`race_number`、`race_name`、`destination_path`に加え、全収録対象の`featured_races`を必ず残します。複数SNS配信は`featured_races`から複数レース用の投稿文を組み立て、代表レースpathを直接リンクの遷移先として使います。

日次実行時には直近7日間の`scheduled`を照合し、公開済みなら`published`へ更新します。公開予定から1時間を過ぎても非公開、処理拒否、動画ID欠損のいずれかならエラーを保存します。当日のデータ完全性（全レース取得・予測完了・AI偏差値・描画完全性）は動画生成前に厳格に検証され、不完全な場合は生成・投稿前に停止します。過去7日間のエラー履歴はSummaryへの警告表示のみとし、当日の完全な動画投稿を非公開へ強制降格することはありません。差し替え実行では旧予約へ`videos.update`を行って`publishAt`を削除し、`videos.list`で非公開を再確認してから`superseded`へ進めます。Actions Summaryには`included_races`、`omitted_races`、収録・除外重賞、`data_source`、`retry_count`、`coverage_status`、`readiness_status`、取得・実収録数、横動画・Shortの完成尺、投稿ID、直近7日間の状態件数とエラー件数を表示します。

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
- `YOUTUBE_PUBLISH_MIN_LEAD_MINUTES`: Workflow固定値`45`
- `YOUTUBE_MAX_PUBLISH_SHIFT_MINUTES`: 初期値`240`
- `YOUTUBE_DAILY_QUOTA_BUDGET`: 初期値`8000`

ワークフローはデータ更新連動と予備cronを単一concurrencyで直列化し、最大90分、日次統合長尺1本とShort 1本に固定します。アップロード前に動画本数、横長サムネイル数、状態確認回数からAPIクォータを概算し、設定上限を超える場合は投稿しません。日次実行ではMP4をartifactへ保存しません。手動`workflow_dispatch`かつ`dry_run=true`の場合だけ、縮小レビューMP4を7日保存します。

手動実行の`target_date`はYYYY-MM-DDで必須です。通常は`replacement_revision`を空、`supersede_existing=false`にします。差し替え確認では最初に`replacement_revision`だけを指定して`dry_run=true`とし、完全性ゲート合格後の投稿実行だけ同じrevisionと`supersede_existing=true`を指定します。差し替え実行はShortを他SNSへ再配信しません。

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

差し替え完全性のdry-run:

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-08-29 --publication-mode disabled --dry-run --skip-upload --replacement-revision coverage-recovery-v1
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

1. 日次統合長尺とShortの両方が生成完全性ゲートを通り、横長の章順が中央各場から地方各場になっている。生成段階で片方が欠けた場合は両方とも外部投稿せず、アップロード開始後の媒体側エラーでは成功済み動画を取り消さない。
2. YouTube上で処理が完了し、重複動画がない。
3. 横長とShortの説明欄1行目が`https://uma-free.com/races/{対象日}`で、収録開催場・重賞名・チャプターが実データと一致する。
4. Shortの全収録レースで表紙と上位5頭がスマートフォンで読め、完成尺が59.5秒以下である。
5. 246×138サムネイルで`M/D 全○レース AI分析`が読める。
6. 素材権利エラー、プレースホルダー、強い購入誘導表現がない。
7. GA4 DebugViewでYouTube属性付き`race_view`が一度だけ発火する。

3日すべて合格し、YouTube APIプロジェクトの公開制限とチャンネルの高度な機能を確認した後、Repository Variableを`scheduled_public`へ一度だけ変更します。既存の非公開試験動画は自動公開せず、切り替え後に生成する翌日分から予約公開します。

公開開始後7日間はActions Summaryの`published`件数、動画種別ごとのエラー件数、`readiness_status`、期待除外数、取得・実収録数、データ取得元を毎日確認し、GA4ではYouTube参照元のトップページ流入、そこからのレースページ遷移、`prediction_table_view`を同じ日付範囲で確認します。UTMを廃止した日より前の動画単位集計とは直接比較しません。GA4の集計値はAnalytics管理画面で確定値を確認し、Actions側のDB状態と混同しません。

## 他SNSへの再利用

レンダラーはプラットフォーム非依存の`VideoPackage`を返し、縦型カバー、代表レースpath、全収録レースの`featured_races`、標準版とTikTok専用版の動画pathを保持します。Threads、Instagram、Facebook、TikTok、Pinterest、Blueskyへの日次配信では複数レース用の投稿文を生成します。UTM、投稿モード、外部設定は`docs/video/social_video_distribution.md`を参照します。Xの動画投稿は行いません。
