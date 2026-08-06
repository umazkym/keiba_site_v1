import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getApiBaseUrl } from '../../lib/api-base';
import { findGradeRaceEntity } from '../../lib/grade-race-entities';

type AuditRow = {
  file: string;
  slug: string;
  race_name: string;
  scheduled_race_date: string;
  entity_key: string;
  status: 'eligible' | 'not_found' | 'race_only' | 'missing_metadata' | 'pending_verification' | 'api_error';
  reason: string;
  race_id?: string;
  race_url?: string;
  applied?: boolean;
};

const articlesDir = path.join(process.cwd(), 'content', 'articles');
const apiBaseUrl = getApiBaseUrl();
const offline = process.argv.includes('--offline');
const applyEligible = process.argv.includes('--apply-eligible');
const slugIndex = process.argv.indexOf('--slug');
const targetSlug = slugIndex >= 0 ? String(process.argv[slugIndex + 1] || '').trim() : '';

if (targetSlug && !/^[a-z0-9][a-z0-9-]{0,199}$/.test(targetSlug)) {
  throw new Error(`不正な記事slugです: ${targetSlug}`);
}

if (offline && applyEligible) {
  throw new Error('--offlineと--apply-eligibleは同時に使用できません。');
}

function serializeFrontmatterScalar(value: string | number | boolean): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function upsertFrontmatterScalars(
  raw: string,
  updates: Record<string, string | number | boolean>,
): string {
  const lineBreak = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/u);
  if (lines[0] !== '---') throw new Error('YAML frontmatterの開始行がありません。');
  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex < 0) throw new Error('YAML frontmatterの終了行がありません。');

  for (const [key, value] of Object.entries(updates)) {
    const keyPattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}:`);
    const existingIndex = lines.slice(1, closingIndex).findIndex((line) => keyPattern.test(line));
    const serialized = `${key}: ${serializeFrontmatterScalar(value)}`;
    if (existingIndex >= 0) {
      lines[existingIndex + 1] = serialized;
    } else {
      lines.splice(closingIndex, 0, serialized);
    }
  }
  return lines.join(lineBreak);
}

async function auditArticle(file: string): Promise<AuditRow | null> {
  const fullPath = path.join(articlesDir, file);
  const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
  const text = `${parsed.data.race_name || ''} ${parsed.data.title || ''} ${parsed.data.target_keyword || ''}`;
  const entity = parsed.data.entity_type === 'grade_race'
    ? findGradeRaceEntity(text) || null
    : findGradeRaceEntity(text);
  if (!entity) return null;

  const raceName = String(parsed.data.race_name || '').trim();
  const raceDate = String(parsed.data.scheduled_race_date || '').trim();
  const base: AuditRow = {
    file,
    slug: file.replace(/\.md$/, ''),
    race_name: raceName,
    scheduled_race_date: raceDate,
    entity_key: entity.entity_key,
    status: 'missing_metadata',
    reason: '',
  };
  if (!raceName || !/^20\d{2}-\d{2}-\d{2}$/.test(raceDate)) {
    return { ...base, reason: 'race_nameまたはscheduled_race_dateが不足' };
  }
  if (offline) {
    return {
      ...base,
      status: 'pending_verification',
      reason: 'メタデータ候補。preview APIを呼ぶオンラインdry-runまで有効化禁止',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/predictions/article-preview/${raceDate}?race_name=${encodeURIComponent(raceName)}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal },
    );
    if (!response.ok) {
      return { ...base, status: 'api_error', reason: `preview API ${response.status}` };
    }
    const preview = await response.json() as Record<string, any>;
    if (preview.status !== 'available') {
      return {
        ...base,
        status: preview.status === 'race_only' ? 'race_only' : 'not_found',
        reason: preview.status === 'race_only' ? 'レースは存在するがAI偏差値データなし' : '一意一致するレースなし',
      };
    }
    const previewRace = preview.race && typeof preview.race === 'object' ? preview.race : {};
    const verifiedRaceId = String(previewRace.id || '').trim();
    const verifiedRaceUrl = String(previewRace.race_url || '').trim();
    const storedRaceId = String(parsed.data.race_id || '').trim();
    const storedRaceUrl = String(parsed.data.race_url || '').trim();
    const seasonYear = String(parsed.data.season_year || '').trim();
    const storedEntityKey = String(parsed.data.race_entity_key || parsed.data.entity_key || '').trim();
    const exactRaceUrl = /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/u.test(verifiedRaceUrl);
    const hasCompletePredictions = Array.isArray(preview.top_predictions) && preview.top_predictions.length > 0;
    const completeMatch =
      verifiedRaceId.length > 0
      && exactRaceUrl
      && String(previewRace.race_date || '') === raceDate
      && /^20\d{2}$/u.test(seasonYear)
      && raceDate.startsWith(`${seasonYear}-`)
      && storedEntityKey === entity.entity_key
      && (!storedRaceId || storedRaceId === verifiedRaceId)
      && (!storedRaceUrl || storedRaceUrl === verifiedRaceUrl)
      && hasCompletePredictions;
    if (!completeMatch) {
      return {
        ...base,
        status: hasCompletePredictions ? 'not_found' : 'race_only',
        reason: '年度・レース名・日付・race ID・URL・予測データの完全一致を確認できない',
      };
    }

    let applied = false;
    if (applyEligible) {
      const updates: Record<string, string | number | boolean> = {
        race_bridge_enabled: false,
        race_bridge_eligible: true,
        race_bridge_eligibility_status: 'eligible',
        race_bridge_verified_at: new Date().toISOString(),
        race_id: verifiedRaceId,
        race_url: verifiedRaceUrl,
        race_entity_key: entity.entity_key,
      };
      const raceNumber = Number(previewRace.race_number || 0);
      if (Number.isInteger(raceNumber) && raceNumber >= 1 && raceNumber <= 12) {
        updates.race_number = raceNumber;
      }
      const venueName = String(previewRace.venue_name || '').trim();
      if (venueName) updates.scheduled_venue = venueName;
      const originalRaw = fs.readFileSync(fullPath, 'utf8');
      const nextRaw = upsertFrontmatterScalars(originalRaw, updates);
      if (nextRaw !== originalRaw) {
        fs.writeFileSync(fullPath, nextRaw, 'utf8');
        applied = true;
      }
    }

    return {
      ...base,
      status: 'eligible',
      reason: applyEligible
        ? applied
          ? '完全一致メタデータだけを更新。本文・記事URLは未変更'
          : '完全一致済み。更新差分なし'
        : '一意一致・予測データあり。--apply-eligibleでメタデータだけを更新可能',
      race_id: verifiedRaceId,
      race_url: verifiedRaceUrl,
      applied,
    };
  } catch (error) {
    return { ...base, status: 'api_error', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const files = fs.readdirSync(articlesDir)
    .filter((file) => file.endsWith('.md'))
    .filter((file) => !targetSlug || file === `${targetSlug}.md`)
    .sort();
  if (targetSlug && files.length !== 1) {
    throw new Error(`対象記事が一意に見つかりません: ${targetSlug}`);
  }
  const rows: AuditRow[] = [];
  for (const file of files) {
    const row = await auditArticle(file);
    if (row) rows.push(row);
  }

  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: offline ? 'offline' : applyEligible ? 'apply_eligible' : 'online_dry_run',
    api_base_url: apiBaseUrl,
    summary,
    applied_count: rows.filter((row) => row.applied).length,
    rows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
