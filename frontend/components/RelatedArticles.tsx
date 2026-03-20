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
            className="block group border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white hover-lift flex flex-col h-full"
          >
            <div className="relative w-full h-40 sm:h-48 overflow-hidden bg-slate-100 shrink-0">
              <Image
                src={article.eyecatch}
                alt={article.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
                className="transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5 sm:p-6 flex flex-col flex-grow">
              <span className="inline-block w-fit bg-slate-200 text-primary-dark text-xs font-bold px-3 py-1 rounded-full mb-3">
                {article.category}
              </span>
              <h4 className="font-bold text-base sm:text-lg mb-2 text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                {article.title}
              </h4>
              <p className="text-text-muted text-xs sm:text-sm font-medium mt-auto pt-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {new Date(article.date).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
