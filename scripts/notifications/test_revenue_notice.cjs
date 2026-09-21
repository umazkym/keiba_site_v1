'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  publish, validate, fallback, decision, stateFromComment,
  latestStableSunday, shouldRunWeekly, ISSUE_MARKER,
} = require('./publish_revenue_notice.cjs');

const make = (reasons = [], kind = 'daily', end = '2026-09-19') => ({
  ...fallback(kind), period_end: end, reason_codes: reasons, needs_attention: reasons.length > 0,
  title: '自動確認', body: '確認期間：2026-09-18〜2026-09-19\n確認結果をお知らせします。',
});

test('初回正常は静かに、異常・変化・解消だけ通知する', () => {
  assert.equal(decision(make(), []), 'unchanged');
  assert.equal(decision(make(['traffic_drop']), []), 'alert');
  const previous = make(['traffic_drop']);
  assert.equal(decision(make(['traffic_drop'], 'daily', '2026-09-20'), [previous]), 'unchanged');
  assert.equal(decision(make(['ad_delivery_drop']), [previous]), 'alert');
  assert.equal(decision(make(), [previous]), 'recovery');
  assert.equal(decision(make(['traffic_drop'], 'daily', '2026-09-18'), [previous]), 'stale');
});

test('週次は同期間で再送せず日次と独立する', () => {
  const weekly = make([], 'weekly', '2026-09-20');
  assert.equal(decision(weekly, [make()]), 'weekly');
  assert.equal(decision(weekly, [weekly]), 'duplicate');
  assert.equal(decision(weekly, [make(['monitor_failed'], 'weekly', '2026-09-20')]), 'weekly_update');
  assert.equal(decision(make([], 'weekly', '2026-09-27'), [weekly]), 'weekly');
});

test('公開用印・金額・アクセス数・URL・日付・非公開原稿を検査する', () => {
  assert.doesNotThrow(() => validate(make()));
  for (const body of ['収益123円', 'PV ４２', '一万円', 'https://example.com', '@someone', '<!-- 原本 -->']) {
    assert.throws(() => validate({ ...make(), body }));
  }
  assert.throws(() => validate({ ...make(), public_safe: false }));
  assert.throws(() => validate(make(['revenue_50000'])));
  assert.throws(() => validate({ ...make(), period_end: '2026-02-31' }));
});

test('人の返信を監視状態にしない', () => {
  const body = `<!-- uma-revenue-notice:${JSON.stringify(make(['traffic_drop']))} -->`;
  assert.equal(stateFromComment({ user: { login: 'reader' }, body }), null);
  assert.equal(stateFromComment({ user: { login: 'github-actions[bot]' }, body }).kind, 'daily');
});

test('収集開始前の失敗にもJST日付で未判定通知を作る', () => {
  assert.equal(fallback('daily', new Date('2026-09-20T16:00:00Z')).period_end, '2026-09-19');
  assert.equal(fallback('weekly', new Date('2026-09-22T16:00:00Z')).period_end, '2026-09-20');
  assert.equal(fallback('weekly', new Date('2026-09-19T16:00:00Z')).period_end, '2026-09-13');
});

test('週次は三日以上経過した日曜を選ぶ', () => {
  assert.equal(latestStableSunday(new Date('2026-09-20T15:00:00Z')), '2026-09-13'); // 月曜JST
  assert.equal(latestStableSunday(new Date('2026-09-21T15:00:00Z')), '2026-09-13'); // 火曜JST
  assert.equal(latestStableSunday(new Date('2026-09-22T15:00:00Z')), '2026-09-20'); // 水曜JST
  assert.equal(latestStableSunday(new Date('2026-09-25T15:00:00Z')), '2026-09-20'); // 土曜JST
});

test('木金の再実行は対象週の取得不足時だけ行う', () => {
  const now = new Date('2026-09-23T00:30:00Z'); // 木曜09:30 JST
  const base = { kind: 'weekly', period_end: '2026-09-20', reason_codes: ['action_traffic'] };
  assert.equal(shouldRunWeekly({ eventName: 'workflow_dispatch', states: [base], now }).run, true);
  assert.equal(shouldRunWeekly({ eventName: 'schedule', schedule: '30 0 * * 3', states: [base], now }).run, true);
  assert.equal(shouldRunWeekly({ eventName: 'schedule', schedule: '30 0 * * 4', states: [base], now }).run, false);
  assert.equal(shouldRunWeekly({
    eventName: 'schedule', schedule: '30 0 * * 4', states: [], now, retryEnabled: false,
  }).run, false);
  assert.equal(shouldRunWeekly({ eventName: 'schedule', schedule: '30 0 * * 4', states: [], now }).run, true);
  assert.equal(shouldRunWeekly({
    eventName: 'schedule', schedule: '30 0 * * 4', now,
    states: [{ ...base, reason_codes: ['rolling_28_days_adsense_date_coverage_incomplete'] }],
  }).run, true);
});

test('Issueの再利用・停止・コメント再実行をAPIモックで確認する', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uma-notice-test-'));
  const issue = { number: 42, state: 'open', body: ISSUE_MARKER };
  const comments = [];
  let creates = 0;
  const github = { rest: { issues: {
    listForRepo: 'issues', listComments: 'comments',
    create: async () => { creates++; return { data: issue }; },
    createComment: async ({ body }) => { comments.push({ user: { login: 'github-actions[bot]' }, body }); },
  } }, paginate: async method => method === 'issues' ? [issue] : comments };
  const args = { github, context: { repo: { owner: 'test', repo: 'test' }, runId: 1 }, core: { info() {} }, directory, kind: 'daily' };
  try {
    fs.writeFileSync(path.join(directory, 'notification.json'), JSON.stringify(make(['traffic_drop'])));
    assert.equal((await publish(args)).sent, true);
    assert.equal((await publish(args)).sent, false);
    assert.equal(comments.length, 1);
    assert.equal(creates, 0);
    fs.writeFileSync(path.join(directory, 'notification.json'), JSON.stringify(make([], 'weekly', '2026-09-20')));
    assert.equal((await publish({ ...args, kind: 'weekly' })).reason, 'weekly');
    assert.match(comments.at(-1).body, /まだ解消を確認できていません/);
    assert.match(comments.at(-1).body, /新しい確認作業は不要/);
    fs.writeFileSync(path.join(directory, 'notification.json'), JSON.stringify(make([], 'daily', '2026-09-20')));
    assert.equal((await publish(args)).reason, 'recovery');
    issue.state = 'closed';
    assert.equal((await publish(args)).reason, 'disabled');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
