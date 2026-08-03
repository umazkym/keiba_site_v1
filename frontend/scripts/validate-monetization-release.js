const DEFAULT_RELEASE_ID = '2026-08-01-ga-route-v2';

const EXPERIMENTS = [
  {
    id: 'MOBILE-RACE-ENGAGED-AD-2026-08',
    envName: 'NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE',
    baseline: 'legacy',
    allowed: new Set(['legacy', 'split', 'engaged_display']),
  },
  {
    id: 'ARTICLE-RACE-BRIDGE-2026-08',
    envName: 'NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE',
    baseline: 'off',
    allowed: new Set(['off', 'split', 'on']),
  },
  {
    id: 'ARTICLE-AD-READ-COMPLETE-2026-08',
    envName: 'NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE',
    baseline: 'control',
    allowed: new Set(['control', 'split', 'variant']),
  },
  {
    id: 'AFF-RAKUTEN-QUALIFIED-NAR-2026-08',
    envName: 'NEXT_PUBLIC_RAKUTEN_KEIBA_MODE',
    baseline: 'legacy',
    allowed: new Set(['legacy', 'qualified_nar']),
  },
];

function parseDate(value, label, errors) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    errors.push(`${label}はYYYY-MM-DD形式で設定してください。`);
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    errors.push(`${label}に実在する日付を設定してください。`);
    return null;
  }
  return parsed;
}

