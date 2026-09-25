// 記事の冒頭と末尾の部品（通常の記事・騎手/コース/レースのまとめ記事で共用）。
// 見出しの下の「カテゴリ・公開日・読了時間」、冒頭の写真、目次（この記事で確認できること）、
// 今日の全レースへの案内、本文の後の「次に読む分析」。
import Link from 'next/link';
import { RaceAnalysisValueGrid } from '@/components/RaceAnalysisValueGrid';
import { LineIcon } from '@/components/LineIcon';
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

// 記事の題名。「本題｜副題」は、スマホだけ区切りの後で改行して2段にする（1字だけ次の行に落ちるのを防ぐ。OG画像と同じ分け方）。
// 文字の並びは元の題名のまま（パンくず・読み上げ・検索で同じ文になる）。
export function ArticleTitleText({ title }: { title: string }) {
    const match = title.match(/^(.+?)(\s*[｜|]\s*)(.+)$/);
    if (!match) return <>{title}</>;
    const [, main, separator, sub] = match;
    return (
        <>
            <span className="block sm:inline">{main}{separator}</span>
            <span className="block sm:inline">{sub}</span>
        </>
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
            {/* 札は見た目23pxのまま、押せる範囲だけ広げる（hit-44） */}
            <Link
                prefetch={false}
                href={`/articles/category/${encodeURIComponent(category)}`}
                className="hit-44 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
                <ArticleCategoryTag category={category} size="md" />
            </Link>
            {published && <time dateTime={published.toISOString()}>{JST_DATE.format(published)}</time>}
            {showUpdated && updated && <span>更新 <time dateTime={updated.toISOString()}>{JST_DATE.format(updated)}</time></span>}
            {/* 見本どおり時計のアイコンは付けない */}
            <span>約{readingMinutes}分</span>
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

// 今日の全レースへの案内。ホームの写真の下と同じ「4つの視点」の1行（小図と名前）に、文と矢印を添える。
// パネル全体で1つのリンク（2026-09-26 利用者の指定「ホームと同じUI」。以前は4つの線のアイコンと文の1行）。
export function ArticleValueGuide({ headingId }: { headingId: string }) {
    return (
        <Link
            href="/races/today"
            prefetch={false}
            data-analytics-placement="article_value_guide"
            data-analytics-variant="compact_four"
            data-preview-state="generic"
            className="flex cursor-pointer flex-col gap-2 rounded-xl bg-white px-2 pb-2 pt-2.5 ring-1 ring-inset ring-slate-200 transition-colors duration-150 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:px-4 sm:pt-3"
            aria-label="今日の全レース分析を見る。AI偏差値、対戦成績、展開予測、馬番の傾向を確認できます"
        >
            <RaceAnalysisValueGrid variant="strip" />
            <span className="flex items-center justify-center gap-1 border-t border-slate-100 pt-2 text-brand-700">
                <h2 id={headingId} className="font-sans text-[13.5px] font-bold leading-snug text-brand-700 sm:text-[14.5px]">
                    今日の全レースを4つの視点で確認する
                </h2>
                <LineIcon name="arrowR" size={16} className="block shrink-0" />
            </span>
        </Link>
    );
}

// 目次。本文のH2（enhanceArticleHtml が付けた id）へ移動する。見出しが2つ未満なら出さない。
// 各行はスマホで44px以上（押せる所は44px以上の決まり。2026-09-25 に40pxから変更）、PCは36px。
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
                            className="flex min-h-9 items-center py-1 text-[14.5px] leading-[1.55] text-slate-700 transition-colors duration-150 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:min-h-[36px] sm:text-[15px]"
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
    // 本文を持たない一覧（レース画面の関連記事）では出さない
    readingMinutes?: number;
    thumb: ArticleThumbData;
};

// 本文の後の「次に読む分析」。スマホは写真つきの行、PCは3列。レース画面の「関連する分析記事」も同じ形を使う。
export function RelatedArticleList({ items, headingId, title = '次に読む分析' }: { items: RelatedArticleItem[]; headingId: string; title?: string }) {
    if (items.length === 0) return null;
    return (
        // 見出しは18px。スマホの行はホームの記事一覧と同じ90×60の写真と上下10px（2026-09-26 縦の高さの見直し）
        <section aria-labelledby={headingId} className="rounded-[14px] bg-white px-4 pb-1 pt-3.5 ring-1 ring-inset ring-slate-200 sm:p-6">
            <h2 id={headingId} className="font-display text-[18px] font-bold leading-snug text-slate-900 sm:text-[21px]">
                {title}
            </h2>
            <ul className="mt-1 flex flex-col sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-5">
                {items.map((item) => (
                    <li key={item.slug} className="border-b border-slate-200 last:border-b-0 sm:border-b-0">
                        <Link
                            prefetch={false}
                            href={`/articles/${item.slug}`}
                            className="group flex gap-3 py-2.5 sm:flex-col sm:gap-2.5 sm:py-0"
                        >
                            <ArticleThumb
                                thumb={item.thumb}
                                sizes="(min-width: 1080px) 300px, (min-width: 640px) 30vw, 90px"
                                className="h-[60px] w-[90px] shrink-0 rounded-[10px] sm:aspect-[16/9] sm:h-auto sm:w-full sm:rounded-xl"
                            />
                            <span className="flex min-w-0 flex-col gap-1 sm:contents">
                                <span className="line-clamp-2 text-[14.5px] font-bold leading-normal text-slate-900 group-hover:text-brand-700 sm:order-2 sm:text-[15px] sm:leading-[1.55]">
                                    {item.title}
                                </span>
                                <span className="flex items-center gap-2 text-[12.5px] text-slate-500 sm:order-1">
                                    <ArticleCategoryTag category={item.category} />
                                    {formatArticleShortDate(item.date)}{item.readingMinutes ? ` · 約${item.readingMinutes}分` : ''}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
