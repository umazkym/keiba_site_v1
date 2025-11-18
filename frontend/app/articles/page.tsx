import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles, getUniqueCategories } from '../../lib/articles';
import type { Metadata } from 'next';

interface ArticlesPageProps {
    searchParams: {
        category?: string;
    };
}

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
    const selectedCategory = searchParams.category;
    // ▼▼▼▼▼【修正】canonical URLの生成ロジックを変更 ▼▼▼▼▼
    let canonicalUrl = '/articles'; 
    let title = "記事一覧 | UMA-FREE";
    let description = "UMA-FREEが提供する競馬データ分析に関する記事の一覧です。コース分析や騎手分析など、馬券検討に役立つ情報をお届けします。";

    if (selectedCategory) {
        title = `${selectedCategory}の記事一覧 | UMA-FREE`;
        description = `${selectedCategory}に関するデータ分析記事の一覧です。`;
        // カテゴリが指定されている場合は、canonical URLにもパラメータを追加
        canonicalUrl = `/articles?category=${encodeURIComponent(selectedCategory)}`;
    }
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
    };
}

// ▼▼▼▼▼【ここから修正】静的テキストを定義 ▼▼▼▼▼
const content = {
    title: "記事一覧",
    allCategoryButton: "すべて",
};
// ▲▲▲▲▲【修正ここまで】▲▲▲▲▲


export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
    const allArticles = getAllArticles();
    const uniqueCategories = getUniqueCategories();
    const selectedCategory = searchParams.category;
    const filteredArticles = selectedCategory ? allArticles.filter((article) => article.category === selectedCategory) : allArticles;
    return (
        <div className="flex flex-col gap-12 py-12 px-4">
            <div className="flex flex-col gap-10">
                <h1 className="text-5xl font-bold text-center text-gray-800">{selectedCategory ? `${selectedCategory}の${content.title}` : content.title}</h1>
                <div className="flex flex-wrap justify-center gap-4">
                    <Link href="/articles" className={`font-bold py-2 px-6 rounded-full transition-all duration-200 shadow-md ${!selectedCategory ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{content.allCategoryButton}</Link>
                    {uniqueCategories.map((category) => (<Link href={`/articles?category=${encodeURIComponent(category)}`} key={category} className={`font-bold py-2 px-6 rounded-full transition-all duration-200 shadow-md ${selectedCategory === category ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{category}</Link>))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {filteredArticles.map((article) => (
                    <Link
                        href={`/articles/${article.slug}`}
                        key={article.slug}
                        className="group flex flex-col h-full border-2 border-gray-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-white hover:translate-y-[-8px] hover:border-indigo-300"
                    >
                        <div className="relative h-48 sm:h-52 md:h-56 w-full overflow-hidden">
                            <Image
                                src={article.eyecatch}
                                alt={article.title}
                                fill
                                style={{ objectFit: 'cover' }}
                                className="transition-transform duration-500 group-hover:scale-110"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        <div className="flex flex-col gap-4 p-6 flex-1">
                            <span className="inline-block w-fit bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                                {article.category}
                            </span>
                            <h2 className="text-xl font-bold text-gray-800 line-clamp-3 group-hover:text-indigo-600 transition-colors duration-200">
                                {article.title}
                            </h2>
                            <p className="text-gray-500 text-sm mt-auto flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(article.date).toLocaleDateString('ja-JP', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                }).replace(/\//g, '/')}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}