import assert from 'assert';
import matter from 'gray-matter';
import {
  assertSafeArticleSlug,
  finalizeGscRewriteFrontmatter,
  validateGscRewrite,
} from './gsc_rewrite_guard';
import {
  buildGscRewriteDraft,
  ensureGscRewriteCooldown,
  selectGscRewriteCandidate,
  type GscReport,
  type RewriteProposal,
} from './gsc_seo_rewrite';
import type { WriteOrder } from './agent_writer';

const originalMarkdown = matter.stringify(
  `競馬場ごとの特徴を整理し、出走表と合わせて確認するための導入です。[今日のレースを見る](/races/today)

## コースを見るときの基本

本文段落は変更しません。確認済みの値は次の表にまとめます。

| 項目 | 値 |
| :--- | ---: |
| 勝数 | 54 |
| 勝率 | 23.0% |

## 当日の確認材料

馬場状態と枠順を一緒に確認します。CTAや[関連記事](/articles/guide)も維持します。
`,
  {
    title: '競馬場の特徴と確認材料を整理するガイド',
    description: '競馬場ごとの特徴を整理し、出走表や馬場状態と合わせて確認するときの読み方を、公開済みの本文に沿って紹介します。',
    keywords: ['競馬場', 'コース', '馬場状態'],
    date: '2026-06-01T00:00:00.000Z',
    canonical_path: '/articles/course-guide',
    entity_type: 'course',
    entity_key: 'course-guide',
    entity_path: '/articles/course-guide',
    update_stage: 'preview',
    article_race_bridge: {
      enabled: true,
      race_id: '202607260101',
      url: '/races/2026-07-26/202607260101',
    },
    draft: false,
  },
);

const proposal: RewriteProposal = {
  title: '競馬場の特徴から当日の確認材料を読み解くガイド',
  description: '競馬場ごとの特徴と当日に確認したい材料を整理し、出走表や馬場状態と合わせて読む手順を、公開済みの内容に沿って紹介します。',
  keywords: ['競馬場', 'コース特徴', '馬場状態'],
  lead: 'コースの特徴と当日の情報を整理し、出走表と合わせて確認するための導入です。[今日のレースを見る](/races/today)',
  h2_headings: ['コース特徴の確認手順', '当日に見直したい材料'],
};

const order: WriteOrder = {
  operation: 'rewrite',
  rewrite_target_slug: 'course-guide',
  target_keyword: '競馬場 コース',
  theme_cluster: 'gsc_seo_rewrite',
  reference_data: {
    period: '2026-06-23/2026-07-20',
    condition: 'Search Console改善候補',
    sample_size: 0,
    key_metrics: [],
    article_type: 'rewrite',
  },
};

const safeDraft = buildGscRewriteDraft(
  originalMarkdown,
  proposal,
  order,
  '2026-07-20',
  12.5,
);
const safeGuard = validateGscRewrite(originalMarkdown, safeDraft);
assert.equal(safeGuard.passed, true, safeGuard.errors.join('\n'));

const original = matter(originalMarkdown);
const queued = matter(safeDraft);
const finalizedData = finalizeGscRewriteFrontmatter(
  original.data,
  queued.data,
  '2026-07-23T00:15:00.000Z',
);
const finalizedMarkdown = matter.stringify(queued.content, finalizedData);
const finalGuard = validateGscRewrite(originalMarkdown, finalizedMarkdown);
assert.equal(finalGuard.passed, true, finalGuard.errors.join('\n'));
assert.equal(finalizedData.canonical_path, original.data.canonical_path);
assert.equal(finalizedData.date, original.data.date);
assert.deepEqual(finalizedData.article_race_bridge, original.data.article_race_bridge);
assert.equal(finalizedData.operation, undefined);
assert.equal(finalizedData.rewrite_target_slug, undefined);

const bodyChanged = safeDraft.replace(
  '本文段落は変更しません。',
  '本文段落を書き換えました。',
);
assert.equal(validateGscRewrite(originalMarkdown, bodyChanged).passed, false);

const canonicalChangedParsed = matter(safeDraft);
canonicalChangedParsed.data.canonical_path = '/articles/other';
const canonicalChanged = matter.stringify(
  canonicalChangedParsed.content,
  canonicalChangedParsed.data,
);
assert.equal(validateGscRewrite(originalMarkdown, canonicalChanged).passed, false);

const linkChanged = safeDraft.replace('/races/today', '/races/tomorrow');
assert.equal(validateGscRewrite(originalMarkdown, linkChanged).passed, false);

const numberChanged = safeDraft.replace('| 54 |', '| 55 |');
assert.equal(validateGscRewrite(originalMarkdown, numberChanged).passed, false);

assert.doesNotThrow(() => assertSafeArticleSlug('course-guide'));
assert.throws(() => assertSafeArticleSlug('../course-guide'), /不正な記事slug/);

assert.throws(
  () => ensureGscRewriteCooldown(
    { gsc_last_rewritten_at: '2026-07-10T00:00:00.000Z' },
    new Date('2026-07-23T00:00:00.000Z'),
  ),
  /28日以内/,
);
assert.doesNotThrow(() => ensureGscRewriteCooldown(
  { gsc_last_rewritten_at: '2026-06-01T00:00:00.000Z' },
  new Date('2026-07-23T00:00:00.000Z'),
));

const candidate = {
  source_slug: 'course-guide',
  canonical_path: '/articles/course-guide',
  title: '候補',
  estimated_missed_clicks: 12.5,
  top_queries: [],
};
const report: GscReport = {
  periods: {
    current: { start_date: '2026-06-23', end_date: '2026-07-20' },
  },
  candidates: [candidate],
  seasonal_grade_demand: [],
};
assert.equal(selectGscRewriteCandidate(report, 'course-guide').source_slug, 'course-guide');
assert.throws(
  () => selectGscRewriteCandidate({ ...report, candidates: [] }, 'missing'),
  /一意一致しません/,
);
assert.throws(
  () => selectGscRewriteCandidate(
    { ...report, candidates: [], seasonal_grade_demand: [candidate] },
    'course-guide',
  ),
  /重賞記事は通常GSC改稿の対象外/,
);

console.log('GSC SEO rewrite guard tests passed.');
