import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { WriteOrder } from './agent_writer';

type ArticleType = 'data' | 'grade_race_preview' | 'beginner' | 'guide' | 'rewrite';
type FlowStatus = 'APPROVED' | 'REJECTED';
type FlowSeverity = 'info' | 'warning' | 'critical';

type FlowIssue = {
  node: string;
  severity: FlowSeverity;
  message: string;
};

type RelatedArticle = {
  slug: string;
  title: string;
  target_keyword: string;
  theme_cluster: string;
  score: number;
};

type EvidencePack = {
  hasDataMetrics: boolean;
  allowedTokens: string[];
  metricRows: number;
  source: string;
};

type ResearchDecision = {
  needsExternalResearch: boolean;
  reason: string;
  tavilyEnabled: boolean;
};

type ArticleFlowState = {
  target_keyword: string;
  theme_cluster: string;
  article_type: ArticleType;
  season_label: string;
  related_articles: RelatedArticle[];
  evidence_pack: EvidencePack;
  research_decision: ResearchDecision;
  issues: FlowIssue[];
};

export type ArticleFlowResult = {
  status: FlowStatus;
  state: ArticleFlowState;
  log: string;
};

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const ARTICLES_DIR = path.join(PROJECT_ROOT, 'frontend', 'content', 'articles');

const DATA_THEME_CLUSTERS = new Set([
  'asset',
  'seasonal',
  'waku_data',
  'jockey_data',
  'popularity_data',
  'running_style_data',
]);

function addIssue(state: ArticleFlowState, node: string, severity: FlowSeverity, message: string): void {
  state.issues.push({ node, severity, message });
}

function classifyArticleType(order: WriteOrder): ArticleType {
  const cluster = order.theme_cluster || '';
  if (cluster === 'grade_race_preview') return 'grade_race_preview';
  if (/beginner|初心者|guide|manual/i.test(cluster) || /始め方|買い方|用語|ガイド|マニュアル/.test(order.target_keyword)) {
    return 'beginner';
  }
  if (/rewrite|リライト/i.test(cluster)) return 'rewrite';
  if (DATA_THEME_CLUSTERS.has(cluster)) return 'data';
  return 'guide';
}

function getSeasonLabel(date = new Date()): string {
  const month = date.getMonth() + 1;
  if (month <= 2) return 'winter_dirt_and_february_stakes';
  if (month <= 4) return 'spring_classic';
  if (month <= 6) return 'tokyo_g1_and_takarazuka';
  if (month <= 8) return 'summer_local';
  if (month <= 10) return 'autumn_g1';
  return 'year_end_g1';
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[｜|【】「」『』（）()[\],.、。:：/]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2);
}

function safeMatter(raw: string): { data: Record<string, any>; content: string } | null {
  try {
    const parsed = matter(raw);
    return { data: parsed.data || {}, content: parsed.content || '' };
  } catch {
    return null;
  }
}

function collectRelatedArticles(order: WriteOrder): RelatedArticle[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];

  const queryTokens = new Set([
    ...tokenize(order.target_keyword || ''),
    ...tokenize(order.theme_cluster || ''),
  ]);

  return fs.readdirSync(ARTICLES_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
      const parsed = safeMatter(raw);
      if (!parsed) return null;

      const title = String(parsed.data.title || '');
      const targetKeyword = String(parsed.data.target_keyword || '');
      const themeCluster = String(parsed.data.theme_cluster || '');
      const articleTokens = tokenize(`${title} ${targetKeyword} ${themeCluster}`);
      const score = articleTokens.reduce((sum, token) => sum + (queryTokens.has(token) ? 1 : 0), 0);

      if (score === 0 && themeCluster !== order.theme_cluster) return null;

      return {
        slug,
        title,
        target_keyword: targetKeyword,
        theme_cluster: themeCluster,
        score: score + (themeCluster === order.theme_cluster ? 1 : 0),
      };
    })
    .filter((item): item is RelatedArticle => Boolean(item))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 5);
}

function normalizeEvidenceToken(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.replace(/\s+/g, '');
}

