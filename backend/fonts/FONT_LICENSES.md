# 同梱している書体

SNS画像・動画・OG画像で使う書体。どれも SIL Open Font License 1.1（OFL）で、画像に使うことと、ファイルを同梱することが認められている。

| ファイル | 書体 | 入手元 | ライセンス |
| --- | --- | --- | --- |
| `MPLUSRounded1c-*.ttf` | M PLUS Rounded 1c | Google Fonts（github.com/google/fonts `ofl/mplusrounded1c`） | OFL 1.1（全文は `OFL-MPLUSRounded1c.txt`） |
| `BarlowSemiCondensed-Bold.ttf`・`BarlowSemiCondensed-SemiBold.ttf` | Barlow Semi Condensed | Google Fonts（github.com/google/fonts `ofl/barlowsemicondensed`） | OFL 1.1（全文は `OFL-BarlowSemiCondensed.txt`） |
| `Inter-*.ttf` | Inter | Google Fonts | OFL 1.1 |

- 見出し：M PLUS Rounded 1c の ExtraBold（800、サイトと同じ）。本文：同じ書体の Bold と Regular。
- 数字：Barlow Semi Condensed。この書体に無い「→」などは本文の書体で描く（`backend/scripts/sns_images.py` の `mixed_text`）。
- 記事のグラフ（`scripts/analysis/brand_chart_style.py`）も M PLUS Rounded 1c を使う。記事のOG画像は同じ ExtraBold を `frontend/assets/fonts/` に置いて使う。
- `new-logo.png` は UMA-FREE のロゴ（書体ではない）。
