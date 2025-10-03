import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// content/articles ディレクトリのパス
const articlesDirectory = path.join(process.cwd(), 'content/articles');

// すべての記事のスラッグ（ファイル名）を取得
export function getAllArticleSlugs() {
  const fileNames = fs.readdirSync(articlesDirectory);
  return fileNames.map((fileName) => {
    return {
      slug: fileName.replace(/\.md$/, ''),
    };
  });
}

// スラッグに基づいて記事データを取得
export function getArticleData(slug: string) {
  const fullPath = path.join(articlesDirectory, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  // gray-matterでFrontmatterと本文をパース
  const matterResult = matter(fileContents);

  return {
    slug,
    frontmatter: matterResult.data,
    content: matterResult.content,
  };
}

// すべての記事データを日付順に取得
export function getAllArticles() {
  const fileNames = fs.readdirSync(articlesDirectory);
  const allArticlesData = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(articlesDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const matterResult = matter(fileContents);

    return {
      slug,
      frontmatter: matterResult.data,
    };
  });

  // 日付でソート
  return allArticlesData.sort((a, b) => {
    if (a.frontmatter.date < b.frontmatter.date) {
      return 1;
    } else {
      return -1;
    }
  });
}