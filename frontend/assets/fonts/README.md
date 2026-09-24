# OG画像の書体

`app/og/[slug]/route.ts`（記事のOG画像 1200×630）がサーバーで読み込む書体。ブラウザへは配信しない（`public/` に置かない）。

| ファイル | 書体 | ライセンス |
| --- | --- | --- |
| `MPLUSRounded1c-ExtraBold.ttf` | M PLUS Rounded 1c ExtraBold（800。サイトの見出しと同じ） | SIL Open Font License 1.1（全文は `OFL-MPLUSRounded1c.txt`） |

- 本番のコンテナ（node:20-bookworm-slim）には日本語の書体が無く、以前の sharp＋SVG の描き方では英字も含めて全文字が四角になっていた。書体をこのファイルで渡して描く。
- `next.config.mjs` の `outputFileTracingIncludes` で standalone の出力に含める。
- 元のファイルは `backend/fonts/` と同じ（SNS画像・動画でも使う）。
