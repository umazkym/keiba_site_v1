import React from "react";
import Link from "next/link";
import { getAllArticles, getUniqueCategories } from "../../lib/articles";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { shouldSuppressAdsInDevelopment } from "@/lib/ad-config";
import {
  getArticleArchiveTotals,
  getGradeRaceArticleArchiveSections,
  getUpcomingGradeRaceArticleGroups,
} from "@/lib/article-archives";
import type { Metadata } from "next";

interface ArticlesPageProps {
  searchParams: {
    category?: string;
    tag?: string;
  };
}

type ArticleLike = ReturnType<typeof getAllArticles>[number];
type ArchiveGroupList = ReturnType<typeof getArticleArchiveTotals>["gradeRaceGroups"];
type GradeRaceSectionList = ReturnType<typeof getGradeRaceArticleArchiveSections>;

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
  const selectedCategory = searchParams.category;
  let canonicalUrl = "/articles";
  let title = "競馬データ分析記事 | 重賞・騎手・馬場の実戦コラム";
  let description =
    "競馬データ分析の記事一覧。重賞展望、騎手の得意コース、馬場状態、枠順傾向、馬体重、人気別成績など、レース前に確認したい統計コラムを掲載。";

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

function ArticleMeta({ article }: { article: ArticleLike }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(article.category)}`}>
        {article.category}
      </span>
      <time dateTime={new Date(article.date).toISOString()}>{formatDate(article.date)}</time>
      <span>約{getReadingTime(article.content)}分</span>
      {isNewArticle(article.date) && <span className="font-black text-primary">NEW</span>}
    </div>
  );
}

function formatRaceDate(date?: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

function UpcomingGradeRacePickup({
  groups,
}: {
  groups: ReturnType<typeof getUpcomingGradeRaceArticleGroups>;
}) {
  if (groups.length === 0) return null;

  return (
    <section className="mb-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 sm:p-4" aria-label="近日の重賞記事">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-950 sm:text-base">近日の重賞</h2>
        <span className="text-xs font-bold text-amber-700">{groups.length}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((group) => {
          const latestArticle = group.articles[0];
          return (
            <Link
              key={group.href}
              href={group.href}
              className="group rounded-xl border border-amber-200/70 bg-white px-3 py-2 transition-colors hover:border-amber-300 hover:bg-amber-50/40"
            >
              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-amber-700">
                <span>{formatRaceDate(group.scheduledDate)}</span>
                <span>{group.articleCount}件</span>
              </div>
              <p className="mt-1 truncate text-sm font-black text-slate-950 group-hover:text-primary">{group.title}</p>
              {latestArticle && (
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{latestArticle.title}</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CompactArticleLink({ article }: { article: ArticleLike }) {
  return (
    <Link
      prefetch={false}
      href={`/articles/${article.slug}`}
      className="group flex min-h-[58px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <ArticleMeta article={article} />
        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950 group-hover:text-primary sm:text-[15px]">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}

function EntityDirectoryLinks({ groups }: { groups: ArchiveGroupList }) {
  const visibleGroups = groups.filter((group) => group.articleCount > 0);

  return (
    <div className="grid gap-1.5">
      {visibleGroups.map((group) => (
        <Link
          key={group.href}
          href={group.href}
          className="group flex min-h-[36px] items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <span className="min-w-0 truncate group-hover:text-primary">{group.title}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
            {group.articleCount}
          </span>
        </Link>
      ))}
    </div>
  );
}

function GradeRaceDirectoryDetails({
  id,
  sections,
  defaultOpen = false,
}: {
  id: string;
  sections: GradeRaceSectionList;
  defaultOpen?: boolean;
}) {
  const groupCount = sections.reduce((sum, section) => sum + section.groupCount, 0);
  const articleCount = sections.reduce((sum, section) => sum + section.articleCount, 0);
  if (groupCount === 0) return null;

  return (
    <details id={id} className="group scroll-mt-20 rounded-xl border border-slate-200 bg-white" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-black text-slate-800">
        <span>重賞</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{articleCount}</span>
          <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[390px] overflow-y-auto border-t border-slate-100 p-1.5">
        <div className="grid gap-2">
          {sections.map((section) => (
            <section key={section.id} aria-label={section.title}>
              <div className="mb-1 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-800">
                <span>{section.title}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                  {section.groupCount}件
                </span>
              </div>
              <EntityDirectoryLinks groups={section.groups} />
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}

function EntityDirectoryDetails({
  id,
  title,
  groups,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  groups: ArchiveGroupList;
  defaultOpen?: boolean;
}) {
  const visibleGroups = groups.filter((group) => group.articleCount > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <details id={id} className="group scroll-mt-20 rounded-xl border border-slate-200 bg-white" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-black text-slate-800">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{visibleGroups.length}</span>
          <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[300px] overflow-y-auto border-t border-slate-100 p-1.5">
        <EntityDirectoryLinks groups={visibleGroups} />
      </div>
    </details>
  );
}

function MobileEntityDirectory({
  archiveTotals,
  gradeRaceSections,
}: {
  archiveTotals: ReturnType<typeof getArticleArchiveTotals>;
  gradeRaceSections: GradeRaceSectionList;
}) {
  return (
    <section className="mt-3 grid gap-2 lg:hidden" aria-label="記事テーマ">
      <GradeRaceDirectoryDetails id="grade-races" sections={gradeRaceSections} />
      <EntityDirectoryDetails id="races" title="レース" groups={archiveTotals.raceGroups} />
      <EntityDirectoryDetails id="jockeys" title="騎手" groups={archiveTotals.jockeyGroups} />
      <EntityDirectoryDetails id="courses" title="コース" groups={archiveTotals.courseGroups} />
    </section>
  );
}

export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const allArticles = getAllArticles();
  const uniqueCategories = getUniqueCategories();
  const selectedCategory = searchParams.category;
  const selectedTag = searchParams.tag;
  const shouldRenderAds = !shouldSuppressAdsInDevelopment;
  const archiveTotals = getArticleArchiveTotals();
  const gradeRaceSections = getGradeRaceArticleArchiveSections(archiveTotals.gradeRaceGroups);
  const upcomingGradeRaceGroups = getUpcomingGradeRaceArticleGroups(4);

  let filteredArticles = selectedCategory
    ? allArticles.filter((article) => article.category === selectedCategory)
    : allArticles;

  if (selectedTag) {
    filteredArticles = filteredArticles.filter((article) => article.tags && article.tags.includes(selectedTag));
  }

  const categoryItems = uniqueCategories.map((category) => ({
    category,
    count: allArticles.filter((article) => article.category === category).length,
  }));

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
        <header className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">競馬統計コラム</p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {selectedCategory ? `${selectedCategory}分析記事` : "競馬データ分析記事"}
              </h1>
            </div>
            <p className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
              {filteredArticles.length}件
            </p>
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

        <MobileEntityDirectory archiveTotals={archiveTotals} gradeRaceSections={gradeRaceSections} />

        <div className="mt-3 grid gap-5 lg:mt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0">
            <UpcomingGradeRacePickup groups={upcomingGradeRaceGroups} />

            {filteredArticles.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center">
                <p className="text-base font-bold text-slate-700">条件に合う記事が見つかりませんでした</p>
                <Link href="/articles" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  一覧へ
                </Link>
              </div>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-black text-slate-950">記事</h2>
                  <p className="text-xs font-bold text-slate-500">{filteredArticles.length}件</p>
                </div>
                <div className="grid gap-2 xl:grid-cols-2">
                  {filteredArticles.map((article, index) => (
                    <React.Fragment key={article.slug}>
                      <CompactArticleLink article={article} />
                      {(index === 7 || index === 27) && shouldRenderAds && filteredArticles.length > index + 1 && (
                        <div className="xl:col-span-2">
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

            {shouldRenderAds && (
              <div className="pt-5">
                <MultiplexAd slot="9407670747" />
              </div>
            )}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <nav className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block" aria-label="記事テーマ">
              <p className="mb-2 px-1 text-xs font-bold text-slate-600">記事テーマ</p>
              <div className="space-y-2">
                <GradeRaceDirectoryDetails id="sidebar-grade-races" sections={gradeRaceSections} defaultOpen />
                <EntityDirectoryDetails id="sidebar-races" title="レース" groups={archiveTotals.raceGroups} />
                <EntityDirectoryDetails id="sidebar-jockeys" title="騎手" groups={archiveTotals.jockeyGroups} defaultOpen />
                <EntityDirectoryDetails id="sidebar-courses" title="コース" groups={archiveTotals.courseGroups} defaultOpen />
              </div>
            </nav>

            <nav className="rounded-xl border border-slate-200 bg-white p-4" aria-label="記事カテゴリ">
              <p className="mb-2 text-xs font-bold text-slate-600">記事カテゴリ</p>
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

            <Link
              prefetch={false}
              href="/races/today"
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm font-black text-slate-950 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50"
            >
              <span>本日のレース分析</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700">今日</span>
            </Link>

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
