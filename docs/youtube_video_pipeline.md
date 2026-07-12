# YouTube自動動画生成・投稿パイプライン

UMA-FREEへの検索外流入を増やすため、翌日開催分のレースデータからYouTube向け動画を自動生成します。AIによる動画生成は使わず、既存APIのデータをPillowとFFmpegでスライド動画化します。

## 生成内容

- 会場別長尺: 翌日の開催会場ごとに1本。冒頭でUMA-FREEの無料分析内容を紹介し、1Rから順番にAI偏差値・位置取り・コース条件を表示します。
- Shorts: 1日最大3本。重賞、メインレース、AI偏差値上位が明確なレースを優先します。
- サムネイル: 重賞がある会場では重賞名を優先表示します。

## デザイン方針

- v4は「写真×データ融合」です。サムネイルと冒頭では権利確認済みの競走馬・競馬場写真を使い、本編ではウォームホワイトの紙面、深いグリーンの見出し、チャコールの表見出しで競馬新聞・出馬表のような比較性を持たせます。
- 写真は `backend/scripts/social_video/assets/manifest.json` で管理し、`日付:競馬場:レース番号`、競馬場、共通画像の順で解決します。外部URL、参考サイトから保存した画像、権利未確認素材は使用しません。素材がない場合は写真なしのコース図へ切り替えます。
- `SOCIAL_VIDEO_ASSET_MANIFEST` でmanifestを差し替えられます。横長は1920x1080以上、縦長は1080x1920以上を推奨し、`focus` でクロップ時に残す中心位置を指定します。
- サムネイルは1920x1080の独立テンプレートです。表示要素はレース名・競馬場・日付・グレード、注目馬の馬番・馬名・AI偏差値、UMA-FREEのブランド表示だけに絞ります。CTA、カテゴリチップ、斜めリボン、放射線、順位カードは表示しません。
- サムネイル右下15%×下8%には重要情報を置かず、YouTubeの再生時間表示との衝突を避けます。
- 長尺は1レースにつき `AI偏差値` と `位置取り` の2画面です。AI偏差値画面は上位3頭と4〜8位の表、位置取り画面は先行・中団・後方のコース図を表示します。
- 枠番がある場合は1白、2黒、3赤、4青、5黄、6緑、7橙、8桃を馬番バッジへ適用します。枠番がない場合は白地・黒文字へフォールバックします。
- Shortsは1080x1920で、重要情報を `X=60-900`、`Y=260-1450` に配置します。冒頭、AI偏差値、位置取り、CTAの4場面とし、途中画面にはCTAやURLを常時表示しません。
- CTAは長尺・Shortsとも最終画面に1回だけ `全頭データは概要欄のUMA-FREEで確認` と表示します。
- 日本語はNoto Sans JP、数値はInterを使用します。写真上の大見出しだけ単一アウトラインを使い、紙面上の表や本文には縁取りを使いません。
- 冒頭はスコアの疑似カウントアップを行います。拡大・Ken Burnsズームは使用せず、シーン間に約0.16秒のクロスフェードだけを入れます。`SOCIAL_VIDEO_DISABLE_MOTION=1` では静止concatへ戻せます。
- 音声は権利確認済みのBGM素材を `SOCIAL_VIDEO_BGM_PATH` に指定した場合だけ自動合成します。音量は `SOCIAL_VIDEO_BGM_VOLUME` で調整し、未指定時は動画のみを書き出します。素材の権利確認ができない音源は使いません。
- 長い見出しやレース名は、省略記号を使わず、フォント縮小、最大2行折り返し、最後にハードカットの順で処理します。
- 長いUTM付きURLは動画画面には出さず、概要欄metadataにだけ保持します。
- 添付資料のような強い競馬投稿表現は視認性だけを参考にし、画面内の文言は `AI偏差値`、`位置取り`、`全頭データ`、`確認材料` を中心にします。
- 本番API取得時は、出走馬データが空のレースや `サンプル` 系のプレースホルダー馬名が混入したレースを除外します。検証JSONでは確認用に許容します。

## 実行例

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-07 --dry-run --skip-upload
```

ローカルにFFmpegがない場合は、PNGとmetadataだけ確認できます。

```powershell
cd backend
python scripts/youtube_video_pipeline.py --target-date 2026-07-07 --dry-run --skip-upload --skip-video
```

## GitHub Secrets

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_UPLOAD_ENABLED`
- `API_BASE_URL`

`YOUTUBE_UPLOAD_ENABLED=true` のときだけYouTubeへ投稿します。YouTube API監査が完了するまでは、生成検証またはprivate投稿で運用してください。

## 計測

概要欄URLには `utm_source=youtube`、`utm_medium=video`、`utm_campaign=YYYYMMDD_preview`、`utm_content` を付与します。GA4ではYouTube流入を動画種別・会場・レース単位で確認できます。
