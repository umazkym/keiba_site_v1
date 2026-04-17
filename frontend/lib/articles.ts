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
      tags: data.tags || [],
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

  // MarkdownをHTMLに変換 (GFMプラグインを使用してテーブル等をサポート)
  const processedContent = await remark()
    .use(gfm)
    .use(html)
    .process(content);
  const contentHtml = processedContent.toString();

  return {
    slug,
    content: contentHtml, // HTML化されたコンテンツを返す
    title: data.title || '無題',
    date: data.date || data.article_published_time || data.last_updated || extractDateFromSlug(slug) || new Date().toISOString(),
    description: data.description || '',
    eyecatch: data.eyecatch || '/images/articles/data-analysis-eyecatch.png',
    category: data.category || '未分類',
    tags: data.tags || [],
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

  const relatedArticles = allArticles.filter(
    a => a.category === currentArticle.category && a.slug !== currentSlug
  );

  return relatedArticles.slice(0, count);
}