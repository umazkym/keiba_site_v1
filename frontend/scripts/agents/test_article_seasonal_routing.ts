import assert from 'node:assert/strict';
import {
  deterministicGradeRaceEntityKey,
  findGradeRaceEntity,
  findGradeRaceEntityByName,
  resolveScheduledGradeRaceEntity,
} from '../../lib/grade-race-entities';
import { getSeasonalGradeRaceSlug, isSameSeasonalGradeRaceIdentity } from '../../lib/article-seasonal-routing';
import identityFixtures from '../../content/reference/grade-race-identity-fixtures.json';

assert.equal(findGradeRaceEntity('マーキュリーカップ2026 出走馬')?.entity_key, 'mercury-cup');
assert.equal(findGradeRaceEntity('星雲賞 2026 枠順')?.entity_key, 'seiun-sho');
assert.equal(findGradeRaceEntity('岐阜金賞2026')?.entity_key, 'gifu-kin-sho');
assert.equal(findGradeRaceEntityByName('黒潮菊花賞')?.entity_key, 'kuroshio-kikuka-sho');
assert.equal(findGradeRaceEntityByName('ひまわり賞(オークス)')?.entity_key, 'himawari-sho-oaks');
assert.equal(findGradeRaceEntityByName('ルーキーズサマーカップ')?.entity_key, 'rookies-summer-cup');
assert.notEqual(findGradeRaceEntity('黒潮菊花賞2026')?.entity_key, 'kikuka-sho');
assert.notEqual(findGradeRaceEntity('ひまわり賞(オークス)2026')?.entity_key, 'oaks');
assert.notEqual(findGradeRaceEntity('ルーキーズサマーカップ2026')?.entity_key, 'summer-cup');
assert.equal(findGradeRaceEntityByName('はまなす賞')?.entity_key, 'hamanasu-sho');
assert.equal(findGradeRaceEntityByName('ジュニアグランプリ')?.entity_key, 'junior-grand-prix');
assert.equal(findGradeRaceEntityByName('九州チャンピオンシップ')?.entity_key, 'kyushu-championship');
for (const fixture of identityFixtures) {
  assert.equal(
    deterministicGradeRaceEntityKey(fixture.race_name, fixture.circuit),
    fixture.entity_key,
  );
}
const derived = resolveScheduledGradeRaceEntity({
  raceName: '将来の地方重賞',
  circuit: 'nar',
  trustedSchedule: true,
});
assert.equal(derived.source, 'deterministic_schedule');
assert.match(derived.entityKey, /^auto-nar-[a-f0-9]{16}$/);
assert.equal(derived.archiveSlug, '');
assert.equal(
  resolveScheduledGradeRaceEntity({
    raceName: '将来の地方重賞',
    circuit: 'nar',
    trustedSchedule: false,
  }).source,
  'unresolved',
);
assert.equal(getSeasonalGradeRaceSlug('grade_race', 'mercury-cup', 2026), 'mercury-cup-2026');
assert.equal(getSeasonalGradeRaceSlug('grade_race', 'mercury-cup', 2027), 'mercury-cup-2027');
assert.equal(getSeasonalGradeRaceSlug('grade_race', 'auto-nar-1d8e751d064dbc90', 2026), null);
assert.equal(getSeasonalGradeRaceSlug('jockey', 'mercury-cup', 2026), null);
assert.equal(
  isSameSeasonalGradeRaceIdentity(
    { entityType: 'grade_race', entityKey: 'mercury-cup', seasonYear: 2026 },
    { entityType: 'grade_race', entityKey: 'mercury-cup', seasonYear: '2026' },
  ),
  true,
);
assert.equal(
  isSameSeasonalGradeRaceIdentity(
    { entityType: 'grade_race', entityKey: 'mercury-cup', seasonYear: 2026 },
    { entityType: 'grade_race', entityKey: 'mercury-cup', seasonYear: 2027 },
  ),
  false,
);

console.log('article seasonal routing tests passed');
