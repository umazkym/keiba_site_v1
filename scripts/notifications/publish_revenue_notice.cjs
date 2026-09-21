'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ISSUE_MARKER = '<!-- uma-revenue-notifications:v1 -->';
const ISSUE_TITLE = 'UMA-FREE 自動運用のお知らせ';
const REASON_CODES = new Set([
  'adsense_fetch_failed', 'ga4_fetch_failed', 'adsense_data_missing', 'ga4_data_missing',
  'ad_delivery_drop', 'traffic_drop', 'attribution_missing', 'monitor_failed', 'workflow_incomplete',
  'monthly_pace_unavailable', 'rolling_28_days_rpm_missing', 'rolling_28_days_rpm_nonpositive',
  'rolling_28_days_adsense_page_views_coverage_incomplete',
  'core_non_adsense_source_incomplete',
  ...['partial', 'failed', 'unavailable'].map(status => `adsense_daily_report_${status}`),
  ...['data_quality', 'content', 'workflow', 'traffic', 'routine'].map(category => `action_${category}`),
  ...['current_week', 'rolling_28_days'].flatMap(period => [
    'period_dates_missing', 'period_dates_invalid', 'adsense_date_coverage_incomplete',
    'adsense_revenue_missing', 'adsense_metric_coverage_unavailable',
    'adsense_estimated_earnings_coverage_incomplete',
  ].map(suffix => `${period}_${suffix}`)),
]);
const ISSUE_BODY = `${ISSUE_MARKER}
このIssueへ週次の状況と、対応が必要な異常・解消のお知らせを届けます。

- 金額・アクセス数・検索語・認証情報は掲載しません。
- 週次のお知らせでは、目標への進み具合と次に確認することをお伝えします。
- 日次確認で異常が続いていても、同じ内容を毎日送りません。
- 広告設定を自動変更する処理ではありません。

メールで受け取るには、このIssueをSubscribeし、GitHubの通知設定で参加・購読中のEmail通知を有効にしてください。メールに返信すると公開コメントになります。

通知を停止するには、このIssueを閉じてください。再開する場合は再度開いてください。
`;

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function validate(payload) {
  if (payload?.schema_version !== 'revenue-notification.v1' || payload.public_safe !== true
      || !['daily', 'weekly'].includes(payload.kind) || !validDate(payload.period_end)
      || typeof payload.needs_attention !== 'boolean' || !Array.isArray(payload.reason_codes)
      || payload.reason_codes.some(code => !REASON_CODES.has(code))
      || typeof payload.body !== 'string' || payload.body.length > 5000
      || typeof payload.title !== 'string' || payload.title.length > 200) {
    throw new Error('通知の形式が不正なため公開を停止しました。');
  }
  // 日付以外の数値・URL・メンションは公開原稿に不要。詳細原稿の取り違えも検出する。
  const prose = (payload.title + '\n' + payload.body).replace(/\d{4}-\d{2}-\d{2}/g, '');
  if (/[0-9０-９¥￥$%@]|https?:\/\/|<!--|[一二三四五六七八九十百千万億兆〇零]+(?:円|ドル|件|回|人|PV)/i.test(prose)) {
    throw new Error('公開通知に不要な数値・リンク等が含まれています。');
  }
  return { ...payload, reason_codes: [...new Set(payload.reason_codes)].sort() };
}

function fallback(kind, now = new Date()) {
  // JSTの集計日。日次は反映待ちを除外、週次は直近の完了日曜に合わせる。
  const day = new Date(now.getTime() + 9 * 3600 * 1000);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - (kind === 'daily' ? 2 : day.getUTCDay() || 7));
  return {
    schema_version: 'revenue-notification.v1', public_safe: true,
    kind, period_end: day.toISOString().slice(0, 10), needs_attention: true,
    reason_codes: ['monitor_failed'], title: 'UMA-FREE：自動確認が完了しませんでした',
    body: '## 自動確認が完了しませんでした\n\nあなたの対応：実行履歴の確認が必要です。\n\n監視処理を完了できなかったため、今回の状況は未判定です。サイトの障害とは限りません。金額・アクセス数は掲載していません。',
  };
}

