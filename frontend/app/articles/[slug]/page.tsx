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

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const article = await getArticleBySlug(params.slug);
    const description = article.description ||
      article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 160);

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

    const articleUrl = `https://uma-free.com/articles/${params.slug}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = datePublished;

    const proseClass = [
      "prose prose-slate prose-lg max-w-none",
      "prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900",
      "prose-h2:text-2xl prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-3 prose-h2:mt-12 prose-h2:mb-6",
      "prose-h3:text-xl prose-h3:mt-8",
      "prose-p:leading-[1.9] prose-p:text-slate-600",
      "prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-blue-600",
      "prose-strong:text-slate-900 prose-strong:font-bold",
      "prose-img:rounded-2xl prose-img:shadow-md",
      "prose-blockquote:border-l-4 prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50/50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-slate-700",
      "prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 prose-code:font-mono prose-code:text-sm",
      "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl",
      "prose-ul:marker:text-blue-500 prose-ol:marker:text-blue-500 prose-ol:marker:font-bold",
    ].join(' ');

    return (
      <div className="bg-slate-50 min-h-screen py-6 sm:py-10">
        <ArticleSchema
          title={article.title}
          description={article.content.substring(0, 160)}
          url={articleUrl}
          datePublished={datePublished}
          dateModified={dateModified}
          image={article.eyecatch.startsWith('http') ? article.eyecatch : `https://uma-free.com${article.eyecatch}`}
        />

        <div className="mx-auto px-4 max-w-3xl">
          <Breadcrumb />

          <article className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

            {/* ===== ARTICLE HEADER ===== */}
            <header className="relative">
              {/* アイキャッチ画像（フルワイド） */}
              {article.eyecatch && (
                <div className="relative w-full aspect-[16/7] overflow-hidden bg-slate-200">
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
              <div className="px-6 sm:px-10 pt-8 pb-8 border-b border-slate-100">
                {/* カテゴリ + バッジ群 */}
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  <Link
                    href={`/articles?category=${encodeURIComponent(article.category)}`}
                    className="bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold py-1.5 px-4 rounded-full hover:bg-blue-100 transition-colors duration-200 tracking-wide"
                  >
                    {article.category}
                  </Link>
                  <span className="text-slate-300">|</span>
                  <time
                    dateTime={datePublished}
                    className="text-slate-400 text-sm font-medium"
                  >
                    {new Date(article.date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400 text-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    約{readingTimeMin}分で読めます
                  </span>
                </div>

                {/* タイトル */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                  {article.title}
                </h1>

                {/* リードテキスト */}
                {article.description && (
                  <p className="mt-4 text-base text-slate-500 leading-relaxed border-l-4 border-blue-400 pl-4 bg-slate-50 py-3 pr-4 rounded-r-lg">
                    {article.description}
                  </p>
                )}
              </div>
            </header>

            {/* ===== 広告: アイキャッチ後・記事本文前 ===== */}
            <div className="px-6 sm:px-10 pt-6">
              <AdUnit slot="8529703346" placement="inline" />
            </div>

            {/* ===== ARTICLE BODY ===== */}
            <div className="px-6 sm:px-10 pb-10">
              {(() => {
                const h2Positions: number[] = [];
                const searchRegex = /<h2[\s>]/gi;
                let match;
                while ((match = searchRegex.exec(article.content)) !== null) {
                  h2Positions.push(match.index);
                }

                if (h2Positions.length >= 7) {
                  const split1 = h2Positions[1];
                  const split2 = h2Positions[4];
                  const part1 = article.content.substring(0, split1);
                  const part2 = article.content.substring(split1, split2);
                  const part3 = article.content.substring(split2);
                  return (
                    <>
                      <div className={`${proseClass} mt-8`} dangerouslySetInnerHTML={{ __html: part1 }} />
                      <AdUnit slot="1489598374" placement="inline" />
                      <div className={proseClass} dangerouslySetInnerHTML={{ __html: part2 }} />
                      <AdUnit slot="9407670747" placement="inline" />
                      <div className={proseClass} dangerouslySetInnerHTML={{ __html: part3 }} />
                    </>
                  );
                }

                if (h2Positions.length >= 4) {
                  const splitPos = h2Positions[1];
                  const firstPart = article.content.substring(0, splitPos);
                  const secondPart = article.content.substring(splitPos);
                  return (
                    <>
                      <div className={`${proseClass} mt-8`} dangerouslySetInnerHTML={{ __html: firstPart }} />
                      <AdUnit slot="1489598374" placement="inline" />
                      <div className={proseClass} dangerouslySetInnerHTML={{ __html: secondPart }} />
                    </>
                  );
                }

                return (
                  <div className={`${proseClass} mt-8`} dangerouslySetInnerHTML={{ __html: article.content }} />
                );
              })()}
            </div>

            {/* ===== 記事フッター ===== */}
            <div className="px-6 sm:px-10 pb-8 border-t border-slate-100 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  href={`/articles?category=${encodeURIComponent(article.category)}`}
                  className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {article.category}の記事をもっと見る
                </Link>
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-primary-light transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  記事一覧へ
                </Link>
              </div>
            </div>

            {/* ===== 広告: 記事本文後 ===== */}
            <div className="px-6 sm:px-10 pb-8">
              <AdUnit slot="1489598374" placement="inline" />
            </div>

            {/* ===== 関連記事 ===== */}
            <div className="px-6 sm:px-10 pb-10">
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