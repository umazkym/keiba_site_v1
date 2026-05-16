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
}

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
  const fileNames = fs.readdirSync(articlesDirectory);
  const allArticles = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(articlesDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
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
    };
  });

  // 日付の降順で記事をソート
  return allArticles.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

// 全記事のスラッグを取得する関数 (generateStaticParams用)
export function getAllArticleSlugs(): { slug: string }[] {
  const fileNames = fs.readdirSync(articlesDirectory);
  return fileNames.map((fileName) => {
    return {
      slug: fileName.replace(/\.md$/, ''),
    };
  });
}

// クライアントコンポーネントへ渡すためのメタデータのみ（content抜き）を取得する関数
export function getAllArticlesMeta(): Omit<Article, 'content'>[] {
  const allArticles = getAllArticles();
  return allArticles.map(({ content, ...meta }) => meta);
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
      ...article.tags,
      ...article.keywords,
    ].join(' ');

    const signals = new Set<string>();
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
          score += signal.startsWith('venue:') ? 4 : 2;
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
