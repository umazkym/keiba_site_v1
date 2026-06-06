const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const ARTICLES_DIR = path.join(PROJECT_ROOT, 'frontend', 'content', 'articles');
const HISTORY_PATH = path.join(PROJECT_ROOT, 'data', 'posted_history.json');

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function dateFromSlug(slug) {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? `${match[1]}T00:00:00.000Z` : new Date(0).toISOString();
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function articleRecord(file) {
  const slug = file.replace(/\.md$/, '');
  const fullPath = path.join(ARTICLES_DIR, file);
  const parsed = matter(fs.readFileSync(fullPath, 'utf8'));
  const publishedAt =
    parsed.data.article_published_time ||
    parsed.data.date ||
    parsed.data.last_updated ||
    dateFromSlug(slug);

  return {
    id: slug,
    title: parsed.data.title || '',
    target_keyword: parsed.data.target_keyword || parsed.data.title || slug,
    theme_cluster: parsed.data.theme_cluster || '',
    category: parsed.data.category || '',
    keywords: normalizeStringArray(parsed.data.keywords),
    posted_at: publishedAt,
    draft: false,
    published_at: publishedAt,
    slug,
    path: `content/articles/${slug}.md`,
    estimated_monthly_searches: null,
    actual_pv_30d: null,
    ad_revenue_30d: null,
    rewrite_score: null,
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const existing = loadHistory();
  const bySlug = new Map();

  for (const item of existing) {
    if (item && item.slug) {
      bySlug.set(item.slug, item);
    }
  }

  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.md')).sort();
  const restored = files.map((file) => {
    const record = articleRecord(file);
    const previous = bySlug.get(record.slug) || {};
    return {
      ...record,
      ...previous,
      draft: false,
      slug: record.slug,
      path: record.path,
      title: record.title || previous.title || '',
      target_keyword: record.target_keyword || previous.target_keyword || '',
      theme_cluster: record.theme_cluster || previous.theme_cluster || '',
      category: record.category || previous.category || '',
      keywords: record.keywords.length > 0 ? record.keywords : normalizeStringArray(previous.keywords),
      posted_at: previous.posted_at || record.posted_at,
      published_at: previous.published_at || record.published_at,
    };
  });

  if (apply) {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, `${JSON.stringify(restored, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({
    apply,
    previousEntries: existing.length,
    restoredEntries: restored.length,
    addedEntries: Math.max(0, restored.length - existing.length),
  }, null, 2));
}

main();
