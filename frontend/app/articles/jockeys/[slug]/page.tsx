import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getJockeyArticleArchiveGroup, getJockeyArticleArchiveGroups } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";

type Props = {
  params: { slug: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getJockeyArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => ({ slug: group.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getJockeyArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "騎手別の記事アーカイブ | UMA-FREE",
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
      `${group.title}に関する得意コース、騎乗傾向、条件別データの記事を更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
    robots: { index: false, follow: true },
  };
}

export default async function JockeyArticleArchiveDetailPage({ params }: Props) {
  const group = getJockeyArticleArchiveGroup(params.slug);
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
          { name: "騎手", url: "https://uma-free.com/articles#jockeys" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "ホーム", href: "/" },
          { label: "記事", href: "/articles" },
          { label: "騎手", href: "/articles#jockeys" },
          { label: group.title, href: "" },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <EntityArticleDocument
          article={article}
          canonicalPath={group.href}
          backHref="/articles#jockeys"
          backLabel="騎手"
          profileHref={group.profileHref}
          profileLabel={group.profileLabel}
          relatedArticles={group.articles}
          themeTitle={group.title}
        />
      </div>
    </>
  );
}
