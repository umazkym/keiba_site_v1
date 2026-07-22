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
};

const articlesDir = path.join(process.cwd(), 'content', 'articles');
const apiBaseUrl = getApiBaseUrl();
const offline = process.argv.includes('--offline');

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

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/predictions/article-preview/${raceDate}?race_name=${encodeURIComponent(raceName)}`,
      { headers: { Accept: 'application/json' } },
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
    return {
      ...base,
      status: 'eligible',
      reason: '一意一致・予測データあり。既存URLは変更せず明示対象化可能',
      race_id: String(preview.race?.id || ''),
      race_url: String(preview.race?.race_url || ''),
    };
  } catch (error) {
    return { ...base, status: 'api_error', reason: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const files = fs.readdirSync(articlesDir).filter((file) => file.endsWith('.md')).sort();
  const rows: AuditRow[] = [];
  for (const file of files) {
    const row = await auditArticle(file);
    if (row) rows.push(row);
  }

  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), mode: offline ? 'offline' : 'online', api_base_url: apiBaseUrl, summary, rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
