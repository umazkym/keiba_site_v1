import { getRelatedArticles } from '@/lib/articles';
import { estimateReadingMinutes, pickArticleThumbs } from '@/lib/article-visual';
import { RelatedArticleList } from '@/components/ArticleParts';

interface RelatedArticlesProps {
  currentSlug: string;
  count?: number;
}

// 記事の本文の後に置く「次に読む分析」。サムネイルは一覧と同じ規則（汎用のアイキャッチはカテゴリの写真）。
export function RelatedArticles({ currentSlug, count = 3 }: RelatedArticlesProps) {
  const relatedArticles = getRelatedArticles(currentSlug, count);
  if (relatedArticles.length === 0) {
    return null;
  }

  const thumbs = pickArticleThumbs(relatedArticles);
  return (
    <RelatedArticleList
      headingId="related-articles-heading"
      items={relatedArticles.map((article, index) => ({
        slug: article.slug,
        title: article.title,
        category: article.category,
        date: article.date,
        readingMinutes: estimateReadingMinutes(article.content),
        thumb: thumbs[index],
      }))}
    />
  );
}
