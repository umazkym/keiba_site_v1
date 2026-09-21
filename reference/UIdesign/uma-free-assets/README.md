# UMA-FREE プレビューC 追加素材の配置場所

ここはプレビュー用の追加素材を置く原本フォルダです。他社サイトの参考画像はコピーせず、UMA-FREEで使用権を確認できる写真・イラストだけを配置してください。実在する人物・騎手・競走馬として見せる素材は、名称と画像の対応を確認し、仮の人物や馬を実在対象として扱わないでください。

## 必要なファイル

| フォルダ | ファイル名 | 推奨寸法 | 比率 | 用途 |
| --- | --- | ---: | ---: | --- |
| `hero/` | `desktop.webp` | 1600×800 | 2:1 | PC向けトップヒーロー |
| `hero/` | `mobile.webp` | 750×640 | 約1.17:1 | スマートフォン向けトップヒーロー |
| `features/` | `grade.webp` | 960×600 | 8:5 | 注目重賞の特集 |
| `courses/` | `nakayama.webp` | 960×540 | 16:9 | 中山コースの紹介 |
| `guides/` | `track.webp` | 640×400 | 8:5 | コース解説 |
| `guides/` | `weight.webp` | 640×400 | 8:5 | 馬体重の見方 |
| `horses/` | `sample.webp` | 400×400 | 1:1 | 競走馬紹介のサンプル |

ヒーロー画像はPCとスマートフォンで表示比率が異なります。`desktop.webp`を機械的に切り取らず、`mobile.webp`では主要な被写体や視線の流れが縦長に近い画面でも成立する別構図を用意してください。

配置後、リポジトリルートで次を実行します。

```powershell
node .local/previews/uma-free-site/sync-assets.mjs
```

同期後の採用ファイルは`.local/previews/uma-free-site/assets/custom/`、manifestは`.local/previews/uma-free-site/media.js`です。未提供の素材はmanifestで`src: null`となり、親UI側のグレー一色フォールバックが表示されます。同期処理は原本も同期先も削除しません。
