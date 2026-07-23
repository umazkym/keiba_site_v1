import matter from 'gray-matter';

const ALLOWED_FRONTMATTER_CHANGES = new Set([
  'title',
  'description',
  'keywords',
  'og_title',
  'og_description',
  'last_updated',
  'draft',
  'operation',
  'rewrite_target_slug',
  'gsc_rewrite_period_end',
  'gsc_rewrite_score',
  'gsc_last_rewritten_at',
  'gsc_last_rewrite_period_end',
]);

const WORKFLOW_ONLY_FRONTMATTER = new Set([
  'operation',
  'rewrite_target_slug',
  'gsc_rewrite_period_end',
  'gsc_rewrite_score',
]);

export type ArticleSectionStructure = {
  lead: string;
  headings: string[];
  bodies: string[];
};

export type RewriteGuardResult = {
  passed: boolean;
  errors: string[];
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function equalValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function assertSafeArticleSlug(slug: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) {
    throw new Error(`不正な記事slugです: ${slug || '(empty)'}`);
  }
}

export function splitArticleSections(content: string): ArticleSectionStructure {
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  const matches = [...content.matchAll(headingPattern)];
  if (matches.length === 0) {
    return {
      lead: content.trim(),
      headings: [],
      bodies: [],
    };
  }

  const lead = content.slice(0, matches[0].index).trim();
  const headings: string[] = [];
  const bodies: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const headingEnd = (match.index || 0) + match[0].length;
    const sectionEnd = matches[index + 1]?.index ?? content.length;
    headings.push(String(match[1] || '').trim());
    bodies.push(content.slice(headingEnd, sectionEnd).trim());
  }
  return { lead, headings, bodies };
}

export function rebuildArticleContent(
  structure: ArticleSectionStructure,
  nextLead: string,
  nextHeadings: string[],
): string {
  if (nextHeadings.length !== structure.headings.length) {
    throw new Error(
      `H2件数を変更できません。expected=${structure.headings.length}, actual=${nextHeadings.length}`,
    );
  }
  const chunks = [nextLead.trim()];
  for (let index = 0; index < nextHeadings.length; index += 1) {
    chunks.push(`## ${nextHeadings[index].trim()}\n\n${structure.bodies[index]}`);
  }
  return `${chunks.filter(Boolean).join('\n\n').trim()}\n`;
}

function collectNumberTokens(text: string): string[] {
  return (text.normalize('NFKC').match(/\d+(?:[.,]\d+)?%?/g) || []).sort();
}

function collectLinkTokens(text: string): string[] {
  const tokens = [
    ...(text.match(/!?\[[^\]]*]\([^)]+\)/g) || []),
    ...(text.match(/^\s*\[[^\]]+]:\s*\S+.*$/gm) || []),
    ...(text.match(/<(?:https?:\/\/|mailto:)[^>]+>/gi) || []),
    ...(text.match(/\b(?:href|src)\s*=\s*["'][^"']+["']/gi) || []),
  ];
  return tokens.sort();
}

function collectTables(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const tables: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      current.push(line.trimEnd());
      continue;
    }
    if (current.length > 0) {
      tables.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length > 0) tables.push(current.join('\n'));
  return tables;
}

function comparableText(data: Record<string, unknown>, content: string): string {
  return [
    String(data.title || ''),
    String(data.description || ''),
    JSON.stringify(data.keywords || []),
    content,
  ].join('\n');
}

export function validateGscRewrite(
  originalMarkdown: string,
  revisedMarkdown: string,
): RewriteGuardResult {
  const errors: string[] = [];
  let original;
  let revised;
  try {
    original = matter(originalMarkdown);
    revised = matter(revisedMarkdown);
  } catch {
    return { passed: false, errors: ['Frontmatterを解析できません。'] };
  }

  const allKeys = new Set([
    ...Object.keys(original.data || {}),
    ...Object.keys(revised.data || {}),
  ]);
  for (const key of allKeys) {
    if (ALLOWED_FRONTMATTER_CHANGES.has(key)) continue;
    if (!equalValue(original.data[key], revised.data[key])) {
      errors.push(`保護対象frontmatterが変更されています: ${key}`);
    }
  }

  const originalStructure = splitArticleSections(original.content);
  const revisedStructure = splitArticleSections(revised.content);
  if (originalStructure.headings.length === 0) {
    errors.push('H2がない記事は導入文と本文の境界を固定できないためGSC改稿できません。');
  }
  if (originalStructure.headings.length !== revisedStructure.headings.length) {
    errors.push(
      `H2件数が変更されています: ${originalStructure.headings.length} -> ${revisedStructure.headings.length}`,
    );
  }
  if (!equalValue(originalStructure.bodies, revisedStructure.bodies)) {
    errors.push('H2配下の本文段落が変更されています。');
  }
  if (!equalValue(collectTables(original.content), collectTables(revised.content))) {
    errors.push('Markdownテーブルが変更されています。');
  }

  const originalNumbers = collectNumberTokens(
    comparableText(original.data, original.content),
  );
  const revisedNumbers = collectNumberTokens(
    comparableText(revised.data, revised.content),
  );
  if (!equalValue(originalNumbers, revisedNumbers)) {
    errors.push('記事内の数値集合が変更されています。');
  }

  const originalLinks = collectLinkTokens(original.content);
  const revisedLinks = collectLinkTokens(revised.content);
  if (!equalValue(originalLinks, revisedLinks)) {
    errors.push('記事内のリンクが変更されています。');
  }

  return { passed: errors.length === 0, errors };
}

export function finalizeGscRewriteFrontmatter(
  originalData: Record<string, unknown>,
  revisedData: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...originalData,
    title: revisedData.title,
    description: revisedData.description,
    keywords: revisedData.keywords,
    og_title: revisedData.title,
    og_description: revisedData.description,
    last_updated: nowIso,
    gsc_last_rewritten_at: nowIso,
    gsc_last_rewrite_period_end: revisedData.gsc_rewrite_period_end || '',
    draft: false,
  };
  for (const key of WORKFLOW_ONLY_FRONTMATTER) {
    delete next[key];
  }
  return next;
}
