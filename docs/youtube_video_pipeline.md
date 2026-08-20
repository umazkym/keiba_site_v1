# YouTube自動集客基盤 v9

UMA-FREEへの検索外流入を増やすため、翌日開催分の確定済みレースデータから動画を生成し、YouTubeへ非公開投稿または予約公開します。映像、画像、音声、文章の生成AIは使用せず、Pillow、FFmpeg、UMA-FREEの実データ、権利確認済み素材だけを利用します。

## 日次の生成内容

- 日次統合長尺: 1日1本。新馬戦・障害戦などAI偏差値の算出対象外レースを除き、中央競馬の各開催場を先に開催場単位で表示し、その後に地方競馬の各開催場を表示します。各開催場内は実際のレース番号順で、各レース約6秒の1シーンにAI偏差値上位3頭と全馬の位置取りを収録します。
- 日次統合Short: 1日1本。当日にAI分析可能な重賞がある場合は中央・地方を問わず収録し、スコア不足の重賞だけを除外します。分析可能な重賞がない日は各開催場の11Rを選び、11Rがない開催場は最終レースをメインレースとして収録します。最後のレースだけにサイト案内を表示し、通常はそれ以前を1レース約12秒、最後を15.5秒とします。合計が59.5秒を超える場合は途中シーンを均等短縮します。
- 長尺タイトルは`M/D 全○レースAI分析｜中央・地方競馬予想｜重賞名`を基本とし、○には実収録数を入れ、重賞名は優先度順で最大2件にします。Shortタイトルは重賞日を`M/D 重賞名・重賞名ほか｜○重賞 AI競馬予想｜YYYY #Shorts`、重賞なしの日を`M/D 開催場 11R・最終R｜AI競馬予想TOP3｜YYYY #Shorts`とします。100文字以内で、日付、AI、競馬、予想、主要な重賞名を自然な文脈で前方へ置きます。重賞を1件でも除外した日は`全重賞`と表現しません。
- 長尺サムネイルの主見出しは`M/D 全○レース AI分析`とし、中央・地方の収録範囲と主要重賞を補助情報にします。
- 説明欄はサイトURL、タイトル、`【中央・地方競馬のAI分析をいつでも無料公開中】`、収録開催場または収録レース、重賞名、チャプター、注意書き、検索意図に沿ったハッシュタグの順で構成します。
- 基準公開時刻: 日次統合長尺と日次統合Shortを、前日19:00 JSTに同時公開します。
- GitHub Actionsの起動が遅れた場合は、最初の公開まで45分の猶予を確保できる次の10分枠へ、全動画を同じ分数だけ後ろ倒しします。補正後も全動画は同時刻です。
- GitHub Actionsは午後の翌日データ更新Workflowの成否にかかわらず完了時点で連動起動します。18:20 JSTの予備cronも残し、単一concurrencyグループで直列化します。連動時は前段WorkflowのJST開始日の翌日、予備cronはJST翌日、手動実行は明示した対象日を正本とします。
- 前日夜の投稿が上流データ欠損などで不成立だった場合に備え、12:30 JSTの当日復旧cronを持ちます。対象日は当日で、`--recovery-only`により対象日の日次動画が既に終端状態（scheduled / private_review / published）なら生成せず即終了します。未投稿の種別が残っている場合だけ生成・投稿し、収録可能レースが0件の日は警告扱いで正常終了します。
- 対象日の収録可能レースが全件ゼロの場合だけ、120秒間隔で再取得2回を行い、初回を含む計3回確認します。2回目以降は同一プロセスの予測キャッシュを破棄します。1レースでも収録可能なら待機せず部分収録へ進みます。

判定単位は会場ではなく各レースです。正常な馬名と有限なAI偏差値を持つ馬が3頭以上いれば収録し、出走頭数との差、位置取り指標の一部欠損、レース番号の飛び、他レースの欠損では停止しません。Prediction行なし、全馬スコアなし、予測計算エラーは当該レースだけを除外します。中央の新馬・障害、地方競馬の「ゴールデンデビュー」「スパーキングデビュー」「NewBeginning」などの初出走、比較可能な過去データ不足を明示した`予測対象外`は正常な除外です。プレースホルダー馬名はUnicode正規化後の完全一致で該当馬だけを除外し、`ウイングレイテスト`のような部分一致は拒否しません。

WorkflowはIAPトンネル経由のDBを第1ソース、公開予測APIを第2ソースとします。DB接続に失敗した場合はAPIへ自動フォールバックし、部分保存済みデータを活用します。3回の取得後も収録可能レースが全件ゼロの場合だけ対象日の生成を停止し、前日データは再利用しません。上流予測処理は欠損レースだけを1回再取得し、1レース以上が収録可能なら警告付き成功として完了します。動画生成では1レースの描画失敗をそのレースだけの除外として再構成し、横動画とShortも独立して生成・アップロードします。

Actions遅延などで19:00まで45分未満になった場合、全動画を同じ10分枠へまとめて後ろへ移動します。補正が240分を超える場合だけ、古い内容の公開を避けるため失敗終了します。

## Broadcast Editorialデザイン

