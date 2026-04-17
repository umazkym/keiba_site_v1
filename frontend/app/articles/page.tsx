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
    const filteredArticles = selectedCategory
        ? allArticles.filter((article) => article.category === selectedCategory)
        : allArticles;

    const featuredArticle = filteredArticles[0];
    const regularArticles = filteredArticles.slice(1);

    return (
        <>
            {/* ===== DARK HERO BANNER ===== */}
            <div className="relative -mx-3 sm:-mx-4 md:-mx-6 bg-slate-900 overflow-hidden">
                {/* 斜線パターン背景 */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(-45deg, #fff 0px, #fff 1px, transparent 1px, transparent 12px)',
                    }}
                />
                {/* アンバーグロー */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative px-4 sm:px-6 pt-8 sm:pt-10 pb-0">
                    {/* ページタイトルエリア */}
                    <div className="flex items-start justify-between mb-7">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="w-2 h-2 rounded-full bg-amber-400/50" />
                                    <span className="w-2 h-2 rounded-full bg-amber-400/20" />
                                </div>
                                <span className="text-amber-400/80 text-xs font-bold uppercase tracking-[0.25em]">
                                    Analysis Articles
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">
                                {selectedCategory ? (
                                    <>
                                        <span className="text-amber-400">{selectedCategory}</span>
                                        <span className="text-white/60 text-2xl font-bold ml-2">の記事</span>
                                    </>
                                ) : (
                                    '分析記事'
                                )}
                            </h1>
                            <p className="text-slate-500 text-sm mt-2 font-medium">
                                {filteredArticles.length}件の記事
                            </p>
                        </div>
                        {/* 装飾テキスト */}
                        <div
                            className="hidden sm:block text-right select-none pointer-events-none"
                            aria-hidden="true"
                        >
                            <div className="text-6xl font-black text-white/[0.03] leading-none tracking-tighter">
                                DATA
                            </div>
                            <div className="text-6xl font-black text-white/[0.03] leading-none tracking-tighter -mt-2">
                                BASE
                            </div>
                        </div>
                    </div>

                    {/* ===== CATEGORY FILTERS ===== */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-6">
                        <Link
                            href="/articles"
                            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 border ${!selectedCategory
                                    ? 'bg-amber-400 text-slate-900 border-amber-400 shadow-lg shadow-amber-500/20'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            すべて
                        </Link>
                        {uniqueCategories.map((cat) => (
                            <Link
                                key={cat}
                                href={`/articles?category=${encodeURIComponent(cat)}`}
                                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 border ${selectedCategory === cat
                                        ? 'bg-amber-400 text-slate-900 border-amber-400 shadow-lg shadow-amber-500/20'
                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {cat}
                            </Link>
                        ))}
                    </div>

                    {/* アクセントライン */}
                    <div className="h-px bg-gradient-to-r from-amber-400/40 via-amber-400/10 to-transparent" />
                </div>
            </div>

            {/* ===== BREADCRUMB ===== */}
            <Breadcrumb />

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex flex-col gap-10 pb-12 max-w-[1200px] mx-auto w-full">

                {/* 広告: カテゴリフィルター後 */}
                <AdUnit slot="1489598374" placement="inline" />

                {filteredArticles.length === 0 ? (
                    <div className="text-center py-24">
                        <div className="text-5xl mb-4 opacity-20">🏇</div>
                        <p className="text-slate-400 text-lg font-medium">該当する記事がありません</p>
                        <Link
                            href="/articles"
                            className="mt-4 inline-block text-primary font-bold hover:text-amber-600 transition-colors text-sm"
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
                                    <div className="w-1 h-5 bg-amber-400 rounded-full" />
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                                        Featured
                                    </span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>
                                <Link
                                    href={`/articles/${featuredArticle.slug}`}
                                    className="group block"
                                >
                                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 h-[260px] sm:h-[380px] md:h-[440px]">
                                        <Image
                                            src={featuredArticle.eyecatch}
                                            alt={featuredArticle.title}
                                            fill
                                            sizes="100vw"
                                            style={{ objectFit: 'cover' }}
                                            className="opacity-50 group-hover:opacity-60 group-hover:scale-105 transition-all duration-700 ease-out"
                                            priority
                                        />
                                        {/* グラデーションオーバーレイ */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 to-transparent" />

                                        {/* 番号バッジ */}
                                        <div
                                            className="absolute top-5 right-6 text-8xl sm:text-9xl font-black text-white/[0.06] leading-none select-none pointer-events-none"
                                            aria-hidden="true"
                                        >
                                            01
                                        </div>

                                        {/* コンテンツ */}
                                        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 md:p-10">
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                                <span className="bg-amber-400 text-slate-900 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wide">
                                                    {featuredArticle.category}
                                                </span>
                                                {isNewArticle(featuredArticle.date) && (
                                                    <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
                                                        NEW
                                                    </span>
                                                )}
                                                <span className="text-slate-400 text-xs font-medium">
                                                    {new Date(featuredArticle.date).toLocaleDateString('ja-JP', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                    })}
                                                </span>
                                                <span className="text-slate-500 text-xs flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    約{getReadingTime(featuredArticle.content)}分
                                                </span>
                                            </div>
                                            <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-3 group-hover:text-amber-100 transition-colors duration-300 max-w-3xl">
                                                {featuredArticle.title}
                                            </h2>
                                            {featuredArticle.description && (
                                                <p className="text-slate-300/80 text-sm sm:text-base line-clamp-2 max-w-2xl hidden sm:block leading-relaxed">
                                                    {featuredArticle.description}
                                                </p>
                                            )}
                                            {/* 続きを読む */}
                                            <div className="mt-4 sm:mt-5 flex items-center gap-2 text-amber-400 text-sm font-bold">
                                                <span>記事を読む</span>
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
                                    <div className="w-1 h-5 bg-slate-300 rounded-full" />
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                                        All Articles
                                    </span>
                                    <div className="flex-1 h-px bg-slate-100" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                                    {regularArticles.map((article, index) => (
                                        <React.Fragment key={article.slug}>
                                            <Link
                                                href={`/articles/${article.slug}`}
                                                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1"
                                            >
                                                {/* サムネイル */}
                                                <div className="relative h-44 overflow-hidden bg-slate-100 shrink-0">
                                                    <Image
                                                        src={article.eyecatch}
                                                        alt={article.title}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                        style={{ objectFit: 'cover' }}
                                                        className="transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    {/* 番号バッジ */}
                                                    <div className="absolute top-3 left-3 bg-slate-900/75 backdrop-blur-sm text-white text-xs font-black px-2.5 py-1 rounded-lg font-mono tracking-wider">
                                                        {String(index + 2).padStart(2, '0')}
                                                    </div>
                                                    {/* NEWバッジ */}
                                                    {isNewArticle(article.date) && (
                                                        <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide">
                                                            NEW
                                                        </div>
                                                    )}
                                                    {/* ホバー時のアンバーオーバーレイ */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-amber-900/0 to-amber-900/0 group-hover:from-amber-900/10 transition-all duration-500" />
                                                </div>

                                                {/* カード本文 */}
                                                <div className="flex flex-col flex-1 p-5">
                                                    {/* カテゴリバッジ */}
                                                    <div className="mb-3">
                                                        <span className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full group-hover:bg-amber-50 group-hover:text-amber-800 transition-colors duration-200">
                                                            {article.category}
                                                        </span>
                                                    </div>

                                                    {/* タイトル */}
                                                    <h3 className="font-bold text-[15px] text-slate-900 line-clamp-2 leading-snug mb-2.5 group-hover:text-primary transition-colors flex-1">
                                                        {article.title}
                                                    </h3>

                                                    {/* 説明文 */}
                                                    {article.description && (
                                                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-3">
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

                                                {/* ボトムアクセントライン（ホバー時） */}
                                                <div className="h-0.5 bg-gradient-to-r from-amber-400 to-amber-300 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                                            </Link>

                                            {/* インフィード広告: 4番目と9番目の後 */}
                                            {(index === 3 || index === 8) && regularArticles.length > index + 1 && (
                                                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
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
                <MultiplexAd slot="8529703346" />
            </div>
        </>
    );
}