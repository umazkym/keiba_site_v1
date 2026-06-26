import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";

type EntityArticleSectionProps = {
  title: string;
  description?: string;
  articles: ArticleMeta[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export function EntityArticleSection({ title, description, articles }: EntityArticleSectionProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          )}
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
          {articles.length}件
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{article.category}</span>
                <time dateTime={new Date(article.date).toISOString()}>{formatDate(article.date)}</time>
                {article.contentTarget && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {article.contentTarget.includes("trend") ? "トレンド" : "データ"}
                  </span>
                )}
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug text-slate-950 group-hover:text-primary">
                {article.title}
              </h3>
              {article.description && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{article.description}</p>
              )}
            </div>
            <span className="mt-4 text-xs font-black text-primary">記事を読む</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
