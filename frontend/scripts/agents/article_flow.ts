import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { buildWriterFacingOrder, WriteOrder } from './agent_writer';
import { checkSourceIndependence } from './seo_checker';

type ArticleType = 'data' | 'grade_race_preview' | 'race_update' | 'beginner' | 'guide' | 'rewrite';
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

export type ResearchSource = {
  source_url: string;
  source_name: string;
  source_type: 'official' | 'trusted_media' | 'reference' | 'other';
  fetched_at: string;
  title: string;
  allowed_claims: string[];
};

type ArticleFlowState = {
  target_keyword: string;
  theme_cluster: string;
  article_type: ArticleType;
  season_label: string;
  related_articles: RelatedArticle[];
  evidence_pack: EvidencePack;
  research_decision: ResearchDecision;
  research_sources: ResearchSource[];
  tavily_usage_credits: number;
  issues: FlowIssue[];
};

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilySearchResponse = {
  query?: string;
  results?: TavilySearchResult[];
  usage?: { credits?: number };
  request_id?: string;
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

function isDrawConfirmedReference(ref: Record<string, unknown>): boolean {
  const drawStatus = String(ref.draw_status || '').toLowerCase();
  return (
    drawStatus === 'confirmed' ||
    ref.draw_confirmed === true ||
    String(ref.search_angle_label || '') === '枠順発表後'
  );
}

function hasConfirmedDrawClaim(text: string): boolean {
  return /枠順確定|枠順が確定|枠順発表後|枠順が発表された|枠順を発表|馬番確定|馬番が確定|出馬表発表後|出馬表が発表された|出馬表が公開された|出馬表を発表|draw_confirmed/i.test(text);
}

function normalizeDateOnly(value: unknown): string | null {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function currentJstDateString(): string {
  const configuredNow = normalizeDateOnly(process.env.KEIBA_NEWS_NOW);
  if (configuredNow) return configuredNow;

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function daysBetweenDateStrings(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function expectedRacePhase(daysToRace: number): string {
  if (daysToRace < 0) return 'post_race';
  if (daysToRace === 0) return 'race_day';
  if (daysToRace <= 2) return 'final_48h';
  if (daysToRace <= 5) return 'race_week';
  if (daysToRace <= 10) return 'field_building';
  return 'early_preview';
}

function validateRaceTimingReference(ref: Record<string, unknown>, state: ArticleFlowState): void {
  const scheduledRaceDate = normalizeDateOnly(ref.scheduled_race_date);
  if (!scheduledRaceDate) return;

  const daysToRace = daysBetweenDateStrings(currentJstDateString(), scheduledRaceDate);
  const searchIntent = String(ref.search_intent || '');
  const racePhase = String(ref.race_phase || '');
  const resultConfirmed = ref.result_confirmed === true;
  const expectedPhase = searchIntent === 'result_review' && resultConfirmed
    ? 'post_race'
    : expectedRacePhase(daysToRace);

  if (daysToRace >= 0 && searchIntent === 'result_review' && !resultConfirmed) {
    addIssue(
      state,
      'Demand Planner',
      'critical',
      `開催前のレースを結果回顧として生成できません。scheduled_race_date=${scheduledRaceDate}, days_to_race=${daysToRace}`
    );
  }
  if (racePhase && racePhase !== expectedPhase) {
    addIssue(
      state,
      'Demand Planner',
      'critical',
      `開催日とrace_phaseが不整合です。scheduled_race_date=${scheduledRaceDate}, expected=${expectedPhase}, actual=${racePhase}`
    );
  }
}

function validateDraftMetadata(
  order: WriteOrder,
  state: ArticleFlowState,
  draftData: Record<string, any>,
): void {
  const ref = order.reference_data as Record<string, unknown>;
  for (const key of ['search_intent', 'race_phase', 'scheduled_race_date', 'schedule_milestone'] as const) {
    const expected = String(ref[key] || '');
    const actual = String(draftData[key] || '');
    if (expected && actual !== expected) {
      addIssue(
        state,
        'Fact Checker',
        'critical',
        `frontmatter.${key}がWriteOrderと不一致です。expected=${expected}, actual=${actual || '(empty)'}`
      );
    }
  }

  for (const key of [
    'entity_type',
    'entity_key',
    'entity_key_source',
    'race_identity_version',
    'race_circuit',
    'entity_archive_slug',
    'season_year',
    'entity_path',
    'canonical_path',
    'content_target',
  ] as const) {
    const orderValue = (order as unknown as Record<string, unknown>)[key];
    const expected = String(orderValue || ref[key] || '').trim();
    if (!expected) continue;

    const actual = String(draftData[key] || '').trim();
    if (actual !== expected) {
      addIssue(
        state,
        'Fact Checker',
        'critical',
        `frontmatter.${key}がWriteOrderと不一致です。expected=${expected}, actual=${actual || '(empty)'}`
      );
    }
  }
}

function classifyArticleType(order: WriteOrder): ArticleType {
  const cluster = order.theme_cluster || '';
  if (cluster === 'grade_race_preview') return 'grade_race_preview';
  if (cluster === 'news_context') return 'rewrite';
  if (cluster === 'race_update') return 'race_update';
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
  return text.replace(/\s+/g, '').replace(/％/g, '%');
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
  const writerOrder = buildWriterFacingOrder(order);
  const tokens = new Set<string>();
  collectEvidenceTokens(writerOrder.target_keyword, tokens);
  collectEvidenceTokens(writerOrder.theme_cluster, tokens);
  collectEvidenceTokens(writerOrder.reference_data, tokens);

  const keyMetrics = writerOrder.reference_data?.key_metrics;
  const courseStats = (writerOrder.reference_data as Record<string, unknown> | undefined)?.course_stats;
  const predictions = (writerOrder.reference_data as Record<string, unknown> | undefined)?.predictions;
  const horseNumberAdvantages = (writerOrder.reference_data as Record<string, unknown> | undefined)?.horse_number_advantages;
  const metricRows =
    countMetricRows(keyMetrics) +
    countMetricRows(courseStats) +
    countMetricRows(predictions) +
    countMetricRows(horseNumberAdvantages);

  return {
    hasDataMetrics: metricRows > 0 || Boolean(writerOrder.reference_data?.race_name || writerOrder.reference_data?.race_date),
    allowedTokens: Array.from(tokens).sort(),
    metricRows,
    source: 'verified_writer_evidence',
  };
}

function decideResearch(order: WriteOrder, articleType: ArticleType): ResearchDecision {
  if (articleType === 'race_update' && (order.research_sources || []).some(source => source.source_type === 'official')) {
    return {
      needsExternalResearch: false,
      reason: 'News research sources were already attached by News Topic Planner.',
      tavilyEnabled: false,
    };
  }

  const needsExternalResearch =
    articleType === 'grade_race_preview' ||
    articleType === 'race_update' ||
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

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsvEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function compactText(value: string, maxLength = 240): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 1)}…` : compacted;
}

function getHostname(urlValue: string): string {
  try {
    return new URL(urlValue).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function classifySourceType(urlValue: string): ResearchSource['source_type'] {
  const host = getHostname(urlValue);
  if (host === 'jra.jp' || host.endsWith('.jra.jp') || host === 'jra.go.jp' || host.endsWith('.jra.go.jp')) {
    return 'official';
  }
  if (/keiba|netkeiba|sponichi|sanspo|nikkan|tospo|yahoo/.test(host)) {
    return 'trusted_media';
  }
  if (host === 'uma-free.com') return 'reference';
  return 'other';
}

function extractAllowedClaims(content: string): string[] {
  const rejectedMetricPattern = /勝率|複勝率|連対率|回収率|単勝回収|複勝回収|AI偏差値|指数|オッズ|人気|予想印/;
  return content
    .split(/。|\n/)
    .map(sentence => compactText(sentence, 180))
    .filter(sentence => sentence.length >= 18)
    .filter(sentence => !rejectedMetricPattern.test(sentence))
    .slice(0, 3);
}

function buildTavilyQueries(order: WriteOrder, articleType: ArticleType): string[] {
  const ref = order.reference_data as Record<string, unknown>;
  const raceName = String(ref.race_name || '').replace(/\([^)]*\)/g, '').trim();
  const raceDate = String(ref.race_date || '').trim();
  const venue = String(ref.venue || ref.condition || '').trim();
  const explicitQueries = Array.isArray(ref.external_research_queries)
    ? ref.external_research_queries.map(query => String(query || '').trim()).filter(Boolean)
    : String(ref.external_research_query || '').trim()
      ? [String(ref.external_research_query).trim()]
      : [];

  if (explicitQueries.length > 0) {
    return explicitQueries;
  }

  if (articleType === 'grade_race_preview' && raceName) {
    return [
      `${raceName} ${raceDate} ${venue} JRA 公式`,
      `${raceName} 出走予定 開催情報 JRA`,
    ];
  }

  if (articleType === 'beginner' || articleType === 'guide') {
    return [
      `${order.target_keyword} JRA 公式`,
      `${order.target_keyword} 競馬 公式`,
    ];
  }

  if (articleType === 'race_update') {
    const raceNameForNews = String(ref.race_name || '').trim();
    return [
      `${raceNameForNews || order.target_keyword} JRA NAR 公式 開催情報`,
      `${raceNameForNews || order.target_keyword} 公式 出馬表`,
    ].filter(Boolean);
  }

  return [];
}

async function tavilySearch(query: string, includeDomains: string[], maxResults: number): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      topic: 'general',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_domains: includeDomains.length > 0 ? includeDomains : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Tavily search failed: ${response.status} ${body.slice(0, 160)}`);
  }

  return response.json() as Promise<TavilySearchResponse>;
}

