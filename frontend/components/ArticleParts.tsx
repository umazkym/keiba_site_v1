// 記事の冒頭と末尾の部品（通常の記事・騎手/コース/レースのまとめ記事で共用）。
// 見出しの下の「カテゴリ・公開日・読了時間」、冒頭の写真、目次（この記事で確認できること）、
// 今日の全レースへの案内、本文の後の「次に読む分析」。
import Link from 'next/link';
import { LineIcon } from '@/components/LineIcon';
import { RaceAnalysisValueGrid } from '@/components/RaceAnalysisValueGrid';
import { ArticleThumb } from '@/components/ArticleThumb';
import type { ArticleTocItem } from '@/lib/article-ux';
import type { ArticleThumb as ArticleThumbData } from '@/lib/article-visual';
import { getArticleCategoryStyle } from '@/lib/article-visual';

const JST_DATE = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' });
const JST_SHORT_DATE = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
const JST_DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });

const toDate = (value: string) => new Date(value);
const isValidDate = (value?: string): value is string => Boolean(value) && !Number.isNaN(toDate(value as string).getTime());

export const formatArticleDate = (value: string) => (isValidDate(value) ? JST_DATE.format(toDate(value)) : '');
export const formatArticleShortDate = (value: string) => (isValidDate(value) ? JST_SHORT_DATE.format(toDate(value)) : '');

export function ArticleCategoryTag({ category, size = 'sm' }: { category: string; size?: 'sm' | 'md' }) {
    const style = getArticleCategoryStyle(category);
    const sizeClass = size === 'md' ? 'px-2 py-0.5 text-[12.5px]' : 'px-1.5 py-px text-[11.5px]';
    return (
        <span className={`inline-flex shrink-0 items-center rounded-[5px] bg-white font-bold leading-normal ring-1 ring-inset ${sizeClass} ${style.tagClass}`}>
            {category}
        </span>
    );
}

// 見出しの下に置く「カテゴリ・公開日・読了時間」。更新日が公開日と別の日なら「更新」を添える。
export function ArticleMetaRow({
    category,
    date,
    lastUpdated,
    readingMinutes,
}: {
    category: string;
    date: string;
    lastUpdated?: string;
    readingMinutes: number;
}) {
    const published = isValidDate(date) ? toDate(date) : null;
    const updated = isValidDate(lastUpdated) ? toDate(lastUpdated) : null;
    const showUpdated = Boolean(published && updated && JST_DAY_KEY.format(updated) > JST_DAY_KEY.format(published));
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-slate-500 sm:text-[13.5px]">
            <Link
                href={`/articles/category/${encodeURIComponent(category)}`}
                className="rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
                <ArticleCategoryTag category={category} size="md" />
            </Link>
            {published && <time dateTime={published.toISOString()}>{JST_DATE.format(published)}</time>}
            {showUpdated && updated && <span>更新 <time dateTime={updated.toISOString()}>{JST_DATE.format(updated)}</time></span>}
            <span className="inline-flex items-center gap-1">
                <LineIcon name="clock" size={15} className="block text-slate-500" />
                約{readingMinutes}分
            </span>
        </div>
    );
}

// 冒頭の写真。高さを先に確保してレイアウトを動かさない。カテゴリの写真は内容を表さないため alt は空にする。
export function ArticleCover({ cover, title }: { cover: ArticleThumbData | null; title: string }) {
    if (!cover || cover.kind === 'category') return null;
    const isPhoto = cover.kind === 'photo';
    return (
        <div className="overflow-hidden rounded-[14px] bg-slate-100 ring-1 ring-inset ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- 事前に書き出した画像を直接配信し、サーバーの画像最適化を使わない */}
            <img
                src={cover.src}
                srcSet={isPhoto ? cover.srcSet : undefined}
                sizes={isPhoto ? '(min-width: 1080px) 760px, (min-width: 640px) 90vw, 100vw' : undefined}
                alt={isPhoto ? '' : `${title} のアイキャッチ画像`}
                loading="eager"
                decoding="async"
                className="block aspect-[19/10] w-full object-cover sm:aspect-[9/4]"
            />
        </div>
    );
}

