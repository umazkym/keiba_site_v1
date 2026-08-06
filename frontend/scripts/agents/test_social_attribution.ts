import assert from 'node:assert/strict';
import { parseSocialAttributionSearch } from '../../lib/analytics';

const x = parseSocialAttributionSearch(
  '?utm_source=x&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=evening_race-20260809-a1b2c3d4e5f6&utm_term=evening_race',
  '新潟',
  1,
);
assert.equal(x?.source_platform, 'x');
assert.equal(x?.source_content_key, 'evening_race-20260809-a1b2c3d4e5f6');
assert.equal(x?.post_type, 'evening_race');
assert.equal(x?.video_format, 'none');

const threads = parseSocialAttributionSearch(
  '?utm_source=threads&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=pre_race_remind-20260809-112233aabbcc',
  '中京',
  2,
);
assert.equal(threads?.source_platform, 'threads');
assert.equal(threads?.post_type, 'pre_race_remind');
assert.equal(threads?.video_format, 'none');

const youtube = parseSocialAttributionSearch(
  '?utm_source=youtube&utm_medium=video&utm_campaign=daily_race_video_v2&utm_content=daily_short_compilation',
  '札幌',
  3,
);
assert.equal(youtube?.source_platform, 'youtube');
assert.equal(youtube?.source_content_key, 'daily_short_compilation');
assert.equal(youtube?.video_format, 'short');
assert.equal(youtube?.post_type, 'social_video');

assert.equal(parseSocialAttributionSearch('?utm_source=x&utm_medium=organic_social', '', 4), null);
assert.equal(parseSocialAttributionSearch('?utm_source=google&utm_medium=organic', '', 5), null);

console.log('social attribution: OK');
