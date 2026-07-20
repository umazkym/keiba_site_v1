# 動画用素材ライブラリ

このディレクトリには、権利確認済みの競走馬・競馬場写真とBGMだけを配置します。
外部サイトから保存した画像、JRAや他社のロゴ、利用条件を確認できない音源は使用しません。

## 最初に配置する素材

最低限、次の3種類を配置してください。

```text
images/default/wide/       共通横長写真（1920x1080以上推奨）
images/default/vertical/   共通縦長写真（1080x1920以上推奨）
audio/common/              長尺・Shorts共通BGM
```

長尺とShortsで曲を分ける場合は、`audio/long/`と`audio/shorts/`へ配置します。
写真を競馬場・レース単位で差し替える場合は次の構造を使います。

```text
images/venues/函館/wide/
images/venues/函館/vertical/
images/races/2026-07-13/函館/11/wide/
images/races/2026-07-13/函館/11/vertical/
```

同じフォルダに複数素材を置くと、日付と動画IDから毎回同じ素材を自動選択します。

## コース形状素材

背景透過のコースPNGは写真素材と分離し、位置取り画面専用として中央は`courses/central/`、地方は`courses/local/`へ配置します。

```text
courses/central/tokyo.png         東京
courses/central/chukyo.png        中京
courses/central/fukushima.png     福島
courses/central/hakodate.png      函館
courses/central/hanshin.png       阪神
courses/central/kokura.png        小倉
courses/central/kyoto.png         京都
courses/central/nakayama.png      中山
courses/central/niigata_turf.png  新潟・芝
courses/central/sapporo.png       札幌
courses/local/ooi_course_texture.png       大井
courses/local/funabashi_course_texture.png 船橋
```

位置取り画面では、会場に一致するコース形状を下地にし、その上へ先行・中団・後方の馬番と馬名を表示します。該当素材がない会場・馬場は汎用コース図へ自動フォールバックします。

## 対応形式

- 写真: `.jpg`、`.jpeg`、`.png`、`.webp`
- コース形状: 背景透過の`.png`
- 音声: `.mp3`、`.m4a`、`.aac`、`.wav`、`.flac`、`.ogg`
- 100MB以上の単一ファイルは使用しません
- 25MBを超える素材はリポジトリ肥大化を防ぐため圧縮を推奨します

## クレジット

写真と音声は、権利確認の記録として`credits.json`への`credit`と`license`登録を必須とします。
このディレクトリからの相対パスをキーとして登録してください。登録内容は動画画面ではなくYouTube概要欄へ追加されます。

```json
{
  "images/default/wide/race-01.jpg": {
    "credit": "素材提供者名",
    "source": "https://example.com/source",
    "license": "利用条件",
    "focus": [0.55, 0.45]
  },
  "audio/common/bgm-01.mp3": {
    "title": "曲名",
    "credit": "制作者名",
    "source": "https://example.com/music",
    "license": "利用条件",
    "volume": 0.18
  }
}
```

`focus`はクロップ時に残す写真上の中心位置を0から1で指定します。未指定時は`[0.5, 0.5]`です。
`volume`は0から1で指定し、未指定時は`0.20`です。

## 検証

```powershell
cd backend
python scripts/social_video/validate_assets.py
```

素材不足時も確認用動画は生成されますが、該当動画は`publishable=false`となりYouTube投稿をスキップします。
写真とコース画像はGitHub Actionsで使うためリポジトリへ配置します。BGM原本は素材サイトの再配布条件に従いGitへ入れず、非公開Cloud Storageから実行時に取得します。

`manifest.json`は特定ファイルを明示指定する既存互換機能です。通常運用ではフォルダ配置だけで動作します。
