# 同梱している書体

SNS画像・動画・OG画像で使う書体。どれも SIL Open Font License 1.1（OFL）で、画像に使うことと、ファイルを同梱することが認められている。

| ファイル | 書体 | 入手元 | ライセンス |
| --- | --- | --- | --- |
| `MPLUSRounded1c-*.ttf` | M PLUS Rounded 1c | Google Fonts（github.com/google/fonts `ofl/mplusrounded1c`） | OFL 1.1（全文は `OFL-MPLUSRounded1c.txt`） |
| `BarlowSemiCondensed-Bold.ttf`・`BarlowSemiCondensed-SemiBold.ttf` | Barlow Semi Condensed | Google Fonts（github.com/google/fonts `ofl/barlowsemicondensed`） | OFL 1.1（全文は `OFL-BarlowSemiCondensed.txt`） |
| `Inter-*.ttf` | Inter | Google Fonts | OFL 1.1 |
| `NotoSansJP-Bold.ttf`・`NotoSansJP-Regular.ttf` | Noto Sans JP（可変書体 2.004 から太さ700・400を静的に書き出したもの。名前に予約名「Source」は含まない） | Google Fonts（`ofl/notosansjp`） | OFL 1.1（全文は `OFL-NotoSansJP.txt`） |

- 見出し・本文：Noto Sans JP の Bold（700）と Regular（400）。サイトの見出しを「ゴシックでそろえる」にしたのに合わせた（2026-09-26）。
- 丸ゴシック（M PLUS Rounded 1c ExtraBold）は、ロゴ文字（UMA-FREE）と、写真の上に置く大きな見出し（動画の表紙・サムネイル・カルーセルの表紙など）だけ。
- 数字：Barlow Semi Condensed。この書体に無い「→」などは本文の書体で描く（`backend/scripts/sns_images.py` の `mixed_text`）。
- 記事のグラフ（`scripts/analysis/brand_chart_style.py`）も Noto Sans JP を使う。記事のOG画像は `frontend/assets/fonts/NotoSansJP-Bold.ttf`（題名）と `MPLUSRounded1c-ExtraBold.ttf`（ロゴ文字）を使う。
- `new-logo.png` は UMA-FREE のロゴ（書体ではない）。
