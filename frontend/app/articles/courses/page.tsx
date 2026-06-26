import type { Metadata } from "next";
import { ArticleArchiveGroupGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getCourseArticleArchiveGroups } from "@/lib/article-archives";

export const metadata: Metadata = {
  title: "コース別の記事アーカイブ | UMA-FREE",
  description:
    "東京芝1600m、中山ダート1200mなど、競馬場と距離ごとに枠順・脚質・騎手データの記事を整理したアーカイブです。",
  alternates: {
    canonical: "/articles/courses",
  },
};

export default function CourseArticleArchivePage() {
  const groups = getCourseArticleArchiveGroups();
  const totalArticles = groups.reduce((sum, group) => sum + group.articleCount, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "コース別", url: "https://uma-free.com/articles/courses" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <ArticleArchiveHero
          eyebrow="COURSE ARTICLES"
          title="コース別の記事アーカイブ"
          description="競馬場と距離の組み合わせごとに、枠順、脚質、騎手、馬場傾向の記事を整理します。レース名よりも条件で調べるユーザーが迷わず入れる導線です。"
          countLabel={`${totalArticles}件`}
        >
          <ArticleArchiveNav active="courses" />
        </ArticleArchiveHero>

        <section className="mt-6">
          <ArticleArchiveGroupGrid groups={groups} />
        </section>
      </div>
    </>
  );
}
