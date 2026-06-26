import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleArchiveArticleGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getRaceArticleArchiveGroup, getRaceArticleArchiveGroups } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return getRaceArticleArchiveGroups().map((group) => ({ slug: group.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getRaceArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "レース名別の記事アーカイブ | UMA-FREE",
      alternates: { canonical: "/articles/races" },
    };
  }
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;

  return {
    title: primaryArticle?.title || `${group.title}の記事 | UMA-FREE`,
    description:
      primaryArticle?.description ||
      `${group.title}に関する展望、当日材料、振り返りを更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
  };
}

export default async function RaceArticleArchiveDetailPage({ params }: Props) {
  const group = getRaceArticleArchiveGroup(params.slug);
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
          { name: "レース名別", url: "https://uma-free.com/articles/races" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        {primaryArticle ? (
          <EntityArticleDocument
            article={primaryArticle}
            canonicalPath={group.href}
            backHref="/articles/races"
            backLabel="レース名別一覧へ"
            profileHref={group.profileHref}
            profileLabel={group.profileLabel}
          />
        ) : (
          <>
            <ArticleArchiveHero
              eyebrow="RACE ARCHIVE"
              title={`${group.title}の記事`}
              description="このレース名に紐づく記事を1本のURLで更新していきます。"
              countLabel="準備中"
            >
              <ArticleArchiveNav active="races" />
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
