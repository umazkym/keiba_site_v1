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
import { MobileArticleThemeDirectory } from "@/components/MobileArticleThemeDirectory";

interface ArticlesPageProps {
  searchParams: {
    category?: string;
    tag?: string;
  };
}

type ArticleLike = ReturnType<typeof getAllArticles>[number];
type ArchiveGroupList = ReturnType<typeof getArticleArchiveTotals>["gradeRaceGroups"];
type GradeRaceSectionList = ReturnType<typeof getGradeRaceArticleArchiveSections>;
type CourseVenueSection = {
  id: string;
  title: string;
  groups: ArchiveGroupList;
  articleCount: number;
};

function normalizeArticleThemeGradeSections(sections: GradeRaceSectionList): GradeRaceSectionList {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const emptySection = (id: string, title: string) => ({ id, title, groups: [], groupCount: 0, articleCount: 0 });
  const getSection = (id: string, title: string) => byId.get(id) ?? emptySection(id, title);
  const localOther = getSection("nar-local", "地方 その他重賞");
  const overseas = getSection("overseas", "海外");
  const otherGroups = [...localOther.groups, ...overseas.groups];

  return [
    getSection("jra-g1", "G1"),
    getSection("jra-g2", "G2"),
    getSection("jra-g3", "G3"),
    getSection("jra-other", "その他（中央）"),
    getSection("nar-jpn1", "Jpn1"),
    getSection("nar-jpn2", "Jpn2"),
    getSection("nar-jpn3", "Jpn3"),
    {
      id: "nar-other",
      title: "その他（地方・海外）",
      groups: otherGroups,
      groupCount: otherGroups.length,
      articleCount: localOther.articleCount + overseas.articleCount,
    },
  ];
}

function groupCourseArchivesByVenue(groups: ArchiveGroupList): CourseVenueSection[] {
  const sections = new Map<string, CourseVenueSection>();

  groups.filter((group) => group.articleCount > 0).forEach((group) => {
    const pathSegments = group.href.split("/").filter(Boolean);
    const courseSegmentIndex = pathSegments.indexOf("courses");
    const venueId = courseSegmentIndex >= 0 ? pathSegments[courseSegmentIndex + 1] : group.key.split("-")[0];
    const venueTitle = group.badges[0] || group.title;
    const current = sections.get(venueId) ?? {
      id: venueId,
      title: venueTitle,
      groups: [],
      articleCount: 0,
    };
    current.groups.push(group);
    current.articleCount += group.articleCount;
    sections.set(venueId, current);
  });

  return Array.from(sections.values()).sort((left, right) => left.title.localeCompare(right.title, "ja"));
}

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
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 72;
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
    <section className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="近日の重賞記事">
      <div className="mb-2 flex items-center justify-between gap-3 px-4 pt-3.5 sm:px-5">
        <h2 className="text-sm font-black text-slate-950 sm:text-base">近日の重賞</h2>
        <span className="text-xs font-bold text-slate-500">{groups.length}</span>
      </div>
      <div className="divide-y divide-slate-100 border-t border-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
        {groups.map((group) => {
          const latestArticle = group.articles[0];
          return (
            <Link
              key={group.href}
              href={group.href}
              className="group px-4 py-3 transition-colors duration-150 hover:bg-slate-50 sm:border-b sm:border-slate-100 sm:px-5"
            >
              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-blue-600">
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
      className="group flex min-h-[112px] flex-col justify-center border-b border-slate-100 bg-white px-3 py-3 transition-colors duration-150 last:border-b-0 hover:bg-slate-50 sm:min-h-[172px] sm:justify-start sm:rounded-xl sm:border sm:border-slate-200 sm:p-4 sm:hover:border-blue-300"
    >
      <div className="min-w-0">
        <ArticleMeta article={article} />
        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950 group-hover:text-primary sm:text-[15px]">
          {article.title}
        </h3>
        {article.description && (
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
            {article.description}
          </p>
        )}
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
            {group.articleCount}記事
          </span>
        </Link>
      ))}
    </div>
  );
}

function getGradeSectionLabel(sectionId: string, fallback: string) {
  const labels: Record<string, string> = {
    "jra-g1": "G1",
    "jra-g2": "G2",
    "jra-g3": "G3",
    "jra-other": "その他",
    "nar-jpn1": "Jpn1",
    "nar-jpn2": "Jpn2",
    "nar-jpn3": "Jpn3",
    "nar-other": "その他",
  };
  return labels[sectionId] ?? fallback;
}