function parseTimestamp(value, label, errors) {
  const raw = String(value || '').trim();
  const timezonePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!timezonePattern.test(raw)) {
    errors.push(`${label}はタイムゾーンを含むISO日時で設定してください。`);
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${label}はタイムゾーンを含むISO日時で設定してください。`);
    return null;
  }
  return parsed;
}

function parseNumber(value, label, errors) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    errors.push(`${label}が必要です。`);
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors.push(`${label}は0以上の数値で設定してください。`);
    return null;
  }
  return parsed;
}

function validateMonetizationRelease(env) {
  const errors = [];
  const active = [];

  for (const experiment of EXPERIMENTS) {
    const value = String(env[experiment.envName] || experiment.baseline).trim();
    if (!experiment.allowed.has(value)) {
      errors.push(`${experiment.envName}の値が不正です: ${value}`);
      continue;
    }
    if (value !== experiment.baseline) {
      active.push({ ...experiment, value });
    }
  }

  if (active.length > 1) {
    errors.push(`収益実験を同時に開始できません: ${active.map(item => item.id).join(', ')}`);
  }
  if (active.length === 0) {
    return { passed: errors.length === 0, activeExperimentId: null, errors };
  }

  const experiment = active[0];
  const activeExperimentId = String(env.MONETIZATION_ACTIVE_EXPERIMENT_ID || '').trim();
  if (activeExperimentId !== experiment.id) {
    errors.push(`MONETIZATION_ACTIVE_EXPERIMENT_IDは${experiment.id}にしてください。`);
  }
  if (String(env.MONETIZATION_QUALITY_GATE_STATUS || '').trim() !== 'passed') {
    errors.push('MONETIZATION_QUALITY_GATE_STATUS=passedが必要です。');
  }

  const gateMode = String(env.MONETIZATION_QUALITY_GATE_MODE || '').trim();
  if (gateMode !== 'accelerated' && gateMode !== 'standard') {
    errors.push('MONETIZATION_QUALITY_GATE_MODEはacceleratedまたはstandardにしてください。');
  }
  const observedDays = Number.parseInt(
    String(env.MONETIZATION_QUALITY_GATE_OBSERVED_DAYS || ''),
    10,
  );
  const minimumObservedDays = gateMode === 'accelerated' ? 3 : 7;
  if (!Number.isFinite(observedDays) || observedDays < minimumObservedDays) {
    errors.push(
      `MONETIZATION_QUALITY_GATE_OBSERVED_DAYSは${minimumObservedDays}以上が必要です。`,
    );
  }
  const maxObservedRate = parseNumber(
    env.MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE,
    'MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATE',
    errors,
  );
  const requiredMaxRate = gateMode === 'accelerated' ? 0.02 : 0.05;
  if (maxObservedRate !== null && maxObservedRate >= requiredMaxRate) {
    errors.push(
      `MONETIZATION_QUALITY_GATE_MAX_OBSERVED_RATEは${requiredMaxRate}未満が必要です。`,
    );
  }
  const observedSessions = parseNumber(
    env.MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS,
    'MONETIZATION_QUALITY_GATE_TOTAL_SESSIONS',
    errors,
  );
  if (gateMode === 'accelerated' && observedSessions !== null && observedSessions < 500) {
    errors.push('高速ゲートではMONETIZATION_QUALITY_GATE_TOTAL_SESSIONSが500以上必要です。');
  }

  const expectedReleaseId = String(
    env.NEXT_PUBLIC_ANALYTICS_RELEASE_ID || DEFAULT_RELEASE_ID,
  ).trim();
  const gateReleaseId = String(env.MONETIZATION_QUALITY_GATE_RELEASE_ID || '').trim();
  if (gateReleaseId !== expectedReleaseId) {
    errors.push(`MONETIZATION_QUALITY_GATE_RELEASE_IDは${expectedReleaseId}にしてください。`);
  }

  const reminderId = String(env.MONETIZATION_EXPERIMENT_REMINDER_ID || '').trim();
  if (!reminderId) {
    errors.push('MONETIZATION_EXPERIMENT_REMINDER_IDが必要です。');
  }
  const decisionDate = parseDate(
    env.MONETIZATION_EXPERIMENT_DECISION_DATE,
    'MONETIZATION_EXPERIMENT_DECISION_DATE',
    errors,
  );
  const startedAtRaw = String(env.MONETIZATION_EXPERIMENT_STARTED_AT || '').trim();
  const startedAt = parseTimestamp(
    startedAtRaw,
    'MONETIZATION_EXPERIMENT_STARTED_AT',
    errors,
  );
  const gateEndDate = parseDate(
    env.MONETIZATION_QUALITY_GATE_END_DATE,
    'MONETIZATION_QUALITY_GATE_END_DATE',
    errors,
  );
  if (startedAt && gateEndDate) {
    const startDate = new Date(`${startedAtRaw.slice(0, 10)}T00:00:00Z`);
    const ageDays = Math.floor((startDate.getTime() - gateEndDate.getTime()) / 86_400_000);
    if (ageDays < 1 || ageDays > 3) {
      errors.push('計測ゲートの最終日は実験開始日の1〜3日前である必要があります。');
    }
    if (decisionDate) {
      const decisionDays = Math.floor(
        (decisionDate.getTime() - startDate.getTime()) / 86_400_000,
      );
      const minimumDecisionDays = experiment.id === 'AFF-RAKUTEN-QUALIFIED-NAR-2026-08'
        ? 28
        : 7;
      if (decisionDays < minimumDecisionDays) {
        errors.push(
          `MONETIZATION_EXPERIMENT_DECISION_DATEは開始日から${minimumDecisionDays}日後以降にしてください。`,
        );
      }
      if (experiment.id !== 'AFF-RAKUTEN-QUALIFIED-NAR-2026-08') {
        const finalDecisionDate = parseDate(
          env.MONETIZATION_EXPERIMENT_FINAL_DECISION_DATE,
          'MONETIZATION_EXPERIMENT_FINAL_DECISION_DATE',
          errors,
        );
        const finalReminderId = String(
          env.MONETIZATION_EXPERIMENT_FINAL_REMINDER_ID || '',
        ).trim();
        if (!finalReminderId) {
          errors.push('MONETIZATION_EXPERIMENT_FINAL_REMINDER_IDが必要です。');
        }
        if (finalDecisionDate) {
          const finalDecisionDays = Math.floor(
            (finalDecisionDate.getTime() - startDate.getTime()) / 86_400_000,
          );
          if (finalDecisionDays < 14) {
            errors.push(
              'MONETIZATION_EXPERIMENT_FINAL_DECISION_DATEは開始日から14日後以降にしてください。',
            );
          }
          if (decisionDate && finalDecisionDate <= decisionDate) {
            errors.push(
              'MONETIZATION_EXPERIMENT_FINAL_DECISION_DATEは早期判断日より後にしてください。',
            );
          }
        }
      }
    }
  }

  if (
    experiment.id === 'MOBILE-RACE-ENGAGED-AD-2026-08'
    && !/^\d{10}$/.test(String(env.NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT || '').trim())
  ) {
    errors.push('NEXT_PUBLIC_RACE_ENGAGED_AD_SLOTには10桁の広告slotが必要です。');
  }

  return {
    passed: errors.length === 0,
    activeExperimentId: experiment.id,
    errors,
  };
}

function main() {
  // Next.jsが参照する.env.local等も先に読み込み、ローカルビルドでのゲート迂回を防ぐ。
  require('@next/env').loadEnvConfig(process.cwd());
  const result = validateMonetizationRelease(process.env);
  if (!result.passed) {
    console.error('収益実験のリリースゲートに失敗しました。');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  if (result.activeExperimentId) {
    console.log(`収益実験リリースゲート: OK (${result.activeExperimentId})`);
  } else {
    console.log('収益実験リリースゲート: OK (実験なし)');
  }
}

module.exports = { validateMonetizationRelease };

if (require.main === module) main();
