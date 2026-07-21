import Link from 'next/link';
import { getRelatedArticles } from '@/lib/articles';

interface RelatedArticlesProps {
  currentSlug: string;
  count?: number;
}

const CategoryFallbackIcon = ({ category }: { category: string }) => {
  const isJockey = category.includes('騎手');
  const isCourse = category.includes('コース') || category.includes('枠順');
  const tone = isJockey
    ? 'bg-purple-50 text-purple-700'
    : isCourse
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-blue-50 text-blue-700';
  return (
    <div className={`flex h-full w-full items-center justify-center ${tone}`} aria-hidden="true">
      {isJockey ? (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M7 18c1.5-2.4 3.2-3.6 5-3.6s3.5 1.2 5 3.6M12 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" /></svg>
      ) : isCourse ? (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M4 17.5h16M6 14V9m4 5V6m4 8v-3m4 3V4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6"><path strokeLinecap="round" strokeLinejoin="round" d="M5 18V6m0 1h9l-2 3 2 3H5m4 5h10" /></svg>
      )}
    </div>
  );
};

export function RelatedArticles({ currentSlug, count = 3 }: RelatedArticlesProps) {
  const relatedArticles = getRelatedArticles(currentSlug, count);

  if (relatedArticles.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-4 sm:mt-12 sm:pt-8">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800 sm:mb-6 sm:text-xl">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-8 sm:w-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </span>
        次に読む分析
      </h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {relatedArticles.map((article) => {
          const hasSpecificEyecatch = Boolean(
            article.eyecatch && !article.eyecatch.endsWith('/images/articles/data-analysis-eyecatch.png'),
          );
          return (
            <Link
              href={`/articles/${article.slug}`}
              key={article.slug}
              className="group flex h-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-slate-300 hover:shadow-md sm:block sm:rounded-xl"
            >
            <div className="h-20 w-20 shrink-0 overflow-hidden bg-slate-100 sm:h-48 sm:w-full">
              {hasSpecificEyecatch ? (
                <img
                  src={article.eyecatch}
                  alt={article.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <CategoryFallbackIcon category={article.category} />
              )}
            </div>
            <div className="flex min-w-0 flex-grow flex-col p-3 sm:p-6">
              <span className="mb-1.5 inline-block w-fit rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-primary-dark sm:mb-3 sm:px-3 sm:py-1 sm:text-xs">
                {article.category}
              </span>
              <h4 className="mb-1 line-clamp-2 text-[13px] font-bold leading-snug text-text-primary transition-colors group-hover:text-primary sm:mb-2 sm:text-lg">
                {article.title}
              </h4>
              {article.description && (
                <p className="hidden line-clamp-2 text-[11px] leading-5 text-slate-500 sm:block sm:line-clamp-3 sm:text-sm sm:leading-6">
                  {article.description}
                </p>
              )}
              <p className="mt-auto flex items-center gap-1 pt-1 text-[10px] font-medium text-text-muted sm:gap-1.5 sm:pt-2 sm:text-sm">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {new Date(article.date).toLocaleDateString('ja-JP')}
              </p>
            </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
