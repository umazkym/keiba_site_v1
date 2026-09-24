import Link from "next/link";
import type { Article } from "@/lib/articles";
import { ArticleSchema } from "@/components/StructuredData";
import { enhanceArticleHtml } from "@/lib/article-ux";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { ArticleBody } from "@/components/ArticleBody";
import { ArticleCover, ArticleMetaRow, ArticleToc, ArticleValueGuide } from "@/components/ArticleParts";
import { estimateReadingMinutes, pickArticleCover } from "@/lib/article-visual";
import { ArticleEngagementTracker } from "@/components/ArticleEngagementTracker";

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
  const readingTimeMin = estimateReadingMinutes(article.content);
  const { html: enhancedContent, toc } = enhanceArticleHtml(article.content);
  const stableArticleAdProps = {
    placement: "inline" as const,
    minHeight: "280px",
    collapseUnfilled: false,
    lazyRootMargin: "760px 0px 760px 0px",
    refreshRootMarginPx: 720,
    className: "article-ad-slot",
  };
  // 構造化データの画像は題名入りのOG画像（app/og/[slug]/route.tsx）
  const imageUrl = `https://uma-free.com/og/${encodeURIComponent(article.slug)}.png`;
  const cover = pickArticleCover(article);

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
        <header className="flex max-w-[760px] flex-col gap-4 border-b border-slate-200 pb-7 sm:gap-5 sm:pb-9">
          <div className="flex flex-wrap gap-2">
            <Link href={backHref} className="ui-btn ui-btn--secondary text-[14px]">
              {backLabel}
            </Link>
            {profileHref && profileLabel && profileHref !== backHref && (
              <Link href={profileHref} className="ui-btn ui-btn--navy text-[14px]">
                {profileLabel}
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            <h1 className="article-page-title font-display text-[23px] font-extrabold leading-[1.5] text-slate-900 [overflow-wrap:anywhere] sm:text-[30px] lg:text-[34px]">
              {article.title}
            </h1>
            {article.description && (
              <p className="article-page-lead max-w-3xl text-[15px] leading-[1.9] text-slate-700 sm:text-[17px]">
                {article.description}
              </p>
            )}
            <ArticleMetaRow
              category={article.category}
              date={article.date}
              lastUpdated={article.lastUpdated}
              readingMinutes={readingTimeMin}
            />
          </div>

          <ArticleCover cover={cover} title={article.title} />
          <ArticleValueGuide headingId="entity-article-site-value-title" />
          <ArticleToc toc={toc} headingId="entity-article-toc-heading" />
        </header>

        <div className="px-1 pb-6 sm:px-0 sm:pb-10">
          <ArticleBody html={enhancedContent} analyticsPrefix="entity_article" />
        </div>

        <ArticleEngagementTracker
          slug={article.slug}
          category={article.category}
          readingTimeMin={readingTimeMin}
        />

        <div className="pb-5 sm:pb-8">
          <AdUnit slot="1489598374" analyticsPlacement="entity_article_after_body" {...stableArticleAdProps} />
        </div>

        <MultiplexAd slot="9407670747" />
      </article>
    </>
  );
}
