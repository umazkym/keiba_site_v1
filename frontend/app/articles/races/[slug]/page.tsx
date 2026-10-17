import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityArticleArchive } from "@/components/EntityArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getRaceArticleArchiveGroup, getRaceArticleArchiveGroups } from "@/lib/article-archives";

type Props = {
  params: { slug: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getRaceArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => ({ slug: group.key }));
}

// レースのまとめの description は先頭の記事の説明文なので、一覧の1行目と重ならないよう決まった文にする。
function archiveDescription(title: string): string {
  return `${title}に関する展望、当日材料、振り返りの記事をまとめています。`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getRaceArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "レース名別の記事アーカイブ",
      alternates: { canonical: "/articles" },
    };
  }
  if (group.articleCount === 0) {
    notFound();
  }

  return {
    title: `${group.title}の記事一覧`,
    description: archiveDescription(group.title),
    alternates: {
      canonical: group.href,
    },
    // 記事が1本だけの一覧は、その記事とほぼ同じなので検索に出さない（2026-10-17）。
    robots: { index: group.articleCount > 1, follow: true },
  };
}

export default function RaceArticleArchiveDetailPage({ params }: Props) {
  const group = getRaceArticleArchiveGroup(params.slug);
  if (!group) notFound();
  if (group.articleCount === 0) {
    notFound();
  }

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
      <EntityArticleArchive
        group={group}
        eyebrow="レース別の記事"
        description={archiveDescription(group.title)}
      />
    </>
  );
}