- 競馬中継の速度感と専門紙の信頼感を組み合わせ、チャコール、深緑、ゴールド、ウォームアイボリー、データブルー、Noto Sans JP、Interを使用します。
- 横長動画は1920×1080、Shortは1080×1920、H.264、AAC 48kHzで生成します。
- 横長冒頭は2.2秒で日付と総収録レース数を提示し、その後に各開催場の2.2秒の章表紙を置きます。章の順序は中央競馬の各場、地方競馬の各場です。
- 各レースは1画面・約6秒です。左側へ上位3頭、右側へ先行・中団・後方・不明の全馬馬番トークンを置き、AI偏差値と位置取りを別スライドに分けません。
- 各レース画面の下部には、横長では「その他の分析情報は概要欄のサイトから」、縦型の共通版では「その他の分析情報はUMA-FREEで公開」を常時表示します。4視点（AI偏差値、対戦成績、展開・脚質、枠順傾向）は名称とミニグラフィックだけで示し、CTA内で内容を繰り返し説明しません。
- 横長の情報階層は「背景面、データカード、左アクセント線」の3要素に限定します。左右カラムとCTAを囲う外枠は描かず、カード枠・CTA枠・進行線が交差する二重囲みを禁止します。CTAは上部と同じ左右端`44–1876px`へ揃え、ゴールドの左線だけで強調し、4分析セルも面と役割色で区切ります。
- 位置取りレーンの馬番は、1行ならレーン中央、2行以上でも上下の余白が等しくなるよう行全体を垂直中央へ配置します。各行の頭数に応じてラベル右側の利用可能幅で水平中央も再計算し、少頭数の行が左へ偏らないようにします。
- 1位カードだけを大きくし、AI偏差値は約0.8秒で7段階カウントアップします。長い馬名は省略記号を使わずフォントを縮小します。
- 決勝線を模したゴールドワイプ、ease-outのカード表示、レーンの時間差表示、細い進行ラインを使用します。バウンド、点滅、Ken Burns、無意味なズームは使用しません。
- `SOCIAL_VIDEO_MOTION_PROFILE`は`standard`、`reduced`、`static`に対応します。本番は`standard`、確認用の動き抑制は`reduced`、FFmpegレイヤー障害時は`static`を使用します。
- サムネイルは`M/D 全○レース AI分析`を主見出しとし、中央・地方の収録範囲、重賞名、代表馬を補助情報にします。JPEG quality 90で保存し、YouTube上限の2MB未満を検証します。
- ShortはカスタムサムネイルAPIを呼びません。最初のフレームをレース固有の表紙にし、YouTube以外でも不自然にならない共通CTAを表示します。TikTok向けにはロゴ、URL、外部誘導文を映像へ焼き込まない専用版も同時生成します。
- Shortは複数レースを1本へ連結します。各レースで表紙、上位3頭、全馬位置取り、1位再提示を表示し、途中レースは通常約12秒、最後のレースだけ15.5秒としてサイト導線を表示します。最大5重賞でも完成尺が59.5秒以下になるよう途中レースを均等短縮し、権利確認済みBGMと完成尺を投稿前に検証します。
- Shortのカード面は左右108pxの864px幅で画面中央へ置きます。YouTube操作UIへの対応はカード全体を左へ寄せず、右側の重要文字・数値だけに追加余白を持たせます。主要情報は上部だけへ偏らないよう縦方向へ再配分し、下部には4分析を2×2で常時表示して概要欄のサイト導線まで同じ中央軸を維持します。
- Shortの表紙、ランキング、位置取り、1位、CTAは時間上で重ねません。FFmpegのレイヤー終了時刻は排他的に扱い、切替境界で前後コンテンツが同一フレームへ残らないようにします。フェーズ自体を画面外から移動させず、透明度だけで表示し、生成時には全主要レイヤーの透過領域が1080×1920内に収まることを検証します。

素材は`backend/scripts/social_video/assets/`で管理します。写真、動画、コース図、BGM、効果音は`credits.json`の`credit`と`license`を必須とし、不足時は投稿を停止します。B-rollは任意で、未配置時は権利確認済み写真へフォールバックします。動画派生素材は合計40MB以内とし、Cloud RunのDockerコンテキストから除外します。BGM原本と再配布不可素材はGitへ含めず、既存の非公開Cloud StorageからActions実行時だけ取得します。

効果音は`audio/sfx/whoosh`、`data_tick`、`score_reveal`、`transition`、`cta`へ配置します。未配置時はBGMだけで生成を継続します。BGMと効果音は48kHzへ統一し、`loudnorm`とリミッターを通します。

## サイト導線と計測

横長動画とShortの説明欄1行目は、`data_loader.build_video_url`が組み立てるURLで統一します。着地先は動画が扱う範囲に合わせて出し分けます。

| 動画種別 | `scope` | 着地先 |
|---|---|---|
| 個別Short（1レース） | `race` | `https://uma-free.com/races/{対象日}/{会場slug}/{レース番号}` |
| 会場別長尺 | `date` | `https://uma-free.com/races/{対象日}` |
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
| `private_review` | `privacyStatus=private`で投稿し、`publishAt`は設定しない |
| `scheduled_public` | `privacyStatus=private`で投稿し、`publishAt`により予約公開する |

