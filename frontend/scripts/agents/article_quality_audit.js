const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.basename(process.cwd()) === 'frontend'
  ? process.cwd()
  : path.join(process.cwd(), 'frontend');
const ARTICLES_DIR = path.join(FRONTEND_ROOT, 'content', 'articles');

const RULES = {
  minBodyChars: Number.parseInt(process.env.ARTICLE_MIN_BODY_CHARS || '3000', 10) || 3000,
  titleMin: 30,
  titleMax: 50,
  descriptionMin: 120,
  descriptionMax: 160,
  requiredFrontmatter: ['title', 'description', 'keywords', 'category'],
  generatedRequiredFrontmatter: ['target_keyword', 'theme_cluster'],
  decorativeEmojiPattern: /[✅❌📊🔄⏸️🔥✨🎯💰🚀]/,
  bannedPatterns: [
    { pattern: /いかがでしたか|ぜひ参考にしてください|最後まで読んでいただき/, reason: 'template-like closing phrase' },
    { pattern: /必勝|絶対に当たる|絶対的|絶対条件|完全攻略|最強|圧倒的|狙い撃つ/, reason: 'overconfident betting phrase' },
    { pattern: /投資|資金配分|期待値|儲か|稼げ|爆益|勝てる/, reason: 'profit-like or financial phrase' },
    { pattern: /結論から言うと|興味深いことに|と言えるでしょう/, reason: 'AI-like phrase' },
  ],
};

function getArticleFiles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR)
    .filter(file => file.endsWith('.md'))
    .sort();
}

function stripMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[[^\]]*]\([^)]*\)/g, match => match.replace(/\([^)]*\)/g, ''))
    .replace(/[#>*_`|[\](){}:~-]/g, '')
    .replace(/\s+/g, '');
}

function collectMarkdownLinks(content) {
  const links = [];
  const pattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    links.push(match[1].replace(/^<|>$/g, ''));
  }
  return links;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;

  const endMatch = raw.match(/\r?\n---\r?\n/);
  if (!endMatch || typeof endMatch.index !== 'number') return null;

  const frontmatter = raw.slice(3, endMatch.index).trim();
  const content = raw.slice(endMatch.index + endMatch[0].length);
  const data = {};
  const lines = frontmatter.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (value === '[]') {
      data[key] = [];
      continue;
    }

    if (value === '>' || value === '>-' || value === '|' || value === '|-') {
      const parts = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        i++;
        parts.push(lines[i].trim());
      }
      data[key] = parts.join(value.startsWith('|') ? '\n' : ' ').trim();
      continue;
    }

    if (value === '') {
      const list = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        i++;
        list.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
      }
      data[key] = list.length > 0 ? list : '';
      continue;
    }

    if (/^\[.*]$/.test(value)) {
      data[key] = value
        .replace(/^\[|]$/g, '')
        .split(',')
        .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    data[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return { data, content };
}

function isExternalHref(href) {
  if (!/^https?:\/\//.test(href)) return false;
  try {
    const url = new URL(href);
    return url.hostname !== 'uma-free.com' && url.hostname !== 'www.uma-free.com';
  } catch {
    return false;
  }
}

function parseMarkdownTables(content) {
  const tables = [];
  let current = [];

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*\|.+\|\s*$/.test(line)) {
      current.push(line.trim());
      continue;
    }
    if (current.length >= 3) tables.push(current);
    current = [];
  }

  if (current.length >= 3) tables.push(current);
  return tables;
}

function parseTableRows(tableLines) {
  return tableLines
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(cells => cells.length > 1)
    .filter(cells => !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
}

function toPercentNumber(value) {
  const match = value.replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : null;
}

function isStrictlyMonotonic(values) {
  if (values.length < 5) return false;
  let increasing = true;
  let decreasing = true;
  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) increasing = false;
    if (!(values[i] < values[i - 1])) decreasing = false;
  }
  return increasing || decreasing;
}

function detectSyntheticTableRisk(content) {
  const risks = [];
  const tables = parseMarkdownTables(content);

  for (const [index, table] of tables.entries()) {
    const rows = parseTableRows(table);
    if (rows.length < 6) continue;

    const width = Math.max(...rows.map(row => row.length));
    let monotonicPercentColumns = 0;

    for (let column = 0; column < width; column++) {
      const values = rows
        .slice(1)
        .map(row => toPercentNumber(row[column] || ''))
        .filter(value => value !== null);

      if (isStrictlyMonotonic(values)) {
        monotonicPercentColumns++;
      }
    }

    if (monotonicPercentColumns >= 2) {
      risks.push(`table ${index + 1}: ${monotonicPercentColumns} percentage columns are strictly monotonic`);
    }
  }

  return risks;
}

function addIssue(issues, file, severity, type, message) {
  issues.push({ file, severity, type, message });
}

