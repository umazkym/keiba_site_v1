import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getCourseArticleArchiveGroup, getCourseArticleArchiveGroups } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";

type Props = {
  params: { venue: string; course: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getCourseArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => {
      const [venue, ...courseParts] = group.key.split("-");
      return {
        venue,
        course: courseParts.join("-"),
      };
    });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getCourseArticleArchiveGroup(params.venue, params.course);
  if (!group) {
    return {
      title: "コース別の記事アーカイブ | UMA-FREE",
      alternates: { canonical: "/articles" },
    };
  }
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;
  if (!primaryArticle) {
    notFound();
  }

  return {
    title: primaryArticle?.title || `${group.title}の記事 | UMA-FREE`,
    description:
      primaryArticle?.description ||
      `${group.title}に関する枠順、脚質、騎手、馬場傾向の記事を更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
    robots: { index: true, follow: true },
  };
}

export default async function CourseArticleArchiveDetailPage({ params }: Props) {
  const group = getCourseArticleArchiveGroup(params.venue, params.course);
  if (!group) notFound();
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;
  if (!primaryArticle) {
    notFound();
  }
  const article = primaryArticle;

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "コース", url: "https://uma-free.com/articles#courses" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "ホーム", href: "/" },
          { label: "記事", href: "/articles" },
          { label: "コース", href: "/articles#courses" },
          { label: group.title, href: "" },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <EntityArticleDocument
          article={article}
          canonicalPath={group.href}
          backHref="/articles#courses"
          backLabel="コース"
          profileHref={group.profileHref}
          profileLabel={group.profileLabel}
        />
      </div>
    </>
  );
}
