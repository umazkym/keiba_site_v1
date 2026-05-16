const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(process.cwd(), '..');
const ARTICLES_DIR = path.join(PROJECT_ROOT, 'frontend', 'content', 'articles');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'frontend', 'public');
const ALLOWED_INTERNAL_PATHS = new Set([
  '/',
  '/about',
  '/about-ai',
  '/advertising',
  '/articles',
  '/contact',
  '/faq',
  '/privacy',
  '/search',
  '/sitemap',
  '/terms',
]);

const markdownLinkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const manualRelatedPattern = /^##\s+関連記事\s*$/m;
const relatedPlaceholderPattern = /\[関連記事：.*?]/;

function getArticleFiles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR).filter(file => file.endsWith('.md')).sort();
}

function stripQueryAndHash(href) {
  return href.split(/[?#]/)[0];
}

function normalizeSiteUrl(href) {
  if (!/^https?:\/\//.test(href)) return href;

  try {
    const url = new URL(href);
    if (url.hostname === 'uma-free.com' || url.hostname === 'www.uma-free.com') {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return null;
  } catch {
    return href;
  }
}

function validateHref(file, type, href, slugs, issues) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

  if (href.includes('uma-free.jp')) {
    issues.push({ file, type, value: href, reason: 'canonical domain must be uma-free.com' });
  }

  const normalized = normalizeSiteUrl(href);
  if (normalized === null) return;

  const pathname = stripQueryAndHash(normalized);

  if (pathname.startsWith('/articles/')) {
    const slug = decodeURIComponent(pathname.replace('/articles/', '').replace(/\/$/, ''));
    if (!slugs.has(slug)) {
      issues.push({ file, type, value: href, reason: `missing article slug: ${slug}` });
    }
    return;
  }

  if (pathname.startsWith('/images/')) {
    const imagePath = path.join(PUBLIC_DIR, pathname.replace(/^\//, ''));
    if (!fs.existsSync(imagePath)) {
      issues.push({ file, type, value: href, reason: 'missing image file' });
    }
    return;
  }

  if (pathname.startsWith('/og/')) {
    return;
  }

  if (pathname.startsWith('/races/')) {
    if (pathname === '/races/today' || /^\/races\/\d{4}-\d{2}-\d{2}$/.test(pathname)) {
      return;
    }
    issues.push({ file, type, value: href, reason: 'unexpected race path' });
    return;
  }

  if (pathname.startsWith('/')) {
    if (!ALLOWED_INTERNAL_PATHS.has(pathname)) {
      issues.push({ file, type, value: href, reason: 'unknown internal path' });
    }
    return;
  }

  issues.push({ file, type, value: href, reason: 'relative link is not allowed' });
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;

  const endIndex = raw.indexOf('\n---', 3);
  if (endIndex === -1) return null;

  const frontmatter = raw.slice(3, endIndex).trim();
  const content = raw.slice(endIndex + 4);
  const data = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    data[key] = value;
  }

  return { data, content };
}

function main() {
  const files = getArticleFiles();
  const slugs = new Set(files.map(file => file.replace(/\.md$/, '')));
  const issues = [];

  for (const file of files) {
    const fullPath = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseFrontmatter(raw);

    if (!parsed) {
      issues.push({ file, type: 'frontmatter', value: 'missing or invalid frontmatter', reason: 'frontmatter parse failed' });
      continue;
    }

    if (manualRelatedPattern.test(parsed.content)) {
      issues.push({ file, type: 'content', value: '## 関連記事', reason: 'manual related section is not allowed' });
    }

    if (relatedPlaceholderPattern.test(parsed.content)) {
      issues.push({ file, type: 'content', value: '[関連記事：...]', reason: 'related placeholder is not allowed' });
    }

    for (const field of ['eyecatch', 'og_image']) {
      const value = parsed.data[field];
      if (typeof value === 'string' && value) {
        validateHref(file, `frontmatter.${field}`, value, slugs, issues);
      }
    }

    let match;
    while ((match = markdownLinkPattern.exec(parsed.content)) !== null) {
      const rawLink = match[0];
      const href = match[1].replace(/^<|>$/g, '');
      validateHref(file, rawLink.startsWith('!') ? 'image' : 'link', href, slugs, issues);
    }
  }

  if (issues.length > 0) {
    console.error('[ArticleLinkValidator] Invalid article links found:');
    for (const issue of issues) {
      console.error(`- ${issue.file} [${issue.type}] ${issue.value} (${issue.reason})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[ArticleLinkValidator] OK: ${files.length} articles checked.`);
}

main();
