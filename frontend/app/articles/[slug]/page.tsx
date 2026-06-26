import { getAllArticleSlugs, getArticleBySlug } from '../../../lib/articles';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleSchema, BreadcrumbSchema } from '@/components/StructuredData';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RelatedArticles } from '@/components/RelatedArticles';
import { AdUnit } from '@/components/AdUnit';
import { MultiplexAd } from '@/components/MultiplexAd';
import { enhanceArticleHtml } from '@/lib/article-ux';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { ArticleEngagementTracker } from '@/components/ArticleEngagementTracker';

type Props = {
  params: { slug: string };
};

function resolveArticleCanonicalPath(article: { canonicalPath?: string; canonicalSlug?: string }, fallbackSlug: string): string {
  if (article.canonicalPath && article.canonicalPath.startsWith('/')) {
    return article.canonicalPath;
  }
  return `/articles/${article.canonicalSlug || fallbackSlug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const article = await getArticleBySlug(params.slug);
    // ★ SEO改善: descriptionのfallbackに「競馬データ分析」を含めて検索クエリとの関連性を強化
    // 記事のdescriptionが設定されていない場合、本文冒頭から「競馬データ分析」を前置して生成
    const rawDescription = article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 140);
    const description = article.description ||
      `【競馬データ分析】${rawDescription}...`;

    const canonicalPath = resolveArticleCanonicalPath(article, params.slug);
    const canonicalUrl = `https://uma-free.com${canonicalPath}`;
    const imageUrl = article.eyecatch.startsWith('http')
      ? article.eyecatch
      : `https://uma-free.com${article.eyecatch}`;

    return {
      title: article.title,
      description,
      openGraph: {
        title: article.title,
        description,
        url: canonicalUrl,
        type: 'article',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: article.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title,
        description,
        images: [imageUrl],
      },
      alternates: {
        canonical: canonicalPath,
      },
    };
  } catch (error) {
    return { title: "記事が見つかりません" };
  }
}

