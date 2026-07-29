# SNS動画の日次配信

更新日: 2026-07-30

## 目的

YouTube向けに生成する翌日レースの縦動画を、YouTubeを経由せず各SNSへネイティブ投稿し、UMA-FREEへの無料流入元を増やす。Xは動画投稿の対象外とし、既存のテキスト・画像投稿だけを維持する。

日次の投稿対象は、動画パイプラインが選んだ最優先レースのShort 1本である。媒体ごとに別の動画テーマを量産せず、同じ対象レースと分析値を使うため、運用コストと内容不一致を抑えられる。

## 対象媒体

| 媒体 | 投稿形式 | サイト導線 | 下書きAPI | 実装上の注意 |
| --- | --- | --- | --- | --- |
| Threads | 動画投稿 | 投稿本文の個別レースURL | なし | Metaが取得できる短命の署名URLを使う |
| Instagram | Reels | プロフィールURL | なし | プロアカウントとMetaアプリが必要 |
| Facebook | Page Reels | 本文の個別レースURL | あり | `draft`で実アカウント確認が可能 |
| TikTok | 縦動画 | プロフィールURL | あり | Content Posting APIの監査と明示的な自動投稿同意が必要 |
| Pinterest | Video Pin | Pinの個別レースリンク | なし | ビジネスアカウント、アプリ、ボードが必要 |
| Bluesky | 動画投稿 | 本文の個別レースURL | なし | App Passwordと動画サービスを使う |

InstagramとTikTokは投稿本文中の外部リンクを主要導線にできないため、プロフィールリンクを専用UTM付きトップページへ固定する。Threads、Facebook、Pinterest、Blueskyは個別レースへ直接送る。

## 動画成果物

`backend/scripts/social_video/renderer.py`はShort生成時に次の2種類を同時に作る。

- `standard`: UMA-FREEのロゴ、サイト名、自然なサイト案内を含む。YouTube、Threads、Instagram、Facebook、Pinterest、Blueskyで共用する。
- `tiktok_clean`: ロゴ、URL、外部誘導文を映像へ焼き込まない。TikTok Content Posting API向けにだけ使う。

両方とも1080×1920、15.5秒、H.264/AACで、同一のレースデータと権利確認済み素材を使用する。縦型カバーにはShortの最初のレース固有フレームを使う。写真、動画、BGM、効果音は`credits.json`の`allowed_platforms`へ投稿先が明示されている場合だけ利用し、YouTube許諾だけの素材を他SNSへ流用しない。

投稿先別の内容ハッシュは、元動画の内容ハッシュ、本文、タイトル、遷移先、権利ハッシュ、動画variantから作る。同じ対象日・投稿先・stable IDに異なる内容が現れた場合は、重複投稿せず停止する。

## URLと計測

個別レースへ送る媒体:

```text
https://uma-free.com/races/YYYY-MM-DD/{venue-slug}/{race-number}
  ?utm_source={platform}
  &utm_medium=organic_social
  &utm_campaign=daily_race_video
  &utm_content=YYYYMMDD_{venue-slug}_{race-number}r_daily1
```

プロフィール経由の媒体:

```text
https://uma-free.com/
  ?utm_source=instagram|tiktok
  &utm_medium=organic_social
  &utm_campaign=profile
```

UTMは最初の`race_view`へ30分以内に一度だけ引き継ぐ。タブやレース切り替えで仮想`page_view`は送らない。追加される主なパラメータは次のとおり。

- `entry_source=social_video`
- `source_platform`
- `source_content_key`
- `video_format=short`
- `source_venue`

## 投稿モード

各媒体のRepository Variable `SOCIAL_VIDEO_{PLATFORM}_MODE`で独立して切り替える。

| 値 | 動作 |
| --- | --- |
| `disabled` | ローカル検証も外部投稿も行わない |
| `validate` | 動画、権利、本文、URL、認証設定の有無だけを確認する。外部POST、DB記録、GCS配置は行わない |
| `draft` | 対応するFacebook/TikTokへ下書きとして送る |
| `public` | 公式APIで公開する |

Workflowの既定値は全媒体`validate`である。`draft`に対応しない媒体へ指定した場合は公開へ勝手に読み替えず停止する。TikTokの下書きはTikTok側で手動公開し、同じstable IDを自動公開へ再送しない。

## GitHub設定

### 共通

Repository Variables:

- `SOCIAL_VIDEO_STAGING_GCS_BUCKET`
- `SOCIAL_VIDEO_GCS_SIGNING_SERVICE_ACCOUNT`
- `SOCIAL_VIDEO_THREADS_MODE`
- `SOCIAL_VIDEO_INSTAGRAM_MODE`
- `SOCIAL_VIDEO_FACEBOOK_MODE`
- `SOCIAL_VIDEO_TIKTOK_MODE`
- `SOCIAL_VIDEO_PINTEREST_MODE`
- `SOCIAL_VIDEO_BLUESKY_MODE`

