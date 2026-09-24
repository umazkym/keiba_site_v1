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
import { ArticleCover, ArticleMetaRow, ArticleToc, ArticleValueGuide } from '@/components/ArticleParts';
import { LineIcon } from '@/components/LineIcon';
import { estimateReadingMinutes, pickArticleCover } from '@/lib/article-visual';
import { ArticleRaceBridgeExperiment } from '@/components/ArticleRaceBridgeExperiment';
import { ArticleAfterBodyLayout } from '@/components/ArticleAfterBodyLayout';
import { getArticleRacePreview } from '@/lib/api';
import { hasValidArticleRaceBridgeMetadata, shouldRenderArticleRaceBridge } from '@/lib/article-race-bridge';
import { resolveArticleCanonicalPath } from '@/lib/article-canonical';

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
    // OG画像は題名入りのブランドの画像（app/og/[slug]/route.tsx）。汎用のアイキャッチでは記事の区別がつかないため。
    const imageUrl = `https://uma-free.com/og/${encodeURIComponent(params.slug)}.png`;

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
    const readingTimeMin = estimateReadingMinutes(article.content);
    const { html: enhancedContent, toc } = enhanceArticleHtml(article.content);
    const articleFaqs = extractArticleFaqs(article.content);

    const canonicalPath = resolveArticleCanonicalPath(article, params.slug);
    const articleUrl = `https://uma-free.com${canonicalPath}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = new Date(article.lastUpdated || article.date).toISOString();
    // 冒頭の写真：記事ごとのアイキャッチ、無ければカテゴリ（重賞は季節）の写真
    const cover = pickArticleCover(article);
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
      <div className="article-detail-scope min-h-screen bg-white pb-2 pt-1 sm:py-8">
        <ArticleSchema
          title={article.title}
          description={article.description || textContent.substring(0, 160)}
          url={articleUrl}
          datePublished={datePublished}
          dateModified={dateModified}
          image={`https://uma-free.com/og/${encodeURIComponent(params.slug)}.png`}
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

        <div className="site-shell-article mx-auto max-w-[1080px] px-4 sm:px-6">
          <Breadcrumb />

          <article
            data-article-slug={params.slug}
            data-content-group={contentGroup}
            data-race-phase={racePhase}
          >
            {/* ===== ARTICLE HEADER =====
                見出し → リード → カテゴリ・日付・読了時間 → （対応するレースへの導線）→ 写真 → 今日の全レースへの案内 → 目次 */}
            <header className="flex max-w-[760px] flex-col gap-4 border-b border-slate-200 pb-7 sm:gap-5 sm:pb-9">
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

              <ArticleCover cover={cover} title={article.title} />

              {shouldRenderGenericGuide && articleIntentGuide && (
                <section
                  aria-labelledby="article-intent-guide-title"
                  className="rounded-[14px] bg-brand-50/70 p-3 ring-1 ring-inset ring-brand-200 sm:p-4"
                  data-analytics-placement="article_intent_guide"
                >
                  <h2 id="article-intent-guide-title" className="font-sans text-[14.5px] font-bold leading-tight text-slate-900 sm:text-[15.5px]">
                    記事の内容を当日のレースへつなげる
                  </h2>
                  <div className="mt-2">
                    <RaceAnalysisValueGrid variant="compact" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={articleIntentGuide.href} prefetch={false} className="ui-btn ui-btn--secondary px-2 text-center text-[14px]">
                      {articleIntentGuide.label}
                    </Link>
                    <Link href="/races/today" prefetch={false} data-preview-state="generic" className="ui-btn ui-btn--primary px-2 text-center text-[14px]">
                      今日のレース分析へ
                    </Link>
                  </div>
                </section>
              )}

              {shouldRenderGenericGuide && !articleIntentGuide && (
                <ArticleValueGuide headingId="article-site-value-title" />
              )}

              <ArticleToc toc={toc} headingId="article-toc-heading" />
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pb-6 pt-5 sm:pb-8 sm:pt-6">
              <Link
                href={`/articles/category/${encodeURIComponent(article.category)}`}
                className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-600"
              >
                {article.category}の記事をもっと読む
                <LineIcon name="chevR" size={16} className="block" />
              </Link>
              <Link href="/articles" className="ui-btn ui-btn--secondary gap-1.5 text-[14px]">
                <LineIcon name="book" size={18} className="block" />
                記事の一覧へ
              </Link>
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
