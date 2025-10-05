// app/articles/page.tsx (ArticlesPage 全文 - 修正済み)
import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles, getUniqueCategories, Article } from '../../lib/articles';

interface ArticlesPageProps {
  searchParams: {
    category?: string;
  };
}

export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
  // サーバーサイドで全記事とカテゴリを取得
  const allArticles = getAllArticles();
  const uniqueCategories = getUniqueCategories();

  const selectedCategory = searchParams.category;

  const filteredArticles = selectedCategory
    ? allArticles.filter((article) => article.category === selectedCategory)
    : allArticles;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-10">
        {selectedCategory ? `${selectedCategory}の記事一覧` : "記事一覧"}
      </h1>

      {/* カテゴリーフィルターボタン */}
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        <Link 
          href="/articles" 
          className={`font-bold py-2 px-5 rounded-full transition-colors shadow-md ${!selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          すべて
        </Link>
        {uniqueCategories.map((category) => (
          <Link
            href={`/articles?category=${encodeURIComponent(category)}`}
            key={category}
            className={`font-bold py-2 px-5 rounded-full transition-colors shadow-md ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {category}
          </Link>
        ))}
      </div>

      {/* 記事一覧グリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredArticles.map((article) => (
          <Link href={`/articles/${article.slug}`} key={article.slug} className="block group border rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 bg-white">
            {/* 画像：レスポンシブ高さを指定 */}
            <div className="relative h-40 sm:h-44 md:h-48 w-full">
              <Image
                src={article.eyecatch}
                alt={article.title}
                fill
                style={{ objectFit: 'cover' }}
                className="transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>
            <div className="p-5">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mb-3">
                {article.category}
              </span>

              {/* タイトルを最大3行に制限（スマホでもPCでも被らない） */}
              <h2
                className="text-xl font-bold mb-2 group-hover:text-primary-dark"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minHeight: '4.5rem' /* 3行分の高さを確保 */
                }}
              >
                {article.title}
              </h2>

              <p className="text-gray-600 text-sm">
                {new Date(article.date).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
