// 記事のカテゴリ色とサムネイル。ホームの記事一覧と記事ページで同じ規則を使う。
// 共通のアイキャッチ（データ分析・入門・騎手・重賞の汎用画像）はカテゴリの写真に置き換える。
// 同じ一覧で同じ写真が並ばないよう、写真が尽きたらカテゴリ色の面＋線のアイコンにする。
import type { LineIconName } from '@/components/LineIcon';
import { getSeason } from '@/lib/race-display';

export type ArticleCategoryStyle = {
    // 文字と枠線（白地のタグ）
    tagClass: string;
    // 写真が無いときの面、カテゴリ一覧の色の目印
    fillClass: string;
    icon: LineIconName;
    // 同じ色の16進（OG画像など Tailwind の外で描くもの）
    hex: string;
};

const CATEGORY_STYLES: Record<string, ArticleCategoryStyle> = {
    重賞攻略: { tagClass: 'text-navy ring-navy', fillClass: 'bg-navy', icon: 'trophy', hex: '#1C2787' },
    騎手分析: { tagClass: 'text-[#6A4BC4] ring-[#6A4BC4]', fillClass: 'bg-[#6A4BC4]', icon: 'user', hex: '#6A4BC4' },
    コース分析: { tagClass: 'text-turf-deep ring-turf-deep', fillClass: 'bg-turf-deep', icon: 'pin', hex: '#1D6B40' },
    入門ガイド: { tagClass: 'text-[#0E7490] ring-[#0E7490]', fillClass: 'bg-[#0E7490]', icon: 'book', hex: '#0E7490' },
    '馬券・統計': { tagClass: 'text-dirt-deep ring-dirt-deep', fillClass: 'bg-dirt-deep', icon: 'chart', hex: '#7D4B1C' },
    海外競馬: { tagClass: 'text-[#3F4A6B] ring-[#3F4A6B]', fillClass: 'bg-[#3F4A6B]', icon: 'flag', hex: '#3F4A6B' },
    枠順データ: { tagClass: 'text-[#B4436C] ring-[#B4436C]', fillClass: 'bg-[#B4436C]', icon: 'bars', hex: '#B4436C' },
};

const DEFAULT_STYLE: ArticleCategoryStyle = { tagClass: 'text-slate-600 ring-slate-300', fillClass: 'bg-slate-600', icon: 'chart', hex: '#474E73' };

export const getArticleCategoryStyle = (category: string): ArticleCategoryStyle =>
    CATEGORY_STYLES[category] ?? DEFAULT_STYLE;

// 記事ごとに作られていない、使い回しのアイキャッチ
const GENERIC_EYECATCHES = new Set([
    '/images/articles/data-analysis-eyecatch.png',
    '/images/articles/beginner.png',
    '/images/articles/jockey.png',
    '/images/articles/jyusyo-eyecatch.png',
]);

const CATEGORY_PHOTOS: Record<string, string[]> = {
    重賞攻略: ['article-grade'],
    騎手分析: ['article-jockey'],
    コース分析: ['article-course'],
    入門ガイド: ['article-guide'],
    '馬券・統計': ['article-stats'],
    海外競馬: ['article-overseas'],
    枠順データ: ['article-gate'],
};

export type ArticleThumb =
    | { kind: 'photo'; src: string; srcSet: string }
    | { kind: 'eyecatch'; src: string }
    | { kind: 'category'; category: string };

const photoThumb = (name: string): ArticleThumb => {
    // 重賞の季節写真（grade-*）は 720/1200、記事の写真（article-*）は 800/1600
    const [small, large] = name.startsWith('grade-') ? [720, 1200] : [800, 1600];
    return {
        kind: 'photo',
        src: `/images/photos/${name}-${small}.webp`,
        srcSet: `/images/photos/${name}-${small}.webp ${small}w, /images/photos/${name}-${large}.webp ${large}w`,
    };
};

// 一覧に並べる記事のサムネイルを、上から順に決める
export function pickArticleThumbs(articles: { category: string; eyecatch?: string; date: string }[]): ArticleThumb[] {
    const used = new Set<string>();
    return articles.map((article) => {
        if (article.eyecatch && !GENERIC_EYECATCHES.has(article.eyecatch)) {
            return { kind: 'eyecatch', src: article.eyecatch };
        }
        const pool = [...(CATEGORY_PHOTOS[article.category] ?? [])];
        // 重賞は記事の日付の季節の写真も候補にする
        if (article.category === '重賞攻略') {
            pool.push(`grade-${getSeason(article.date)}`);
        }
        const name = pool.find((candidate) => !used.has(candidate));
        if (!name) {
            return { kind: 'category', category: article.category };
        }
        used.add(name);
        return photoThumb(name);
    });
}

// 記事の冒頭の写真。記事ごとのアイキャッチがあればそれを、無ければカテゴリの写真を使う。
// 重賞は開催日（無ければ記事の日付）の季節の写真にする。写真が無いカテゴリは null（冒頭に写真を出さない）。
export function pickArticleCover(article: { category: string; eyecatch?: string; date: string; scheduledRaceDate?: string }): ArticleThumb | null {
    if (article.eyecatch && !GENERIC_EYECATCHES.has(article.eyecatch)) {
        return { kind: 'eyecatch', src: article.eyecatch };
    }
    if (article.category === '重賞攻略') {
        return photoThumb(`grade-${getSeason(article.scheduledRaceDate || article.date)}`);
    }
    const name = CATEGORY_PHOTOS[article.category]?.[0];
    return name ? photoThumb(name) : null;
}

// 本文の文字数からの目安（1分で500字）
export const estimateReadingMinutes = (content: string) =>
    Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length / 500));