function collectEvidenceTokens(value: unknown, tokens: Set<string>): void {
  const normalized = normalizeEvidenceToken(value);
  if (normalized) {
    tokens.add(normalized);
    const numericParts = normalized.match(/\d+(?:\.\d+)?(?:%|回|頭|レース|R|kg|m|年|月|日)?/g) || [];
    for (const part of numericParts) tokens.add(part);
  }

  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceTokens(item, tokens);
    return;
  }

  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectEvidenceTokens(item, tokens);
    }
  }
}

function countMetricRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + (typeof item === 'object' && item !== null ? 1 : countMetricRows(item)), 0);
  }
  if (typeof value !== 'object' || value === null) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>(
    (sum, item) => sum + countMetricRows(item),
    0
  );
}

function buildEvidencePack(order: WriteOrder): EvidencePack {
  const tokens = new Set<string>();
  collectEvidenceTokens(order.target_keyword, tokens);
  collectEvidenceTokens(order.theme_cluster, tokens);
  collectEvidenceTokens(order.reference_data, tokens);

  const keyMetrics = order.reference_data?.key_metrics;
  const courseStats = (order.reference_data as Record<string, unknown> | undefined)?.course_stats;
  const predictions = (order.reference_data as Record<string, unknown> | undefined)?.predictions;
  const metricRows = countMetricRows(keyMetrics) + countMetricRows(courseStats) + countMetricRows(predictions);

  return {
    hasDataMetrics: metricRows > 0 || Boolean(order.reference_data?.race_name || order.reference_data?.race_date),
    allowedTokens: Array.from(tokens).sort(),
    metricRows,
    source: String(order.reference_data?.source || 'unknown'),
  };
}

function decideResearch(order: WriteOrder, articleType: ArticleType): ResearchDecision {
  const needsExternalResearch =
    articleType === 'grade_race_preview' ||
    articleType === 'beginner' ||
    articleType === 'guide' ||
    Boolean((order.reference_data as Record<string, unknown> | undefined)?.external_research_required);

  if (!needsExternalResearch) {
    return {
      needsExternalResearch: false,
      reason: 'DB evidence is sufficient for this article type.',
      tavilyEnabled: false,
    };
  }

  return {
    needsExternalResearch: true,
    reason: 'External context may help, but it must not be used as metric evidence.',
    tavilyEnabled: Boolean(process.env.TAVILY_API_KEY),
  };
}

function createInitialState(order: WriteOrder): ArticleFlowState {
  const articleType = classifyArticleType(order);
  const evidencePack = buildEvidencePack(order);

  return {
    target_keyword: order.target_keyword,
    theme_cluster: order.theme_cluster,
    article_type: articleType,
    season_label: getSeasonLabel(),
    related_articles: collectRelatedArticles(order),
    evidence_pack: evidencePack,
    research_decision: decideResearch(order, articleType),
    issues: [],
  };
}

function validatePreDraftState(order: WriteOrder, state: ArticleFlowState): void {
  if (!order.target_keyword) {
    addIssue(state, 'Demand Planner', 'critical', 'target_keyword is required.');
  }
  if (!order.theme_cluster) {
    addIssue(state, 'Demand Planner', 'critical', 'theme_cluster is required.');
  }
  if (!order.reference_data) {
    addIssue(state, 'Evidence Builder', 'critical', 'reference_data is required.');
  }

  if (state.article_type === 'data' && state.evidence_pack.metricRows === 0) {
    addIssue(state, 'Evidence Builder', 'critical', 'data article requires key_metrics, course_stats, or predictions.');
  }

  if (state.article_type === 'grade_race_preview') {
    const ref = order.reference_data as Record<string, unknown>;
    if (!ref.race_name || !ref.race_date || !ref.venue) {
      addIssue(state, 'Evidence Builder', 'critical', 'grade race preview requires race_name, race_date, and venue.');
    }
  }

  if (state.research_decision.needsExternalResearch && !state.research_decision.tavilyEnabled) {
    addIssue(
      state,
      'Research Decision',
      'warning',
      'Tavily is not configured. Continue with DB/internal evidence only.'
    );
  }
}

function parseMarkdownTables(content: string): string[][] {
  const tables: string[][] = [];
  let current: string[] = [];

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

function parseTableRows(tableLines: string[]): string[][] {
  return tableLines
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(cells => cells.length > 1)
    .filter(cells => !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
}

function toPercentNumber(value: string): number | null {
  const match = value.replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : null;
}

function isStrictlyMonotonic(values: number[]): boolean {
  if (values.length < 5) return false;
  let increasing = true;
  let decreasing = true;

  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) increasing = false;
    if (!(values[i] < values[i - 1])) decreasing = false;
  }

  return increasing || decreasing;
}

