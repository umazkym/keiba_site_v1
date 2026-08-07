import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleMeta } from "@/lib/articles";
import type { ArticleArchiveGroup, ArticleArchiveKind } from "@/lib/article-archives";
import { articleArchiveKinds } from "@/lib/article-archives";

type ArticleArchiveNavProps = {
  active: ArticleArchiveKind | "all";
};

type ArticleArchiveHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  countLabel?: string;
  children?: ReactNode;
};

type ArticleArchiveGroupGridProps = {
  groups: ArticleArchiveGroup[];
};

type ArticleArchiveArticleGridProps = {
  articles: ArticleMeta[];
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatDate(date: string) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function contentTargetLabel(contentTarget?: string) {
  if (!contentTarget) return "";
  if (contentTarget.includes("trend")) return "トレンド";
  if (contentTarget.includes("course")) return "コース";
  if (contentTarget.includes("jockey")) return "騎手";
  if (contentTarget.includes("grade")) return "重賞";
  return "データ";
}

export function ArticleArchiveNav({ active }: ArticleArchiveNavProps) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="記事カテゴリ">
      {articleArchiveKinds.map((item) => {
        const isActive = item.kind === active;
        return (
          <Link
            key={item.kind}
            href={item.href}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors sm:text-sm ${
              isActive
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ArticleArchiveHero({
  eyebrow,
  title,
  description,
  countLabel,
  children,
}: ArticleArchiveHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">{description}</p>
        </div>
        {countLabel && (
          <p className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
            {countLabel}
          </p>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

export function ArticleArchiveGroupGrid({ groups }: ArticleArchiveGroupGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <article
          key={group.key}
          className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold tracking-[0.14em] text-slate-400">ARCHIVE</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                {group.articleCount}件
              </span>
            </div>
            <Link href={group.href} className="group mt-2 block">
              <h2 className="text-xl font-black leading-tight text-slate-950 group-hover:text-primary">
                {group.title}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{group.subtitle}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{group.description}</p>
            </Link>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.badges.slice(0, 4).map((badge) => (
                <span key={badge} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {badge}
                </span>
              ))}
            </div>
            {group.latestDate && (
              <p className="mt-3 text-xs font-bold text-slate-400">最新更新 {formatDate(group.latestDate)}</p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={group.href}
              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-primary"
            >
              記事一覧
            </Link>
            <Link
              href={group.profileHref}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              {group.profileLabel}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ArticleArchiveArticleGrid({
  articles,
  emptyTitle = "記事は準備中です",
  emptyDescription = "今後の自動生成で、このカテゴリに紐づく記事を追加していきます。",
}: ArticleArchiveArticleGridProps) {
  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-14 text-center">
        <p className="text-base font-black text-slate-800">{emptyTitle}</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => {
        const label = contentTargetLabel(article.contentTarget);
        return (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group flex min-h-[360px] h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/20"
          >
            {article.eyecatch ? (
              <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                <img
                  src={article.eyecatch}
                  alt={`${article.title} のアイキャッチ画像`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex min-h-20 items-end border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-black text-slate-600">{article.category}の記事</span>
              </div>
            )}
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{article.category}</span>
                  <time dateTime={new Date(article.date).toISOString()}>{formatDate(article.date)}</time>
                  {label && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{label}</span>}
                </div>
                <h3 className="mt-2 line-clamp-3 text-base font-black leading-snug text-slate-950 group-hover:text-primary">
                  {article.title}
                </h3>
                {article.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{article.description}</p>
                )}
              </div>
              <span className="mt-4 text-xs font-black text-primary">詳細</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
