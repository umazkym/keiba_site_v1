import { getAllArticleSlugs, getArticleBySlug } from '../../../lib/articles';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArticleSchema } from '@/components/StructuredData';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RelatedArticles } from '@/components/RelatedArticles';
import { AdUnit } from '@/components/AdUnit';
import { MultiplexAd } from '@/components/MultiplexAd';
import { enhanceArticleHtml, getArticleIntent } from '@/lib/article-ux';
import { ArticleIntentPanel } from '@/components/ArticleIntentPanel';

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const article = await getArticleBySlug(params.slug);
    // ★ SEO改善: descriptionのfallbackに「競馬データ分析」を含めて検索クエリとの関連性を強化
    // 記事のdescriptionが設定されていない場合、本文冒頭から「競馬データ分析」を前置して生成
    const rawDescription = article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 140);
    const description = article.description ||
      `【競馬データ分析】${rawDescription}...`;

    const imageUrl = article.eyecatch.startsWith('http')
      ? article.eyecatch
      : `https://uma-free.com${article.eyecatch}`;

    return {
      title: article.title,
      description,
      openGraph: {
        title: article.title,
        description,
        url: `https://uma-free.com/articles/${params.slug}`,
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
        canonical: `/articles/${params.slug}`,
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
    const intent = getArticleIntent(article);

    const articleUrl = `https://uma-free.com/articles/${params.slug}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = new Date(article.lastUpdated || article.date).toISOString();

    const proseClass = [
      "prose prose-slate max-w-none",
      "prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900",
      "prose-h2:text-2xl prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-3 prose-h2:mt-12 prose-h2:mb-6 prose-h2:scroll-mt-24",
      "prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3",
      "prose-p:leading-[1.9] prose-p:text-slate-600",
      "prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-blue-600",
      "prose-strong:text-slate-900 prose-strong:font-bold",
      "prose-img:border prose-img:border-slate-100",
      "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic prose-blockquote:text-slate-700",
      "prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 prose-code:font-mono prose-code:text-sm",
      "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl",
      "prose-ul:marker:text-slate-400 prose-ol:marker:text-slate-400 prose-ol:marker:font-bold",
    ].join(' ');

    return (
      <div className="min-h-screen bg-white py-5 sm:py-8">
        <ArticleSchema
          title={article.title}
          description={article.description || textContent.substring(0, 160)}
          url={articleUrl}
          datePublished={datePublished}
          dateModified={dateModified}
          image={article.eyecatch.startsWith('http') ? article.eyecatch : `https://uma-free.com${article.eyecatch}`}
        />

        <div className="mx-auto max-w-[920px] px-4">
          <Breadcrumb />

          <article>

            {/* ===== ARTICLE HEADER ===== */}
            <header className="relative border-b border-slate-200 pb-8">
              {/* アイキャッチ画像（フルワイド） */}
              {article.eyecatch && (
                <div className="relative mb-7 aspect-[16/9] max-h-[320px] w-full overflow-hidden bg-slate-100 sm:aspect-[16/6]">
                  <Image
                    src={article.eyecatch}
                    alt={`${article.title} のアイキャッチ画像`}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    style={{ objectFit: 'cover' }}
                    priority
                  />
                </div>
              )}

              {/* メタ情報 + タイトル */}
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400 sm:text-sm">
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
                <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
                  {article.title}
                </h1>

                {/* リードテキスト */}
                {article.description && (
                  <p className="mt-5 max-w-3xl text-base leading-8 text-slate-500 sm:text-lg">
                    {article.description}
                  </p>
                )}
              </div>
            </header>

            <div className="mt-6">
              <ArticleIntentPanel intent={intent} />
            </div>

            {toc.length > 1 && (
              <details className="mt-4 border border-slate-200 bg-slate-50" aria-label="記事の目次">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-800">
                  本文の流れを見る
                </summary>
                <ol className="grid gap-2 border-t border-slate-200 px-4 py-3 sm:grid-cols-2">
                  {toc.map((item, index) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="flex gap-2 text-sm font-semibold leading-6 text-slate-600 transition-colors hover:text-primary"
                      >
                        <span className="font-mono text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                        <span>{item.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            {/* ===== ARTICLE BODY ===== */}
            <div className="pb-10">
              {(() => {
                const h2Positions: number[] = [];
                const searchRegex = /<h2[\s>]/gi;
                let match;
                while ((match = searchRegex.exec(enhancedContent)) !== null) {
                  h2Positions.push(match.index);
                }

                if (h2Positions.length >= 7) {
                  const split1 = h2Positions[1];
                  const split2 = h2Positions[4];
                  const part1 = enhancedContent.substring(0, split1);
                  const part2 = enhancedContent.substring(split1, split2);
                  const part3 = enhancedContent.substring(split2);
                  return (
                    <>
                      <div className={`${proseClass} mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part1 }} />
                      <AdUnit slot="1489598374" placement="inline" analyticsPlacement="article_after_intro" />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: part2 }} />
                      <AdUnit slot="9407670747" placement="inline" analyticsPlacement="article_mid" />
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
                      <div className={`${proseClass} mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: firstPart }} />
                      <AdUnit slot="1489598374" placement="inline" analyticsPlacement="article_after_intro" />
                      <div className={`${proseClass} sm:prose-lg`} dangerouslySetInnerHTML={{ __html: secondPart }} />
                    </>
                  );
                }

                return (
                  <div className={`${proseClass} mt-8 sm:prose-lg`} dangerouslySetInnerHTML={{ __html: enhancedContent }} />
                );
              })()}
            </div>

            {/* ===== 記事フッター ===== */}
            <div className="border-t border-slate-200 pb-8 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href={`/articles?category=${encodeURIComponent(article.category)}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {article.category}の記事をもっと見る
                </Link>
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-2 bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-primary"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  記事一覧へ
                </Link>
              </div>
            </div>

            {/* ===== 広告: 記事本文後 ===== */}
            <div className="pb-8">
              <AdUnit slot="1489598374" placement="inline" analyticsPlacement="article_after_body" />
            </div>

            {/* ===== 関連記事 ===== */}
            <div className="pb-10">
              <RelatedArticles currentSlug={params.slug} count={3} />
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
