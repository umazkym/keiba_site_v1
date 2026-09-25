// 記事のカテゴリ色とサムネイル。ホームの記事一覧と記事ページで同じ規則を使う。
// 共通のアイキャッチ（データ分析・入門・騎手・重賞の汎用画像）はカテゴリの写真に置き換える。
// 同じ一覧では、まだ使っていない写真を優先し、使い切ったら間を空けて使い回す（色の面は、写真の無いときだけの予備）。
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
    重賞攻略: ['article-grade', 'article-grade-2'],
    騎手分析: ['article-jockey', 'article-jockey-2'],
    コース分析: ['article-course', 'article-course-2'],
    入門ガイド: ['article-guide'],
    '馬券・統計': ['article-stats', 'article-stats-2'],
    海外競馬: ['article-overseas', 'article-overseas-2'],
    枠順データ: ['article-gate', 'article-stats-2'],
};

// どのカテゴリにも使えるレースの写真。カテゴリの写真を使い切ったら、ここから選ぶ（2026-09-26）。
// 以前は写真を使い切ると色の面にしており、記事一覧では332件中約270件が写真なしになっていた。
const SEASON_PHOTOS = ['grade-spring', 'grade-summer', 'grade-autumn', 'grade-winter', 'grade-spring-2', 'grade-summer-2', 'grade-winter-2'];
const RACE_PHOTOS = ['race-turf-1', 'race-turf-2', 'race-dirt-1', 'race-night-1', 'race-dusk-1'];
// 横長（2.4:1 など）で馬群が右に寄っている写真は、小さな枠でも馬が入るよう右寄りに切り取る
const PHOTO_POSITION: Record<string, string> = {
    'race-turf-1': '72% 50%',
    'race-turf-2': '75% 50%',
    'race-dirt-1': '75% 50%',
    'race-night-1': '80% 50%',
    'race-dusk-1': '55% 60%',
    // 重賞の季節写真（16:10）は馬群が下寄り。16:9のカードと90×60の行で馬が切れないよう下を見せる（2026-09-26）
    // article-grade・article-grade-2 は16:9の寄りの写真のため真ん中のまま
    'grade-spring': '50% 70%',
    'grade-summer': '50% 70%',
    'grade-autumn': '50% 70%',
    'grade-winter': '50% 70%',
    'grade-spring-2': '50% 70%',
    'grade-summer-2': '50% 70%',
    'grade-winter-2': '50% 70%',
};

export type ArticleThumb =
    | { kind: 'photo'; src: string; srcSet: string; position?: string }
    | { kind: 'eyecatch'; src: string }
    | { kind: 'category'; category: string };

const photoThumb = (name: string): ArticleThumb => {
    // 重賞の季節写真（grade-*）は 720/1200、記事・レースの写真（article-*・race-*）は 800/1600
    const [small, large] = name.startsWith('grade-') ? [720, 1200] : [800, 1600];
    return {
        kind: 'photo',
        src: `/images/photos/${name}-${small}.webp`,
        srcSet: `/images/photos/${name}-${small}.webp ${small}w, /images/photos/${name}-${large}.webp ${large}w`,
        position: PHOTO_POSITION[name],
    };
};

// 記事の候補の写真：カテゴリの写真 → （重賞は）その季節の写真 → どのカテゴリにも使える写真の順
const photoCandidates = (article: { category: string; date: string }): string[] => {
    const own = [...(CATEGORY_PHOTOS[article.category] ?? [])];
    if (article.category === '重賞攻略') {
        const season = `grade-${getSeason(article.date)}`;
        own.unshift(season);
        if (SEASON_PHOTOS.includes(`${season}-2`)) own.push(`${season}-2`);
    }
    return Array.from(new Set([...own, ...SEASON_PHOTOS, ...RACE_PHOTOS]));
};

// 一覧に並べる記事のサムネイルを、上から順に決める。
// まだ使っていない写真を優先し、全部使ったら、いちばん前に使った写真へ戻る（直前の3件と同じ写真は避ける）。
export function pickArticleThumbs(articles: { category: string; eyecatch?: string; date: string }[]): ArticleThumb[] {
    const lastUsed = new Map<string, number>();
    return articles.map((article, index) => {
        if (article.eyecatch && !GENERIC_EYECATCHES.has(article.eyecatch)) {
            return { kind: 'eyecatch', src: article.eyecatch };
        }
        const candidates = photoCandidates(article);
        const fresh = candidates.find((candidate) => !lastUsed.has(candidate));
        const name = fresh ?? candidates
            .filter((candidate) => index - (lastUsed.get(candidate) ?? -Infinity) > 3)
            .sort((a, b) => (lastUsed.get(a) ?? -1) - (lastUsed.get(b) ?? -1))[0]
            ?? candidates[0];
        lastUsed.set(name, index);
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
