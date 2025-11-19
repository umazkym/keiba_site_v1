import Link from 'next/link';
import Image from 'next/image';
import { getRelatedArticles } from '@/lib/articles';

interface RelatedArticlesProps {
  currentSlug: string;
  count?: number;
}

export function RelatedArticles({ currentSlug, count = 3 }: RelatedArticlesProps) {
  const relatedArticles = getRelatedArticles(currentSlug, count);

  if (relatedArticles.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-gray-200">
      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="bg-primary/10 text-primary rounded-lg w-8 h-8 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </span>
        関連記事
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedArticles.map((article) => (
          <Link
            href={`/articles/${article.slug}`}
            key={article.slug}
            className="block group border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white"
          >
            <div className="relative w-full h-40 sm:h-48 overflow-hidden">
              <Image
                src={article.eyecatch}
                alt={article.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                style={{ objectFit: 'cover' }}
                className="transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-4">
              <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded mb-2 border border-blue-100">
                {article.category}
              </span>
              <h4
                className="font-bold text-sm mb-2 text-gray-800 group-hover:text-primary transition-colors line-clamp-2"
              >
                {article.title}
              </h4>
              <p className="text-gray-400 text-xs">
                {new Date(article.date).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
