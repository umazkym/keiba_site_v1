import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles, getUniqueCategories, getUniqueTags } from '../../lib/articles';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AdUnit } from '@/components/AdUnit';
import { MultiplexAd } from '@/components/MultiplexAd';
import type { Metadata } from 'next';

interface ArticlesPageProps {
    searchParams: {
        category?: string;
        tag?: string;
    };
}

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
    const selectedCategory = searchParams.category;
    let canonicalUrl = '/articles';
    // ★ SEO改善: 検索クエリ「競馬データ分析 サイト」(月24表示/0クリック)、
    // 「競馬データ分析 無料」(月14表示/0クリック)に対応するtitle/descriptionに変更
    // 旧: 「記事一覧」→ 検索意図との関連が薄くCTR 0%
    // 新: 「無料」「データ分析」「統計」を明示し、検索結果での訴求力を向上
    let title = "競馬データ分析の記事一覧 | 無料で読める統計分析コラム";
    let description = "競馬のデータ分析・統計情報を無料で提供。馬場状態の影響、騎手の得意コース、枠順傾向、体重変動と勝率の関係など、馬券検討に役立つデータ分析記事を多数掲載。登録不要で全記事を閲覧できます。";

    if (selectedCategory) {
        title = `${selectedCategory}のデータ分析記事 | 競馬統計コラム`;
        description = `${selectedCategory}に関する競馬データ分析記事の一覧です。過去5年以上のデータに基づく統計分析で、馬券検討をサポートします。`;
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

// 読了時間の推定（日本語: 約500文字/分）
function getReadingTime(content: string): number {
    const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    return Math.max(1, Math.ceil(text.length / 500));
}

// 14日以内の記事に「NEW」バッジを付与
function isNewArticle(dateStr: string): boolean {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
}

export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
    const allArticles = getAllArticles();
    const uniqueCategories = getUniqueCategories();
    const selectedCategory = searchParams.category;
    const selectedTag = searchParams.tag;

    // Get tags related to the selected category (or empty if everything)
    const uniqueTags = selectedCategory ? getUniqueTags(selectedCategory) : [];

    let filteredArticles = selectedCategory
        ? allArticles.filter((article) => article.category === selectedCategory)
        : allArticles;

    if (selectedTag) {
        filteredArticles = filteredArticles.filter((article) => 
            article.tags && article.tags.includes(selectedTag)
        );
    }

    const featuredArticle = filteredArticles[0];
    const regularArticles = filteredArticles.slice(1);

    return (
        <>
            {/* ===== LIGHT HERO BANNER ===== */}
            <div className="relative -mx-3 sm:-mx-4 md:-mx-6 bg-white overflow-hidden border-b border-slate-100">


                <div className="relative px-4 sm:px-6 pt-8 sm:pt-10 pb-0">
                    {/* ページタイトルエリア */}
                    <div className="flex items-start justify-between mb-7">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-primary font-bold text-xs tracking-wider">
                                    競馬データ分析・コラム
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none tracking-tight">
                                {selectedCategory ? (
                                    <>
                                        <span className="text-primary">{selectedCategory}</span>
                                        <span className="text-slate-500 text-2xl font-bold ml-2">の記事</span>
                                    </>
                                ) : (
                                    'データ分析記事'
                                )}
                            </h1>
                            <p className="text-slate-500 text-sm mt-2 font-medium">
                                全 {filteredArticles.length} 件の記事
                            </p>
                        </div>
                    </div>

                    {/* ===== TIER 1: CATEGORY FILTERS ===== */}
                    <div className={`flex flex-wrap gap-2.5 ${selectedCategory && uniqueTags.length > 0 ? 'pb-3' : 'pb-6'}`}>
                        <Link
                            href="/articles"
                            className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${!selectedCategory
                                    ? 'bg-primary text-white border-primary shadow-[0_4px_14px_rgba(15,23,42,0.2)]'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            すべて
                        </Link>
                        {uniqueCategories.map((cat) => (
                            <Link
                                key={cat}
                                href={`/articles?category=${encodeURIComponent(cat)}`}
                                className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${selectedCategory === cat
                                        ? 'bg-primary text-white border-primary shadow-[0_4px_14px_rgba(15,23,42,0.2)]'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                            >
                                {cat}
                            </Link>
                        ))}
                    </div>

                    {/* ===== TIER 2: TAG FILTERS ===== */}
                    {selectedCategory && uniqueTags.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 pb-6 pt-1">
                            <Link
                                href={`/articles?category=${encodeURIComponent(selectedCategory)}`}
                                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${!selectedTag
                                        ? 'bg-slate-700 text-white border-slate-700'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                すべて
                            </Link>
                            {uniqueTags.map((tag) => (
                                <Link
                                    key={tag}
                                    href={`/articles?category=${encodeURIComponent(selectedCategory)}&tag=${encodeURIComponent(tag)}`}
                                    className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${selectedTag === tag
                                            ? 'bg-slate-700 text-white border-slate-700'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== BREADCRUMB ===== */}
            <Breadcrumb />

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex flex-col gap-10 pb-12 max-w-[1200px] mx-auto w-full mt-2">

                {/* 広告: カテゴリフィルター後 */}
                <AdUnit slot="1489598374" placement="inline" />

                {filteredArticles.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="text-5xl mb-4 opacity-20">🏇</div>
                        <p className="text-slate-500 text-lg font-medium">該当する記事がありません</p>
                        <Link
                            href="/articles"
                            className="mt-4 inline-block text-primary font-bold hover:text-primary-light transition-colors text-sm"
                        >
                            ← すべての記事を見る
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* ===== FEATURED ARTICLE (1件目) ===== */}
                        {featuredArticle && (
                            <div className="mt-2">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                        注目の記事
                                    </h2>
                                </div>
                                <Link
                                    href={`/articles/${featuredArticle.slug}`}
                                    className="group block bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="flex flex-col md:flex-col">
                                        {/* 大きなサムネイル（オーバーレイなし） */}
                                        <div className="relative w-full h-[240px] sm:h-[320px] md:h-[400px] bg-slate-100 overflow-hidden shrink-0">
                                            <Image
                                                src={featuredArticle.eyecatch}
                                                alt={featuredArticle.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, 1200px"
                                                style={{ objectFit: 'cover' }}
                                                className="group-hover:scale-105 transition-transform duration-700 ease-out"
                                                priority
                                            />
                                            {/* 新着バッジ */}
                                            {isNewArticle(featuredArticle.date) && (
                                                <div className="absolute top-4 left-4 bg-red-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md tracking-wide">
                                                    新着記事
                                                </div>
                                            )}
                                        </div>

                                        {/* クリーンな白背景のコンテンツエリア */}
                                        <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                                                <span className="bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold px-3 py-1 rounded-md">
                                                    {featuredArticle.category}
                                                </span>
                                                <span className="text-slate-400 text-sm font-medium">
                                                    {new Date(featuredArticle.date).toLocaleDateString('ja-JP', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                    })}
                                                </span>
                                                <span className="text-slate-400 text-sm flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    約{getReadingTime(featuredArticle.content)}分
                                                </span>
                                            </div>
                                            
                                            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug mb-4 group-hover:text-primary transition-colors duration-300">
                                                {featuredArticle.title}
                                            </h3>
                                            
                                            {featuredArticle.description && (
                                                <p className="text-slate-500 text-base leading-relaxed line-clamp-3 mb-6">
                                                    {featuredArticle.description}
                                                </p>
                                            )}
                                            
                                            <div className="inline-flex items-center gap-2 text-primary font-bold text-sm bg-slate-50 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition-colors self-start w-fit">
                                                記事を読む
                                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )}

                        {/* ===== REGULAR ARTICLES GRID ===== */}
                        {regularArticles.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-slate-300 rounded-full" />
                                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
                                        記事一覧
                                    </h2>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                                    {regularArticles.map((article, index) => (
                                        <React.Fragment key={article.slug}>
                                            <Link
                                                href={`/articles/${article.slug}`}
                                                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1"
                                            >
                                                {/* サムネイル */}
                                                <div className="relative h-48 overflow-hidden bg-slate-100 shrink-0">
                                                    <Image
                                                        src={article.eyecatch}
                                                        alt={article.title}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                        style={{ objectFit: 'cover' }}
                                                        className="transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    {/* 新着バッジ */}
                                                    {isNewArticle(article.date) && (
                                                        <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm">
                                                            新着記事
                                                        </div>
                                                    )}
                                                </div>

                                                {/* カード本文 */}
                                                <div className="flex flex-col flex-1 p-5">
                                                    {/* カテゴリバッジ */}
                                                    <div className="mb-3">
                                                        <span className="inline-flex bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold px-2.5 py-1 rounded-md">
                                                            {article.category}
                                                        </span>
                                                    </div>

                                                    {/* タイトル */}
                                                    <h3 className="font-extrabold text-[16px] text-slate-900 line-clamp-2 leading-snug mb-3 group-hover:text-primary transition-colors flex-1">
                                                        {article.title}
                                                    </h3>

                                                    {/* 説明文 */}
                                                    {article.description && (
                                                        <p className="text-slate-500 text-[13px] leading-relaxed line-clamp-2 mb-4">
                                                            {article.description}
                                                        </p>
                                                    )}

                                                    {/* フッター: 日付 + 読了時間 */}
                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                                                        <time
                                                            dateTime={new Date(article.date).toISOString()}
                                                            className="text-slate-400 text-xs font-medium"
                                                        >
                                                            {new Date(article.date).toLocaleDateString('ja-JP', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                            })}
                                                        </time>
                                                        <span className="text-slate-400 text-xs flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            約{getReadingTime(article.content)}分
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>

                                            {/* インフィード広告: 4番目と9番目の後 */}
                                            {(index === 3 || index === 8) && regularArticles.length > index + 1 && (
                                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 pb-2 pt-2">
                                                    <AdUnit slot="8529703346" placement="inline" />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* MultiplexAd: 読了後 */}
                <div className="pt-4">
                    <MultiplexAd slot="9407670747" />
                </div>
            </div>
        </>
    );
}