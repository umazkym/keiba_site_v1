import { getAllArticleSlugs, getArticleBySlug } from '../../../lib/articles';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleSchema, BreadcrumbSchema, FAQSchema } from '@/components/StructuredData';
import { extractArticleFaqs } from '@/lib/article-faq';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RelatedArticles } from '@/components/RelatedArticles';
import { AdUnit } from '@/components/AdUnit';
import { MultiplexAd } from '@/components/MultiplexAd';
import { enhanceArticleHtml } from '@/lib/article-ux';
import { ArticleEngagementTracker } from '@/components/ArticleEngagementTracker';
import { RaceAnalysisValueGrid } from '@/components/RaceAnalysisValueGrid';
import { ArticleBody } from '@/components/ArticleBody';
import { ArticleRaceBridgeExperiment } from '@/components/ArticleRaceBridgeExperiment';
import { ArticleAfterBodyLayout } from '@/components/ArticleAfterBodyLayout';
import { getArticleRacePreview } from '@/lib/api';
import { hasValidArticleRaceBridgeMetadata, shouldRenderArticleRaceBridge } from '@/lib/article-race-bridge';

type Props = {
  params: { slug: string };
};

const ARTICLE_INTENT_GUIDES: Record<string, { href: string; label: string }> = {
  '2025-10-26-ground-condition-impact': {
    href: '/keiba-data/track-condition',
    label: '馬場状態データを確認',
  },
  '2025-11-11-weight-change-impact-analysis': {
    href: '/keiba-data/horse-weight',
    label: '馬体重データを確認',
  },
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
    // 記事を解決できないURLはインデックスさせない。
    // ページ本体は notFound() を返すが、metadata 側が index 可のままだと
    // 404 到達前のレスポンスがインデックス対象として扱われうる。
    return {
      title: "記事が見つかりません",
      robots: { index: false, follow: false },
    };
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
    const articleFaqs = extractArticleFaqs(article.content);

    const canonicalPath = resolveArticleCanonicalPath(article, params.slug);
    const articleUrl = `https://uma-free.com${canonicalPath}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = new Date(article.lastUpdated || article.date).toISOString();
    const shouldShowEyecatch = Boolean(
      article.eyecatch && !article.eyecatch.endsWith('/images/articles/data-analysis-eyecatch.png'),
    );
    const stableArticleAdProps = {
      placement: 'inline' as const,
      minHeight: '280px',
      collapseUnfilled: false,
      lazyRootMargin: '760px 0px 760px 0px',
      refreshRootMarginPx: 720,
      className: 'article-ad-slot',
    };
    const bridgeMetadata = {
      eligible: article.raceBridgeEligible,
      entityType: article.entityType,
      raceName: article.raceName,
      scheduledRaceDate: article.scheduledRaceDate,
      seasonYear: article.seasonYear,
      raceId: article.raceId,
      raceUrl: article.raceUrl,
    };
    const hasValidBridgeMetadata = hasValidArticleRaceBridgeMetadata(bridgeMetadata);
    const racePreview = hasValidBridgeMetadata
      ? await getArticleRacePreview(article.scheduledRaceDate as string, article.raceName as string)
      : null;
    const shouldRenderRaceBridge = shouldRenderArticleRaceBridge(bridgeMetadata, racePreview);
    const shouldRenderGenericGuide = article.entityType !== 'grade_race';
    const articleIntentGuide = ARTICLE_INTENT_GUIDES[params.slug];
    const contentGroup = article.entityType === 'grade_race'
      ? 'grade_race'
      : article.entityType && article.entityType !== 'article'
        ? 'entity_data'
        : 'evergreen_guide';
    const racePhase = article.racePhase || (article.entityType === 'grade_race' ? undefined : 'evergreen');

    return (
      <div className="article-detail-scope min-h-screen bg-white py-1 sm:py-8">
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
            { name: article.category, url: `https://uma-free.com/articles/category/${encodeURIComponent(article.category)}` },
            { name: article.title, url: articleUrl },
          ]}
        />
        {/* 本文に「よくある質問」がある記事だけFAQPageを出す。旧記事では何も出力しない。 */}
        {articleFaqs.length > 0 && <FAQSchema faqs={articleFaqs} />}

        <div className="site-shell-article mx-auto max-w-4xl px-3.5 sm:px-6">
          <Breadcrumb />

          <article
            data-article-slug={params.slug}
            data-content-group={contentGroup}
            data-race-phase={racePhase}
          >
            {/* ===== ARTICLE HEADER ===== */}
            <header className="relative border-b border-slate-200 pb-4 sm:pb-8">
              <div>
                {/* タイトル */}
                <h1 className="article-page-title text-[1.55rem] font-black leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl md:text-5xl">
                  {article.title}
                </h1>

                {/* リードテキスト */}
                {article.description && (
                  <p className="article-page-lead mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">
                    {article.description}
                  </p>
                )}

                {shouldRenderRaceBridge && (
                  <ArticleRaceBridgeExperiment
                    articleSlug={params.slug}
                    articleCategory={article.category}
                    raceId={article.raceId as string}
                    raceName={article.raceName as string}
                    raceDate={article.scheduledRaceDate as string}
                    venueName={article.scheduledVenue || ''}
                    raceNumber={article.raceNumber}
                    raceUrl={article.raceUrl as string}
                    preview={racePreview!}
                  />
                )}

                {shouldRenderGenericGuide && articleIntentGuide && (
                  <section
                    aria-labelledby="article-intent-guide-title"
                    className="mt-4 rounded-xl border border-blue-200 bg-slate-50 p-3 sm:mt-6"
                    data-analytics-placement="article_intent_guide"
                  >
                    <h2 id="article-intent-guide-title" className="text-sm font-black leading-tight text-slate-950 sm:text-base">
                      記事の内容を当日のレースへつなげる
                    </h2>
                    <div className="mt-2">
                      <RaceAnalysisValueGrid variant="compact" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link
                        href={articleIntentGuide.href}
                        prefetch={false}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-center text-xs font-black text-slate-800 transition-colors duration-150 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-sm"
                      >
                        {articleIntentGuide.label}
                      </Link>
                      <Link
                        href="/races/today"
                        prefetch={false}
                        data-preview-state="generic"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-2 text-center text-xs font-black text-white transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-sm"
                      >
                        今日のレース分析へ
                      </Link>
                    </div>
                  </section>
                )}

                {shouldRenderGenericGuide && !articleIntentGuide && (
                  <Link
                    href="/races/today"
                    prefetch={false}
                    data-analytics-placement="article_value_guide"
                    data-analytics-variant="compact_four"
                    data-preview-state="generic"
                    className="mt-4 block min-h-[44px] cursor-pointer rounded-xl border border-blue-200 bg-slate-50 p-3 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:mt-6"
                    aria-label="今日の全レース分析を見る。AI偏差値、対戦比較、展開・脚質、枠順傾向を確認できます"
                  >
                    <section aria-labelledby="article-site-value-title">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 id="article-site-value-title" className="text-sm font-black leading-tight text-slate-950 sm:text-base">
                          今日の全レースを4つの視点で確認
                        </h2>
                        <span className="shrink-0 text-[11px] font-black text-blue-700 sm:text-xs">
                          全レース分析へ <span aria-hidden="true">→</span>
                        </span>
                      </div>
                      <RaceAnalysisValueGrid variant="compact" />
                    </section>
                  </Link>
                )}
              </div>

              {/* アイキャッチは内容を把握した後の補助ビジュアルとして配置 */}
              {shouldShowEyecatch && (
                <div className="relative mt-4 aspect-[16/8] max-h-[180px] w-full overflow-hidden rounded-lg bg-slate-100 sm:mt-7 sm:aspect-[16/6] sm:max-h-[320px]">
                  <img
                    src={article.eyecatch}
                    alt={`${article.title} のアイキャッチ画像`}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </header>

            {/* ===== ARTICLE BODY ===== */}
            <div className="px-1 pb-6 sm:px-0 sm:pb-10">
              <ArticleBody html={enhancedContent} analyticsPrefix="article" />
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
                  href={`/articles/category/${encodeURIComponent(article.category)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-primary sm:gap-2 sm:text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {article.category}の記事をもっと見る
                </Link>
                <Link
                  href="/articles"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 hover:text-primary sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  ほかの記事を確認する
                </Link>
              </div>
            </div>

            <ArticleAfterBodyLayout
              articleSlug={params.slug}
              relatedContent={(
                <div className="pb-6 sm:pb-10">
                  <RelatedArticles currentSlug={params.slug} count={3} />
                </div>
              )}
              adContent={(
                <div className="pb-5 sm:pb-8">
                  <AdUnit slot="1489598374" analyticsPlacement="article_after_body" {...stableArticleAdProps} />
                </div>
              )}
            />

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