function getGradeSectionTone(sectionId: string) {
  void sectionId;
  return "border-slate-200 bg-slate-50 text-slate-800";
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
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{groupCount}レース / {articleCount}記事</span>
          <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[390px] overflow-y-auto border-t border-slate-100 p-1.5">
        <div className="grid gap-1.5">
          {sections.map((section) => (
            <details key={section.id} className={`group/grade overflow-hidden rounded-lg border ${getGradeSectionTone(section.id)}`}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
                <span>{getGradeSectionLabel(section.id, section.title)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    {section.groupCount}レース / {section.articleCount}記事
                  </span>
                  <span aria-hidden="true" className="text-slate-500 transition-transform duration-150 group-open/grade:rotate-90">›</span>
                </span>
              </summary>
              <div className="border-t border-current/10 bg-white p-1">
                <EntityDirectoryLinks groups={section.groups} />
              </div>
            </details>
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

function CourseDirectoryDetails({
  id,
  sections,
}: {
  id: string;
  sections: CourseVenueSection[];
}) {
  const courseCount = sections.reduce((sum, section) => sum + section.groups.length, 0);
  if (courseCount === 0) return null;

  return (
    <details id={id} className="group scroll-mt-20 rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-black text-slate-800">
        <span>コース</span>
        <span className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{courseCount}</span>
          <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[390px] overflow-y-auto border-t border-slate-100 p-1.5">
        <div className="grid gap-1.5">
          {sections.map((section) => (
            <details key={section.id} className="group/venue overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-800">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-black">
                <span>{section.title}</span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span>{section.groups.length}コース / {section.articleCount}記事</span>
                  <span aria-hidden="true" className="transition-transform group-open/venue:rotate-90">›</span>
                </span>
              </summary>
              <div className="border-t border-slate-200 bg-white p-1">
                <EntityDirectoryLinks groups={section.groups} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const allArticles = getAllArticles();
  const uniqueCategories = getUniqueCategories();
  const selectedCategory = searchParams.category;
  const selectedTag = searchParams.tag;
  const shouldRenderAds = !shouldSuppressAdsInDevelopment;
  const archiveTotals = getArticleArchiveTotals();
  const gradeRaceSections = normalizeArticleThemeGradeSections(
    getGradeRaceArticleArchiveSections(archiveTotals.gradeRaceGroups),
  );
  const courseVenueSections = groupCourseArchivesByVenue(archiveTotals.courseGroups);
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

      <div className="articles-page-scope site-shell-data px-2 pb-10 pt-2 sm:px-4 sm:pb-16 sm:pt-4">
        <header className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 sm:rounded-xl sm:p-8">
          <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">競馬統計コラム</p>
              <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:mt-2 sm:text-4xl">
                {selectedCategory ? `${selectedCategory}分析記事` : "競馬データ分析記事"}
              </h1>
            </div>
            <p className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
              {filteredArticles.length}件
            </p>
          </div>

          <div
            className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2"
          >
            <Link
              href="/articles"
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
                !selectedCategory ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              すべての記事
            </Link>
            {categoryItems.map(({ category, count }) => (
              <Link
                key={category}
                href={`/articles?category=${encodeURIComponent(category)}`}
                className={`rounded-full px-3 py-2 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
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

        <MobileArticleThemeDirectory
          gradeRaceSections={gradeRaceSections}
          jockeyGroups={archiveTotals.jockeyGroups}
          courseSections={courseVenueSections}
        />

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
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:p-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:mb-3 sm:border-b-0 sm:px-0 sm:py-0">
                  <h2 className="text-base font-black text-slate-950">記事</h2>
                  <p className="text-xs font-bold text-slate-500">{filteredArticles.length}件</p>
                </div>
                <div className="grid gap-0 sm:gap-2 xl:grid-cols-2">
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

          <aside className="article-desktop-sidebar space-y-3 lg:sticky lg:self-start">
            <nav className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block" aria-label="記事テーマ">
              <p className="mb-2 px-1 text-xs font-bold text-slate-600">記事テーマ</p>
              <div className="space-y-2">
                <GradeRaceDirectoryDetails id="sidebar-grade-races" sections={gradeRaceSections} />
                <EntityDirectoryDetails id="sidebar-races" title="レース" groups={archiveTotals.raceGroups} />
                <EntityDirectoryDetails id="sidebar-jockeys" title="騎手" groups={archiveTotals.jockeyGroups} />
                <CourseDirectoryDetails id="sidebar-courses" sections={courseVenueSections} />
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
