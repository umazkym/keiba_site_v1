import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { verifyLiveGradeRacePublication } from './grade_race_publication_verification';

const projectRoot = path.join(__dirname, '..', '..', '..');
const articlesDir = path.join(projectRoot, 'frontend', 'content', 'articles');
const outputPath = process.env.GRADE_RACE_PUBLICATION_VERIFICATION_PATH
  || path.join(projectRoot, 'data', 'grade-race-publication-verification.json');
const targetsPath = process.env.GRADE_RACE_PUBLICATION_TARGETS_PATH
  || path.join(projectRoot, 'data', 'grade-race-publication-targets.json');
const siteUrl = (process.env.UMA_FREE_SITE_URL || 'https://uma-free.com').replace(/\/+$/, '');

function loadPublishedGradeRaceSlugs(): string[] {
  if (!fs.existsSync(targetsPath)) {
    throw new Error(`[PublicationVerification] 公開確認対象manifestがありません: ${targetsPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(targetsPath, 'utf-8')) as { slugs?: unknown };
  if (!Array.isArray(manifest.slugs)) {
    throw new Error('[PublicationVerification] 公開確認対象manifestのslugsが配列ではありません');
  }
  const slugs = manifest.slugs.map(value => String(value).trim());
  if (slugs.some(slug => !/^[a-z0-9][a-z0-9-]*$/i.test(slug))) {
    throw new Error('[PublicationVerification] 公開確認対象manifestに不正なslugがあります');
  }
  return Array.from(new Set(slugs));
}

function writeVerificationLedger(rows: Array<Record<string, unknown>>, fatalError?: string): void {
  const payload = {
    schema_version: 'grade-race-publication-verification.v1',
    site_url: siteUrl,
    rows,
    ...(fatalError ? { fatal_error: fatalError } : {}),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

async function main(): Promise<void> {
  const rows: Array<Record<string, unknown>> = [];
  const targetSlugs = loadPublishedGradeRaceSlugs();
  for (const slug of targetSlugs) {
    const file = `${slug}.md`;
    const articlePath = path.join(articlesDir, file);
    if (!fs.existsSync(articlePath)) {
      rows.push({
        slug,
        checked_at: new Date().toISOString(),
        status: 'unverified',
        reason: ['published_article_file_missing'],
      });
      continue;
    }
    const parsed = matter(fs.readFileSync(articlePath, 'utf-8'));
    if (parsed.data.draft === true || parsed.data.entity_type !== 'grade_race') {
      rows.push({
        slug,
        entity_key: String(parsed.data.entity_key || ''),
        checked_at: new Date().toISOString(),
        status: 'unverified',
        reason: ['target_is_not_a_published_grade_race_article'],
      });
      continue;
    }
    const seasonYear = String(parsed.data.season_year || '').trim();
    // 実際に配信される記事URLを確認する。entity_pathは年度をまたぐハブになり得るため使わない。
    const canonicalPath = `/articles/${path.basename(file, '.md')}`;
    const raceName = String(parsed.data.race_name || '').trim();
    if (!/^20\d{2}$/.test(seasonYear) || !raceName || !canonicalPath.startsWith('/')) {
      rows.push({
        slug: path.basename(file, '.md'), entity_key: String(parsed.data.entity_key || ''), season_year: seasonYear,
        scheduled_race_date: String(parsed.data.scheduled_race_date || ''), canonical_path: canonicalPath,
        checked_at: new Date().toISOString(), status: 'unverified', reason: ['invalid_publication_metadata'],
      });
      continue;
    }
    const verification = await verifyLiveGradeRacePublication(`${siteUrl}${canonicalPath}`, canonicalPath, seasonYear, raceName);
    rows.push({
      slug: path.basename(file, '.md'),
      entity_key: String(parsed.data.entity_key || ''),
      season_year: seasonYear,
      scheduled_race_date: String(parsed.data.scheduled_race_date || ''),
      canonical_path: canonicalPath,
      checked_at: new Date().toISOString(),
      ...verification,
    });
  }
  writeVerificationLedger(rows);
  const unverified = rows.filter(row => row.status !== 'verified').length;
  console.log(`[PublicationVerification] verified=${rows.length - unverified} unverified=${unverified} output=${outputPath}`);
  if (rows.length === 0 || unverified > 0) process.exitCode = 1;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  writeVerificationLedger([], message);
  console.error(error);
  process.exitCode = 1;
});
