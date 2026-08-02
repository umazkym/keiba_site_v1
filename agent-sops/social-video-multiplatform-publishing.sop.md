# Social Video Multiplatform Publishing

## Overview

YouTube用に生成する日次統合Short（当日の全重賞、重賞なしは各場メインレース）を、Threads、Instagram、Facebook、TikTok、Pinterest、Blueskyへ安全に日次配信する手順です。X動画は費用上の理由で対象外とし、公式API、権利ゲート、重複防止、UTM計測を維持します。

## Parameters

- **target_date** (required): 投稿対象のレース日。
- **platforms** (required): 対象SNS。
- **publication_modes** (required): 媒体ごとの`disabled`、`validate`、`draft`、`public`。
- **source_summary** (required): `youtube_video_dist/{target_date}/summary.json`。

## Steps

### 1. Confirm scope and source artifact

日次統合Shortが1本だけあり、公開品質ゲートを通過していることを確認します。

**Constraints:**

- You MUST use the generated Short package and its rights manifest because recomputing predictions separately can create inconsistent posts.
- You MUST verify `target_date`, `destination_path`, `race_number`, `race_name`, `featured_races`, `content_hash`, and `rights_manifest_hash`.
- You MUST NOT add X video posting because the current operating decision excludes its cost.
- You MUST NOT publish artifacts older than 240 minutes because stale next-day information can be misleading.

### 2. Select the correct platform variant

TikTokだけは`tiktok_clean`、その他は`standard`を使用します。

**Constraints:**

- You MUST reject TikTok publication when the clean variant is absent.
- You MUST verify every selected image, video, BGM, and SFX lists the target in `allowed_platforms`.
- You MUST keep the standard video CTA platform-neutral because the same file is reused across YouTube and multiple social apps.
- You MUST NOT remove rights metadata from clean variants because removing branding does not change source-license obligations.

### 3. Build native copy and destination

媒体ごとに本文とUTMを生成します。

**Constraints:**

- You MUST use `utm_medium=organic_social` and `utm_campaign=daily_race_video` for direct race links.
- You MUST build multi-race captions from `featured_races` and disclose every included grade race or main-race scope because単一レースの投稿文では映像内容と一致しません。
- You MUST use the profile campaign for Instagram and TikTok because their main external path is the profile link.
- You MUST keep prohibited expressions such as「投資」「必勝」「絶対」「圧倒的」「最強」「消去対象」out of titles and captions because they weaken trust and ad-policy safety.
- You MUST NOT route users through YouTube because the objective is an independent site-acquisition source.

### 4. Apply the publication gate

媒体ごとのRepository Variableから実効モードを決めます。

**Constraints:**

- You MUST treat missing variables as`validate`.
- You MUST ensure `validate` performs no external POST, DB record, or GCS upload.
- You MUST NOT reinterpret an unsupported`draft`as`public` because that could expose unreviewed content.
- You MUST require explicit auto-publish consent before any TikTok mutation, and app audit plus public privacy before TikTok public mode.

### 5. Publish with failure isolation

公式APIへ投稿し、媒体ごとの結果を記録します。

**Constraints:**

- You MUST reserve the `video_publications` record before external mutation because retries must not create duplicates.
- You MUST use a private GCS object and short-lived signed URL where Meta or Pinterest must fetch media.
- You MUST NOT make the staging bucket public because temporary media URLs should have bounded access.
- You MUST continue to the remaining platforms after one platform fails, then fail the workflow after all attempts so coverage and alerting are both preserved.
- You MUST NOT print access tokens, app passwords, signed URLs, or refreshed tokens in logs because Actions logs may be retained.

### 6. Verify and measure

Actions Summary、SNS実画面、GA4を確認します。

**Constraints:**

- You MUST verify the remote post, audio, cover, caption, and destination immediately after a platform's first public run.
- You MUST compare `source_platform` to `race_view`, `prediction_table_view`, `race_navigation`, and `ad_viewable_custom`.
- You MUST NOT optimize on video views alone because the business objective is site ad revenue.
- You SHOULD change only one of posting time, opening second, caption, or landing destination per seven-day observation window.

## Source references

- `docs/social_video_distribution.md`
- `docs/analytics_measurement_plan.md`
- `.github/workflows/keiba-youtube-video-pipeline.yml`
- `backend/scripts/social_video_distribution.py`
- `backend/scripts/social_video/distribution.py`
- `backend/scripts/social_video/publishers.py`

## Examples

外部変更なしの全媒体検証:

```powershell
cd backend
python scripts/social_video_distribution.py --target-date 2026-07-31 --force-validate
```

Facebook下書き:

```powershell
cd backend
$env:SOCIAL_VIDEO_FACEBOOK_MODE="draft"
python scripts/social_video_distribution.py --target-date 2026-07-31 --platforms facebook
```

## Troubleshooting

### 認証設定待ちと表示される

`validate`自体は成功です。`docs/social_video_distribution.md`の媒体別Secrets/Variablesを設定し、まず下書き対応媒体だけ`draft`へ進めます。

### 同一キーに異なる内容が検出される

同じ対象日・媒体へ異なる投稿を重ねず、既存のリモート投稿とDBレコードを確認します。重複防止レコードを削除して再送してはいけません。

### GCS一時オブジェクトの削除に失敗する

Workflowの結果を失敗扱いにし、対象の完全な`gs://` URIだけを確認します。バケット全体や広いprefixを再帰削除してはいけません。
