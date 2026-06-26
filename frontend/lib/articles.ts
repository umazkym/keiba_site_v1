import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import gfm from 'remark-gfm';

const articlesDirectory = path.join(process.cwd(), 'content', 'articles');

export interface Article {
  slug: string;
  content: string;
  title: string;
  date: string;
  description: string;
  eyecatch: string;
  category: string;
  tags: string[];
  keywords: string[];
  targetKeyword?: string;
  themeCluster?: string;
  lastUpdated?: string;
  updateStage?: string;
  canonicalSlug?: string;
  canonicalPath?: string;
  entityType?: string;
  entityKey?: string;
  seasonYear?: string;
  entityPath?: string;
  contentTarget?: string;
}

export type ArticleMeta = Omit<Article, 'content'>;

export type RaceArticleMeta = Pick<
  Article,
  'slug' | 'title' | 'date' | 'eyecatch' | 'category'
>;

type EntityArticleQuery = {
  entityType: string;
  entityKey: string;
  entityPath?: string;
  entityPaths?: string[];
  terms?: string[];
  count?: number;
};

let cachedArticles: Article[] | null = null;

const VENUE_NAMES = [
  '札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉',
  '大井', '川崎', '船橋', '浦和', '門別', '盛岡', '水沢', '金沢', '笠松', '名古屋',
  '園田', '姫路', '高知', '佐賀',
];

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function isDraftArticle(data: Record<string, unknown>): boolean {
  return data.draft === true || String(data.draft || '').toLowerCase() === 'true';
}

function normalizeInternalCanonicalPath(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /^https?:\/\//i.test(raw) || !raw.startsWith('/')) return '';
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

function normalizeOptionalString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeEntitySearchText(value: string): string {
  return value
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s　・（）()【】「」『』｜|:：\-_/]/g, '')
    .toLowerCase();
}

function articleMetaText(article: Article): string {
  return [
    article.slug,
    article.title,
    article.description,
    article.category,
    article.targetKeyword || '',
    article.themeCluster || '',
    article.entityType || '',
    article.entityKey || '',
    article.entityPath || '',
    article.canonicalPath || '',
    article.contentTarget || '',
    ...article.tags,
    ...article.keywords,
  ].join(' ');
}

function toArticleMeta(article: Article): ArticleMeta {
  const { content, ...meta } = article;
  return meta;
}

