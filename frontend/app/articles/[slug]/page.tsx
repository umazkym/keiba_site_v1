import { getAllArticleSlugs, getArticleBySlug } from '../../../lib/articles';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArticleSchema } from '@/components/StructuredData';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RelatedArticles } from '@/components/RelatedArticles';
import { AdUnit } from '@/components/AdUnit';

type Props = {
  params: { slug: string };
};

// ページのタイトルなどを動的に設定 (SEO対策)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const article = await getArticleBySlug(params.slug);
    // frontmatterのdescriptionを優先、なければコンテンツから生成
    const description = article.description ||
      article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 160);

    // eyecatchをフルURLに変換
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
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: article.title,
          },
        ],
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
    return {
      title: "記事が見つかりません",
    };
  }
}

// ビルド時に静的生成するパスのリストを作成
export async function generateStaticParams() {
  const articles = getAllArticleSlugs();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: Props) {
  try {
    const article = await getArticleBySlug(params.slug);

    // 読了時間の推定（日本語: 約500文字/分）
    const textContent = article.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    const readingTimeMin = Math.max(1, Math.ceil(textContent.length / 500));

    // articleのスキーマを生成
    const articleUrl = `https://uma-free.com/articles/${params.slug}`;
    const datePublished = new Date(article.date).toISOString();
    const dateModified = datePublished;

    return (
      <div className="bg-gray-50 py-12">
        {/* 記事用スキーマ構造化データ */}
        <ArticleSchema
          title={article.title}
          description={article.content.substring(0, 160)}
          url={articleUrl}
          datePublished={datePublished}
          dateModified={dateModified}
          image={article.eyecatch.startsWith('http') ? article.eyecatch : `https://uma-free.com${article.eyecatch}`}
        />

        <div className="mx-auto px-4">
          <Breadcrumb />

          <article className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-slate-100">
            <header className="mb-8 text-center border-b border-slate-100 pb-6">
              <div className="mb-4">
                <Link href={`/articles?category=${encodeURIComponent(article.category)}`} className="text-sm bg-slate-100 text-slate-700 font-bold py-1.5 px-4 rounded-full hover:bg-slate-200 transition-colors">
                  {article.category}
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 leading-tight">
                {article.title}
              </h1>
              <div className="flex items-center justify-center gap-3 text-text-muted text-sm">
                <time dateTime={datePublished}>
                  {new Date(article.date).toLocaleDateString('ja-JP')}
                </time>
                <span className="text-slate-300">|</span>
                <span>約{readingTimeMin}分で読めます</span>
              </div>
            </header>

            {article.eyecatch && (
              <div className="relative w-full md:w-1/2 mx-auto aspect-video mb-8 rounded-lg overflow-hidden bg-slate-100">
                <Image
                  src={article.eyecatch}
                  alt={`${article.title} のアイキャッチ画像`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                  priority
                />
              </div>
            )}

            {/* 広告: アイキャッチ後・記事本文前（読者が記事に入る直前のCTR高位置） */}
            <AdUnit slot="8529703346" placement="inline" />

            <div
              className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-[1.85] prose-p:text-slate-700 prose-a:text-primary prose-a:font-semibold hover:prose-a:text-primary-light prose-img:rounded-xl prose-img:shadow-sm prose-blockquote:border-l-4 prose-blockquote:border-primary/20 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-700 mt-8"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* 広告: 記事本文後・関連記事前（読了直後のエンゲージメント最高潮） */}
            <AdUnit slot="1489598374" placement="inline" />

            <RelatedArticles currentSlug={params.slug} count={3} />

            {/* 広告: 関連記事後（次ページ遷移前のインプレッション） */}
            <AdUnit slot="9407670747" placement="inline" />
          </article>

          <div className="text-center mt-12">
            <Link href="/articles" className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary-dark transition-colors">
              記事一覧へ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}