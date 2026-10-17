import Link from "next/link";
import { AdUnit } from "@/components/AdUnit";
import { ArticleTitleText } from "@/components/ArticleTitleText";
import { MultiplexAd } from "@/components/MultiplexAd";
import type { ArticleArchiveGroup } from "@/lib/article-archives";

type EntityArticleArchiveProps = {
  group: ArticleArchiveGroup;
  eyebrow: string;
  description: string;
};

function formatListDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10).replace(/-/g, "/") : date;
}

/**
 * コース・騎手・レースのまとめページ。先頭の記事の本文は出さず、記事の一覧にする
 * （本文をそのまま出すと記事と重複するため。2026-10-17）。形は重賞のまとめページに合わせる。
 */
export function EntityArticleArchive({ group, eyebrow, description }: EntityArticleArchiveProps) {
  return (
    <div className="mx-auto w-full max-w-6xl pb-12 pt-4 sm:px-4 sm:pb-16">
      <main className="mx-auto max-w-[1080px]">
        <header className="border-b border-slate-200 pb-5 sm:pb-8">
          <p className="text-[13px] font-bold text-slate-500">{eyebrow}</p>
          <h1 className="mt-0.5 text-[15px] font-bold leading-tight text-slate-950 sm:text-4xl">
            {group.title}
          </h1>
          <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-slate-600 sm:text-base sm:leading-7">
            {description}
          </p>
          {group.profileHref && (
            <Link
              href={group.profileHref}
              prefetch={false}
              className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              {group.profileLabel}
            </Link>
          )}
        </header>

        <section className="py-2.5 sm:py-8" aria-labelledby="entity-archive-articles">
          <h2 id="entity-archive-articles" className="text-[13px] font-bold text-slate-950 sm:text-2xl">
            記事の一覧（{group.articleCount}本）
          </h2>
          <ul className="mt-1.5 divide-y divide-slate-200 border-y border-slate-200">
            {group.articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/articles/${article.slug}`}
                  prefetch={false}
                  className="grid min-h-9 gap-0.5 py-1.5 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start sm:gap-4 sm:px-2"
                >
                  <time
                    dateTime={article.date.slice(0, 10)}
                    className="font-mono text-[11px] font-semibold text-brand-700 sm:pt-0.5 sm:text-sm"
                  >
                    {formatListDate(article.date)}
                  </time>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold leading-snug text-slate-900 text-balance [overflow-wrap:anywhere] [word-break:keep-all]"><ArticleTitleText title={article.title} /></span>
                    {article.description && (
                      <span className="mt-0.5 line-clamp-2 text-[13px] leading-[1.7] text-slate-600 sm:text-sm">
                        {article.description}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="pb-5 sm:pb-8">
          {/* AdSense のチャネル（エンティティ記事末尾）を続けて使うため、位置の名前は前のまま（2026-10-17）。 */}
          <AdUnit
            slot="1489598374"
            analyticsPlacement="entity_article_after_body"
            placement="inline"
            minHeight="280px"
            collapseUnfilled={false}
            lazyRootMargin="760px 0px 760px 0px"
            refreshRootMarginPx={720}
            className="article-ad-slot"
          />
        </div>
        <MultiplexAd slot="9407670747" />
      </main>
    </div>
  );
}
