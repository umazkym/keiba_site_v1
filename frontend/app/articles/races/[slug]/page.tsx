import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getRaceArticleArchiveGroup, getRaceArticleArchiveGroups } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";

type Props = {
  params: { slug: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getRaceArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => ({ slug: group.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getRaceArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "レース名別の記事アーカイブ | UMA-FREE",
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
      `${group.title}に関する展望、当日材料、振り返りを更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
    robots: { index: false, follow: true },
  };
}

export default async function RaceArticleArchiveDetailPage({ params }: Props) {
  const group = getRaceArticleArchiveGroup(params.slug);
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
          { name: "レース", url: "https://uma-free.com/articles#races" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "ホーム", href: "/" },
          { label: "記事", href: "/articles" },
          { label: "レース", href: "/articles#races" },
          { label: group.title, href: "" },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <EntityArticleDocument
          article={article}
          canonicalPath={group.href}
          backHref="/articles#races"
          backLabel="レース"
          profileHref={group.profileHref}
          profileLabel={group.profileLabel}
          relatedArticles={group.articles}
          themeTitle={group.title}
        />
      </div>
    </>
  );
}