function sourceFromTavilyResult(result: TavilySearchResult, fetchedAt: string): ResearchSource | null {
  const url = String(result.url || '').trim();
  const content = String(result.content || '').trim();
  const title = String(result.title || '').trim();
  if (!url || !content || !title) return null;

  const sourceType = classifySourceType(url);
  if (sourceType !== 'official') return null;

  const allowedClaims = extractAllowedClaims(content);
  if (allowedClaims.length === 0) return null;

  return {
    source_url: url,
    source_name: getHostname(url),
    source_type: sourceType,
    fetched_at: fetchedAt,
    title: compactText(title, 120),
    allowed_claims: allowedClaims,
  };
}

async function runTavilyResearch(order: WriteOrder, state: ArticleFlowState): Promise<void> {
  if (!state.research_decision.needsExternalResearch || !state.research_decision.tavilyEnabled) return;

  const maxQueries = parsePositiveInt(process.env.TAVILY_ARTICLE_MAX_QUERIES, 2);
  const maxResults = Math.min(parsePositiveInt(process.env.TAVILY_ARTICLE_MAX_RESULTS, 3), 5);
  const includeDomains = parseCsvEnv('TAVILY_ARTICLE_INCLUDE_DOMAINS', ['jra.jp', 'jra.go.jp', 'keiba.go.jp']);
  const queries = buildTavilyQueries(order, state.article_type).slice(0, maxQueries);
  const seenUrls = new Set<string>();
  const fetchedAt = new Date().toISOString();

  if (queries.length === 0) {
    addIssue(state, 'Tavily Research', 'warning', 'External research was requested, but no query could be built.');
    return;
  }

  for (const query of queries) {
    try {
      const response = await tavilySearch(query, includeDomains, maxResults);
      state.tavily_usage_credits += response.usage?.credits || 1;

      for (const result of response.results || []) {
        const source = sourceFromTavilyResult(result, fetchedAt);
        if (!source || seenUrls.has(source.source_url)) continue;
        seenUrls.add(source.source_url);
        state.research_sources.push(source);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addIssue(state, 'Tavily Research', 'warning', message);
      break;
    }
  }

  if (state.research_sources.length === 0) {
    addIssue(
      state,
      'Research Filter',
      'warning',
      'No trusted research sources remained after filtering. Continue with DB/internal evidence only.'
    );
  }
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
    research_sources: (order.research_sources || []).filter(source => source.source_type === 'official'),
    tavily_usage_credits: 0,
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
  if (order.theme_cluster === 'news_context' || order.reference_data?.article_type === 'news_context') {
    addIssue(state, 'Demand Planner', 'critical', 'news_contextは公開不可です。競馬固有のテーマへ再分類してください。');
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

  if (state.article_type === 'race_update') {
    const ref = order.reference_data as Record<string, unknown>;
    if (!ref.key_metrics && !ref.writer_evidence) {
      addIssue(state, 'Evidence Builder', 'critical', 'race_updateにはkey_metricsまたはwriter_evidenceが必要です。');
    }
    const drawClaimText = [
      order.target_keyword,
      ref.news_topic,
      ref.news_reason,
      ref.search_intent,
      ref.search_intent_label,
      ref.search_angle_label,
      ref.update_stage,
    ].map(value => String(value || '')).join(' ');
    if (hasConfirmedDrawClaim(drawClaimText) && !isDrawConfirmedReference(ref)) {
      addIssue(
        state,
        'Evidence Builder',
        'critical',
        '枠順確定・枠順発表後の記事には reference_data.draw_status=confirmed が必要です。未発表段階の記事は枠順発表前の確認順として生成してください。'
      );
    }
    const hasOfficialEvidence = state.research_sources.some(source => source.source_type === 'official');
    if (!hasOfficialEvidence && state.evidence_pack.metricRows === 0) {
      addIssue(state, 'Research Filter', 'critical', 'race_updateには公式確認事項またはUMA-FREE掲載データが必要です。');
    }
    validateRaceTimingReference(ref, state);
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

function normalizeMetricToken(token: string): string {
  return token.replace(/\s+/g, '').replace(/％/g, '%');
}

function isAllowedMetricToken(token: string, allowed: Set<string>, targetKeyword: string): boolean {
  const normalized = normalizeMetricToken(token);
  if (allowed.has(normalized) || targetKeyword.includes(normalized)) return true;

  const numericOnly = normalized.match(/^\d+(?:\.\d+)?/)?.[0];
  return Boolean(numericOnly && allowed.has(numericOnly));
}

function collectMetricTokens(content: string): string[] {
  const matches = content.match(/\d+(?:\.\d+)?(?:[%％]|回|頭|レース|R|kg|m|年|月|日)/g) || [];
  return Array.from(new Set(matches.map(normalizeMetricToken)));
}

function collectUnverifiedPercentageMetrics(content: string, allowed: Set<string>, targetKeyword: string): string[] {
  const metricNames = '(?:勝率|連対率|複勝率|好走率|回収率|単勝回収率|複勝回収率|的中率)';
  const patterns = [
    new RegExp(`${metricNames}[^。\\n%％]{0,30}?(\\d+(?:\\.\\d+)?)\\s*[%％]`, 'g'),
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[%％][^。\\n]{0,16}?${metricNames}`, 'g'),
  ];
  const genericAllowed = new Set(['0%', '100%']);
  const result = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const token = normalizeMetricToken(`${match[1]}%`);
      if (genericAllowed.has(token)) continue;
      if (!isAllowedMetricToken(token, allowed, targetKeyword)) {
        result.add(token);
      }
    }
  }

  return Array.from(result);
}

function validateDraftContent(order: WriteOrder, state: ArticleFlowState, content: string): void {
  for (const risk of detectSyntheticTableRisk(content)) {
    addIssue(state, 'Fact Checker', 'critical', `numeric table may be synthetic: ${risk}`);
  }

  for (const href of collectExternalLinks(content)) {
    addIssue(state, 'Research Filter', 'critical', `external link is not allowed in generated article body: ${href}`);
  }

  const allowed = new Set(state.evidence_pack.allowedTokens);
  const unknownPercentageMetrics = collectUnverifiedPercentageMetrics(content, allowed, order.target_keyword);
  if (unknownPercentageMetrics.length > 0) {
    addIssue(
      state,
      'Fact Checker',
      'critical',
      `hallucinated percentage metrics detected: ${unknownPercentageMetrics.slice(0, 12).join(', ')}`
    );
  }

  const criticalTokenSet = new Set(unknownPercentageMetrics);
  const unknownMetricTokens = collectMetricTokens(content)
    .filter(token => !criticalTokenSet.has(token))
    .filter(token => !isAllowedMetricToken(token, allowed, order.target_keyword));

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
    `  research_sources: ${state.research_sources.length}`,
    `  tavily_usage_credits: ${state.tavily_usage_credits}`,
    `  external_research: ${state.research_decision.needsExternalResearch ? 'needed' : 'not_needed'} / tavily=${state.research_decision.tavilyEnabled ? 'enabled' : 'disabled'}`,
    ...issueLines,
  ].join('\n');
}

function statusFromIssues(state: ArticleFlowState): FlowStatus {
  return state.issues.some(issue => issue.severity === 'critical') ? 'REJECTED' : 'APPROVED';
}

export async function runPreDraftArticleFlow(order: WriteOrder): Promise<ArticleFlowResult> {
  const state = createInitialState(order);
  await runTavilyResearch(order, state);
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
  if (parsed) {
    validateDraftMetadata(order, state, parsed.data);
  }
  for (const error of checkSourceIndependence(raw).errors) {
    addIssue(state, 'Source Independence', 'critical', error);
  }
  validateDraftContent(order, state, parsed?.content || raw);

  const status = statusFromIssues(state);
  return {
    status,
    state,
    log: buildLog(`post-writer ${status}`, state),
  };
}
