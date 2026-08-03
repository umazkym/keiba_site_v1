const assert = require('node:assert/strict');
const { validateMonetizationRelease } = require('./validate-monetization-release');

const baseline = validateMonetizationRelease({});
assert.equal(baseline.passed, true);
assert.equal(baseline.activeExperimentId, null);

const raceExperiment = {
  NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE: 'split',
  NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT: '7550236816',
  NEXT_PUBLIC_ANALYTICS_RELEASE_ID: '2026-08-01-ga-route-v2',
  MONETIZATION_ACTIVE_EXPERIMENT_ID: 'MOBILE-RACE-ENGAGED-AD-2026-08',
  MONETIZATION_QUALITY_GATE_STATUS: 'passed',
  MONETIZATION_QUALITY_GATE_OBSERVED_DAYS: '7',
  MONETIZATION_QUALITY_GATE_RELEASE_ID: '2026-08-01-ga-route-v2',
  MONETIZATION_QUALITY_GATE_END_DATE: '2026-08-09',
  MONETIZATION_EXPERIMENT_STARTED_AT: '2026-08-10T00:15:00+09:00',
  MONETIZATION_EXPERIMENT_DECISION_DATE: '2026-08-24',
  MONETIZATION_EXPERIMENT_REMINDER_ID: 'reminder-mobile-race-d14',
};
assert.equal(validateMonetizationRelease(raceExperiment).passed, true);

const noGate = { ...raceExperiment, MONETIZATION_QUALITY_GATE_STATUS: 'pending' };
assert.equal(validateMonetizationRelease(noGate).passed, false);

const overlapping = {
  ...raceExperiment,
  NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE: 'split',
};
const overlapResult = validateMonetizationRelease(overlapping);
assert.equal(overlapResult.passed, false);
assert.match(overlapResult.errors.join('\n'), /同時に開始できません/);

const staleGate = {
  ...raceExperiment,
  MONETIZATION_QUALITY_GATE_END_DATE: '2026-08-01',
};
assert.equal(validateMonetizationRelease(staleGate).passed, false);

const earlyDecision = {
  ...raceExperiment,
  MONETIZATION_EXPERIMENT_DECISION_DATE: '2026-08-20',
};
assert.equal(validateMonetizationRelease(earlyDecision).passed, false);

const missingTimezone = {
  ...raceExperiment,
  MONETIZATION_EXPERIMENT_STARTED_AT: '2026-08-10T00:15:00',
};
assert.equal(validateMonetizationRelease(missingTimezone).passed, false);

console.log('monetization release guard: OK');
