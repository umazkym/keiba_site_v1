import Link from 'next/link';
import { getAllArticles } from '@/lib/articles';
import { format } from 'date-fns';

export const metadata = {
  title: 'データ分析記事一覧 | UMA-FREE',
  description: 'AIと独自のデータ分析に基づいた競馬攻略記事の一覧です。最新のインサイトであなたの予想をアップグレードします。',
};

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">
        データ分析記事一覧
      </h1>
      <p className="text-center text-gray-500 mb-8">
        AIとデータで競馬の新しい楽しみ方を見つけよう
      </p>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="block group bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.frontmatter.eyecatch}
                alt={`${article.frontmatter.title}のアイキャッチ画像`}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 transition-all duration-300"></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-2">
                {format(new Date(article.frontmatter.date), 'yyyy年MM月dd日')}
              </p>
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors duration-300 mb-3">
                {article.frontmatter.title}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                {article.frontmatter.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}