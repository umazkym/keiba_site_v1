import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const guidesDirectory = path.join(process.cwd(), 'content', 'guides');

export interface Guide {
  slug: string;
  content: string;
  title: string;
  description: string;
  keywords: string[];
  eyecatch: string;
  category: string;
}

// 全ガイドを取得する関数
export function getAllGuides(): Guide[] {
  const fileNames = fs.readdirSync(guidesDirectory);
  const allGuides = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(guidesDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      slug,
      content, // ここでは変換せず、生のMarkdownを返す
      title: data.title || '無題',
      description: data.description || '',
      keywords: data.keywords || [],
      eyecatch: data.eyecatch || '/images/guides/default-guide-eyecatch.png',
      category: data.category || 'ガイド',
    };
  });

  return allGuides;
}

// 全ガイドのスラッグを取得する関数 (generateStaticParams用)
export function getAllGuideSlugs(): { slug: string }[] {
  if (!fs.existsSync(guidesDirectory)) {
    return [];
  }
  const fileNames = fs.readdirSync(guidesDirectory);
  return fileNames.map((fileName) => {
    return {
      slug: fileName.replace(/\.md$/, ''),
    };
  });
}

// ユニークなカテゴリーの一覧を取得する関数
export function getUniqueGuideCategories(): string[] {
  if (!fs.existsSync(guidesDirectory)) {
    return [];
  }
  const allGuides = getAllGuides();
  const categories = allGuides.map(guide => guide.category);
  return [...new Set(categories)];
}

// 特定のガイドを取得し、MarkdownをHTMLに変換する関数
export async function getGuideBySlug(slug: string): Promise<Guide> {
    const fullPath = path.join(guidesDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    // MarkdownをHTMLに変換
    const processedContent = await remark().use(html).process(content);
    const contentHtml = processedContent.toString();

    return {
      slug,
      content: contentHtml, // HTML化されたコンテンツを返す
      title: data.title || '無題',
      description: data.description || '',
      keywords: data.keywords || [],
      eyecatch: data.eyecatch || '/images/guides/default-guide-eyecatch.png',
      category: data.category || 'ガイド',
    };
}
