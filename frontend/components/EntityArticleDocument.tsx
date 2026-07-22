import Link from "next/link";
import type { Article } from "@/lib/articles";
import { ArticleSchema } from "@/components/StructuredData";
import { enhanceArticleHtml } from "@/lib/article-ux";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { RaceAnalysisValueGrid } from "@/components/RaceAnalysisValueGrid";
import { ArticleBody } from "@/components/ArticleBody";

type EntityArticleDocumentProps = {
  article: Article;
  canonicalPath: string;
  backHref: string;
  backLabel: string;
  profileHref?: string;
  profileLabel?: string;
};

export function EntityArticleDocument({
  article,
  canonicalPath,
  backHref,
  backLabel,
  profileHref,
  profileLabel,
}: EntityArticleDocumentProps) {
  const articleUrl = `https://uma-free.com${canonicalPath}`;
  const textContent = article.content.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  const datePublished = new Date(article.date).toISOString();
  const dateModified = new Date(article.lastUpdated || article.date).toISOString();
  const { html: enhancedContent, toc } = enhanceArticleHtml(article.content);
  const stableArticleAdProps = {
    placement: "inline" as const,
    minHeight: "280px",
    collapseUnfilled: false,
    lazyRootMargin: "760px 0px 760px 0px",
    refreshRootMarginPx: 720,
    className: "article-ad-slot",
  };
  const imageUrl = article.eyecatch.startsWith("http")
    ? article.eyecatch
    : `https://uma-free.com${article.eyecatch}`;
  const shouldShowEyecatch = Boolean(
    article.eyecatch && !article.eyecatch.endsWith('/images/articles/data-analysis-eyecatch.png'),
  );

  return (
    <>
      <ArticleSchema
        title={article.title}
        description={article.description || textContent.substring(0, 160)}
        url={articleUrl}
        datePublished={datePublished}
        dateModified={dateModified}
        image={imageUrl}
      />

      <article data-article-slug={article.slug} className="mx-auto max-w-[1080px]">
        <header className="relative border-b border-slate-200 pb-4 sm:pb-8">
          {shouldShowEyecatch && (
            <div className="relative mb-3 aspect-[16/8] max-h-[180px] w-full overflow-hidden bg-slate-100 sm:mb-7 sm:aspect-[16/6] sm:max-h-[320px]">
              <img
                src={article.eyecatch}
                alt={`${article.title} のアイキャッチ画像`}
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            <Link
              href={backHref}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              {backLabel}
            </Link>
            {profileHref && profileLabel && profileHref !== backHref && (
              <Link
                href={profileHref}
                className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-primary"
              >
                {profileLabel}
              </Link>
            )}
          </div>

          <h1 className="article-page-title text-[1.55rem] font-black leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl md:text-5xl">
            {article.title}
          </h1>
          {article.description && (
            <p className="article-page-lead mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:mt-5 sm:text-lg sm:leading-8">
              {article.description}
            </p>
          )}

          <Link
            href="/races/today"
            prefetch={false}
            data-analytics-placement="article_value_guide"
            data-analytics-variant="compact_four"
            className="mt-4 block min-h-[44px] rounded-xl border border-blue-200 bg-slate-50 p-3 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:mt-6"
            aria-label="今日の全レース分析を見る。AI偏差値、対戦比較、展開・脚質、枠順傾向を確認できます"
          >
            <section aria-labelledby="entity-article-site-value-title">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="entity-article-site-value-title" className="text-sm font-black leading-tight text-slate-950 sm:text-base">
                  今日の全レースを4つの視点で確認
                </h2>
                <span className="shrink-0 text-[11px] font-black text-blue-700 sm:text-xs">
                  全レース分析へ <span aria-hidden="true">→</span>
                </span>
              </div>
              <RaceAnalysisValueGrid variant="compact" />
            </section>
          </Link>
        </header>

        {toc.length > 1 && (
          <details className="mt-3 border border-slate-200 bg-slate-50 sm:mt-4" aria-label="記事の目次">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-black text-slate-800 sm:px-4 sm:py-3 sm:text-sm">
              この記事で確認できること
            </summary>
            <ol className="grid gap-1.5 border-t border-slate-200 px-3 py-2 sm:grid-cols-2 sm:gap-2 sm:px-4 sm:py-3">
              {toc.map((item, index) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex gap-2 text-xs font-semibold leading-5 text-slate-600 transition-colors hover:text-primary sm:text-sm sm:leading-6"
                  >
                    <span className="font-mono text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="px-1 pb-6 sm:px-0 sm:pb-10">
          <ArticleBody html={enhancedContent} analyticsPrefix="entity_article" />
        </div>

        <div className="pb-5 sm:pb-8">
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_body" {...stableArticleAdProps} />
        </div>

        <MultiplexAd slot="9407670747" />
      </article>
    </>
  );
}
