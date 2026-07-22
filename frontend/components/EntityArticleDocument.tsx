import Link from "next/link";
import type { Article, ArticleMeta } from "@/lib/articles";
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
  relatedArticles?: ArticleMeta[];
  themeTitle?: string;
};

export function ArticleThemeNavigator({
  articles,
  currentSlug,
  canonicalHref,
  canonicalLabel,
}: {
  articles: ArticleMeta[];
  currentSlug: string;
  canonicalHref?: string;
  canonicalLabel?: string;
}) {
  if (articles.length <= 1) return null;

  const currentIndex = articles.findIndex(item => item.slug === currentSlug);
  const previousArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;
  const nextArticle = currentIndex >= 0 && currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;

  const ArticleDirectionLink = ({ article, label, align }: { article: ArticleMeta | null; label: string; align: 'left' | 'right' }) => {
    if (!article) return null;
    return (
      <Link
        href={`/articles/${article.slug}`}
        className={`flex min-h-[50px] min-w-0 flex-col justify-center px-2.5 py-1 transition-colors duration-150 hover:bg-slate-50 ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
        <span className="truncate text-xs font-black text-slate-800">{article.title}</span>
      </Link>
    );
  };

  const visibleItemCount = Number(Boolean(previousArticle)) + Number(Boolean(canonicalHref)) + Number(Boolean(nextArticle));

  return (
    <nav className="mb-2 h-[52px] overflow-hidden rounded-lg border border-slate-200 bg-white sm:mb-4" aria-label={`${canonicalLabel || '記事'}の記事切り替え`}>
      <div
        className="grid h-full items-stretch divide-x divide-slate-200"
        style={{ gridTemplateColumns: `repeat(${Math.max(visibleItemCount, 1)}, minmax(0, 1fr))` }}
      >
        <ArticleDirectionLink article={previousArticle} label="← 前の記事" align="left" />
        {canonicalHref ? (
          <Link href={canonicalHref} className="flex min-h-[50px] min-w-0 flex-col items-center justify-center bg-slate-50 px-2 text-xs font-black text-slate-700 transition-colors duration-150 hover:bg-white">
            <span>一覧</span>
            <span className="text-[10px] text-slate-500">{articles.length}記事</span>
          </Link>
        ) : null}
        <ArticleDirectionLink article={nextArticle} label="次の記事 →" align="right" />
      </div>
    </nav>
  );
}

export function EntityArticleDocument({
  article,
  canonicalPath,
  backHref,
  backLabel,
  profileHref,
  profileLabel,
  relatedArticles = [],
  themeTitle,
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

      <div className="mx-auto max-w-[1080px]">
        <ArticleThemeNavigator
          articles={relatedArticles}
          currentSlug={article.slug}
          canonicalHref={canonicalPath}
          canonicalLabel={themeTitle || article.title}
        />
      </div>

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

        <div className="pb-6 sm:pb-10">
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
