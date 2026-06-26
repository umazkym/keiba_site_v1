import type { Metadata } from "next";
import { ArticleArchiveGroupGrid, ArticleArchiveHero, ArticleArchiveNav } from "@/components/ArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getRaceArticleArchiveGroups } from "@/lib/article-archives";

export const metadata: Metadata = {
  title: "レース名別の記事アーカイブ | UMA-FREE",
  description:
    "レース名ごとに展望、枠順、当日材料、振り返りを1本のURLへ更新していく記事アーカイブです。",
  alternates: {
    canonical: "/articles/races",
  },
};

export default function RaceArticleArchivePage() {
  const groups = getRaceArticleArchiveGroups();
  const totalArticles = groups.reduce((sum, group) => sum + group.articleCount, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "記事", url: "https://uma-free.com/articles" },
          { name: "レース名別", url: "https://uma-free.com/articles/races" },
        ]}
      />
      <Breadcrumb />
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4 sm:pb-16">
        <ArticleArchiveHero
          eyebrow="RACE ARTICLES"
          title="レース名別の記事アーカイブ"
          description="重賞に限らず、レース名ごとに記事を1本のURLへ集約します。日々の生成では新しいレース名なら新規作成、既存レース名なら同じURLを更新します。"
          countLabel={`${totalArticles}件`}
        >
          <ArticleArchiveNav active="races" />
        </ArticleArchiveHero>

        <section className="mt-6">
          <ArticleArchiveGroupGrid groups={groups} />
        </section>
      </div>
    </>
  );
}
