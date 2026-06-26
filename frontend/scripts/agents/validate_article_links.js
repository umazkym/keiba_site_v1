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
  '/courses',
  '/faq',
  '/grade-races',
  '/jockeys',
  '/keiba-data',
  '/keiba-data/horse-weight',
  '/keiba-data/site-selection',
  '/keiba-data/track-condition',
  '/privacy',
  '/results/accuracy',
  '/search',
  '/sitemap',
  '/terms',
]);

const markdownLinkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const manualRelatedPattern = /^##\s+関連記事\s*$/m;
const relatedPlaceholderPattern = /\[関連記事：.*?]/;
const prohibitedTonePatterns = [
  { pattern: /投資|資金配分|期待値/, reason: 'financial or profit-like phrasing should be avoided' },
  { pattern: /絶対|圧倒|最強|完全攻略|必勝|消去対象/, reason: 'overconfident betting phrasing should be avoided' },
  { pattern: /断言|論証|解明|無条件/, reason: 'mechanical or overly assertive phrasing should be avoided' },
  { pattern: /稼げ|儲か|爆益|買えば|勝てる/, reason: 'guaranteed-return style phrasing should be avoided' },
  { pattern: /封殺|叩き出|爆発力/, reason: 'sensational phrasing should be avoided' },
];
const awkwardPhrasePatterns = [
  { pattern: /大きくな|大きくであり|大きなな|目立つな|有力なの/, reason: 'awkward replacement artifact' },
  { pattern: /するする|だだ|できるだけ抑えたし|大きく上回るして/, reason: 'awkward replacement artifact' },
];

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

  if (
    pathname === '/articles/grade-races' ||
    pathname === '/articles/races' ||
    pathname === '/articles/jockeys' ||
    pathname === '/articles/courses' ||
    pathname.startsWith('/articles/grade-races/') ||
    pathname.startsWith('/articles/races/') ||
    pathname.startsWith('/articles/jockeys/') ||
    pathname.startsWith('/articles/courses/')
  ) {
    return;
  }

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
    if (
      pathname === '/races/today' ||
      /^\/races\/\d{4}-\d{2}-\d{2}$/.test(pathname) ||
      /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/.test(pathname)
    ) {
      return;
    }
    issues.push({ file, type, value: href, reason: 'unexpected race path' });
    return;
  }

  if (pathname.startsWith('/courses/') || pathname.startsWith('/jockeys/') || pathname.startsWith('/grade-races/')) {
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

function validateTone(file, raw, issues) {
  for (const { pattern, reason } of [...prohibitedTonePatterns, ...awkwardPhrasePatterns]) {
    const match = raw.match(pattern);
    if (match) {
      issues.push({ file, type: 'tone', value: match[0], reason });
    }
  }
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

    validateTone(file, raw, issues);

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
