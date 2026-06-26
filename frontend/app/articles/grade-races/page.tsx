import type { Metadata } from "next";
import { ArticleArchiveGroupGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getGradeRaceArticleArchiveGroups } from "@/lib/article-archives";

export const metadata: Metadata = {
  title: "重賞別の記事アーカイブ | UMA-FREE",
  description:
    "宝塚記念、安田記念、有馬記念など、重賞名ごとに展望・枠順・追い切り・回顧記事を整理した記事アーカイブです。",
  alternates: {
    canonical: "/articles/grade-races",
  },
};

export default function GradeRaceArticleArchivePage() {
  const groups = getGradeRaceArticleArchiveGroups();
  const totalArticles = groups.reduce((sum, group) => sum + group.articleCount, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "重賞別", url: "https://uma-free.com/articles/grade-races" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <ArticleArchiveHero
          eyebrow="GRADE RACE ARTICLES"
          title="重賞別の記事アーカイブ"
          description="G1・重賞名ごとに、展望、枠順、追い切り、レース後の振り返りをまとめています。年度別の記事を同じ重賞名へ積み重ね、検索需要が高まる時期に読み返しやすい構造にします。"
          countLabel={`${totalArticles}件`}
        >
          <ArticleArchiveNav active="grade-races" />
        </ArticleArchiveHero>

        <section className="mt-6">
          <ArticleArchiveGroupGrid groups={groups} />
        </section>
      </div>
    </>
  );
}
