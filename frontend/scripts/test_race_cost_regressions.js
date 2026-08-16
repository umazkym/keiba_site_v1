const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const api = read("lib/api.ts");
const racePageData = read("lib/race-page-data.ts");
const detailPage = read("app/races/[date]/[venue]/[race]/page.tsx");
const middleware = read("middleware.ts");
const nextConfig = read("next.config.mjs");
const predictionTable = read("components/PredictionTable.tsx");

assert.match(
  api,
  /predictions\/detail\/\$\{date\}\/\$\{encodeURIComponent\(venueSlug\)\}\/\$\{raceNumber\}/,
  "レース詳細APIのURLを利用すること",
);
assert.match(
  racePageData,
  /RACE_DETAIL_API_MODE\s*===\s*["']legacy["']/,
  "日付全体APIへ戻せる機能フラグを残すこと",
);
assert.doesNotMatch(
  detailPage,
  /getRacePageData\(/,
  "レース詳細ページから日付全体のページデータを取得しないこと",
);
assert.match(
  racePageData,
  /getRaceCachePolicy\(date\)\.tier\s*!==\s*["']recent["']/,
  "過去詳細ページで現在・週間集計を取得しないこと",
);
assert.match(
  middleware,
  /ARCHIVE_COST_GUARD_MODE/,
  "アーカイブガードをmiddlewareで判定すること",
);
assert.match(
  middleware,
  /Retry-After/,
  "bot向け縮退応答にRetry-Afterを付けること",
);
assert.match(
  middleware,
  /isDataDetailPath\(pathname\)/,
  "未公開を含むデータ詳細のbot origin missもRed時に縮退すること",
);

// コスト保護は検索資産を犠牲にしてはいけない。
// 503が続くと検索エンジンはインデックスからページを落とす。
const bulkCrawlerPattern = middleware.match(
  /const BULK_CRAWLER_PATTERN\s*=\s*\/\(\?:([^/]+)\)\/i/,
);
assert.ok(
  bulkCrawlerPattern,
  "縮退対象クローラーをBULK_CRAWLER_PATTERNで定義すること",
);
for (const searchEngine of [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "applebot",
  "slurp",
]) {
  assert.doesNotMatch(
    bulkCrawlerPattern[1],
    new RegExp(searchEngine),
    `検索エンジン(${searchEngine})へ503を返さないこと`,
  );
}
assert.match(
  middleware,
  /SEARCH_ENGINE_CRAWLER_PATTERN\.test\(userAgent\)/,
  "検索エンジンUAを縮退対象から明示的に除外すること",
);
assert.doesNotMatch(
  bulkCrawlerPattern[1],
  /facebookexternalhit/,
  "SNSのリンクプレビュー取得を壊さないこと",
);
assert.doesNotMatch(
  nextConfig,
  /source:\s*["']\/races\/:path\*["']/,
  "レース全体へ一律TTLを設定しないこと",
);
assert.match(
  predictionTable,
  /detail_page_indexable/,
  "公開済みエンティティだけをリンク化すること",
);

console.log("race cost regression checks: passed");