GCSは公開バケットにしない。Workflowのサービスアカウントに、対象プレフィックスへのObject Userと署名に必要なService Account Token Creatorを最小範囲で付ける。一時オブジェクトは処理後に個別削除し、取りこぼし対策として2日後に削除するLifecycleも設定する。

### Threads

Secrets:

- `THREADS_USER_ID`
- `THREADS_ACCESS_TOKEN`

既存の朝・昼投稿は維持する。`SOCIAL_VIDEO_THREADS_MODE=public`の場合だけ、20時のThreadsテキスト投稿を動画投稿へ置き換える。Xの20時投稿は維持する。

### Instagram

Secrets:

- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`

Vercel Environment Variable:

- `NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL`

プロフィールのWebsiteへ、Instagram用profile UTM URLを設定する。

### Facebook

Secrets:

- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_ACCESS_TOKEN`

Vercel Environment Variable:

- `NEXT_PUBLIC_SOCIAL_FACEBOOK_URL`

まず`draft`で3開催日確認し、その後`public`へ切り替える。

### TikTok

Secrets:

- `TIKTOK_ACCESS_TOKEN`

Repository Variables:

- `TIKTOK_AUTO_PUBLISH_CONSENT`
- `TIKTOK_APP_AUDITED`
- `TIKTOK_PRIVACY_LEVEL`

Vercel Environment Variable:

- `NEXT_PUBLIC_SOCIAL_TIKTOK_URL`

`draft`でも`TIKTOK_AUTO_PUBLISH_CONSENT=true`を必要とする。`public`ではさらに`TIKTOK_APP_AUDITED=true`と`TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE`がない限り投稿を拒否する。監査前のアプリで公開範囲を偽装しない。プロフィールWebsiteへTikTok用profile UTM URLを設定する。

### Pinterest

Secrets:

- `PINTEREST_ACCESS_TOKEN`

Repository Variables:

- `PINTEREST_BOARD_ID`

Vercel Environment Variable:

- `NEXT_PUBLIC_SOCIAL_PINTEREST_URL`

Video Pinの`link`へ個別レースURLを設定する。

### Bluesky

Secrets:

- `BLUESKY_APP_PASSWORD`

Repository Variables:

- `BLUESKY_HANDLE`

Vercel Environment Variable:

- `NEXT_PUBLIC_SOCIAL_BLUESKY_URL`

通常のアカウントパスワードを保存せず、投稿専用App Passwordを使う。

## 日次処理

`.github/workflows/keiba-youtube-video-pipeline.yml`は毎日17:17 JSTに起動する。

1. 翌日レースデータと素材を検証する。
2. YouTube長尺、標準Short、TikTok専用Shortを生成する。
3. YouTube投稿処理を行う。
4. 生成済みShortを各SNSのモードに従って処理する。
5. すべての媒体を試した後に、YouTubeまたは有効なSNSの失敗を全体失敗として通知する。
6. Actions Summaryと`social-distribution-summary.json`へ、媒体別状態、リモートID、公開URL、外部設定待ちを残す。

生成後240分を超えた動画は外部投稿しない。1媒体のAPI障害で他媒体を中断せず、全試行後に失敗終了する。

## 公開までの順序

1. 全媒体を`validate`にして、3開催日連続で動画、本文、URL、権利ゲートを確認する。
2. FacebookとTikTokは`draft`で実際の表示、安全領域、音声、カバーを3開催日確認する。
3. Threads、Instagram、Pinterest、Blueskyは1媒体ずつ`public`へ切り替え、初回投稿直後に実画面を確認する。
4. 最後にFacebookとTikTokを`public`へ切り替える。
5. 公開開始日を媒体別に記録し、7日間は投稿成功率、サイトセッション、`race_view`到達、広告視認を毎日確認する。

複数媒体を同日に公開開始すると流入や不具合の原因を分離できないため、外部アカウント設定が揃っても公開切り替えは1媒体ずつ行う。

## 効果判定

媒体ごとに次を同じ7日窓で見る。

1. 投稿成功数
2. 動画再生数
3. プロフィール閲覧またはリンククリック
4. UMA-FREEのセッション
5. SNS属性付き`race_view`
6. `prediction_table_view`
7. 1セッション当たりの`race_navigation`
8. `ad_viewable_custom`

再生数だけで投稿数を増やさない。サイト到達率と、到達後に予想表・次レース・広告視認へ進む割合が低い媒体は、投稿時刻、冒頭1秒、本文、リンク先を一度に1要素だけ変更する。

## ローカル検証

生成済みShortを外部変更なしで全媒体検証:

```powershell
cd backend
python scripts/social_video_distribution.py --target-date 2026-07-31 --force-validate
```

Facebookだけ下書き:

```powershell
cd backend
$env:SOCIAL_VIDEO_FACEBOOK_MODE="draft"
python scripts/social_video_distribution.py --target-date 2026-07-31 --platforms facebook
```

X動画投稿はこの処理へ追加しない。費用条件が変わっても、ユーザーが明示的に再承認するまでは既存のテキスト・画像投稿だけを維持する。