function readNotice(directory, kind, now) {
  const file = path.join(directory, 'notification.json');
  if (!fs.existsSync(file)) return fallback(kind, now);
  const payload = validate(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (payload.kind !== kind) throw new Error('通知の種類が一致しません。');
  return payload;
}

function stateFromComment(comment) {
  // 人の返信を監視状態と解釈しない。
  if (comment.user?.login !== 'github-actions[bot]') return null;
  const match = String(comment.body).match(/<!-- uma-revenue-notice:(\{[^\n]*\}) -->/);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    if (!['daily', 'weekly'].includes(state.kind) || !validDate(state.period_end)
        || !Array.isArray(state.reason_codes)
        || state.reason_codes.some(code => !REASON_CODES.has(code))) return null;
    return state;
  } catch { return null; }
}

function decision(payload, states) {
  const relevant = states.filter(state => state.kind === payload.kind);
  const latest = relevant.reduce((last, state) => !last || state.period_end >= last.period_end ? state : last, null);
  if (latest && latest.period_end > payload.period_end) return 'stale';
  if (payload.kind === 'weekly') {
    if (latest?.period_end === payload.period_end) {
      return [...new Set(latest.reason_codes)].sort().join(',') === payload.reason_codes.join(',')
        ? 'duplicate' : 'weekly_update';
    }
    return 'weekly';
  }
  const before = [...new Set(latest?.reason_codes || [])].sort().join(',');
  const after = payload.reason_codes.join(',');
  if (before === after) return 'unchanged';
  return after ? 'alert' : 'recovery';
}

async function publish({ github, context, core, directory, kind, now }) {
  const payload = validate(readNotice(directory, kind, now));
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: 'all', per_page: 100,
  });
  let issue = issues.filter(row => !row.pull_request && row.body?.includes(ISSUE_MARKER))
    .sort((a, b) => a.number - b.number)[0];
  if (issue?.state === 'closed') {
    core.info('通知用Issueが閉じられているため送信しません。');
    return { sent: false, reason: 'disabled' };
  }
  if (!issue) {
    issue = (await github.rest.issues.create({ ...context.repo, title: ISSUE_TITLE, body: ISSUE_BODY })).data;
  }
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo, issue_number: issue.number, per_page: 100,
  });
  const states = comments.map(stateFromComment).filter(Boolean);
  const action = decision(payload, states);
  if (['stale', 'duplicate', 'unchanged'].includes(action)) {
    core.info('同じ状態または古い期間のため、重複通知を省きました。');
    return { sent: false, reason: action, issue_number: issue.number };
  }
  const state = { kind, period_end: payload.period_end, reason_codes: payload.reason_codes };
  const link = `${context.serverUrl || 'https://github.com'}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const recovery = action === 'recovery' ? '## 前回のお知らせから改善しました\n\n以前の異常は、今回の集計では検出していません。\n\n'
    : action === 'weekly_update' ? '## 週次の確認結果を更新しました\n\n再確認により取得・確認対象の状態が変わりました。\n\n' : '';
  let prose = payload.body;
  const dailyState = states.filter(row => row.kind === 'daily').at(-1);
  if (kind === 'weekly' && dailyState?.reason_codes.length) {
    prose = prose.replace('あなたの対応: 確認不要', 'あなたの対応: 確認が必要');
    prose += '\n\n日次のお知らせに、まだ解消を確認できていない異常があります。このIssueの直近の日次通知を確認してください。';
  }
  // 確認先は固定の公開リンクだけにし、収集データ由来のURLを展開しない。
  if (payload.reason_codes.includes('action_content')) {
    prose += `\n\n[重賞記事の自動生成・公開結果を確認する](${context.serverUrl || 'https://github.com'}/${context.repo.owner}/${context.repo.repo}/actions/workflows/keiba-article-pipeline.yml)`;
  }
  if (payload.reason_codes.includes('ad_delivery_drop')) {
    prose += '\n\n[AdSenseで配信状況を確認する](https://adsense.google.com/)';
  }
  const body = `${recovery}${prose}\n\n[自動確認の実行結果](${link})\n\n<!-- uma-revenue-notice:${JSON.stringify(state)} -->`;
  await github.rest.issues.createComment({ ...context.repo, issue_number: issue.number, body });
  core.info('公開用の簡易通知を投稿しました。メールの配信は受信者のGitHub設定に依存します。');
  return { sent: true, reason: action, issue_number: issue.number };
}

module.exports = { publish, validate, fallback, readNotice, decision, stateFromComment, ISSUE_MARKER, ISSUE_TITLE, ISSUE_BODY };
