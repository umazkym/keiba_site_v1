import React from "react";
import Link from "next/link";
import { getAllArticles, getUniqueCategories } from "../../lib/articles";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";
import { BreadcrumbSchema, ItemListSchema } from "@/components/StructuredData";
import { shouldSuppressAdsInDevelopment } from "@/lib/ad-config";
import { resolveArticleCanonicalPath } from "@/lib/article-canonical";
import {
  getArticleArchiveTotals,
  getGradeRaceArticleArchiveSections,
  getUpcomingGradeRaceArticleGroups,
} from "@/lib/article-archives";
import type { Metadata } from "next";
import { MobileArticleThemeDirectory } from "@/components/MobileArticleThemeDirectory";
import { ArticleCategoryTag, formatArticleShortDate } from "@/components/ArticleParts";
import { ArticleThumb } from "@/components/ArticleThumb";
import { GuideHorse } from "@/components/BrandLogo";
import { LineIcon } from "@/components/LineIcon";
import { estimateReadingMinutes, getArticleCategoryStyle, pickArticleThumbs, type ArticleThumb as ArticleThumbData } from "@/lib/article-visual";

interface ArticlesPageProps {
  searchParams: {
    category?: string;
    tag?: string;
    page?: string;
  };
}

/** 1ページあたりの表示件数。薄い一覧ページを量産しないよう多めに取る。 */
export const ARTICLES_PER_PAGE = 24;

/**
 * 記事一覧の正規URLを組み立てる。
 * カテゴリは実ルート `/articles/category/{カテゴリ}` を正とし、
 * タグとページ番号だけをクエリに残す。1ページ目はページ番号を付けない。
 */
export function buildArticlesHref(
  options: { category?: string; tag?: string; page?: number } = {},
): string {
  const { category, tag, page } = options;
  const basePath = category ? `/articles/category/${encodeURIComponent(category)}` : "/articles";
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function getVisiblePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | 'ellipsis')[] = [1];
  if (current > 3) items.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    if (!items.includes(i)) items.push(i);
  }
  if (current < total - 2) items.push('ellipsis');
  if (!items.includes(total)) items.push(total);
  return items;
}