// 今日の全レースへの案内（4つの視点の図と、パネル全体で1つのリンク）
export function ArticleValueGuide({ headingId }: { headingId: string }) {
    return (
        <Link
            href="/races/today"
            prefetch={false}
            data-analytics-placement="article_value_guide"
            data-analytics-variant="compact_four"
            data-preview-state="generic"
            className="block min-h-[44px] cursor-pointer rounded-[14px] bg-brand-50/70 p-3 ring-1 ring-inset ring-brand-200 transition-colors duration-150 hover:bg-brand-50 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:p-4"
            aria-label="今日の全レース分析を見る。AI偏差値、対戦比較、展開・脚質、馬番の傾向を確認できます"
        >
            <section aria-labelledby={headingId}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 id={headingId} className="font-sans text-[14.5px] font-bold leading-tight text-slate-900 sm:text-[15.5px]">
                        今日の全レースを4つの視点で確認
                    </h2>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-brand-700 sm:text-[13.5px]">
                        全レース分析へ
                        <LineIcon name="chevR" size={15} className="block" />
                    </span>
                </div>
                <RaceAnalysisValueGrid variant="compact" />
            </section>
        </Link>
    );
}

// 目次。本文のH2（enhanceArticleHtml が付けた id）へ移動する。見出しが2つ未満なら出さない。
export function ArticleToc({ toc, headingId }: { toc: ArticleTocItem[]; headingId: string }) {
    if (toc.length < 2) return null;
    return (
        <nav
            aria-labelledby={headingId}
            data-analytics-placement="article_toc"
            className="rounded-[14px] bg-white px-4 py-3.5 ring-1 ring-inset ring-slate-200 sm:px-6 sm:py-5"
        >
            <p id={headingId} className="flex items-center gap-2 text-[14.5px] font-bold text-navy">
                <LineIcon name="list" size={18} className="block text-navy" />
                この記事で確認できること
            </p>
            <ol className="mt-1.5 list-decimal pl-[22px] marker:font-num marker:font-bold marker:text-slate-500">
                {toc.map((item) => (
                    <li key={item.id} className="pl-1">
                        <a
                            href={`#${item.id}`}
                            className="flex min-h-[40px] items-center py-1 text-[14.5px] leading-[1.55] text-slate-700 transition-colors duration-150 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:min-h-[36px] sm:text-[15px]"
                        >
                            {item.title}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

export type RelatedArticleItem = {
    slug: string;
    title: string;
    category: string;
    date: string;
    readingMinutes: number;
    thumb: ArticleThumbData;
};

// 本文の後の「次に読む分析」。スマホは写真つきの行、PCは3列。
export function RelatedArticleList({ items, headingId }: { items: RelatedArticleItem[]; headingId: string }) {
    if (items.length === 0) return null;
    return (
        <section aria-labelledby={headingId} className="rounded-[14px] bg-white p-4 ring-1 ring-inset ring-slate-200 sm:p-6">
            <h2 id={headingId} className="font-display text-[19px] font-extrabold leading-snug text-slate-900 sm:text-[21px]">
                次に読む分析
            </h2>
            <ul className="mt-1 flex flex-col sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-5">
                {items.map((item) => (
                    <li key={item.slug} className="border-b border-slate-200 last:border-b-0 sm:border-b-0">
                        <Link
                            prefetch={false}
                            href={`/articles/${item.slug}`}
                            className="group flex gap-3 py-3 sm:flex-col sm:gap-2.5 sm:py-0"
                        >
                            <ArticleThumb
                                thumb={item.thumb}
                                sizes="(min-width: 1080px) 300px, (min-width: 640px) 30vw, 104px"
                                className="h-[70px] w-[104px] shrink-0 rounded-[10px] sm:aspect-[16/9] sm:h-auto sm:w-full sm:rounded-xl"
                            />
                            <span className="flex min-w-0 flex-col gap-1.5 sm:contents">
                                <span className="line-clamp-2 text-[14.5px] font-bold leading-normal text-slate-900 group-hover:text-brand-700 sm:order-2 sm:text-[15px] sm:leading-[1.55]">
                                    {item.title}
                                </span>
                                <span className="flex items-center gap-2 text-[12.5px] text-slate-500 sm:order-1">
                                    <ArticleCategoryTag category={item.category} />
                                    {formatArticleShortDate(item.date)} · 約{item.readingMinutes}分
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