Workflowの安全な既定値は`private_review`です。`YOUTUBE_UPLOAD_ENABLED=true`も設定されている場合だけAPIへ送信します。`scheduled_public`へ切り替える前に3開催日連続で非公開検証を行います。

GitHub Actionsの`on.schedule`は指定時刻どおりに起動する保証がありません。`scheduled_public`でレンダリング完了時点から19:00まで45分未満の場合、全動画を同じ時刻のまま10分単位で後ろへ移動します。後ろ倒しが240分を超える場合は、古い翌日情報を深夜に公開しないため停止します。遅延補正の有無、補正分数、実効公開時刻はActions Summaryへ記録します。

動画レンダリング前にDBレジストリ、YouTube OAuth、認証チャンネルを事前検証します。`invalid_grant`は動画生成やDB予約を始めずに停止し、Actions Summaryへ認証失敗と復旧先のSecret名を記録します。OAuthアプリは単一管理アカウント向けの外部・本番環境で運用し、`https://www.googleapis.com/auth/youtube`スコープで再認証します。token値やclient secretはログ、artifact、文書へ残しません。

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

Shortは`thumbnail_skipped`、横長だけが`thumbnail_set`へ進みます。アップロード後は`videos.list`で処理完了、拒否、公開状態、予約時刻を確認します。アップロード直後に動画一覧への反映が遅れて空応答になった場合は、処理確認の上限時間まで同じ動画IDを再照会します。`processing`は再開可能な中間状態として扱い、再実行時に新しい動画を作りません。既存動画が元の予約時刻を過ぎて公開済みなら`published`へ確定し、未処理の後続動画から再開します。安全ゲートで`private_review`になった動画をYouTube Studioから手動公開した場合も、次回実行時にYouTube上の公開状態を照合してDBを`published`へ同期します。

生成サマリーのShort項目には、代表遷移先用の`target_date`、`venue_name`、`race_number`、`race_name`、`destination_path`に加え、全収録対象の`featured_races`を必ず残します。複数SNS配信は`featured_races`から複数レース用の投稿文を組み立て、代表レースpathを直接リンクの遷移先として使います。

日次実行時には直近7日間の`scheduled`を照合し、公開済みなら`published`へ更新します。公開予定から1時間を過ぎても非公開、処理拒否、動画ID欠損のいずれかならエラーを保存します。素材・権利保留または直近7日間の投稿エラーが1件でもある日は、Repository Variableが`scheduled_public`でも当日分を自動的に`private_review`へ落とします。予測欠損はレース単位で除外し、全件ゼロの場合だけ3回確認後に停止します。すでにYouTubeへ予約済みの同日動画がある場合は`videos.update`で`publishAt`を削除し、`videos.list`で非公開を再確認します。Actions Summaryには`included_races`、`omitted_races`、収録・除外重賞、`data_source`、`retry_count`、`coverage_status`、実収録数、横動画・Shortの完成尺、投稿ID、直近7日間の状態件数とエラー件数を表示します。

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

1. 生成可能な日次統合長尺とShortが独立して処理され、横長の章順が中央各場から地方各場になっている。片方の失敗はもう片方を取り消さない。
2. YouTube上で処理が完了し、重複動画がない。
3. 横長とShortの説明欄1行目が`https://uma-free.com/races/{対象日}`（個別Shortはレース詳細パス）で、収録開催場・重賞名・チャプターが実データと一致する。
4. Shortの全収録レースで表紙と上位3頭がスマートフォンで読め、完成尺が59.5秒以下である。
5. 246×138サムネイルで`M/D 全○レース AI分析`が読める。
6. 素材権利エラー、プレースホルダー、強い購入誘導表現がない。
7. GA4 DebugViewでYouTube属性付き`race_view`が一度だけ発火する。

3日すべて合格し、YouTube APIプロジェクトの公開制限とチャンネルの高度な機能を確認した後、Repository Variableを`scheduled_public`へ一度だけ変更します。既存の非公開試験動画は自動公開せず、切り替え後に生成する翌日分から予約公開します。

公開開始後7日間はActions Summaryの`published`件数、動画種別ごとのエラー件数、部分収録数、除外理由、データ取得元を毎日確認し、GA4ではYouTube参照元のトップページ流入、そこからのレースページ遷移、`prediction_table_view`を同じ日付範囲で確認します。UTMを廃止した日より前の動画単位集計とは直接比較しません。GA4の集計値はAnalytics管理画面で確定値を確認し、Actions側のDB状態と混同しません。

## 他SNSへの再利用

レンダラーはプラットフォーム非依存の`VideoPackage`を返し、縦型カバー、代表レースpath、全収録レースの`featured_races`、標準版とTikTok専用版の動画pathを保持します。Threads、Instagram、Facebook、TikTok、Pinterest、Blueskyへの日次配信では複数レース用の投稿文を生成します。UTM、投稿モード、外部設定は`docs/social_video_distribution.md`を参照します。Xの動画投稿は行いません。
