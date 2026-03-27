import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles, getUniqueCategories } from '../../lib/articles';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AdUnit } from '@/components/AdUnit';
import { MultiplexAd } from '@/components/MultiplexAd';
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
            <div className="flex flex-col gap-10 py-8 sm:py-12 px-4 max-w-[1200px] mx-auto w-full">
                <div className="flex flex-col gap-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-center text-text-primary tracking-tight">
                        {selectedCategory ? `${selectedCategory}の${content.title}` : content.title}
                    </h1>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Link href="/articles" className={`font-bold py-2 px-5 sm:px-6 text-sm sm:text-base rounded-full transition-all duration-200 shadow-sm ${!selectedCategory ? 'bg-primary text-white shadow-md' : 'bg-surface border border-slate-200 text-text-secondary hover:bg-slate-50 hover:text-primary-dark hover:border-primary-light'}`}>{content.allCategoryButton}</Link>
                        {uniqueCategories.map((category) => (<Link href={`/articles?category=${encodeURIComponent(category)}`} key={category} className={`font-bold py-2 px-5 sm:px-6 text-sm sm:text-base rounded-full transition-all duration-200 shadow-sm ${selectedCategory === category ? 'bg-primary text-white shadow-md' : 'bg-surface border border-slate-200 text-text-secondary hover:bg-slate-50 hover:text-primary-dark hover:border-primary-light'}`}>{category}</Link>))}
                    </div>
                </div>
                {/* 広告: カテゴリフィルター後・記事グリッド前 */}
                <AdUnit slot="1489598374" placement="inline" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full mt-4">
                    {filteredArticles.map((article, index) => (
                        <React.Fragment key={article.slug}>
                            <Link href={`/articles/${article.slug}`} className="card group flex flex-col h-full overflow-hidden transition-all duration-300 hover-lift"><div className="relative h-48 w-full overflow-hidden"><Image src={article.eyecatch} alt={article.title} fill style={{ objectFit: 'cover' }} className="transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" /></div><div className="flex flex-col gap-3 p-5 sm:p-6 bg-white flex-grow"><span className="inline-block w-fit bg-slate-200 light text-primary-dark text-xs font-bold px-3 py-1 rounded-full">{article.category}</span><h2 className="text-lg sm:text-xl font-bold text-text-primary line-clamp-2 group-hover:text-primary transition-colors">{article.title}</h2>{article.description && <p className="text-text-secondary text-sm leading-relaxed line-clamp-2 mt-1">{article.description}</p>}<p className="text-text-muted text-xs sm:text-sm font-medium mt-auto pt-4 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{new Date(article.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', }).replace(/\//g, '/')}</p></div></Link>
                            {/* インフィード広告: 5番目と10番目の記事の後に挿入 */}
                            {(index === 4 || index === 9) && filteredArticles.length > index + 1 && (
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                                    <AdUnit slot="8529703346" placement="inline" />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                {/* ★ MultiplexAd: 記事一覧読了後（views/user 5.22・滞在100秒の高エンゲージ読者向け）
                     GAデータ: 記事一覧は全ページ中最高のエンゲージメント指標だが収益$0.01。
                     関連コンテンツ風広告で回遊を促しつつ収益化 */}
                <MultiplexAd slot="8529703346" />
            </div>
        </>
    );
}