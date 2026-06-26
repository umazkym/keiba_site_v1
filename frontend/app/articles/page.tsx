import React from "react";
import Link from "next/link";
import { getAllArticles, getUniqueCategories } from "../../lib/articles";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { shouldSuppressAdsInDevelopment } from "@/lib/ad-config";
import { ArticleArchiveNav } from "@/components/ArticleArchive";
import { getArticleArchiveTotals } from "@/lib/article-archives";
import type { Metadata } from "next";

interface ArticlesPageProps {
  searchParams: {
    category?: string;
    tag?: string;
  };
}

type ArticleLike = ReturnType<typeof getAllArticles>[number];

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
  const selectedCategory = searchParams.category;
  let canonicalUrl = "/articles";
  let title = "競馬データ分析を無料で読む | 重賞・騎手・馬場の実戦コラム";
  let description =
    "競馬データ分析を無料で読める記事一覧。重賞展望、騎手の得意コース、馬場状態、枠順傾向、馬体重、人気別成績など、レース前に確認したい統計コラムを掲載。";

  if (selectedCategory) {
    title = `${selectedCategory}のデータ分析記事 | 競馬統計コラム`;
    description = `${selectedCategory}に関する競馬データ分析記事の一覧です。過去5年以上のデータに基づく統計分析で、レース前の判断材料を整理します。`;
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

const getCategoryBadgeClass = (category: string) => {
  switch (category) {
    case "重賞":
    case "G1":
    case "G2":
    case "G3":
      return "bg-amber-50 text-amber-700 border border-amber-200/70";
    case "騎手":
      return "bg-purple-50 text-purple-700 border border-purple-200/70";
    case "コース":
    case "コース分析":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/70";
    default:
      return "bg-blue-50 text-blue-700 border border-blue-200/70";
  }
};

const getFeaturedSummary = (content: string) => {
  const cleanText = content
    .replace(/<[^>]*>/g, "")
    .replace(/#+\s+/g, "")
    .replace(/[\[\]\(\)\*\-\+_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanText.length > 118 ? `${cleanText.slice(0, 118)}...` : cleanText;
};

function getReadingTime(content: string): number {
  const text = content.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  return Math.max(1, Math.ceil(text.length / 500));
}

function isNewArticle(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 14;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

function ArticleImage({
  article,
  className,
  priority = false,
}: {
  article: ArticleLike;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`overflow-hidden bg-slate-100 ${className ?? ""}`}>
      <img
        src={article.eyecatch}
        alt={`${article.title} のアイキャッチ画像`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  );
}

function ArticleMeta({ article }: { article: ArticleLike }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-400 sm:text-xs">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(article.category)}`}>
        {article.category}
      </span>
      <time dateTime={new Date(article.date).toISOString()}>{formatDate(article.date)}</time>
      <span>約{getReadingTime(article.content)}分</span>
      {isNewArticle(article.date) && <span className="font-black text-primary">NEW</span>}
    </div>
  );
}

function FeaturedArticleCard({ article }: { article: ArticleLike }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated md:grid-cols-[42%_minmax(0,1fr)]"
    >
      <ArticleImage article={article} priority className="aspect-[16/10] md:aspect-auto" />
      <div className="flex min-h-[260px] flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div>
          <ArticleMeta article={article} />
          <h2 className="mt-3 text-xl font-black leading-tight tracking-tight text-slate-950 group-hover:text-primary sm:text-3xl">
            {article.title}
          </h2>
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600">
            {getFeaturedSummary(article.content)}
          </p>
        </div>
        <span className="mt-5 inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors group-hover:bg-primary">
          記事を確認する
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({ article }: { article: ArticleLike }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group grid grid-cols-[98px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated sm:flex sm:flex-col sm:p-3"
    >
      <ArticleImage article={article} className="aspect-[4/3] rounded-xl sm:w-full" />
      <div className="min-w-0 sm:px-1 sm:pb-1">
        <ArticleMeta article={article} />
        <h3 className="mt-2 line-clamp-3 text-sm font-black leading-snug text-slate-950 group-hover:text-primary sm:text-base">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}

export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const allArticles = getAllArticles();
  const uniqueCategories = getUniqueCategories();
  const selectedCategory = searchParams.category;
  const selectedTag = searchParams.tag;
  const shouldRenderAds = !shouldSuppressAdsInDevelopment;
  const archiveTotals = getArticleArchiveTotals();

  let filteredArticles = selectedCategory
    ? allArticles.filter((article) => article.category === selectedCategory)
    : allArticles;

  if (selectedTag) {
    filteredArticles = filteredArticles.filter((article) => article.tags && article.tags.includes(selectedTag));
  }

  const featuredArticle = filteredArticles[0];
  const regularArticles = filteredArticles.slice(1);
  const categoryItems = uniqueCategories.map((category) => ({
    category,
    count: allArticles.filter((article) => article.category === category).length,
  }));
  const archiveCategoryCards = [
    {
      title: "重賞別に読む",
      href: "/articles/grade-races",
      count: archiveTotals.gradeRaceCount,
      description: "G1・重賞名ごとに、展望、枠順、追い切り、回顧をまとめて確認できます。",
    },
    {
      title: "レース名別に読む",
      href: "/articles/races",
      count: archiveTotals.raceCount,
      description: "重賞以外も含め、同じレース名の記事を1本のURLへ更新していきます。",
    },
    {
      title: "騎手別に読む",
      href: "/articles/jockeys",
      count: archiveTotals.jockeyCount,
      description: "騎手名を起点に、得意コースや条件別データの記事へ進めます。",
    },
    {
      title: "コース別に読む",
      href: "/articles/courses",
      count: archiveTotals.courseCount,
      description: "競馬場と距離の条件から、枠順・脚質・馬場傾向の記事を探せます。",
    },
  ];

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
        ]}
      />
      <Breadcrumb />

      <div className="mx-auto w-full max-w-[1200px] px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.16em] text-slate-400">競馬統計コラム</p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {selectedCategory ? `${selectedCategory}分析記事` : "競馬データ分析記事"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
                重賞、騎手、コース、馬場傾向を、レース前の判断材料として確認できます。
                気になるテーマだけをカテゴリで絞り込めます。
              </p>
            </div>
            <p className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
              {filteredArticles.length}件
            </p>
          </div>

          <div className="mt-5">
            <ArticleArchiveNav active="all" />
          </div>

          <div
            className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <Link
              href="/articles"
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                !selectedCategory ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              すべての記事
            </Link>
            {categoryItems.map(({ category, count }) => (
              <Link
                key={category}
                href={`/articles?category=${encodeURIComponent(category)}`}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                  selectedCategory === category
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {category}
                <span className="ml-1 text-[10px] opacity-60">{count}</span>
              </Link>
            ))}
          </div>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="記事アーカイブカテゴリ">
          {archiveCategoryCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-950 group-hover:text-primary">{card.title}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                  {card.count}件
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
            </Link>
          ))}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <main className="min-w-0">
            {filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center shadow-soft">
                <p className="text-base font-bold text-slate-700">条件に合う記事が見つかりませんでした</p>
                <Link href="/articles" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  すべての記事を見る
                </Link>
              </div>
            ) : (
              <>
                {featuredArticle && <FeaturedArticleCard article={featuredArticle} />}

                {featuredArticle && shouldRenderAds && (
                  <div className="mt-5">
                    <AdUnit slot="1489598374" placement="inline" analyticsPlacement="articles_after_featured" />
                  </div>
                )}

                {regularArticles.length > 0 && (
                  <section className="mt-5">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold tracking-[0.14em] text-slate-400">NEW ARTICLES</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">新着・関連コラム</h2>
                      </div>
                      <p className="text-xs font-bold text-slate-400">{regularArticles.length}件</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {regularArticles.map((article, index) => (
                        <React.Fragment key={article.slug}>
                          <ArticleCard article={article} />
                          {(index === 5 || index === 14) && shouldRenderAds && regularArticles.length > index + 1 && (
                            <div className="sm:col-span-2 xl:col-span-3">
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

            {shouldRenderAds && (
              <div className="pt-5">
                <MultiplexAd slot="9407670747" />
              </div>
            )}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft" aria-label="記事アーカイブ">
              <p className="mb-2 text-xs font-bold tracking-[0.14em] text-slate-400">ARTICLE ARCHIVE</p>
              <div className="space-y-1">
                {archiveCategoryCards.map((card) => (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span>{card.title}</span>
                    <span className="text-xs opacity-70">{card.count}</span>
                  </Link>
                ))}
              </div>
            </nav>

            <nav className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft" aria-label="記事カテゴリ">
              <p className="mb-2 text-xs font-bold tracking-[0.14em] text-slate-400">CATEGORY</p>
              <Link
                href="/articles"
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  !selectedCategory ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>すべての記事</span>
                <span className="text-xs opacity-70">{allArticles.length}</span>
              </Link>
              <div className="mt-2 space-y-1">
                {categoryItems.map(({ category, count }) => (
                  <Link
                    key={category}
                    href={`/articles?category=${encodeURIComponent(category)}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                      selectedCategory === category ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{category}</span>
                    <span className="text-xs opacity-70">{count}</span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-soft">
              <p className="text-sm font-black text-slate-950">本日のレース分析</p>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                記事で確認した観点を、当日の出走表やAI偏差値と照合できます。
              </p>
              <Link prefetch={false} href="/races/today" className="mt-3 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-primary">
                今日の分析を見る
              </Link>
            </div>

            {/* ★ PCサイドバー広告
                モバイルでは非表示（hidden）、PCのみ表示（lg:block）。
                記事一覧はPC訪問者が約40%（Clarity 72h計測）のため、
                スクロールせずに目に入るAbove the fold付近の表示機会を確保。
                stickyなasideに配置するため、スクロール中も視認性が高い。 */}
            {shouldSuppressAdsInDevelopment ? null : (
              <div className="hidden lg:block">
                <AdUnit
                  slot="1489598374"
                  placement="sidebar"
                  analyticsPlacement="articles_sidebar"
                  minHeight="280px"
                  collapseUnfilled={false}
                  lazyRootMargin="400px 0px 400px 0px"
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