function detectSyntheticTableRisk(content: string): string[] {
  const risks: string[] = [];

  parseMarkdownTables(content).forEach((table, index) => {
    const rows = parseTableRows(table);
    if (rows.length < 6) return;

    const width = Math.max(...rows.map(row => row.length));
    let monotonicPercentColumns = 0;

    for (let column = 0; column < width; column++) {
      const values = rows
        .slice(1)
        .map(row => toPercentNumber(row[column] || ''))
        .filter((value): value is number => value !== null);

      if (isStrictlyMonotonic(values)) monotonicPercentColumns++;
    }

    if (monotonicPercentColumns >= 2) {
      risks.push(`table ${index + 1}: ${monotonicPercentColumns} percentage columns are strictly monotonic`);
    }
  });

  return risks;
}

function collectExternalLinks(content: string): string[] {
  const links: string[] = [];
  const pattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^https?:\/\//.test(href) && !/^https?:\/\/(www\.)?uma-free\.com\//.test(href)) {
      links.push(href);
    }
  }

  return links;
}

function collectMetricTokens(content: string): string[] {
  const matches = content.match(/\d+(?:\.\d+)?(?:%|回|頭|レース|R|kg|m|年|月|日)/g) || [];
  return Array.from(new Set(matches.map(token => token.replace(/\s+/g, ''))));
}

function validateDraftContent(order: WriteOrder, state: ArticleFlowState, content: string): void {
  for (const risk of detectSyntheticTableRisk(content)) {
    addIssue(state, 'Fact Checker', 'critical', `numeric table may be synthetic: ${risk}`);
  }

  for (const href of collectExternalLinks(content)) {
    addIssue(state, 'Research Filter', 'critical', `external link is not allowed in generated article body: ${href}`);
  }

  const allowed = new Set(state.evidence_pack.allowedTokens);
  const unknownMetricTokens = collectMetricTokens(content)
    .filter(token => !allowed.has(token))
    .filter(token => !order.target_keyword.includes(token));

  if (unknownMetricTokens.length > 0) {
    addIssue(
      state,
      'Fact Checker',
      'warning',
      `metric-like tokens were not found in Evidence Pack: ${unknownMetricTokens.slice(0, 12).join(', ')}`
    );
  }
}

function buildLog(prefix: string, state: ArticleFlowState): string {
  const issueLines = state.issues.length === 0
    ? ['  - no issues']
    : state.issues.map(issue => `  - ${issue.severity.toUpperCase()} [${issue.node}] ${issue.message}`);

  return [
    `[ArticleFlow] ${prefix}`,
    `  target_keyword: ${state.target_keyword}`,
    `  article_type: ${state.article_type}`,
    `  season_label: ${state.season_label}`,
    `  evidence_rows: ${state.evidence_pack.metricRows}`,
    `  related_articles: ${state.related_articles.length}`,
    `  external_research: ${state.research_decision.needsExternalResearch ? 'needed' : 'not_needed'} / tavily=${state.research_decision.tavilyEnabled ? 'enabled' : 'disabled'}`,
    ...issueLines,
  ].join('\n');
}

function statusFromIssues(state: ArticleFlowState): FlowStatus {
  return state.issues.some(issue => issue.severity === 'critical') ? 'REJECTED' : 'APPROVED';
}

export function runPreDraftArticleFlow(order: WriteOrder): ArticleFlowResult {
  const state = createInitialState(order);
  validatePreDraftState(order, state);

  const status = statusFromIssues(state);
  return {
    status,
    state,
    log: buildLog(`pre-draft ${status}`, state),
  };
}

export function runPostWriterArticleFlow(order: WriteOrder, draftPath: string): ArticleFlowResult {
  const state = createInitialState(order);
  const raw = fs.readFileSync(draftPath, 'utf-8');
  const parsed = safeMatter(raw);
  validatePreDraftState(order, state);
  validateDraftContent(order, state, parsed?.content || raw);

  const status = statusFromIssues(state);
  return {
    status,
    state,
    log: buildLog(`post-writer ${status}`, state),
  };
}