function cleanArticleMarkdownForRender(markdown: string): string {
  let cleaned = markdown.replace(/\r\n/g, '\n');

  // 旧記事の本文末に残っている手動関連記事は、ページ側の関連記事コンポーネントと重複する。
  // 生成時期によってリンク切れも混ざるため、表示時には自動関連記事へ一本化する。
  const manualRelatedIndex = cleaned.search(/\n##\s+関連記事\s*\n/);
  if (manualRelatedIndex >= 0) {
    cleaned = cleaned.slice(0, manualRelatedIndex);
  }

  // パブリッシュ時の置換失敗で単独行として残った "(/course-...)" のような壊れたURL片を消す。
  cleaned = cleaned.replace(/^\s*\(\/[^)\s]+\)\s*$/gm, '');

  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

// スラッグ（ファイル名）から日付を抽出するフォールバック関数
function extractDateFromSlug(slug: string): string | null {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    try {
      // e.g., "2024-10-15" -> "2024-10-15T00:00:00.000Z"
      return new Date(`${match[1]}T00:00:00Z`).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

// 全記事を取得する関数
export function getAllArticles(): Article[] {
  if (cachedArticles) {
    return cachedArticles;
  }

  const fileNames = fs.readdirSync(articlesDirectory);
  const allArticles = fileNames.flatMap((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(articlesDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    if (isDraftArticle(data)) return [];

    return [{
      slug,
      content, // ここでは変換せず、生のMarkdownを返す
      title: data.title || '無題',
      date: data.date || data.article_published_time || data.last_updated || extractDateFromSlug(slug) || new Date().toISOString(),
      description: data.description || '',
      eyecatch: data.eyecatch || '/images/articles/data-analysis-eyecatch.png',
      category: data.category || '未分類',
      tags: normalizeStringArray(data.tags),
      keywords: normalizeStringArray(data.keywords),
      targetKeyword: data.target_keyword || '',
      themeCluster: data.theme_cluster || '',
      lastUpdated: data.last_updated || '',
      updateStage: data.update_stage || '',
      canonicalSlug: data.canonical_slug || '',
      canonicalPath: normalizeInternalCanonicalPath(data.canonical_path || data.canonicalPath),
      entityType: normalizeOptionalString(data.entity_type || data.entityType),
      entityKey: normalizeOptionalString(data.entity_key || data.entityKey),
      seasonYear: normalizeOptionalString(data.season_year || data.seasonYear),
      entityPath: normalizeInternalCanonicalPath(data.entity_path || data.entityPath),
      contentTarget: normalizeOptionalString(data.content_target || data.contentTarget),
    }];
  });

  // 日付の降順で記事をソート
  cachedArticles = allArticles.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });

  return cachedArticles;
}

// 全記事のスラッグを取得する関数 (generateStaticParams用)
export function getAllArticleSlugs(): { slug: string }[] {
  return getAllArticles().map(({ slug }) => ({ slug }));
}

// クライアントコンポーネントへ渡すためのメタデータのみ（content抜き）を取得する関数
export function getAllArticlesMeta(): ArticleMeta[] {
  const allArticles = getAllArticles();
  return allArticles.map(toArticleMeta);
}

export function getArticlesByEntity({
  entityType,
  entityKey,
  entityPath = '',
  entityPaths = [],
  terms = [],
  count = 8,
}: EntityArticleQuery): ArticleMeta[] {
  const normalizedEntityType = entityType.trim();
  const normalizedEntityKey = entityKey.trim();
  const normalizedEntityPaths = [entityPath, ...entityPaths]
    .map((pathName) => pathName.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const normalizedTerms = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .flatMap((term) => [term, normalizeEntitySearchText(term)])
    .filter(Boolean);

  const scored = getAllArticles()
    .map((article) => {
      let score = 0;
      const metaText = articleMetaText(article);
      const normalizedMetaText = normalizeEntitySearchText(metaText);

      if (article.entityType === normalizedEntityType && article.entityKey === normalizedEntityKey) {
        score += 12;
      }
      if (normalizedEntityPaths.includes(article.entityPath || '')) {
        score += 10;
      }
      if (normalizedEntityPaths.includes(article.canonicalPath || '')) {
        score += 10;
      }
      if (article.entityKey === normalizedEntityKey) {
        score += 6;
      }

      for (const term of normalizedTerms) {
        if (term.length < 2) continue;
        if (metaText.includes(term)) score += 3;
        if (normalizedMetaText.includes(term)) score += 2;
      }

      if (score === 0) return null;
      return { article, score };
    })
    .filter((entry): entry is { article: Article; score: number } => entry !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.article.date < b.article.date ? 1 : -1;
    });

  return scored.slice(0, count).map((entry) => toArticleMeta(entry.article));
}

function courseSearchTerms(venueName: string, courseName: string): string[] {
  const compactCourse = courseName.replace(/\s+/g, '');
  const shortDirtCourse = compactCourse.replace('ダート', 'ダ');
  return [
    `${venueName}${compactCourse}`,
    `${venueName}${shortDirtCourse}`,
    `${venueName} ${compactCourse}`,
    `${venueName} ${shortDirtCourse}`,
  ];
}

export function getArticlesByGradeRaceEntity(slug: string, raceNames: string[], count = 8): ArticleMeta[] {
  return getArticlesByEntity({
    entityType: 'grade_race',
    entityKey: slug,
    entityPath: `/articles/grade-races/${slug}`,
    entityPaths: [`/grade-races/${slug}`],
    terms: raceNames,
    count,
  });
}

export function getArticlesByCourseEntity(
  venue: string,
  course: string,
  venueName: string,
  courseName: string,
  count = 8,
): ArticleMeta[] {
  return getArticlesByEntity({
    entityType: 'course',
    entityKey: `${venue}-${course}`,
    entityPath: `/articles/courses/${venue}/${course}`,
    entityPaths: [`/courses/${venue}/${course}`],
    terms: courseSearchTerms(venueName, courseName),
    count,
  });
}

export function getArticlesByJockeyEntity(slug: string, jockeyNames: string[], count = 8): ArticleMeta[] {
  return getArticlesByEntity({
    entityType: 'jockey',
    entityKey: slug,
    entityPath: `/articles/jockeys/${slug}`,
    entityPaths: [`/jockeys/${slug}`],
    terms: jockeyNames,
    count,
  });
}

// レースページへ渡す項目を表示に必要な最小限へ絞り、HTML/RSCサイズを抑える。
export function getRaceArticleMeta(): RaceArticleMeta[] {
  const allArticles = getAllArticles();
  return allArticles.map((article) => ({
    slug: article.slug,
    title: article.title,
    date: article.date,
    eyecatch: article.eyecatch,
    category: article.category,
  }));
}

// 最新の記事を指定した件数だけ取得する関数
export function getLatestArticles(count: number): Article[] {
  const allArticles = getAllArticles();
  return allArticles.slice(0, count);
}

// ユニークなカテゴリーの一覧を取得する関数
export function getUniqueCategories(): string[] {
  const allArticles = getAllArticles();
  const categories = allArticles.map(article => article.category);
  return [...new Set(categories)];
}

// ユニークなタグ一覧を取得する関数（特定のカテゴリに絞ることも可能）
export function getUniqueTags(category?: string): string[] {
  const allArticles = getAllArticles();
  const filtered = category 
    ? allArticles.filter(a => a.category === category)
    : allArticles;
  
  const tags = new Set<string>();
  filtered.forEach(a => {
    if (a.tags && Array.isArray(a.tags)) {
      a.tags.forEach(t => tags.add(t));
    }
  });
  return Array.from(tags).sort();
}

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 特定の記事を取得し、MarkdownをHTMLに変換する関数
export async function getArticleBySlug(slug: string): Promise<Article> {
  const fullPath = path.join(articlesDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  if (isDraftArticle(data)) {
    throw new Error('下書き記事は公開できません。');
  }
  const cleanedContent = cleanArticleMarkdownForRender(content);

  // MarkdownをHTMLに変換 (GFMプラグインを使用してテーブル等をサポート)
  const processedContent = await remark()
    .use(gfm)
    .use(html)
    .process(cleanedContent);
  const contentHtml = processedContent.toString();

  return {
    slug,
    content: contentHtml, // HTML化されたコンテンツを返す
    title: data.title || '無題',
    date: data.date || data.article_published_time || data.last_updated || extractDateFromSlug(slug) || new Date().toISOString(),
    description: data.description || '',
    eyecatch: data.eyecatch || '/images/articles/data-analysis-eyecatch.png',
    category: data.category || '未分類',
    tags: normalizeStringArray(data.tags),
    keywords: normalizeStringArray(data.keywords),
    targetKeyword: data.target_keyword || '',
    themeCluster: data.theme_cluster || '',
    lastUpdated: data.last_updated || '',
    updateStage: data.update_stage || '',
    canonicalSlug: data.canonical_slug || '',
    canonicalPath: normalizeInternalCanonicalPath(data.canonical_path || data.canonicalPath),
    entityType: normalizeOptionalString(data.entity_type || data.entityType),
    entityKey: normalizeOptionalString(data.entity_key || data.entityKey),
    seasonYear: normalizeOptionalString(data.season_year || data.seasonYear),
    entityPath: normalizeInternalCanonicalPath(data.entity_path || data.entityPath),
    contentTarget: normalizeOptionalString(data.content_target || data.contentTarget),
  };
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// 関連記事を取得する関数（同じカテゴリの記事から指定件数）
export function getRelatedArticles(currentSlug: string, count: number = 3): Article[] {
  const allArticles = getAllArticles();
  const currentArticle = allArticles.find(a => a.slug === currentSlug);

  if (!currentArticle) {
    // 現在の記事が見つからない場合は最新記事を返す
    return allArticles.slice(0, count);
  }

  const buildSignals = (article: Article): Set<string> => {
    const text = [
      article.title,
      article.description,
      article.category,
      article.targetKeyword || '',
      article.themeCluster || '',
      article.entityType || '',
      article.entityKey || '',
      article.entityPath || '',
      article.contentTarget || '',
      ...article.tags,
      ...article.keywords,
    ].join(' ');

    const signals = new Set<string>();
    if (article.entityType && article.entityKey) {
      signals.add(`entity:${article.entityType}:${article.entityKey}`);
    }
    if (article.canonicalPath) {
      signals.add(`canonical:${article.canonicalPath}`);
    }
    if (article.entityPath) {
      signals.add(`entity-path:${article.entityPath}`);
    }
    for (const venue of VENUE_NAMES) {
      if (text.includes(venue)) signals.add(`venue:${venue}`);
    }

    const distances = text.match(/\d{3,4}m/g) || [];
    distances.forEach((distance) => signals.add(`distance:${distance}`));

    if (text.includes('芝')) signals.add('course:turf');
    if (text.includes('ダート') || text.includes('ダ')) signals.add('course:dirt');
    if (article.themeCluster) signals.add(`theme:${article.themeCluster}`);
    article.tags.forEach((tag) => signals.add(`tag:${tag}`));

    return signals;
  };

  const currentSignals = buildSignals(currentArticle);

  const scoredArticles = allArticles
    .filter((article) => article.slug !== currentSlug)
    .map((article) => {
      let score = 0;
      if (article.category === currentArticle.category) score += 4;
      if (article.themeCluster && article.themeCluster === currentArticle.themeCluster) score += 2;

      const articleSignals = buildSignals(article);
      for (const signal of articleSignals) {
        if (currentSignals.has(signal)) {
          if (signal.startsWith('entity:') || signal.startsWith('canonical:') || signal.startsWith('entity-path:')) {
            score += 7;
          } else {
            score += signal.startsWith('venue:') ? 4 : 2;
          }
        }
      }

      if (article.tags.some((tag) => currentArticle.tags.includes(tag))) score += 3;

      return { article, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.article.date < b.article.date ? 1 : -1;
    });

  const related = scoredArticles
    .filter((entry) => entry.score > 0)
    .slice(0, count)
    .map((entry) => entry.article);

  if (related.length >= count) {
    return related;
  }

  const fallback = allArticles
    .filter((article) => article.slug !== currentSlug && !related.some((r) => r.slug === article.slug))
    .slice(0, count - related.length);

  return [...related, ...fallback];
}
