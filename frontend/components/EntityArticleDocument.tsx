import Link from "next/link";
import type { Article, ArticleMeta } from "@/lib/articles";
import { ArticleSchema } from "@/components/StructuredData";
import { enhanceArticleHtml } from "@/lib/article-ux";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { RaceAnalysisValueGrid } from "@/components/RaceAnalysisValueGrid";

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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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
    if (!article) return <span aria-hidden="true" />;
    return (
      <Link
        href={`/articles/${article.slug}`}
        className={`flex min-h-11 min-w-0 flex-col justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
        <span className="truncate text-xs font-black text-slate-800">{article.title}</span>
      </Link>
    );
  };

  return (
    <nav className="mb-3 rounded-xl border border-slate-200 bg-white p-2.5 sm:mb-5 sm:p-3" aria-label="記事切り替え">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black text-slate-950 sm:text-base">{canonicalLabel || "記事"}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
            {articles.length}
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-400">前後の記事へ移動</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5">
        <ArticleDirectionLink article={previousArticle} label="← 前の記事" align="left" />
        {canonicalHref ? (
          <Link href={canonicalHref} className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-white">
            一覧
          </Link>
        ) : <span aria-hidden="true" />}
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
  const readingTimeMin = Math.max(1, Math.ceil(textContent.length / 500));
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

  const proseClass = [
    "article-page-prose prose prose-slate max-w-none",
    "[overflow-wrap:anywhere]",
    "prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900",
    "prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-3 prose-h2:scroll-mt-20 sm:prose-h2:text-2xl sm:prose-h2:mt-12 sm:prose-h2:mb-6",
    "prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 sm:prose-h3:text-xl sm:prose-h3:mt-8 sm:prose-h3:mb-3",
    "prose-p:leading-[1.78] prose-p:text-slate-600 sm:prose-p:leading-[1.9]",
    "prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-blue-600",
    "prose-strong:text-slate-900 prose-strong:font-bold",
    "prose-img:border prose-img:border-slate-100",
    "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic prose-blockquote:text-slate-700",
    "prose-ul:marker:text-slate-400 prose-ol:marker:text-slate-400 prose-ol:marker:font-bold",
  ].join(" ");

  const renderArticleBody = () => {
    const h2Positions: number[] = [];
    const searchRegex = /<h2[\s>]/gi;
    let match;
    while ((match = searchRegex.exec(enhancedContent)) !== null) {
      h2Positions.push(match.index);
    }

    const isLongArticle = enhancedContent.length >= 6000;

    if (h2Positions.length >= 7) {
      const split1 = h2Positions[1];
      const split2 = h2Positions[4];
      const part1 = enhancedContent.substring(0, split1);
      const part2 = enhancedContent.substring(split1, split2);
      const part3 = enhancedContent.substring(split2);
      return (
        <>
          <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part1 }} />
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_intro" {...stableArticleAdProps} />
          <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part2 }} />
          <AdUnit slot="9407670747" analyticsPlacement="entity_article_mid" {...stableArticleAdProps} />
          <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part3 }} />
        </>
      );
    }

    if (h2Positions.length >= 4 && isLongArticle) {
      const split1 = h2Positions[1];
      const split2 = h2Positions[Math.min(3, h2Positions.length - 1)];
      const part1 = enhancedContent.substring(0, split1);
      const part2 = enhancedContent.substring(split1, split2);
      const part3 = enhancedContent.substring(split2);
      return (
        <>
          <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part1 }} />
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_intro" {...stableArticleAdProps} />
          <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part2 }} />
          <AdUnit slot="9407670747" analyticsPlacement="entity_article_mid_long" {...stableArticleAdProps} />
          <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part3 }} />
        </>
      );
    }

    if (h2Positions.length >= 4) {
      const splitPos = h2Positions[1];
      const firstPart = enhancedContent.substring(0, splitPos);
      const secondPart = enhancedContent.substring(splitPos);
      return (
        <>
          <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: firstPart }} />
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_intro" {...stableArticleAdProps} />
          <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: secondPart }} />
        </>
      );
    }

    return (
      <div className={`${proseClass} mt-5 pb-8 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: enhancedContent }} />
    );
  };

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

      <div className="mx-auto max-w-[920px]">
        <ArticleThemeNavigator
          articles={relatedArticles}
          currentSlug={article.slug}
          canonicalHref={canonicalPath}
          canonicalLabel={themeTitle || article.title}
        />
      </div>

      <article data-article-slug={article.slug} className="mx-auto max-w-[920px]">
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

          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-400 sm:mb-4 sm:gap-x-3 sm:text-sm">
            <span className="text-slate-700">{article.category}</span>
            <time dateTime={datePublished}>{formatDate(article.date)}</time>
            <span>約{readingTimeMin}分</span>
            {article.lastUpdated && <span>更新日 {formatDate(article.lastUpdated)}</span>}
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

        <div className="pb-6 sm:pb-10">{renderArticleBody()}</div>

        <div className="pb-5 sm:pb-8">
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_body" {...stableArticleAdProps} />
        </div>

        <MultiplexAd slot="9407670747" />
      </article>
    </>
  );
}
