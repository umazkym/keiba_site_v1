import assert from 'node:assert/strict';
import { findGradeRaceEntity, findGradeRaceEntityByName } from '../../lib/grade-race-entities';
import { getSeasonalGradeRaceSlug, isSameSeasonalGradeRaceIdentity } from '../../lib/article-seasonal-routing';

assert.equal(findGradeRaceEntity('マーキュリーカップ2026 出走馬')?.entity_key, 'mercury-cup');
assert.equal(findGradeRaceEntity('星雲賞 2026 枠順')?.entity_key, 'seiun-sho');
assert.equal(findGradeRaceEntity('岐阜金賞2026')?.entity_key, 'gifu-kin-sho');
assert.equal(findGradeRaceEntityByName('黒潮菊花賞')?.entity_key, 'kuroshio-kikuka-sho');
assert.equal(findGradeRaceEntityByName('ひまわり賞(オークス)')?.entity_key, 'himawari-sho-oaks');
assert.equal(findGradeRaceEntityByName('ルーキーズサマーカップ')?.entity_key, 'rookies-summer-cup');
assert.notEqual(findGradeRaceEntity('黒潮菊花賞2026')?.entity_key, 'kikuka-sho');
assert.notEqual(findGradeRaceEntity('ひまわり賞(オークス)2026')?.entity_key, 'oaks');
assert.notEqual(findGradeRaceEntity('ルーキーズサマーカップ2026')?.entity_key, 'summer-cup');
assert.equal(getSeasonalGradeRaceSlug('grade_race', 'mercury-cup', 2026), 'mercury-cup-2026');
assert.equal(getSeasonalGradeRaceSlug('grade_race', 'mercury-cup', 2027), 'mercury-cup-2027');
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