export async function generateStaticParams() {
  const articles = getAllArticleSlugs();
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function ArticlePage({ params }: Props) {
  try {
    const article = await getArticleBySlug(params.slug);

    const textContent = article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    const readingTimeMin = Math.max(1, Math.ceil(textContent.length / 500));
    const { html: enhancedContent, toc } = enhanceArticleHtml(article.content);

    const canonicalPath = resolveArticleCanonicalPath(article, params.slug);
    const articleUrl = `https://uma-free.com${canonicalPath}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = new Date(article.lastUpdated || article.date).toISOString();
    const stableArticleAdProps = {
      placement: 'inline' as const,
      minHeight: '280px',
      collapseUnfilled: false,
      lazyRootMargin: '760px 0px 760px 0px',
      refreshRootMarginPx: 720,
      className: 'article-ad-slot',
    };

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
      "prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 prose-code:font-mono prose-code:text-sm",
      "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl",
      "prose-ul:marker:text-slate-400 prose-ol:marker:text-slate-400 prose-ol:marker:font-bold",
    ].join(' ');

    return (
      <div className="min-h-screen bg-white py-2 sm:py-8">
        <ArticleSchema
          title={article.title}
          description={article.description || textContent.substring(0, 160)}
          url={articleUrl}
          datePublished={datePublished}
          dateModified={dateModified}
          image={article.eyecatch.startsWith('http') ? article.eyecatch : `https://uma-free.com${article.eyecatch}`}
        />
        <BreadcrumbSchema
          items={[
            { name: 'ホーム', url: 'https://uma-free.com' },
            { name: '記事', url: 'https://uma-free.com/articles' },
            { name: article.title, url: articleUrl },
          ]}
        />

        <div className="mx-auto max-w-[920px] px-3 sm:px-4">
          <Breadcrumb />

          <article data-article-slug={params.slug}>
            {/* ===== ARTICLE HEADER ===== */}
            <header className="relative border-b border-slate-200 pb-4 sm:pb-8">
              {/* アイキャッチ画像（フルワイド） */}
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

              {/* メタ情報 + タイトル */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-400 sm:mb-4 sm:gap-x-3 sm:text-sm">
                  <Link
                    href={`/articles?category=${encodeURIComponent(article.category)}`}
                    className="text-slate-700 transition-colors hover:text-primary"
                  >
                    {article.category}
                  </Link>
                  <time
                    dateTime={datePublished}
                  >
                    {new Date(article.date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span>
                    約{readingTimeMin}分
                  </span>
                  <Link href="/about" className="text-slate-500 transition-colors hover:text-primary">
                    著者: おとうふや
                  </Link>
                  {article.lastUpdated && (
                    <span>
                      更新日 {new Date(article.lastUpdated).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                </div>

                {/* タイトル */}
                <h1 className="article-page-title text-[1.55rem] font-black leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl md:text-5xl">
                  {article.title}
                </h1>

                {/* リードテキスト */}
                {article.description && (
                  <p className="article-page-lead mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:mt-5 sm:text-lg sm:leading-8">
                    {article.description}
                  </p>
                )}
              </div>
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
                        <span className="font-mono text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                        <span>{item.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="mt-4 sm:mt-5">
              {/* 小型導線 */}
              <div className="my-3 p-3 bg-gradient-to-r from-blue-50/50 to-slate-50 border border-blue-100 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 leading-tight">本日のレースデータ公開中</p>
                  <p className="text-[10px] text-slate-500">AI偏差値、枠順傾向、展開予測を無料で確認できます</p>
                </div>
                <Link
                  href="/races/today"
                  prefetch={false}
                  data-analytics-placement="article_top_cta"
                  className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-light transition-all shadow-sm whitespace-nowrap active:scale-95"
                >
                  本日のレース分析を確認する
                </Link>
              </div>
            </div>

            {/* ===== ARTICLE BODY ===== */}
            <div className="pb-6 sm:pb-10">
              {(() => {
                const h2Positions: number[] = [];
                const searchRegex = /<h2[\s>]/gi;
                let match;
                while ((match = searchRegex.exec(enhancedContent)) !== null) {
                  h2Positions.push(match.index);
                }

                // ★ 長文判定: HTML文字数 6,000字以上 ≒ 本文約3,000字以上
                const isLongArticle = enhancedContent.length >= 6000;

                // H2が7本以上: 3分割 → 本文内2枠（変更なし）
                if (h2Positions.length >= 7) {
                  const split1 = h2Positions[1];
                  const split2 = h2Positions[4];
                  const part1 = enhancedContent.substring(0, split1);
                  const part2 = enhancedContent.substring(split1, split2);
                  const part3 = enhancedContent.substring(split2);
                  return (
                    <>
                      <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part1 }} />
                      <AdUnit slot="1489598374" analyticsPlacement="article_after_intro" {...stableArticleAdProps} />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part2 }} />
                      <AdUnit slot="9407670747" analyticsPlacement="article_mid" {...stableArticleAdProps} />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part3 }} />
                    </>
                  );
                }

                // ★ H2が4〜6本かつ長文: 3分割 → 本文内2枠（新規追加）
                // H2[1]で1回目、H2[3]（存在しない場合はH2[2]）で2回目を挿入
                if (h2Positions.length >= 4 && isLongArticle) {
                  const split1 = h2Positions[1];
                  const split2 = h2Positions[Math.min(3, h2Positions.length - 1)];
                  const part1 = enhancedContent.substring(0, split1);
                  const part2 = enhancedContent.substring(split1, split2);
                  const part3 = enhancedContent.substring(split2);
                  return (
                    <>
                      <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part1 }} />
                      <AdUnit slot="1489598374" analyticsPlacement="article_after_intro" {...stableArticleAdProps} />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part2 }} />
                      <AdUnit slot="9407670747" analyticsPlacement="article_mid_long" {...stableArticleAdProps} />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part3 }} />
                    </>
                  );
                }

                // H2が4〜6本で短め: 2分割 → 本文内1枠（従来通り）
                if (h2Positions.length >= 4) {
                  const splitPos = h2Positions[1];
                  const firstPart = enhancedContent.substring(0, splitPos);
                  const secondPart = enhancedContent.substring(splitPos);
                  return (
                    <>
                      <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: firstPart }} />
                      <AdUnit slot="1489598374" analyticsPlacement="article_after_intro" {...stableArticleAdProps} />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: secondPart }} />
                    </>
                  );
                }

                return (
                  <div className={`${proseClass} mt-5 sm:mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: enhancedContent }} />
                );
              })()}
            </div>


            <ArticleEngagementTracker
              slug={params.slug}
              category={article.category}
              readingTimeMin={readingTimeMin}
            />

            {/* ===== 記事フッター ===== */}
            <div className="border-t border-slate-200 pb-5 pt-4 sm:pb-8 sm:pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <Link
                  href={`/articles?category=${encodeURIComponent(article.category)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-primary sm:gap-2 sm:text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {article.category}の記事をもっと見る
                </Link>
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-1.5 bg-slate-950 px-4 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-primary sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  ほかの記事を確認する
                </Link>
              </div>
            </div>

            <AffiliateSlot context="article_footer" selectionKey={params.slug} className="mb-5 sm:mb-8" />

            {/* ===== 関連記事 ===== */}
            <div className="pb-6 sm:pb-10">
              <RelatedArticles currentSlug={params.slug} count={3} />
            </div>

            {/* ===== 広告: 記事本文後 ===== */}
            <div className="pb-5 sm:pb-8">
              <AdUnit slot="1489598374" analyticsPlacement="article_after_body" {...stableArticleAdProps} />
            </div>

            {/* ===== MultiplexAd ===== */}
            <MultiplexAd slot="9407670747" />
          </article>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
