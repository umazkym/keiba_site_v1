import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUniqueCategories } from "@/lib/articles";
import ArticlesPage, { buildArticlesMetadata } from "../../page";

interface CategoryPageProps {
  params: { category: string };
  searchParams: {
    tag?: string;
    page?: string;
  };
}

/**
 * URLセグメントを実在するカテゴリ名へ解決する。
 * 存在しないカテゴリは404にして、任意文字列で無限にページが生えるのを防ぐ。
 */
function resolveCategory(segment: string): string | null {
  const categories = getUniqueCategories();

  // Next.jsが渡すセグメントは環境によって素の文字列とパーセントエンコード済みの
  // どちらもありうるため、両方の形で突き合わせる。
  if (categories.includes(segment)) return segment;

  try {
    const decoded = decodeURIComponent(segment);
    if (categories.includes(decoded)) return decoded;
  } catch {
    return null;
  }

  return null;
}

function parsePage(value?: string): number {
  const parsed = parseInt(value || "1", 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export function generateStaticParams() {
  // 素のカテゴリ名を返す。ここでencodeURIComponentするとNext.jsが再度エンコードし、
  // 二重エンコードされたセグメントがページへ渡って404になる。
  return getUniqueCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const category = resolveCategory(params.category);
  if (!category) {
    return { title: "カテゴリが見つかりません", robots: { index: false, follow: false } };
  }

  return buildArticlesMetadata({
    category,
    tag: searchParams.tag,
    page: parsePage(searchParams.page),
  });
}

export default function ArticleCategoryPage({ params, searchParams }: CategoryPageProps) {
  const category = resolveCategory(params.category);
  if (!category) {
    notFound();
  }

  // 一覧の描画ロジックは /articles と共通。カテゴリだけルート側で確定させる。
  return <ArticlesPage searchParams={{ ...searchParams, category }} />;
}
