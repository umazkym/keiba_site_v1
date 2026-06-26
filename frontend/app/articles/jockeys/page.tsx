import type { Metadata } from "next";
import { ArticleArchiveGroupGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getJockeyArticleArchiveGroups } from "@/lib/article-archives";

export const metadata: Metadata = {
  title: "騎手別の記事アーカイブ | UMA-FREE",
  description:
    "武豊、ルメール、川田将雅など、騎手名ごとに得意コースや条件別データの記事を整理したアーカイブです。",
  alternates: {
    canonical: "/articles/jockeys",
  },
};

export default function JockeyArticleArchivePage() {
  const groups = getJockeyArticleArchiveGroups();
  const totalArticles = groups.reduce((sum, group) => sum + group.articleCount, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "騎手別", url: "https://uma-free.com/articles/jockeys" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <ArticleArchiveHero
          eyebrow="JOCKEY ARTICLES"
          title="騎手別の記事アーカイブ"
          description="騎手名ごとに、得意コース、条件替わり、人気とのズレを扱う記事を整理します。重賞週だけでなく、平場や条件戦の検索流入も拾えるカテゴリ導線です。"
          countLabel={`${totalArticles}件`}
        >
          <ArticleArchiveNav active="jockeys" />
        </ArticleArchiveHero>

        <section className="mt-6">
          <ArticleArchiveGroupGrid groups={groups} />
        </section>
      </div>
    </>
  );
}
