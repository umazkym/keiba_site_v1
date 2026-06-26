import Link from "next/link";
import type { Article, ArticleMeta } from "@/lib/articles";
import { ArticleSchema } from "@/components/StructuredData";
import { enhanceArticleHtml } from "@/lib/article-ux";

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

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("ja-JP", {
    month: "numeric",
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

  return (
    <nav className="mb-4 rounded-xl border border-slate-200 bg-white p-3 sm:mb-5 sm:p-4" aria-label="同じテーマの記事">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950 sm:text-base">同じテーマ</p>
          {canonicalHref && canonicalLabel && (
            <Link href={canonicalHref} className="mt-1 block truncate text-xs font-bold text-primary hover:text-blue-600">
              {canonicalLabel}
            </Link>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
          {articles.length}件
        </span>
      </div>
      <div className="grid max-h-[260px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {articles.map((item) => {
          const isCurrent = item.slug === currentSlug;
          const className =
            "min-h-[48px] rounded-lg border px-2.5 py-1.5 text-left transition-colors";
          const content = (
            <>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                <time dateTime={new Date(item.date).toISOString()}>{formatShortDate(item.date)}</time>
                <span>{item.category}</span>
                {isCurrent && <span className="text-primary">表示中</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-black leading-snug text-slate-800 sm:text-sm">
                {item.title}
              </p>
            </>
          );

          if (isCurrent) {
            return (
              <div key={item.slug} className={`${className} border-primary/30 bg-blue-50/50`} aria-current="page">
                {content}
              </div>
            );
          }

          return (
            <Link
              key={item.slug}
              href={`/articles/${item.slug}`}
              className={`${className} border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white`}
            >
              {content}
            </Link>
          );
        })}
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
  const imageUrl = article.eyecatch.startsWith("http")
    ? article.eyecatch
    : `https://uma-free.com${article.eyecatch}`;

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
          {article.eyecatch && (
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

        <div className={`${proseClass} mt-5 pb-8 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: enhancedContent }} />
      </article>
    </>
  );
}
