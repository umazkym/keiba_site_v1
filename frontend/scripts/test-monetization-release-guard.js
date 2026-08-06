const assert = require('node:assert/strict');
const { validateMonetizationRelease } = require('./validate-monetization-release');

const baseline = validateMonetizationRelease({});
assert.equal(baseline.passed, true);
assert.equal(baseline.activeExperimentId, null);
assert.equal(baseline.releasePolicy, 'experiment');

const fixedRollout = {
  MONETIZATION_RELEASE_POLICY: 'fixed',
  MONETIZATION_FIXED_ROLLOUT_ID: 'UMA-FREE-TRAFFIC-RECOVERY-2026-08',
  MONETIZATION_FIXED_ROLLOUT_APPROVED_AT: '2026-08-07T18:00:00+09:00',
  NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE: 'engaged_display',
  NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT: '7550236816',
  NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE: 'on',
  NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE: 'variant',
  NEXT_PUBLIC_RAKUTEN_KEIBA_MODE: 'qualified_nar',
};
const fixedResult = validateMonetizationRelease(fixedRollout);
assert.equal(fixedResult.passed, true);
assert.equal(fixedResult.releasePolicy, 'fixed');
assert.equal(fixedResult.activeExperimentId, null);
assert.equal(fixedResult.fixedRolloutId, 'UMA-FREE-TRAFFIC-RECOVERY-2026-08');

const fixedMissingMode = { ...fixedRollout };
delete fixedMissingMode.NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE;
assert.equal(validateMonetizationRelease(fixedMissingMode).passed, false);

const fixedSplit = {
  ...fixedRollout,
  NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE: 'split',
};
assert.equal(validateMonetizationRelease(fixedSplit).passed, false);

const fixedMissingId = { ...fixedRollout, MONETIZATION_FIXED_ROLLOUT_ID: '' };
assert.equal(validateMonetizationRelease(fixedMissingId).passed, false);

const fixedMissingApproval = { ...fixedRollout, MONETIZATION_FIXED_ROLLOUT_APPROVED_AT: '' };
assert.equal(validateMonetizationRelease(fixedMissingApproval).passed, false);

const raceExperiment = {
  NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE: 'split',
  NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT: '7550236816',
  NEXT_PUBLIC_ANALYTICS_RELEASE_ID: '2026-08-01-ga-route-v2',
  MONETIZATION_ACTIVE_EXPERIMENT_ID: 'MOBILE-RACE-ENGAGED-AD-2026-08',
  MONETIZATION_QUALITY_GATE_STATUS: 'passed',
  MONETIZATION_QUALITY_GATE_MODE: 'accelerated',
  MONETIZATION_QUALITY_GATE_OBSERVED_DAYS: '3',
  MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE: '0.019',
  MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS: '520',
  MONETIZATION_QUALITY_GATE_RELEASE_ID: '2026-08-01-ga-route-v2',
  MONETIZATION_QUALITY_GATE_END_DATE: '2026-08-09',
  MONETIZATION_EXPERIMENT_STARTED_AT: '2026-08-10T00:15:00+09:00',
  MONETIZATION_EXPERIMENT_DECISION_DATE: '2026-08-17',
  MONETIZATION_EXPERIMENT_REMINDER_ID: 'reminder-mobile-race-d7',
  MONETIZATION_EXPERIMENT_FINAL_DECISION_DATE: '2026-08-24',
  MONETIZATION_EXPERIMENT_FINAL_REMINDER_ID: 'reminder-mobile-race-d14',
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
  MONETIZATION_EXPERIMENT_DECISION_DATE: '2026-08-16',
};
assert.equal(validateMonetizationRelease(earlyDecision).passed, false);

const acceleratedGateTooShort = {
  ...raceExperiment,
  MONETIZATION_QUALITY_GATE_OBSERVED_DAYS: '2',
};
assert.equal(validateMonetizationRelease(acceleratedGateTooShort).passed, false);

const acceleratedGateTooSparse = {
  ...raceExperiment,
  MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS: '499',
};
assert.equal(validateMonetizationRelease(acceleratedGateTooSparse).passed, false);

const acceleratedGateAtTwoPercent = {
  ...raceExperiment,
  MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE: '0.02',
};
assert.equal(validateMonetizationRelease(acceleratedGateAtTwoPercent).passed, false);

const standardGate = {
  ...raceExperiment,
  MONETIZATION_QUALITY_GATE_MODE: 'standard',
  MONETIZATION_QUALITY_GATE_OBSERVED_DAYS: '7',
  MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE: '0.049',
  MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS: '300',
};
assert.equal(validateMonetizationRelease(standardGate).passed, true);

const missingTimezone = {
  ...raceExperiment,
  MONETIZATION_EXPERIMENT_STARTED_AT: '2026-08-10T00:15:00',
};
assert.equal(validateMonetizationRelease(missingTimezone).passed, false);

console.log('monetization release guard: OK');
