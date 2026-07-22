import assert from 'node:assert/strict';
import { findGradeRaceEntity } from '../../lib/grade-race-entities';
import { getSeasonalGradeRaceSlug, isSameSeasonalGradeRaceIdentity } from '../../lib/article-seasonal-routing';

assert.equal(findGradeRaceEntity('マーキュリーカップ2026 出走馬')?.entity_key, 'mercury-cup');
assert.equal(findGradeRaceEntity('星雲賞 2026 枠順')?.entity_key, 'seiun-sho');
assert.equal(findGradeRaceEntity('岐阜金賞2026')?.entity_key, 'gifu-kin-sho');
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
