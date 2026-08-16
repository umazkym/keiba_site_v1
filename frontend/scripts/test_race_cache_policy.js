const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadTypeScriptModule(relativePath, resolveDependency) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => resolveDependency(request);
  Function("require", "module", "exports", compiled)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

const venueSlugs = JSON.parse(
  fs.readFileSync(path.join(root, "lib", "venue-slugs.json"), "utf8"),
);
const raceUrl = loadTypeScriptModule("lib/race-url.ts", (request) => {
  if (request === "./venue-slugs.json") return venueSlugs;
  throw new Error(`未解決の依存: ${request}`);
});
const policy = loadTypeScriptModule("lib/race-cache-policy.ts", (request) => {
  if (request === "@/lib/race-url") return raceUrl;
  throw new Error(`未解決の依存: ${request}`);
});

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

const today = raceUrl.getJstTodayString();
const recentPast = policy.getRaceCachePolicy(addDays(today, -1));
const recentFuture = policy.getRaceCachePolicy(addDays(today, 1));
const historicalStart = policy.getRaceCachePolicy(addDays(today, -2));
const historicalEnd = policy.getRaceCachePolicy(addDays(today, -14));
const archive = policy.getRaceCachePolicy(addDays(today, -15));

assert.equal(recentPast.tier, "recent");
assert.equal(recentFuture.tier, "recent");
assert.equal(recentPast.revalidateSeconds, 300);
assert.match(recentPast.cacheControl, /s-maxage=300/);
assert.equal(historicalStart.tier, "historical");
assert.equal(historicalEnd.tier, "historical");
assert.equal(historicalStart.revalidateSeconds, 86400);
assert.match(historicalStart.cacheControl, /stale-if-error=604800/);
assert.equal(archive.tier, "archive");
assert.equal(archive.revalidateSeconds, 2592000);
assert.match(archive.cacheControl, /stale-if-error=7776000/);
assert.equal(policy.getRaceCachePolicy("invalid").cacheControl, "private, no-store");

// RACE_PAGE_MIN_DATE の境界。これより前はページを提供せず410を返す。
assert.equal(raceUrl.RACE_PAGE_MIN_DATE, "2026-01-01");
assert.equal(raceUrl.isRetiredRaceDate("2025-12-31"), true);
assert.equal(raceUrl.isRetiredRaceDate("2024-01-14"), true);
assert.equal(raceUrl.isRetiredRaceDate("2026-01-01"), false);
assert.equal(raceUrl.isRetiredRaceDate("2026-08-16"), false);
// 日付として不正なものは410ではなく通常の404扱いに委ねる。
assert.equal(raceUrl.isRetiredRaceDate("invalid"), false);
assert.equal(raceUrl.isRetiredRaceDate("2025-02-30"), false);

console.log("race cache policy boundary checks: passed");
