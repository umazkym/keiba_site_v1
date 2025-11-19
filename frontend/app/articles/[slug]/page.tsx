import { getAllArticleSlugs, getArticleBySlug } from '../../../lib/articles';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArticleSchema } from '@/components/StructuredData';
import { Breadcrumb } from '@/components/Breadcrumb';
import { RelatedArticles } from '@/components/RelatedArticles';

type Props = {
  params: { slug: string };
};

// ページのタイトルなどを動的に設定 (SEO対策)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const article = await getArticleBySlug(params.slug);
    return {
      title: `${article.title} | UMA-FREE`,
      description: article.content.substring(0, 120),
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

// ▼▼▼▼▼ async function に変更 ▼▼▼▼▼
export default async function ArticlePage({ params }: Props) {
  // ▲▲▲▲▲ async function に変更 ▲▲▲▲▲
  try {
    // ▼▼▼▼▼ awaitを追加 ▼▼▼▼▼
    const article = await getArticleBySlug(params.slug);
    // ▲▲▲▲▲ awaitを追加 ▲▲▲▲▲

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
          image={article.eyecatch}
        />

        <div className="container mx-auto px-4 max-w-4xl">
          <Breadcrumb />

          <article className="bg-white p-6 sm:p-8 rounded-lg shadow-sm">
            <header className="mb-8 text-center border-b pb-6">
              <div className="mb-4">
                <Link href={`/articles?category=${encodeURIComponent(article.category)}`} className="text-sm bg-blue-500 text-white font-bold py-1 px-3 rounded-full hover:bg-blue-600 transition-colors">
                  {article.category}
                </Link>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3">
                {article.title}
              </h1>
              <p className="text-gray-500">
                公開日: {new Date(article.date).toLocaleDateString()}
              </p>
            </header>

            {article.eyecatch && (
              <div className="relative w-full h-64 sm:h-80 md:h-96 mb-8 rounded-lg overflow-hidden">
                <Image
                  src={article.eyecatch}
                  alt={`${article.title} のアイキャッチ画像`}
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  style={{ objectFit: 'cover' }}
                  priority
                />
              </div>
            )}

            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <RelatedArticles currentSlug={params.slug} count={3} />
          </article>

          <div className="text-center mt-12">
            <Link href="/articles" className="bg-gray-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-700 transition-colors">
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