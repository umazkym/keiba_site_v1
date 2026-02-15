import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles, getUniqueCategories } from '../../lib/articles';
import { Breadcrumb } from '@/components/Breadcrumb';
import type { Metadata } from 'next';

interface ArticlesPageProps {
    searchParams: {
        category?: string;
    };
}

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
    const selectedCategory = searchParams.category;
    let canonicalUrl = '/articles';
    let title = "記事一覧";
    let description = "UMA-FREEが提供する競馬データ分析に関する記事の一覧です。コース分析や騎手分析など、馬券検討に役立つ情報をお届けします。";

    if (selectedCategory) {
        title = `${selectedCategory}の記事一覧`;
        description = `${selectedCategory}に関するデータ分析記事の一覧です。`;
        // カテゴリが指定されている場合は、canonical URLにもパラメータを追加
        canonicalUrl = `/articles?category=${encodeURIComponent(selectedCategory)}`;
    }


    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
    };
}

const content = {
    title: "記事一覧",
    allCategoryButton: "すべて",
};


export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
    const allArticles = getAllArticles();
    const uniqueCategories = getUniqueCategories();
    const selectedCategory = searchParams.category;
    const filteredArticles = selectedCategory ? allArticles.filter((article) => article.category === selectedCategory) : allArticles;
    return (
        <>
            <Breadcrumb />
            <div className="flex flex-col gap-12 py-12 px-4">
                <div className="flex flex-col gap-10">
                    <h1 className="text-2xl sm:text-4xl font-bold text-center text-text-primary">{selectedCategory ? `${selectedCategory}の${content.title}` : content.title}</h1>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link href="/articles" className={`font-bold py-2 px-6 rounded-full transition-all duration-200 shadow-sm ${!selectedCategory ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{content.allCategoryButton}</Link>
                        {uniqueCategories.map((category) => (<Link href={`/articles?category=${encodeURIComponent(category)}`} key={category} className={`font-bold py-2 px-6 rounded-full transition-all duration-200 shadow-sm ${selectedCategory === category ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{category}</Link>))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                    {filteredArticles.map((article) => (<Link href={`/articles/${article.slug}`} key={article.slug} className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white hover:translate-y-[-2px]"><div className="relative h-40 sm:h-44 md:h-48 w-full overflow-hidden"><Image src={article.eyecatch} alt={article.title} fill style={{ objectFit: 'cover' }} className="transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" /></div><div className="flex flex-col gap-3 p-5"><span className="inline-block w-fit bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">{article.category}</span><h2 className="text-xl font-bold text-gray-800 line-clamp-3">{article.title}</h2>{article.description && <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{article.description}</p>}<p className="text-gray-600 text-sm mt-auto">{new Date(article.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', }).replace(/\//g, '/')}</p></div></Link>))}
                </div>
            </div>
        </>
    );
}