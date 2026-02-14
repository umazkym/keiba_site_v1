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
      title: article.title,
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

        <div className="mx-auto px-4 max-w-3xl">
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
              <p className="text-text-muted text-sm font-mono">
                {new Date(article.date).toLocaleDateString('ja-JP')}
              </p>
            </header>

            {article.eyecatch && (
              <div className="relative w-full aspect-video mb-8 rounded-lg overflow-hidden bg-slate-100">
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
              className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg"
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