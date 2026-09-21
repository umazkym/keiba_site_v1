import assert from 'node:assert/strict';
import {
  buildOfficialFactFallbackMarkdown,
  validateOfficialFactFallbackMarkdown,
  validateOfficialFactFallbackOrder,
} from './official_fact_fallback';
import type { WriteOrder } from './agent_writer';
import { shouldPreserveRichExistingGradeRaceContent } from './grade_race_content_protection';

const completeOrder: WriteOrder = {
  target_keyword: '確認重賞2026 開催概要',
  theme_cluster: 'race_update',
  entity_type: 'grade_race',
  entity_key: 'test-grade-race',
  entity_key_source: 'deterministic_schedule',
  race_identity_version: 'v1',
  race_circuit: 'jra',
  season_year: '2026',
  reference_data: {
    period: '2026年08月01日取得',
    condition: 'レース条件',
    sample_size: 1,
    key_metrics: [],
    race_name: '確認重賞',
    scheduled_race_date: '2026-08-15',
    scheduled_venue: '東京',
    scheduled_distance: '芝1600m',
    scheduled_conditions: '3歳以上',
    scheduled_grade: 'G3',
    update_stage: 'field_building',
    schedule_milestone: 'initial',
    official_schedule_confirmed: true,
    official_fact_fallback_eligible: true,
    schedule_source_url: 'https://www.jra.go.jp/datafile/seiseki/replay/2026/jyusyo.html',
  },
};

assert.equal(validateOfficialFactFallbackOrder(completeOrder).passed, true);
const markdown = buildOfficialFactFallbackMarkdown(completeOrder, new Date('2026-08-01T00:00:00.000Z'));
assert.equal(validateOfficialFactFallbackMarkdown(completeOrder, markdown).passed, true);
assert.match(markdown, /開催日・競馬場・距離の確認/);
assert.doesNotMatch(markdown.match(/^title:.*$/m)?.[0] || '', /予想|枠順|結果|AI/);
assert.doesNotMatch(markdown, /AI偏差値|オッズ|\| 馬番 \||\| 枠番 \|/);

const incompleteOrder: WriteOrder = {
  ...completeOrder,
  reference_data: {
    ...completeOrder.reference_data,
    scheduled_conditions: '',
  },
};
assert.equal(validateOfficialFactFallbackOrder(incompleteOrder).passed, false);

const lateOrUnverifiedOrder: WriteOrder = {
  ...completeOrder,
  reference_data: {
    ...completeOrder.reference_data,
    official_schedule_confirmed: false,
    schedule_source_url: 'https://example.com/schedule',
  },
};
assert.equal(validateOfficialFactFallbackOrder(lateOrUnverifiedOrder).passed, false);

const tampered = markdown.replace('| 条件 | 3歳以上 |', '| 条件 | 4歳以上 |');
assert.equal(validateOfficialFactFallbackMarkdown(completeOrder, tampered).passed, false);
assert.equal(
  shouldPreserveRichExistingGradeRaceContent(
    { entity_type: 'grade_race' },
    '既存の確認済み固有データを含む本文。'.repeat(30),
    { official_fact_fallback: true },
    markdown,
  ),
  true,
);
assert.equal(
  shouldPreserveRichExistingGradeRaceContent(
    { entity_type: 'grade_race' },
    '短い本文',
    { official_fact_fallback: true },
    markdown,
  ),
  false,
);

console.log('official fact fallback tests passed');
