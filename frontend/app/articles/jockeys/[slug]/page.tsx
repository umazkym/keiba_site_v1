import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntityArticleArchive } from "@/components/EntityArticleArchive";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { getJockeyArticleArchiveGroup, getJockeyArticleArchiveGroups } from "@/lib/article-archives";

type Props = {
  params: { slug: string };
};

export const dynamicParams = true;

export function generateStaticParams() {
  return getJockeyArticleArchiveGroups()
    .filter((group) => group.articleCount > 0)
    .map((group) => ({ slug: group.key }));
}

function archiveDescription(title: string, description: string): string {
  return description || `${title}に関する得意コース、騎乗傾向、条件別データの記事をまとめています。`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = getJockeyArticleArchiveGroup(params.slug);
  if (!group) {
    return {
      title: "騎手別の記事アーカイブ",
      alternates: { canonical: "/articles" },
    };
  }
  if (group.articleCount === 0) {
    return {
      title: group.title,
      alternates: { canonical: group.profileHref },
      robots: { index: false, follow: true },
    };
  }

  return {
    title: `${group.title}の記事一覧`,
    description: archiveDescription(group.title, group.description),
    alternates: {
      canonical: group.href,
    },
    // 記事が1本だけの一覧は、その記事とほぼ同じなので検索に出さない（2026-10-17）。
    robots: { index: group.articleCount > 1, follow: true },
  };
}

export default function JockeyArticleArchiveDetailPage({ params }: Props) {
  const group = getJockeyArticleArchiveGroup(params.slug);
  if (!group) notFound();
  if (group.articleCount === 0) {
    permanentRedirect(group.profileHref);
  }

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
      <EntityArticleArchive
        group={group}
        eyebrow="騎手別の記事"
        description={archiveDescription(group.title, group.description)}
      />
    </>
  );
}
