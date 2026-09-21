const assert = require('node:assert/strict');
const { isVerifiedOfficialReference } = require('./article_quality_audit.js');
const official = 'https://www.jra.go.jp/keiba/baba/kaisetsu/';
const reviewed = (url, date = '2026-09-21') => ({ official_reference_reviewed_at: date, verified_official_references: [url] });

assert.equal(isVerifiedOfficialReference(official, reviewed(official)), true);
assert.equal(isVerifiedOfficialReference(official, {}), false);
assert.equal(isVerifiedOfficialReference(official, reviewed(`${official}other`)), false);
assert.equal(isVerifiedOfficialReference(official, reviewed(official, '2026-02-30')), false);
for (const url of ['https://www.jra.go.jp.evil.example/page', 'https://media.example/page', 'http://www.jra.go.jp/page', 'https://user:secret@jra.jp/page', 'https://jra.jp:8443/page']) {
  assert.equal(isVerifiedOfficialReference(url, reviewed(url)), false);
}
console.log('公式資料の完全一致・確認日・ドメイン・通信形式の検証成功');
