import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getGradeRaceArticleArchiveGroup, getGradeRaceArticleArchiveGroups } from "@/lib/article-archives";
import { AdUnit } from "@/components/AdUnit";
import { MultiplexAd } from "@/components/MultiplexAd";

type Props = {
  params: { slug: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getGradeRaceArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => ({ slug: group.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getGradeRaceArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "重賞別の記事アーカイブ | UMA-FREE",
      alternates: { canonical: "/articles" },
    };
  }
  const primaryArticle = group.articles[0];
  if (!primaryArticle) {
    notFound();
  }

  return {
    title: primaryArticle?.title || `${group.title}の記事 | UMA-FREE`,
    description:
      primaryArticle?.description ||
      `${group.title}に関する展望、枠順、追い切り、回顧記事を更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
    robots: { index: true, follow: true },
  };
}

export default async function GradeRaceArticleArchiveDetailPage({ params }: Props) {
  const group = getGradeRaceArticleArchiveGroup(params.slug);
  if (!group) notFound();
  if (group.articles.length === 0) {
    notFound();
  }
  const articlesByYear = [...group.articles].sort((a, b) => {
    const yearA = Number(a.seasonYear || a.scheduledRaceDate?.slice(0, 4) || a.date.slice(0, 4));
    const yearB = Number(b.seasonYear || b.scheduledRaceDate?.slice(0, 4) || b.date.slice(0, 4));
    return yearB - yearA || (a.date < b.date ? 1 : -1);
  });

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "重賞", url: "https://uma-free.com/articles#grade-races" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "ホーム", href: "/" },
          { label: "記事", href: "/articles" },
          { label: "重賞", href: "/articles#grade-races" },
          { label: group.title, href: "" },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <main className="mx-auto max-w-[1080px]">
          <header className="border-b border-slate-200 pb-5 sm:pb-8">
            <p className="text-[10px] font-bold text-slate-500">重賞別の記事</p>
            <h1 className="mt-0.5 text-[15px] font-black leading-tight text-slate-950 sm:text-4xl">
              {group.title}
            </h1>
            <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-slate-600 sm:text-base sm:leading-7">
              {group.description}
            </p>
            {group.profileHref && (
              <Link
                href={group.profileHref}
                prefetch={false}
                className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {group.profileLabel}
              </Link>
            )}
          </header>

          <section className="py-2.5 sm:py-8" aria-labelledby="grade-race-seasonal-articles">
            <h2 id="grade-race-seasonal-articles" className="text-[13px] font-black text-slate-950 sm:text-2xl">
              年度別の記事
            </h2>
            <ul className="mt-1.5 divide-y divide-slate-200 border-y border-slate-200">
              {articlesByYear.map((article) => {
                const year = article.seasonYear || article.scheduledRaceDate?.slice(0, 4) || article.date.slice(0, 4);
                return (
                  <li key={article.slug}>
                    <Link
                      href={`/articles/${article.slug}`}
                      prefetch={false}
                      className="grid min-h-9 gap-0.5 py-1.5 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-start sm:gap-4 sm:px-2"
                    >
                      <span className="font-mono text-[11px] font-black text-blue-700 sm:pt-0.5 sm:text-sm">{year}年</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold leading-snug text-slate-900">{article.title}</span>
                        {article.description && (
                          <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-relaxed text-slate-600 sm:text-sm">
                            {article.description}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="pb-5 sm:pb-8">
            <AdUnit
              slot="1489598374"
              analyticsPlacement="grade_race_archive_after_list"
              placement="inline"
              minHeight="280px"
              collapseUnfilled={false}
              lazyRootMargin="760px 0px 760px 0px"
              refreshRootMarginPx={720}
              className="article-ad-slot"
            />
          </div>
          <MultiplexAd slot="9407670747" />
        </main>
      </div>
    </>
  );
}