function ArticlePagination({
  currentPage,
  totalPages,
  category,
  tag,
}: {
  currentPage: number;
  totalPages: number;
  category?: string;
  tag?: string;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (p: number) => buildArticlesHref({ category, tag, page: p });
  const visiblePages = getVisiblePageNumbers(currentPage, totalPages);
  const stepClass = "inline-flex h-11 items-center justify-center gap-1 rounded-[10px] bg-white px-3 text-[14px] font-bold text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:bg-slate-50 hover:text-brand-700";

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" aria-label="ページナビゲーション">
      {currentPage > 1 && (
        <Link href={buildUrl(currentPage - 1)} className={stepClass}>
          <LineIcon name="chevL" size={16} className="block" />
          前へ
        </Link>
      )}
      {visiblePages.map((p, idx) => {
        if (p === 'ellipsis') {
          return (
            <span key={`ellipsis-${idx}`} className="inline-flex h-11 w-6 items-center justify-center text-[14px] font-bold text-slate-500">
              …
            </span>
          );
        }
        const isCurrent = p === currentPage;
        return (
          <Link
            key={p}
            href={buildUrl(p)}
            aria-current={isCurrent ? "page" : undefined}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] font-num text-[15px] font-bold transition-colors duration-150 ${isCurrent
              ? "bg-navy text-white"
              : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
              }`}
          >
            {p}
          </Link>
        );
      })}
      {currentPage < totalPages && (
        <Link href={buildUrl(currentPage + 1)} className={stepClass}>
          次へ
          <LineIcon name="chevR" size={16} className="block" />
        </Link>
      )}
    </nav>
  );
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

export function buildArticlesMetadata({ category, tag, page }: {
  category?: string;
  tag?: string;
  page?: number;
}): Metadata {
  let title = "競馬データ分析記事 | 重賞・騎手・馬場の実戦コラム";
  let description =
    "競馬データ分析の記事一覧。重賞展望、騎手の得意コース、馬場状態、枠順傾向、馬体重、人気別成績など、レース前に確認したい統計コラムを掲載。";

  if (category) {
    title = `${category}のデータ分析記事 | 競馬統計コラム`;
    description = `${category}に関する競馬データ分析記事の一覧です。過去5年以上のデータに基づく統計分析で、レース前の判断材料を整理します。`;
  }

  if (tag) {
    title = `${tag}の競馬データ分析記事 | 競馬統計コラム`;
    description = `${tag}に関する競馬データ分析記事の一覧です。出走数を伴う統計で、レース前に確認したい傾向を整理します。`;
  }

  // 2ページ目以降は同じtitleだと重複扱いになるため、ページ番号を明示する。
  if (page && page > 1) {
    title = `${title}（${page}ページ目）`;
  }

  return {
    title,
    description,
    // canonicalは必ず自己参照にする。ページ番号やタグを落とすと
    // 2ページ目以降がすべて1ページ目の重複として無視される。
    alternates: {
      canonical: buildArticlesHref({ category, tag, page }),
    },
  };
}

export async function generateMetadata({ searchParams }: ArticlesPageProps): Promise<Metadata> {
  const rawPage = parseInt(searchParams.page || "1", 10);
  return buildArticlesMetadata({
    category: searchParams.category,
    tag: searchParams.tag,
    page: isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
  });
}

function isNewArticle(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 72;
}

function formatRaceDate(date?: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });
}

// カテゴリ・日付・読了時間（3日以内は「新着」）
function ArticleMeta({ article }: { article: ArticleLike }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500 sm:text-[13px]">
      <ArticleCategoryTag category={article.category} />
      <time dateTime={new Date(article.date).toISOString()}>{formatArticleShortDate(article.date)}</time>
      <span>約{estimateReadingMinutes(article.content)}分</span>
      {isNewArticle(article.date) && <span className="font-bold text-brand-700">新着</span>}
    </span>
  );
}

// 近日開催の重賞の記事（開催日の近い順）
function UpcomingGradeRacePickup({
  groups,
}: {
  groups: ReturnType<typeof getUpcomingGradeRaceArticleGroups>;
}) {
  if (groups.length === 0) return null;

  return (
    <section className="rounded-[14px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-5" aria-labelledby="articles-upcoming-grade-heading">
      <h2 id="articles-upcoming-grade-heading" className="flex items-center gap-2 font-display text-[18px] font-extrabold text-slate-900 sm:text-[19px]">
        <LineIcon name="trophy" size={19} className="block text-navy" />
        近日の重賞
      </h2>
      <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
        {groups.map((group) => {
          const latestArticle = group.articles[0];
          return (
            <li key={group.href} className="border-b border-slate-200 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
              <Link href={group.href} className="group flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[12.5px] text-slate-500">
                    <span className="font-bold text-brand-700">{formatRaceDate(group.scheduledDate)}</span>
                    <span>{group.articleCount}記事</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[15px] font-bold text-slate-900 transition-colors duration-150 group-hover:text-brand-700">
                    {group.title}
                  </span>
                  {latestArticle && (
                    <span className="mt-0.5 block truncate text-[13px] text-slate-600">{latestArticle.title}</span>
                  )}
                </span>
                <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 1ページ目の先頭の記事（写真を大きく）
function FeaturedArticle({ article, thumb }: { article: ArticleLike; thumb: ArticleThumbData }) {
  return (
    <Link
      prefetch={false}
      href={`/articles/${article.slug}`}
      className="group grid overflow-hidden rounded-[16px] bg-white ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:ring-brand-300 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      <ArticleThumb
        thumb={thumb}
        sizes="(min-width: 1152px) 560px, (min-width: 768px) 52vw, 100vw"
        className="aspect-[16/9] w-full md:aspect-auto md:h-full md:min-h-[280px]"
      />
      <span className="flex flex-col justify-center gap-2.5 p-4 sm:p-6 lg:p-8">
        <ArticleMeta article={article} />
        <span className="font-display text-[19px] font-extrabold leading-[1.5] text-slate-900 transition-colors duration-150 group-hover:text-brand-700 sm:text-[22px] lg:text-[25px]">
          {article.title}
        </span>
        {article.description && (
          <span className="line-clamp-3 text-[14px] leading-[1.8] text-slate-700 sm:text-[15px]">{article.description}</span>
        )}
        <span className="mt-1 hidden items-center gap-1 text-[14.5px] font-bold text-brand-700 md:inline-flex">
          記事を読む
          <LineIcon name="arrowR" size={16} className="block" />
        </span>
      </span>
    </Link>
  );
}

// 一覧の1行（写真・カテゴリ・日付・題名）
function ArticleRow({ article, thumb }: { article: ArticleLike; thumb: ArticleThumbData }) {
  return (
    <Link
      prefetch={false}
      href={`/articles/${article.slug}`}
      className="group flex gap-3 py-3.5 sm:gap-5 sm:py-4"
    >
      <ArticleThumb
        thumb={thumb}
        sizes="(min-width: 640px) 200px, 104px"
        className="h-[70px] w-[104px] shrink-0 rounded-[10px] sm:h-[112px] sm:w-[200px] sm:rounded-xl"
      />
      <span className="flex min-w-0 flex-col justify-center gap-1.5 sm:gap-2">
        <ArticleMeta article={article} />
        <span className="line-clamp-2 text-[15px] font-bold leading-[1.55] text-slate-900 transition-colors duration-150 group-hover:text-brand-700 sm:text-[17px]">
          {article.title}
        </span>
        {article.description && (
          <span className="hidden text-[13.5px] leading-[1.7] text-slate-600 sm:line-clamp-2">{article.description}</span>
        )}
      </span>
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
          className="group flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[14px] font-bold text-slate-800 transition-colors duration-150 hover:bg-slate-50"
        >
          <span className="min-w-0 truncate group-hover:text-brand-700">{group.title}</span>
          <span className="shrink-0 font-num text-[12.5px] font-semibold text-slate-500">
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
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[14.5px] font-bold text-slate-900">
        <span>重賞</span>
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-slate-500">{groupCount}レース / {articleCount}記事</span>
          <span className="text-slate-500 transition-transform duration-150 group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[390px] overflow-y-auto border-t border-slate-100 p-1.5">
        <div className="grid gap-1.5">
          {sections.map((section) => (
            <details key={section.id} className={`group/grade overflow-hidden rounded-lg border ${getGradeSectionTone(section.id)}`}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-[13.5px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600">
                <span>{getGradeSectionLabel(section.id, section.title)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-600">
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
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[14.5px] font-bold text-slate-900">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          <span className="font-num text-[12.5px] font-semibold text-slate-500">{visibleGroups.length}</span>
          <span className="text-slate-500 transition-transform duration-150 group-open:rotate-90">›</span>
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
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[14.5px] font-bold text-slate-900">
        <span>コース</span>
        <span className="flex items-center gap-2">
          <span className="font-num text-[12.5px] font-semibold text-slate-500">{courseCount}</span>
          <span className="text-slate-500 transition-transform duration-150 group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="max-h-[390px] overflow-y-auto border-t border-slate-100 p-1.5">
        <div className="grid gap-1.5">
          {sections.map((section) => (
            <details key={section.id} className="group/venue overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-800">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-[13.5px] font-bold">
                <span>{section.title}</span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
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

  const rawPage = parseInt(searchParams.page || "1", 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const totalPages = Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE,
  );

  const breadcrumbItems = [
    { name: "ホーム", url: "https://uma-free.com" },
    { name: "記事", url: "https://uma-free.com/articles" },
  ];
  if (selectedCategory) {
    breadcrumbItems.push({
      name: selectedCategory,
      url: `https://uma-free.com${buildArticlesHref({ category: selectedCategory })}`,
    });
  }

  // 一覧の並び順を検索エンジンへ伝える。表示中のページに載っている記事だけを対象にする。
  const itemListEntries = paginatedArticles.map((article) => ({
    name: article.title,
    url: `https://uma-free.com${resolveArticleCanonicalPath(article, article.slug)}`,
  }));

  // 1ページ目の先頭は写真を大きく。サムネイルは先頭から順に決め、同じ写真を並べない。
  const showFeatured = currentPage === 1 && paginatedArticles.length > 0;
  const thumbs = pickArticleThumbs(paginatedArticles);
  const listStart = showFeatured ? 1 : 0;
  const pageTitle = selectedCategory ? `${selectedCategory}の記事` : "競馬データ分析記事";

  return (
    <>
      <BreadcrumbSchema items={breadcrumbItems} />
      <ItemListSchema items={itemListEntries} />
      <Breadcrumb />

      <div className="articles-page-scope site-shell-data px-4 pb-12 pt-1 sm:px-6 sm:pb-16 sm:pt-3">
        <header className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <h1 className="font-display text-[24px] font-extrabold leading-snug text-slate-900 sm:text-[30px] lg:text-[34px]">
              {pageTitle}
            </h1>
            <p className="max-w-3xl text-[14px] leading-[1.75] text-slate-700 sm:text-[15px]">
              重賞・騎手・コース・人気別のデータを、レース前の判断材料としてまとめています。
              <span className="whitespace-nowrap text-slate-500">
                {filteredArticles.length}本{totalPages > 1 ? `（${currentPage}/${totalPages}ページ）` : ""}
              </span>
            </p>
          </div>

          <nav aria-label="記事カテゴリ" className="flex flex-wrap gap-2">
            <Link
              href="/articles"
              aria-current={!selectedCategory ? "page" : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-bold transition-colors duration-150 sm:h-10 sm:px-4 sm:text-[14px] ${!selectedCategory ? "bg-navy text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}
            >
              すべて
              <span className={`font-num text-[12.5px] font-semibold ${!selectedCategory ? "text-white/75" : "text-slate-500"}`}>{allArticles.length}</span>
            </Link>
            {categoryItems.map(({ category, count }) => {
              const isActive = selectedCategory === category;
              return (
                <Link
                  key={category}
                  href={buildArticlesHref({ category })}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-bold transition-colors duration-150 sm:h-10 sm:px-4 sm:text-[14px] ${isActive ? "bg-navy text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}
                >
                  <span className={`h-2 w-2 rounded-[2px] ${getArticleCategoryStyle(category).fillClass}`} aria-hidden="true" />
                  {category}
                  <span className={`font-num text-[12.5px] font-semibold ${isActive ? "text-white/75" : "text-slate-500"}`}>{count}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <MobileArticleThemeDirectory
          gradeRaceSections={gradeRaceSections}
          jockeyGroups={archiveTotals.jockeyGroups}
          courseSections={courseVenueSections}
        />

        <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <main className="flex min-w-0 flex-col gap-5">
            {filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[16px] bg-white px-4 py-12 text-center ring-1 ring-inset ring-slate-200">
                <GuideHorse size={96} mood="look" />
                <p className="text-[16px] font-bold text-slate-900">条件に合う記事が見つかりませんでした</p>
                <Link href="/articles" className="ui-btn ui-btn--primary">
                  すべての記事を見る
                </Link>
              </div>
            ) : (
              <>
                {showFeatured && <FeaturedArticle article={paginatedArticles[0]} thumb={thumbs[0]} />}

                <UpcomingGradeRacePickup groups={upcomingGradeRaceGroups} />

                <section aria-labelledby="articles-list-heading" className="rounded-[16px] bg-white px-4 py-1 ring-1 ring-inset ring-slate-200 sm:px-6 sm:py-2">
                  <h2 id="articles-list-heading" className="sr-only">記事の一覧</h2>
                  <ul>
                    {paginatedArticles.map((article, index) => (
                      <React.Fragment key={article.slug}>
                        {index >= listStart && (
                          <li className="border-b border-slate-200 last:border-b-0">
                            <ArticleRow article={article} thumb={thumbs[index]} />
                          </li>
                        )}
                        {(index === 5 || index === 11) && shouldRenderAds && paginatedArticles.length > index + 1 && (
                          <li className="border-b border-slate-200 py-3">
                            <AdUnit
                              slot="8529703346"
                              placement="inline"
                              analyticsPlacement={`articles_grid_after_${index + 1}`}
                            />
                          </li>
                        )}
                      </React.Fragment>
                    ))}
                  </ul>
                </section>

                <ArticlePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  category={selectedCategory}
                  tag={selectedTag}
                />
              </>
            )}

            {shouldRenderAds && (
              <div className="pt-2">
                <MultiplexAd slot="9407670747" />
              </div>
            )}
          </main>

          <aside className="article-desktop-sidebar space-y-4 lg:sticky lg:self-start">
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

            <Link
              prefetch={false}
              href="/races/today"
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] bg-brand-50/70 px-4 py-3 ring-1 ring-inset ring-brand-200 transition-colors duration-150 hover:bg-brand-50 hover:ring-brand-300"
            >
              <span className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                <LineIcon name="race" size={20} className="block text-brand-600" />
                本日のレース分析
              </span>
              <LineIcon name="chevR" size={18} className="block text-brand-700" />
            </Link>

            <nav className="hidden rounded-[14px] bg-white p-3 ring-1 ring-inset ring-slate-200 lg:block" aria-label="記事テーマ">
              <p className="mb-1 px-1 font-display text-[16px] font-extrabold text-slate-900">記事テーマ</p>
              <div className="space-y-2">
                <GradeRaceDirectoryDetails id="sidebar-grade-races" sections={gradeRaceSections} />
                <EntityDirectoryDetails id="sidebar-races" title="レース" groups={archiveTotals.raceGroups} />
                <EntityDirectoryDetails id="sidebar-jockeys" title="騎手" groups={archiveTotals.jockeyGroups} />
                <CourseDirectoryDetails id="sidebar-courses" sections={courseVenueSections} />
              </div>
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
}