function auditArticle(file) {
  const fullPath = path.join(ARTICLES_DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  const issues = [];
  const parsed = parseFrontmatter(raw);

  if (!parsed) {
    addIssue(issues, file, 'critical', 'frontmatter', 'frontmatter parse failed');
    return issues;
  }

  const data = parsed.data || {};
  const content = parsed.content || '';
  const bodyChars = stripMarkdown(content).length;
  const title = String(data.title || '');
  const description = String(data.description || '');
  const themeCluster = String(data.theme_cluster || '');

  for (const key of RULES.requiredFrontmatter) {
    if (!data[key]) addIssue(issues, file, 'warning', 'frontmatter', `missing ${key}`);
  }

  if (themeCluster) {
    for (const key of RULES.generatedRequiredFrontmatter) {
      if (!data[key]) addIssue(issues, file, 'warning', 'frontmatter', `generated article missing ${key}`);
    }
  }

  if (!data.eyecatch && !data.og_image) {
    addIssue(issues, file, 'warning', 'media', 'missing eyecatch or og_image');
  }

  if (title.length < RULES.titleMin || title.length > RULES.titleMax) {
    addIssue(issues, file, 'warning', 'title', `title length ${title.length}, expected ${RULES.titleMin}-${RULES.titleMax}`);
  }

  if (description.length < RULES.descriptionMin || description.length > RULES.descriptionMax) {
    addIssue(issues, file, 'warning', 'description', `description length ${description.length}, expected ${RULES.descriptionMin}-${RULES.descriptionMax}`);
  }

  if (description && !/[。.!?！？]$/.test(description.trim())) {
    addIssue(issues, file, 'warning', 'description', 'description does not end as a complete sentence');
  }

  if (bodyChars < RULES.minBodyChars) {
    addIssue(issues, file, 'warning', 'body_length', `body length ${bodyChars}, expected at least ${RULES.minBodyChars}`);
  }

  if (!/^\s*\|.+\|\s*$/m.test(content)) {
    addIssue(issues, file, 'warning', 'data_format', 'missing markdown data table');
  }

  if (!content.includes('/races/today') && !/\/races\/\d{4}-\d{2}-\d{2}/.test(content)) {
    addIssue(issues, file, 'warning', 'cta', 'missing race page CTA');
  }

  if (!/^##\s+このコースの買い目ポイント\s*$/m.test(content)) {
    addIssue(issues, file, 'warning', 'buying_points', 'missing required buying-point section');
  }

  if (themeCluster === 'grade_race_preview' && !data.update_stage) {
    addIssue(issues, file, 'warning', 'seasonal_update', 'grade race preview missing update_stage');
  }

  if (RULES.decorativeEmojiPattern.test(raw)) {
    addIssue(issues, file, 'critical', 'tone', 'decorative emoji found');
  }

  for (const { pattern, reason } of RULES.bannedPatterns) {
    const match = raw.match(pattern);
    if (match) {
      addIssue(issues, file, 'critical', 'tone', `${reason}: ${match[0]}`);
    }
  }

  for (const href of collectMarkdownLinks(content)) {
    if (href.includes('uma-free.jp')) {
      addIssue(issues, file, 'critical', 'link', `old domain link found: ${href}`);
    }
    if (isExternalHref(href)) {
      addIssue(issues, file, 'critical', 'link', `external link in generated article body: ${href}`);
    }
  }

  for (const risk of detectSyntheticTableRisk(content)) {
    addIssue(issues, file, 'critical', 'evidence_risk', `numeric table may be synthetic or over-smoothed: ${risk}`);
  }

  return issues;
}

function summarize(issues, files) {
  const summary = {
    checked_articles: files.length,
    total_issues: issues.length,
    critical: issues.filter(issue => issue.severity === 'critical').length,
    warning: issues.filter(issue => issue.severity === 'warning').length,
    by_type: {},
  };

  for (const issue of issues) {
    summary.by_type[issue.type] = (summary.by_type[issue.type] || 0) + 1;
  }

  return summary;
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const failOnCritical = process.argv.includes('--fail-on-critical') || process.env.ARTICLE_AUDIT_FAIL_ON_CRITICAL === 'true';
  const files = getArticleFiles();
  const issues = files.flatMap(auditArticle);
  const summary = summarize(issues, files);

  if (jsonMode) {
    console.log(JSON.stringify({ summary, issues }, null, 2));
  } else {
    console.log(`[ArticleQualityAudit] ${summary.checked_articles} articles checked.`);
    console.log(`[ArticleQualityAudit] Issues: total=${summary.total_issues}, critical=${summary.critical}, warning=${summary.warning}`);
    console.log(`[ArticleQualityAudit] By type: ${JSON.stringify(summary.by_type)}`);

    for (const issue of issues.slice(0, 80)) {
      console.log(`- ${issue.severity.toUpperCase()} ${issue.file} [${issue.type}] ${issue.message}`);
    }

    if (issues.length > 80) {
      console.log(`[ArticleQualityAudit] ...and ${issues.length - 80} more issues. Use --json for full output.`);
    }
  }

  if (failOnCritical && summary.critical > 0) {
    process.exitCode = 1;
  }
}

main();
