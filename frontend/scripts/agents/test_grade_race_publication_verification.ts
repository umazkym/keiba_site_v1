import assert from 'node:assert/strict';
import { verifyGradeRacePublicationHtml } from './grade_race_publication_verification';

const verified = verifyGradeRacePublicationHtml(
  '<html><head><link rel="canonical" href="https://uma-free.com/articles/grade-races/test-race" /></head><body><main><h1>確認重賞 2026｜開催条件</h1>2026年の確認重賞について、開催条件を確認します。開催場と距離、出走条件を公式発表で確認してください。追加情報は発表後に更新します。日程、会場、距離、出走条件を順に確認します。</main></body></html>',
  '/articles/grade-races/test-race',
  '2026',
  '確認重賞',
  200,
);
assert.equal(verified.status, 'verified');

const metadataYear = verifyGradeRacePublicationHtml(
  '<html><head><title>確認重賞 2026 開催条件</title><link rel="canonical" href="https://uma-free.com/articles/grade-races/test-race" /></head><body><article><h1>確認重賞の開催条件</h1>開催日と競馬場、距離、出走条件を公式発表で確認します。追加情報は発表後に更新します。日程と会場を確認し、発表済みの開催条件だけを本文に掲載します。未発表の出走馬、枠順、予想、結果は公式発表後に確認します。</article></body></html>',
  '/articles/grade-races/test-race',
  '2026',
  '確認重賞',
  200,
);
assert.equal(metadataYear.status, 'verified');

const notDeployed = verifyGradeRacePublicationHtml(
  '<html><head><link rel="canonical" href="https://other.example/articles/grade-races/test-race" /></head><body><main><h1>確認重賞</h1>2026 footerだけ</main></body></html>',
  '/articles/grade-races/test-race',
  '2026',
  '確認重賞',
  404,
);
assert.equal(notDeployed.status, 'unverified');
assert.equal(notDeployed.checks.http200, false);
assert.equal(notDeployed.checks.selfCanonical, false);
assert.equal(notDeployed.checks.bodyPresent, false);
assert.equal(notDeployed.checks.seasonYearPresent, false);

for (const html of [
  '<html><head><link rel="canonical" href="https://uma-free.com/articles/grade-races/test-race" /></head><body><main><h1>確認重賞</h1>2026年 お探しのページは見つかりません。'.padEnd(180, 'x') + '</main></body></html>',
  '<html><head><link rel="canonical" href="/articles/grade-races/test-race" /></head><body><main><h1>確認重賞</h1>2026年の本文です。'.padEnd(180, 'x') + '</main></body></html>',
  '<html><head><link rel="canonical" href="https://uma-free.com/articles/grade-races/test-race" /></head><body><nav>2026年 確認重賞 ' + 'x'.repeat(200) + '</nav></body></html>',
]) {
  assert.equal(
    verifyGradeRacePublicationHtml(html, '/articles/grade-races/test-race', '2026', '確認重賞').status,
    'unverified',
  );
}

console.log('grade race publication verification tests passed');
