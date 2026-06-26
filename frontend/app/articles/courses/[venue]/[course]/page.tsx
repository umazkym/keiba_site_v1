import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleArchiveArticleGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getCourseArticleArchiveGroup } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";
import { courseProfiles } from "@/lib/growth-content";

type Props = {
  params: { venue: string; course: string };
};

export function generateStaticParams() {
  return courseProfiles.map((profile) => ({
    venue: profile.venue,
    course: profile.course,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getCourseArticleArchiveGroup(params.venue, params.course);
  if (!group) {
    return {
      title: "コース別の記事アーカイブ | UMA-FREE",
      alternates: { canonical: "/articles/courses" },
    };
  }
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;

  return {
    title: primaryArticle?.title || `${group.title}の記事 | UMA-FREE`,
    description:
      primaryArticle?.description ||
      `${group.title}に関する枠順、脚質、騎手、馬場傾向の記事を更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
  };
}

export default async function CourseArticleArchiveDetailPage({ params }: Props) {
  const group = getCourseArticleArchiveGroup(params.venue, params.course);
  if (!group) notFound();
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "コース別", url: "https://uma-free.com/articles/courses" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        {primaryArticle ? (
          <EntityArticleDocument
            article={primaryArticle}
            canonicalPath={group.href}
            backHref="/articles/courses"
            backLabel="コース別一覧へ"
            profileHref={group.profileHref}
            profileLabel={group.profileLabel}
          />
        ) : (
          <>
            <ArticleArchiveHero
              eyebrow="COURSE ARCHIVE"
              title={`${group.title}の記事`}
              description={`${group.subtitle}。このコース条件に紐づく記事を1本のURLで更新していきます。`}
              countLabel="準備中"
            >
              <ArticleArchiveNav active="courses" />
            </ArticleArchiveHero>
            <section className="mt-6">
              <ArticleArchiveArticleGrid articles={[]} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
