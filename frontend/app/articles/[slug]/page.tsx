import { getAllArticleSlugs, getArticleData } from '@/lib/articles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  params: {
    slug: string;
  };
};

// 動的なメタデータ（タイトル、説明）を生成
export async function generateMetadata({ params }: Props) {
  const articleData = getArticleData(params.slug);
  return {
    title: articleData.frontmatter.title,
    description: articleData.frontmatter.description,
  };
}

// 記事ページ本体
export default function ArticlePage({ params }: Props) {
  const articleData = getArticleData(params.slug);

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-2">
              {articleData.frontmatter.title}
            </h1>
            <p className="text-gray-500 text-sm">
              公開日: {articleData.frontmatter.date}
            </p>
          </header>
          
          {articleData.frontmatter.eyecatch && (
            <div className="mb-8">
              <img 
                src={articleData.frontmatter.eyecatch} 
                alt={articleData.frontmatter.title}
                className="w-full h-auto rounded-lg object-cover" 
              />
            </div>
          )}

          <div className="prose prose-lg max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {articleData.content}
            </ReactMarkdown>
          </div>
        </article>
      </main>
    </div>
  );
}

// ビルド時に静的なパスを生成
export async function generateStaticParams() {
    const paths = getAllArticleSlugs();
    return paths;
}