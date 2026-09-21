import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { WriteOrder } from './agent_writer';

type FactFallbackResult = {
  passed: boolean;
  errors: string[];
};

const OFFICIAL_HOST = /(^|\.)(jra\.go\.jp|jra\.jp|keiba\.go\.jp)$/i;
const FORBIDDEN_TITLE = /予想|出走馬|登録馬|枠順|馬番|結果|回顧|オッズ|AI|買い目/;
const PENDING_DIR = path.join(__dirname, '..', '..', 'agents', 'queue', 'pending');

function stringField(value: unknown): string {
  return String(value || '').trim();
}

function isOfficialScheduleUrl(value: unknown): boolean {
  try {
    const url = new URL(stringField(value));
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.port
      && OFFICIAL_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

function isValidDateOnly(value: unknown): boolean {
  const date = stringField(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
}

function fallbackFields(order: WriteOrder): Record<string, unknown> {
  return order.reference_data as Record<string, unknown>;
}

/** 公式日程だけで作る定型記事の対象かを厳格に確認する。 */
export function validateOfficialFactFallbackOrder(order: WriteOrder): FactFallbackResult {
  const ref = fallbackFields(order);
  const errors: string[] = [];
  const required = [
    ['race_name', ref.race_name],
    ['scheduled_race_date', ref.scheduled_race_date],
    ['scheduled_venue', ref.scheduled_venue],
    ['scheduled_distance', ref.scheduled_distance],
    ['scheduled_conditions', ref.scheduled_conditions],
    ['scheduled_grade', ref.scheduled_grade],
    ['entity_key', order.entity_key || ref.entity_key],
    ['season_year', order.season_year || ref.season_year],
    ['schedule_milestone', ref.schedule_milestone],
  ];
  for (const [name, value] of required) {
    if (!stringField(value)) errors.push(`公式事実の必須項目がありません: ${name}`);
  }
  if (ref.official_schedule_confirmed !== true || ref.official_fact_fallback_eligible !== true) {
    errors.push('公式日程の確認済みフラグがありません');
  }
  if (!isOfficialScheduleUrl(ref.schedule_source_url)) {
    errors.push('公式日程URLがありません');
  }
  if (String(ref.update_stage || '') !== 'field_building' || String(ref.schedule_milestone || '') !== 'initial') {
    errors.push('定型記事は初回のfield_building段階だけを扱います');
  }
  const seasonYear = stringField(order.season_year || ref.season_year);
  if (!/^20\d{2}$/.test(seasonYear) || !isValidDateOnly(ref.scheduled_race_date) || !stringField(ref.scheduled_race_date).startsWith(`${seasonYear}-`)) {
    errors.push('season_yearと開催日が一致しません');
  }
  return { passed: errors.length === 0, errors };
}

function fallbackTitle(order: WriteOrder): string {
  const ref = fallbackFields(order);
  return `${stringField(ref.race_name)} ${stringField(order.season_year || ref.season_year)}｜開催日・競馬場・距離の確認`;
}

function renderOfficialFactFallbackContent(order: WriteOrder): string {
  const ref = fallbackFields(order);
  const raceName = stringField(ref.race_name);
  const scheduledDate = stringField(ref.scheduled_race_date);
  const venue = stringField(ref.scheduled_venue);
  const distance = stringField(ref.scheduled_distance);
  const conditions = stringField(ref.scheduled_conditions);
  const grade = stringField(ref.scheduled_grade);
  return [
    `${raceName}について、現時点で確認できる開催条件を整理します。ここでは日程として確認済みの情報だけを扱います。`,
    '',
    '## 確認済みの開催条件',
    '',
    '| 項目 | 内容 |',
    '| --- | --- |',
    `| 開催日 | ${scheduledDate} |`,
    `| 開催場 | ${venue}競馬場 |`,
    `| 距離 | ${distance} |`,
    `| 条件 | ${conditions} |`,
    `| 格付け | ${grade} |`,
    '',
    '## 発表後に更新する項目',
    '',
    '登録情報、馬番、枠番、予測データ、確定着順は、この時点では記載しません。公式発表またはUMA-FREEの掲載データで確認できた項目だけを、同じ記事に段階的に反映します。',
    '',
  ].join('\n');
}

/** 未確認の馬・枠・予測・結果を作らない、短い公式事実記事を組み立てる。 */
export function buildOfficialFactFallbackMarkdown(order: WriteOrder, now = new Date()): string {
  const gate = validateOfficialFactFallbackOrder(order);
  if (!gate.passed) throw new Error(gate.errors.join(' / '));
  const ref = fallbackFields(order);
  const title = fallbackTitle(order);
  if (FORBIDDEN_TITLE.test(title)) throw new Error('定型記事のタイトルに未確認情報を約束する語が含まれます');
  const data = {
    title, description: `${stringField(ref.race_name)}の確認済み開催日程、競馬場、距離、出走条件を整理します。`, date: now.toISOString(), draft: true, category: '重賞攻略', target_keyword: order.target_keyword,
    theme_cluster: 'race_update', article_type: 'race_update', entity_type: 'grade_race', entity_key: stringField(order.entity_key || ref.entity_key), race_entity_key: stringField(order.entity_key || ref.entity_key), entity_key_source: stringField(order.entity_key_source || ref.entity_key_source), race_identity_version: stringField(order.race_identity_version || ref.race_identity_version), race_circuit: stringField(order.race_circuit || ref.race_circuit), entity_archive_slug: stringField(order.entity_archive_slug || ref.entity_archive_slug), season_year: stringField(order.season_year || ref.season_year), race_name: stringField(ref.race_name), calendar_race: stringField(ref.race_name), scheduled_race_date: stringField(ref.scheduled_race_date), scheduled_venue: stringField(ref.scheduled_venue), scheduled_distance: stringField(ref.scheduled_distance), scheduled_conditions: stringField(ref.scheduled_conditions), scheduled_grade: stringField(ref.scheduled_grade), update_stage: 'field_building', schedule_milestone: 'initial', schedule_milestones: 'initial', search_intent: 'field_analysis', race_phase: 'early_preview', draw_status: 'pre_draw', result_confirmed: false, official_schedule_confirmed: true, official_fact_fallback: true, official_fact_source_url: stringField(ref.schedule_source_url), source_urls: [stringField(ref.schedule_source_url)], keywords: [stringField(ref.race_name), `${stringField(ref.race_name)} ${stringField(order.season_year || ref.season_year)}`, stringField(ref.scheduled_venue), stringField(ref.scheduled_distance)],
  };
  const content = renderOfficialFactFallbackContent(order);
  return matter.stringify(`${content}\n`, data);
}

/** 生成済み定型記事も、元Orderと本文の両方から独立に検査する。 */
export function validateOfficialFactFallbackMarkdown(order: WriteOrder, markdown: string): FactFallbackResult {
  const orderGate = validateOfficialFactFallbackOrder(order);
  if (!orderGate.passed) return orderGate;
  const parsed = matter(markdown);
  const ref = fallbackFields(order);
  const errors: string[] = [];
  if (parsed.data.official_fact_fallback !== true || parsed.data.official_schedule_confirmed !== true) {
    errors.push('定型記事の公式事実フラグがありません');
  }
  if (FORBIDDEN_TITLE.test(stringField(parsed.data.title))) {
    errors.push('タイトルが未確認情報を約束しています');
  }
  for (const key of ['race_name', 'scheduled_race_date', 'scheduled_venue', 'scheduled_distance', 'scheduled_conditions'] as const) {
    if (stringField(parsed.data[key]) !== stringField(ref[key])) errors.push(`frontmatterの${key}がOrderと一致しません`);
  }
  if (parsed.content.trim() !== renderOfficialFactFallbackContent(order).trim()) errors.push('定型本文が確認済み公式事実と一致しません');
  if (/https?:\/\//.test(parsed.content)) errors.push('本文に外部URLを含められません');
  return { passed: errors.length === 0, errors };
}

export function createOfficialFactFallbackDraft(order: WriteOrder, now = new Date()): string {
  const markdown = buildOfficialFactFallbackMarkdown(order, now);
  const gate = validateOfficialFactFallbackMarkdown(order, markdown);
  if (!gate.passed) throw new Error(gate.errors.join(' / '));
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const safeEntity = stringField(order.entity_key || fallbackFields(order).entity_key).replace(/[^a-z0-9-]/gi, '-');
  const filePath = path.join(PENDING_DIR, `official-fact-${safeEntity}-${stamp}.md`);
  fs.writeFileSync(filePath, markdown, 'utf-8');
  return filePath;
}
