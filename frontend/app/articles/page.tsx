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
            <div className="relative h-48 w-full">
              <Image
                src={article.eyecatch}
                alt={article.title}
                layout="fill"
                objectFit="cover"
                className="transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full mb-3">
                {article.category}
              </span>
              <h2 className="text-xl font-bold mb-2 h-16 group-hover:text-primary-dark">
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