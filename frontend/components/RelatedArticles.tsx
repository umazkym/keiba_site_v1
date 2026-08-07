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
    <section className="mt-3 border-t border-slate-200 pt-3 sm:mt-8 sm:pt-6">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 sm:mb-4 sm:text-base">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary sm:h-6 sm:w-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </span>
        次に読む分析
      </h3>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {relatedArticles.map((article) => {
          const eyecatchSrc = article.eyecatch || '/images/articles/data-analysis-eyecatch.png';
          return (
            <Link
              href={`/articles/${article.slug}`}
              key={article.slug}
              className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50/60 sm:block sm:rounded-xl sm:p-4"
            >
              <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded bg-slate-100 sm:h-36 sm:w-full sm:rounded-lg">
                <img
                  src={eyecatchSrc}
                  alt={article.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 sm:mt-2">
                <span className="mb-0.5 inline-block w-fit rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-700 sm:mb-1 sm:px-2 sm:py-0.5 sm:text-xs">
                  {article.category}
                </span>
                <h4 className="line-clamp-2 text-[11.5px] font-bold leading-tight text-slate-900 transition-colors group-hover:text-primary sm:text-sm">
                  {article.title}
                </h4>
                {article.description && (
                  <p className="mt-1 hidden line-clamp-2 text-[10.5px] leading-relaxed text-slate-500 sm:block sm:text-xs">
                    {article.description}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-[9.5px] text-slate-400 sm:text-xs">
                  <span>{new Date(article.date).toLocaleDateString('ja-JP')}</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
