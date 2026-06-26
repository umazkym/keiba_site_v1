import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleArchiveArticleGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { EntityArticleDocument } from "@/components/EntityArticleDocument";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getJockeyArticleArchiveGroup } from "@/lib/article-archives";
import { getArticleBySlug } from "@/lib/articles";
import { jockeyProfiles } from "@/lib/growth-content";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return jockeyProfiles.map((jockey) => ({ slug: jockey.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getJockeyArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "騎手別の記事アーカイブ | UMA-FREE",
      alternates: { canonical: "/articles/jockeys" },
    };
  }
  const primaryArticle = group.articles[0]
    ? await getArticleBySlug(group.articles[0].slug)
    : null;

  return {
    title: primaryArticle?.title || `${group.title}の記事 | UMA-FREE`,
    description:
      primaryArticle?.description ||
      `${group.title}に関する得意コース、騎乗傾向、条件別データの記事を更新していくページです。`,
    alternates: {
      canonical: group.href,
    },
  };
}

export default async function JockeyArticleArchiveDetailPage({ params }: Props) {
  const group = getJockeyArticleArchiveGroup(params.slug);
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
          { name: "騎手別", url: "https://uma-free.com/articles/jockeys" },
          { name: group.title, url: `https://uma-free.com${group.href}` },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        {primaryArticle ? (
          <EntityArticleDocument
            article={primaryArticle}
            canonicalPath={group.href}
            backHref="/articles/jockeys"
            backLabel="騎手別一覧へ"
            profileHref={group.profileHref}
            profileLabel={group.profileLabel}
          />
        ) : (
          <>
            <ArticleArchiveHero
              eyebrow="JOCKEY ARCHIVE"
              title={`${group.title}の記事`}
              description={`${group.subtitle}。この騎手名に紐づく記事を1本のURLで更新していきます。`}
              countLabel="準備中"
            >
              <ArticleArchiveNav active="jockeys" />
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
