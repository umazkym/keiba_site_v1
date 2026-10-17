import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getArticleArchiveGroupForArticle } from '../../lib/article-archives';
import { resolveArticleCanonicalPath } from '../../lib/article-canonical';
import { getCanonicalArticleSitemapEntries } from '../../lib/article-sitemap';
import { getAllArticles } from '../../lib/articles';

type InventoryArticle = {
  source_slug: string;
  canonical_path: string;
  canonical_url: string;
  title: string;
  entity_type: string;
  entity_key: string;
  season_year: string;
  scheduled_race_date: string;
  published: true;
  self_canonical: true;
  indexable: true;
};

const BASE_URL = 'https://uma-free.com';
const ARTICLES_DIR = path.join(__dirname, '..', '..', 'content', 'articles');

function parseOutputPath(argv: string[]): string {
  const index = argv.indexOf('--output');
  if (index < 0 || !argv[index + 1]) {
    throw new Error('--output に記事在庫JSONの出力先を指定してください。');
  }
  return path.resolve(argv[index + 1]);
}

function isSourceIndexable(slug: string): boolean {
  const sourcePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(sourcePath)) return false;
  const { data } = matter(fs.readFileSync(sourcePath, 'utf8'));
  if (data.noindex === true || data.indexable === false) return false;
  if (typeof data.robots === 'string' && /\bnoindex\b/i.test(data.robots)) return false;
  if (
    data.robots
    && typeof data.robots === 'object'
    && (data.robots as Record<string, unknown>).index === false
  ) {
    return false;
  }
  return true;
}

function resolveInventory(): InventoryArticle[] {
  const articles = getAllArticles();
  const byCanonical = new Map<string, InventoryArticle>();
  const sitemapCanonicals = new Set(
    getCanonicalArticleSitemapEntries().map(entry => entry.path),
  );

  for (const article of articles) {
    const canonicalPath = resolveArticleCanonicalPath(article, article.slug);
    if (!canonicalPath.startsWith('/articles/') || !sitemapCanonicals.has(canonicalPath)) {
      continue;
    }

    // まとめページは canonical にならないので、canonical は必ず記事のURL。そのURLで表示される記事を改稿対象にする
    // （ほかの記事が canonical_path で寄せていても、寄せた側は対象にしない。2026-10-17）。
    const canonicalSlug = canonicalPath.slice('/articles/'.length);
    const source = articles.find(item => item.slug === canonicalSlug) || article;
    const sourceSlug = source.slug;
    if (byCanonical.has(canonicalPath) || !isSourceIndexable(sourceSlug)) continue;
    const archiveGroup = getArticleArchiveGroupForArticle(source);
    const entityType = source.entityType
      || (archiveGroup?.href.startsWith('/articles/grade-races/') ? 'grade_race' : '');
    const next: InventoryArticle = {
      source_slug: sourceSlug,
      canonical_path: canonicalPath,
      canonical_url: `${BASE_URL}${canonicalPath}`,
      title: source.title,
      entity_type: entityType,
      entity_key: source.entityKey || archiveGroup?.key || '',
      season_year: source.seasonYear || '',
      scheduled_race_date: source.scheduledRaceDate || archiveGroup?.scheduledDate || '',
      published: true,
      self_canonical: true,
      indexable: true,
    };
    byCanonical.set(canonicalPath, next);
  }

  return Array.from(byCanonical.values()).sort((left, right) =>
    left.canonical_path.localeCompare(right.canonical_path),
  );
}

export function exportGscArticleInventory(outputPath: string): void {
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    articles: resolveInventory(),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[GSC Inventory] ${payload.articles.length} canonical記事を出力: ${outputPath}`);
}

if (require.main === module) {
  exportGscArticleInventory(parseOutputPath(process.argv.slice(2)));
}
