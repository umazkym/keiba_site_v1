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
    let title = "競馬データ分析を無料で読む | 重賞・騎手・馬場の実戦コラム";
    let description = "競馬データ分析を無料で読める記事一覧。重賞予想、騎手の得意コース、馬場状態、枠順傾向、馬体重、人気別成績など、馬券検討前に確認したい統計コラムを掲載。";

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
    const formatDate = (date: string) => new Date(date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const categoryItems = uniqueCategories.map((category) => ({
        category,
        count: allArticles.filter((article) => article.category === category).length,
    }));

    return (
        <>
            <div className="relative -mx-3 border-b border-slate-200 bg-white sm:-mx-4 md:-mx-6">
                <div className="px-4 py-6 sm:px-6 sm:py-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-slate-400">ARTICLES</p>
                            <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                                {selectedCategory || '記事'}
                            </h1>
                        </div>
                        <p className="text-sm font-semibold text-slate-400 tabular-nums">{filteredArticles.length}件</p>
                    </div>

                    <div className="mt-6 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <Link
                            href="/articles"
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${!selectedCategory
                                ? 'bg-slate-950 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            すべて
                        </Link>
                        {categoryItems.map(({ category }) => (
                            <Link
                                key={category}
                                href={`/articles?category=${encodeURIComponent(category)}`}
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${selectedCategory === category
                                    ? 'bg-slate-950 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {category}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== BREADCRUMB ===== */}
            <Breadcrumb />

            {/* ===== MAIN CONTENT ===== */}
            <div className="mx-auto mt-3 grid w-full max-w-[1200px] gap-8 pb-12 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="hidden lg:block">
                    <nav className="sticky top-24 border-r border-slate-200 pr-5" aria-label="記事カテゴリ">
                        <Link
                            href="/articles"
                            className={`flex items-center justify-between border-b border-slate-100 py-3 text-sm font-bold transition-colors ${!selectedCategory ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <span>すべて</span>
                            <span className="text-xs text-slate-400">{allArticles.length}</span>
                        </Link>
                        {categoryItems.map(({ category, count }) => (
                            <Link
                                key={category}
                                href={`/articles?category=${encodeURIComponent(category)}`}
                                className={`flex items-center justify-between border-b border-slate-100 py-3 text-sm font-bold transition-colors ${selectedCategory === category ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <span>{category}</span>
                                <span className="text-xs text-slate-400">{count}</span>
                            </Link>
                        ))}
                    </nav>
                </aside>

                <div className="min-w-0">
                {filteredArticles.length === 0 ? (
                    <div className="border border-slate-100 bg-white py-24 text-center">
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
                        {featuredArticle && (
                            <section>
                                <Link
                                    href={`/articles/${featuredArticle.slug}`}
                                    className="group grid overflow-hidden border border-slate-200 bg-white transition-colors hover:border-slate-300 md:grid-cols-[42%_1fr]"
                                >
                                    <div className="relative aspect-[16/10] bg-slate-100 md:aspect-auto">
                                        <Image
                                            src={featuredArticle.eyecatch}
                                            alt={featuredArticle.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 460px"
                                            style={{ objectFit: 'cover' }}
                                            className="transition-transform duration-500 group-hover:scale-[1.03]"
                                            priority
                                        />
                                    </div>
                                    <div className="flex flex-col justify-between p-5 sm:p-7 md:min-h-[260px] lg:p-8">
                                        <div>
                                            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                                                <span className="text-slate-700">{featuredArticle.category}</span>
                                                <time dateTime={new Date(featuredArticle.date).toISOString()}>{formatDate(featuredArticle.date)}</time>
                                                <span>約{getReadingTime(featuredArticle.content)}分</span>
                                            </div>
                                            <h2 className="text-2xl font-black leading-snug tracking-tight text-slate-950 transition-colors group-hover:text-primary sm:text-3xl">
                                                {featuredArticle.title}
                                            </h2>
                                        </div>
                                        <span className="mt-6 inline-flex text-sm font-bold text-primary">
                                            読む
                                        </span>
                                    </div>
                                </Link>
                            </section>
                        )}

                        {featuredArticle && (
                            <AdUnit
                                slot="1489598374"
                                placement="inline"
                                analyticsPlacement="articles_after_featured"
                            />
                        )}

                        {regularArticles.length > 0 && (
                            <section className="mt-8">
                                <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                                    {regularArticles.map((article, index) => (
                                        <React.Fragment key={article.slug}>
                                            <Link
                                                href={`/articles/${article.slug}`}
                                                className="group grid grid-cols-[96px_minmax(0,1fr)] gap-4 p-4 transition-colors hover:bg-slate-50 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:p-5"
                                            >
                                                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                                                    <Image
                                                        src={article.eyecatch}
                                                        alt={article.title}
                                                        fill
                                                        sizes="(max-width: 640px) 96px, 160px"
                                                        style={{ objectFit: 'cover' }}
                                                        className="transition-transform duration-500 group-hover:scale-[1.03]"
                                                    />
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400 sm:text-xs">
                                                        <span className="text-slate-600">{article.category}</span>
                                                        <time dateTime={new Date(article.date).toISOString()}>{formatDate(article.date)}</time>
                                                        <span>約{getReadingTime(article.content)}分</span>
                                                        {isNewArticle(article.date) && <span className="text-primary">NEW</span>}
                                                    </div>
                                                    <h3 className="line-clamp-2 text-[15px] font-black leading-snug text-slate-950 transition-colors group-hover:text-primary sm:text-lg">
                                                        {article.title}
                                                    </h3>
                                                </div>
                                            </Link>

                                            {(index === 3 || index === 8) && regularArticles.length > index + 1 && (
                                                <div className="py-4">
                                                    <AdUnit
                                                        slot="8529703346"
                                                        placement="inline"
                                                        analyticsPlacement={`articles_grid_after_${index + 1}`}
                                                    />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                <div className="pt-4">
                    <MultiplexAd slot="9407670747" />
                </div>
                </div>
            </div>
        </>
    );
}
