import assert from 'node:assert/strict';
import {
  classifyMonetizationPageType,
  inferContentGroupFromPath,
  normalizeRacePhase,
} from '../../lib/monetization-context';

const pageCases = new Map<string, string>([
  ['/', 'home'],
  ['/articles', 'article_index'],
  ['/articles/2026-test', 'article'],
  ['/races/2026-08-03', 'race_day'],
  ['/races/2026-08-03/niigata/11', 'race_detail'],
  ['/keiba-data', 'data'],
  ['/courses/niigata/turf-1000m', 'data'],
  ['/about', 'other'],
]);

for (const [pathname, expected] of pageCases) {
  assert.equal(classifyMonetizationPageType(pathname), expected, pathname);
}

assert.equal(inferContentGroupFromPath('/races/2026-08-03/niigata/11'), 'race_data');
assert.equal(inferContentGroupFromPath('/horses/2022100001'), 'entity_data');
assert.equal(inferContentGroupFromPath('/articles/guide'), 'evergreen_guide');
assert.equal(normalizeRacePhase('final_48h'), 'final_48h');
assert.equal(normalizeRacePhase('pre_race'), undefined);

console.log('monetization-context: OK');
