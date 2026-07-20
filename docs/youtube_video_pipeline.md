# YouTube自動動画生成・投稿パイプライン

UMA-FREEへの検索外流入を増やすため、翌日開催分のレースデータからYouTube向け動画を自動生成します。AIによる動画生成は使わず、既存APIのデータをPillowとFFmpegでスライド動画化します。

## 生成内容

- 会場別長尺: 翌日の開催会場ごとに1本。冒頭でUMA-FREEの無料分析内容を紹介し、1Rから順番にAI偏差値・位置取り・コース条件を表示します。
- Shorts: 1日最大3本。重賞、メインレース、AI偏差値上位が明確なレースを優先します。
- サムネイル: 重賞がある会場では重賞名を優先表示します。

## デザイン方針

- v6は「競馬写真＋スポーツ誌紙面」のRace Editorialデザインです。Editorial GridとSwiss Modernismを基礎に、写真、紙面、隊列レーン、サイト誘導を同じ情報階層で構成します。ネオン、HUD、星空、レーダー装飾は使用しません。
- ブランド表示は公式の `frontend/public/new-logo.png` を円形マスクで使用し、WebP、バックエンド同梱PNGの順にフォールバックします。`SOCIAL_VIDEO_BRAND_LOGO_PATH` で任意ロゴへ差し替えられます。公式ロゴの青紫はブランド専用で、順位やデータ区分には流用しません。
- 写真は `backend/scripts/social_video/assets/images` へ配置します。レース別、競馬場別、共通画像の順で解決し、同じフォルダの複数素材は日付と動画IDから決定的に選択します。外部URL、参考サイトから保存した画像、権利未確認素材は使用しません。素材がない場合は写真なしのコース図へ切り替えます。
- 共通横写真は `images/default/wide`、共通縦写真は `images/default/vertical` へ配置します。横長は1920x1080以上、縦長は1080x1920以上を推奨します。任意の `credits.json` でクロップの `focus`、出典、ライセンス、クレジットを登録できます。
- 既存の `manifest.json` 明示指定と `SOCIAL_VIDEO_ASSET_MANIFEST` は互換維持します。`SOCIAL_VIDEO_ASSET_ROOT` では素材ルート自体を差し替えられます。
- サムネイルは1920x1080の独立テンプレートです。レース名・競馬場・日付・グレード、注目馬の馬番・馬名・AI偏差値に加え、`中央・地方 全レースを毎日無料公開`、`登録不要`、トップページと共通の4要素グラフィックを表示します。CTA、斜めリボン、放射線、順位カードは表示しません。
- サムネイル右下15%×下8%には重要情報を置かず、YouTubeの再生時間表示との衝突を避けます。
- 長尺は1レースにつき `AI偏差値` と `位置取り` の2画面です。AI偏差値画面は1位を主役面、2〜8位を同一ルールの連続比較表として表示します。
- 位置取り画面は中央 `backend/scripts/social_video/assets/courses/central/`、地方 `backend/scripts/social_video/assets/courses/local/` の透過コースPNGを低彩度の会場識別用透かしとして使用します。長尺は左から `先行・中団・後方` の3レーン、Shortsは上から同じ順序で配置し、各レーン内は1列で全馬を省略せず表示します。位置取り不明馬は中団へ混ぜず、`位置未確定` の独立行へ配置します。
- 馬番は本サイトと同じ影なしの塗りつぶし真円とし、1白、2黒、3赤、4青、5黄、6緑、7橙、8桃を適用します。1枠だけ薄い境界線を付け、2〜8枠は境界線を付けません。枠番欠損時は本サイトと同じ計算で出走頭数と馬番から補完します。
- Shortsは1080x1920で、重要情報を `X=60-900`、`Y=250-1480` に配置します。冒頭、AI偏差値、位置取り、CTAの4場面とし、上位5頭は1位、2〜3位、4〜5位の順に短い時差で表示します。位置取りは最大18頭を2列レーンで全頭表示します。途中画面には小型ロゴだけを置き、CTAやURLを常時表示しません。
- 長尺・Shortsの最終画面には4要素グラフィックを再掲し、`概要欄のリンクからUMA-FREEへ` を主導線、`または「UMA-FREE」で検索` を補助導線として表示します。
- 日本語はNoto Sans JP、数値はInterを使用します。見出しはBlack、馬名と順位はBold、補足説明はRegularと役割を固定します。写真上の大見出しだけ単一アウトラインを使い、紙面上の表や本文には縁取りを使いません。
- 冒頭は最初のフレームで数値を隠し、AI偏差値の平均値 `50.0` から最終値へカウントアップします。スコア欠損時は `集計中` と表示し、架空値や `0.0` は描画しません。拡大・Ken Burnsズームは使用せず、シーン間に約0.16秒のクロスフェードだけを入れます。`SOCIAL_VIDEO_DISABLE_MOTION=1` では静止concatへ戻せます。
- 音声は権利確認済みBGMを `assets/audio/long`、`assets/audio/shorts`、または `assets/audio/common` へ配置します。複数曲は日付・動画種別・動画IDで決定的にローテーションします。`SOCIAL_VIDEO_BGM_PATH` の明示指定を最優先し、`SOCIAL_VIDEO_BGM_VOLUME` も互換維持します。DOVA-SYNDROME等の素材原本は再配布を避けるためGitへ含めず、非公開Cloud StorageからGitHub Actions実行時だけ取得します。
- BGMは動画尺までループし、音量正規化、曲別音量、0.6秒フェードイン、0.8秒フェードアウトを適用してAACで格納します。素材がない場合は無音の確認用動画を生成しますが、YouTube投稿は動画単位で停止します。
- クレジットは動画画面には表示せず、`credits.json` に登録されている素材だけYouTube概要欄へ自動追記します。写真・音声に`credit`と`license`がない場合は素材検証をエラーにし、権利情報が曖昧なまま自動公開されることを防ぎます。
- 長い見出しやレース名は、省略記号を使わず、フォント縮小、最大2行折り返し、最後にハードカットの順で処理します。
- 長いUTM付きURLは動画画面には出さず、概要欄metadataにだけ保持します。
- 4要素グラフィックはトップページと同じ構造で、`AI偏差値`の比較バー、`対戦成績`の比較マトリクス、`位置取り予測`の隊列バー、`枠順傾向`の枠別バーをPillowで再描画します。画面内の文言は機能名と事実説明に絞り、広告的な言い回しや抽象的なコピーは使用しません。
- 本番API取得時は、出走馬データが空のレースや `サンプル` 系のプレースホルダー馬名が混入したレースを除外します。検証JSONでは確認用に許容します。

