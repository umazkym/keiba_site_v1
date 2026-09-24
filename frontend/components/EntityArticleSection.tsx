import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";
import { ArticleCategoryTag, formatArticleDate } from "@/components/ArticleParts";
import { LineIcon } from "@/components/LineIcon";

type EntityArticleSectionProps = {
  title: string;
  description?: string;
  articles: ArticleMeta[];
  archiveHref?: string;
  archiveLabel?: string;
};

// 騎手・コース・重賞のデータ画面に置く関連記事の一覧（区切り線の行。PCは2列）
export function EntityArticleSection({
  title,
  description,
  articles,
  archiveHref,
  archiveLabel = "記事",
}: EntityArticleSectionProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 rounded-[14px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-extrabold leading-snug text-slate-900 sm:text-[21px]">{title}</h2>
          {description && (
            <p className="mt-1.5 max-w-3xl text-[14px] leading-[1.75] text-slate-700">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-slate-500">
          <span>{articles.length}件</span>
          {archiveHref && (
            <Link
              href={archiveHref}
              className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600"
            >
              {archiveLabel}
              <LineIcon name="chevR" size={15} className="block" />
            </Link>
          )}
        </div>
      </div>

      <ul className="mt-1 grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
        {articles.map((article) => (
          <li key={article.slug} className="border-b border-slate-200 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
            <Link
              prefetch={false}
              href={`/articles/${article.slug}`}
              className="group flex h-full flex-col gap-1.5 py-3.5"
            >
              <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
                <ArticleCategoryTag category={article.category} />
                <time dateTime={new Date(article.date).toISOString()}>{formatArticleDate(article.date)}</time>
                {article.contentTarget && (
                  <span className="font-bold text-slate-600">
                    {article.contentTarget.includes("trend") ? "トレンド" : "データ"}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-[15px] font-bold leading-[1.55] text-slate-900 transition-colors duration-150 group-hover:text-brand-700">
                {article.title}
              </span>
              {article.description && (
                <span className="line-clamp-2 text-[13.5px] leading-[1.7] text-slate-600">{article.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