## 実行例

最初に素材ライブラリを検証します。

```powershell
cd backend
python scripts/social_video/validate_assets.py
```

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-07 --dry-run --skip-upload
```

ローカルにFFmpegがない場合は、PNGとmetadataだけ確認できます。

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-07 --dry-run --skip-upload --skip-video
```

生成後は、長尺、Shorts、246×138サムネイル、Shorts UI安全領域をまとめたコンタクトシートが自動生成されます。手動で再生成する場合は次のコマンドを使います。

```powershell
cd backend
python scripts/social_video/create_design_contact_sheet.py ..\youtube_video_dist\2026-07-07
```

旧版と並べる場合は `--baseline-root` を指定します。

## GitHub Secrets

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_UPLOAD_ENABLED`
- `API_BASE_URL`

`YOUTUBE_UPLOAD_ENABLED=true` のときだけYouTubeへ投稿します。YouTube API監査が完了するまでは、生成検証またはprivate投稿で運用してください。
写真またはBGMが不足する動画は `publishable=false` として生成だけ行い、その動画のアップロードをスキップします。選択素材と停止理由は各 `metadata.json` と日付単位の `summary.json` で確認できます。

GitHub ActionsはNoto Sans CJKを導入し、非公開Cloud StorageからBGMを取得した上で動画を生成します。素材検証結果、`summary.json`、サムネイル、コンタクトシート、Shorts UI安全領域は7日間artifactへ保存します。写真とコース画像はリポジトリ、音源原本は非公開ストレージに分離して管理します。

## 計測

概要欄URLには `utm_source=youtube`、`utm_medium=video`、`utm_campaign=YYYYMMDD_preview`、`utm_content` を付与します。GA4ではYouTube流入を動画種別・会場・レース単位で確認できます。
