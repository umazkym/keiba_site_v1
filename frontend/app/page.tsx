import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    BarChart3,
    CalendarDays,
    Gauge,
    LineChart,
    ListChecks,
    MapPin,
    ShieldCheck,
    Swords,
    Target,
    TrendingUp,
} from 'lucide-react';
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { getSpecialPick, getPredictionsForDate, getWeeklyGradeRaces, getTopPayoutHits } from '@/lib/api';
import { getLatestArticles, getAllArticles } from '../lib/articles';

import DisclaimerAlert from '@/components/DisclaimerAlert';
import { AdUnit } from '@/components/AdUnit';
import { NativeCardAd } from '@/components/NativeCardAd';
import type { Metadata } from 'next';
import type { HorsePrediction, RaceDayPrediction, RacePrediction, VenueRaces } from '@/lib/types';

// ISR: データ更新は1日2〜3回（06:00, 13:30 JST）のバッチ処理のため、
// 30分間キャッシュでも十分な鮮度を維持しつつ、Origin Transfer/CPUを大幅削減。
// stale-while-revalidate方式: キャッシュ期間中もユーザーにはページが表示され、
// バックグラウンドで再検証が行われるため「何も見れない」障害を防止する。
export const revalidate = 1800;

const siteDescription = "競馬データ分析サイト。中央・地方の全レースをAIが無料分析。馬場状態の勝率影響、騎手の得意コース、枠順・距離適性、馬体重増減と成績の関係をデータで解説。登録不要で今すぐ使えます。";

export const metadata: Metadata = {
    title: "UMA-FREE | 競馬データ分析・統計情報サイト",
    description: siteDescription,
    openGraph: {
        title: "UMA-FREE | AI競馬データ分析・統計情報サイト",
        description: siteDescription,
        url: 'https://uma-free.com',
        siteName: 'UMA-FREE',
        locale: 'ja_JP',
        type: 'website',
    },
    alternates: {
        canonical: '/',
    },
};

const homepageFaqItems = [
    {
        question: '本当に無料ですか？',
        answer: 'はい。すべてのデータ分析情報が完全無料です。登録も不要で、メールマガジンなども一切ありません。',
    },
    {
        question: 'データはいつ更新されますか？',
        answer: '毎日午前7時頃を目安に、前日の結果と当日の分析データを更新しています。',
    },
    {
        question: '分析の精度はどのくらいですか？',
        answer: '統計分析であるため、実際の結果とは異なる場合があります。過去の的中結果はサイト内でご確認いただけます。',
    },
    {
        question: 'モバイルでも使えますか？',
        answer: 'はい。PC・スマートフォン・タブレットすべてのデバイスに対応しています。',
    },
];

const fallbackPreviewHorses = [
    { horse_number: 3, horse_name: 'AI上位候補', mark: '◎', deviation_score: 72.4 },
    { horse_number: 8, horse_name: '相手候補', mark: '○', deviation_score: 66.8 },
    { horse_number: 11, horse_name: '押さえ候補', mark: '▲', deviation_score: 61.5 },
];

const getTodayString = () => {
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return jstDate.toISOString().split('T')[0];
};

const formatShortDate = (date: string) => {
    const [, month, day] = date.split('-');
    if (!month || !day) return date;
    return `${Number(month)}/${Number(day)}`;
};

const getRaceCourseLabel = (race?: RacePrediction | null) => {
    if (!race) return 'コース・距離別の傾向を確認';
    const type = race.course_type ? `${race.course_type}` : 'コース';
    const distance = race.distance ? `${race.distance}m` : '距離未定';
    return `${type} ${distance}`;
};

const hasMatchupData = (race?: RacePrediction | null) => {
    const data = race?.matchup?.matchup_data;
    return !!data && Object.keys(data).length > 0;
};

const getAllRaceItems = (predictions: RaceDayPrediction | null) => {
    const items: { group: '中央' | '地方'; venue: VenueRaces; race: RacePrediction }[] = [];
    predictions?.jra?.forEach((venue) => {
        venue.races.forEach((race) => items.push({ group: '中央', venue, race }));
    });
    predictions?.nar?.forEach((venue) => {
        venue.races.forEach((race) => items.push({ group: '地方', venue, race }));
    });
    return items;
};

const getVenueCount = (predictions: RaceDayPrediction | null) => {
    return (predictions?.jra?.length ?? 0) + (predictions?.nar?.length ?? 0);
};

const getRaceCount = (predictions: RaceDayPrediction | null) => {
    return getAllRaceItems(predictions).length;
};

const selectFeaturedRace = (predictions: RaceDayPrediction | null, todayStr: string) => {
    const allRaces = getAllRaceItems(predictions);
    if (allRaces.length === 0) return null;

    const scored = allRaces.map((item) => {
        const topScore = Math.max(
            ...item.race.predictions
                .map((prediction) => prediction.deviation_score ?? 0)
                .filter((score) => Number.isFinite(score)),
            0
        );
        const score =
            topScore +
            (item.race.ai_analysis_text ? 12 : 0) +
            (hasMatchupData(item.race) ? 8 : 0) +
            ((item.race.horse_number_advantages?.length ?? 0) > 0 ? 6 : 0) +
            (item.race.predictions.some((prediction) => prediction.start_1c_indicator !== null) ? 5 : 0);

        return { ...item, score };
    });

    const selected = scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.race.race_number - b.race.race_number;
    })[0];

    const topHorses = selected.race.predictions
        .filter((prediction) => prediction.deviation_score !== null)
        .sort((a, b) => (b.deviation_score ?? 0) - (a.deviation_score ?? 0))
        .slice(0, 3);

    return {
        ...selected,
        href: `/races/${todayStr}?race=${selected.race.race_number}&venue=${encodeURIComponent(selected.venue.venue_name)}`,
        topHorses,
    };
};

const getMarkClass = (mark?: string) => {
    if (mark === '◎') return 'bg-amber-500 text-white';
    if (mark === '○') return 'bg-blue-600 text-white';
    if (mark === '▲') return 'bg-slate-800 text-white';
    if (mark === '△') return 'bg-emerald-600 text-white';
    return 'bg-slate-100 text-slate-600';
};

const PreviewHorseRow = ({ horse, index }: { horse: Partial<HorsePrediction>; index: number }) => {
    const score = horse.deviation_score ?? 0;
    const width = Math.max(36, Math.min(100, Math.round((score / 80) * 100)));

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${getMarkClass(horse.mark)}`}>
                    {horse.mark || index + 1}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold leading-none text-slate-900">
                            {horse.horse_number ? `${horse.horse_number}. ` : ''}{horse.horse_name}
                        </p>
                        <span className="font-mono text-[12px] font-black text-slate-900">
                            {score ? score.toFixed(1) : '--'}
                        </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeaturePreviewCard = ({
    title,
    label,
    description,
    icon,
    href,
    children,
}: {
    title: string;
    label: string;
    description: string;
    icon: ReactNode;
    href: string;
    children: ReactNode;
}) => (
    <Link
        href={href}
        className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
        <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400">{label}</p>
                    <p className="truncate text-[13px] font-black text-slate-900">{title}</p>
                </div>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </div>
        <div className="mb-3 min-h-[76px]">{children}</div>
        <p className="mt-auto text-[11px] leading-relaxed text-slate-500">{description}</p>
    </Link>
);

const MiniFeatureSamples = ({ href, race }: { href: string; race?: RacePrediction | null }) => (
    <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Race Detail Preview</p>
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">レースを開くと見られる分析</h2>
            </div>
            <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-950">
                サンプルのレースを見る
                <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FeaturePreviewCard
                href={href}
                label="全頭比較"
                title="AI偏差値"
                icon={<Gauge className="h-4 w-4" />}
                description="能力評価を数値で並べて、上位候補と差をすばやく確認できます。"
            >
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>上位</span><span>72.4</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[88%] rounded-full bg-blue-600" /></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[72%] rounded-full bg-slate-500" /></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[61%] rounded-full bg-amber-500" /></div>
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                href={href}
                label="位置取り"
                title="脚質予測"
                icon={<LineChart className="h-4 w-4" />}
                description="序盤の位置取り傾向を見て、展開が向きそうな馬を探せます。"
            >
                <div className="flex h-[74px] items-end gap-1.5 rounded-lg bg-slate-50 px-3 pb-2 pt-3">
                    {[68, 42, 74, 52, 35].map((height, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                            <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} />
                            <span className="text-[9px] font-bold text-slate-400">{index + 1}C</span>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                href={href}
                label="直接比較"
                title="対戦成績"
                icon={<Swords className="h-4 w-4" />}
                description={hasMatchupData(race) ? '出走馬同士の過去対戦を勝敗で確認できます。' : '過去対戦があるレースでは、勝敗関係を表で確認できます。'}
            >
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-black">
                    {['+2', '0', '-1', '+1', '+3', '0', '-2', '+1', '+2'].map((value, index) => (
                        <span
                            key={`${value}-${index}`}
                            className={`rounded-md py-1.5 ${value.startsWith('+') ? 'bg-emerald-50 text-emerald-700' : value.startsWith('-') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {value}
                        </span>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                href={href}
                label={getRaceCourseLabel(race)}
                title="枠順傾向"
                icon={<BarChart3 className="h-4 w-4" />}
                description="コースごとに、馬番や枠の有利不利をスコアで確認できます。"
            >
                <div className="space-y-1.5">
                    {[82, 54, 68, 40].map((width, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <span className="w-7 text-[10px] font-bold text-slate-400">{index + 1}枠</span>
                            <div className="h-2 flex-1 rounded-full bg-slate-100">
                                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </FeaturePreviewCard>

            <FeaturePreviewCard
                href={href}
                label="読み解き"
                title="AI分析"
                icon={<ListChecks className="h-4 w-4" />}
                description={race?.ai_analysis_text ? 'レースごとの注目点を短く整理して確認できます。' : 'データがそろったレースでは、注目点を文章で確認できます。'}
            >
                <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-[10px] font-bold text-slate-600">
                    <div className="h-1.5 w-[92%] rounded-full bg-slate-300" />
                    <div className="h-1.5 w-[74%] rounded-full bg-slate-300" />
                    <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded bg-white px-1.5 py-1 text-blue-700">展開</span>
                        <span className="rounded bg-white px-1.5 py-1 text-emerald-700">適性</span>
                        <span className="rounded bg-white px-1.5 py-1 text-amber-700">注意点</span>
                    </div>
                </div>
            </FeaturePreviewCard>
        </div>
    </section>
);

const VenueButtonGroup = ({
    label,
    venues,
    todayStr,
}: {
    label: string;
    venues: VenueRaces[];
    todayStr: string;
}) => {
    if (!venues || venues.length === 0) return null;

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black text-slate-700">{label}</p>
                <span className="text-[10px] font-bold text-slate-400">{venues.reduce((sum, venue) => sum + venue.races.length, 0)}レース</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {venues.slice(0, 6).map((venue) => (
                    <Link
                        key={`${label}-${venue.venue_name}`}
                        href={`/races/${todayStr}?venue=${encodeURIComponent(venue.venue_name)}`}
                        className="flex min-h-[44px] items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 transition-colors hover:border-slate-300 hover:bg-white"
                    >
                        <span>{venue.venue_name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{venue.races.length}R</span>
                    </Link>
                ))}
            </div>
            {venues.length > 6 && (
                <Link href={`/races/${todayStr}`} className="mt-2 inline-flex text-xs font-bold text-slate-600 hover:text-slate-950">
                    すべての開催を見る
                </Link>
            )}
        </div>
    );
};

export default async function HomePage() {
    const todayStr = getTodayString();
    const [specialPick, predictions, weeklyGradeRaces, topHits] = await Promise.all([
        getSpecialPick(todayStr).catch(e => {
            console.error("Failed to fetch special pick:", e);
            return null;
        }),
        getPredictionsForDate(todayStr).catch(e => {
            console.error("Failed to fetch predictions:", e);
            return null;
        }),
        getWeeklyGradeRaces().catch(e => {
            console.error("Failed to fetch weekly grade races:", e);
            return [];
        }),
        getTopPayoutHits().catch(e => {
            console.error("Failed to fetch top hits:", e);
            return [];
        })
    ]);

    const latestArticles = getLatestArticles(6);
    const totalArticles = getAllArticles().length;
    const featuredRace = selectFeaturedRace(predictions, todayStr);
    const featuredHref = featuredRace?.href ?? `/races/${todayStr}`;
    const previewHorses = featuredRace?.topHorses.length ? featuredRace.topHorses : fallbackPreviewHorses;
    const venueCount = getVenueCount(predictions);
    const raceCount = getRaceCount(predictions);

    return (
        <div className="py-4 flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                    <div className="p-5 sm:p-7 lg:p-8">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                登録不要
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
                                <CalendarDays className="h-3.5 w-3.5" />
                                毎日更新
                            </span>
                        </div>
                        <h1 className="max-w-2xl text-2xl font-black leading-tight tracking-normal text-slate-950 sm:text-4xl">
                            今日のレースを、AI偏差値とデータで見比べる
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                            UMA-FREEは、出走馬のAI偏差値、脚質予測、過去対戦、枠順傾向、AI分析コメントを無料で確認できる競馬データ分析サイトです。買うレースと見送るレースを整理するための材料を、レースごとにまとめています。
                        </p>
                        <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-lg font-black text-slate-950">{venueCount || 24}</p>
                                <p className="text-[11px] font-bold text-slate-500">対応競馬場</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-lg font-black text-slate-950">{raceCount || '全'}</p>
                                <p className="text-[11px] font-bold text-slate-500">本日レース</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-lg font-black text-slate-950">{totalArticles}</p>
                                <p className="text-[11px] font-bold text-slate-500">分析記事</p>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                            <Link href={featuredHref} className="btn-primary min-h-[46px] justify-center gap-2 px-5 text-sm">
                                今日の分析を見る
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/articles"
                                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            >
                                分析記事を読む
                            </Link>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-4 text-white sm:p-6 lg:p-7">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Today Preview</p>
                                <p className="truncate text-base font-black text-white">
                                    {featuredRace ? `${featuredRace.venue.venue_name} ${featuredRace.race.race_number}R` : 'レース詳細の表示例'}
                                </p>
                            </div>
                            {featuredRace && (
                                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">
                                    {featuredRace.group}
                                </span>
                            )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-white">
                                        {featuredRace?.race.race_name ?? '出走馬のAI評価'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                                        {featuredRace ? getRaceCourseLabel(featuredRace.race) : 'AI偏差値・脚質・枠順傾向をまとめて確認'}
                                    </p>
                                </div>
                                <Gauge className="h-5 w-5 shrink-0 text-blue-300" />
                            </div>
                            <div className="space-y-2">
                                {previewHorses.map((horse, index) => (
                                    <PreviewHorseRow key={`${horse.horse_number}-${horse.horse_name}-${index}`} horse={horse} index={index} />
                                ))}
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                                { label: '脚質予測', active: featuredRace?.race.predictions.some((prediction) => prediction.start_1c_indicator !== null) },
                                { label: '対戦成績', active: hasMatchupData(featuredRace?.race) },
                                { label: '枠順傾向', active: (featuredRace?.race.horse_number_advantages?.length ?? 0) > 0 },
                                { label: 'AI分析', active: !!featuredRace?.race.ai_analysis_text },
                            ].map((item) => (
                                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                                    <p className="text-[11px] font-black text-white">{item.label}</p>
                                    <p className={`mt-0.5 text-[10px] font-bold ${item.active ? 'text-emerald-300' : 'text-slate-400'}`}>
                                        {item.active ? 'このレースで表示' : '詳細画面で確認'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <RecentRaceReturn />

            <section className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Race Entrances</p>
                            <h2 className="text-lg font-black text-slate-900">本日の開催（{formatShortDate(todayStr)}）</h2>
                        </div>
                        <Link href={`/races/${todayStr}`} className="inline-flex items-center gap-1 text-xs font-black text-slate-700 hover:text-slate-950">
                            今日の全レース
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {predictions && ((predictions.jra?.length ?? 0) > 0 || (predictions.nar?.length ?? 0) > 0) ? (
                        <div className="space-y-4">
                            <VenueButtonGroup label="中央競馬" venues={predictions.jra ?? []} todayStr={todayStr} />
                            <VenueButtonGroup label="地方競馬" venues={predictions.nar ?? []} todayStr={todayStr} />
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                            本日のレースデータはまだありません。更新後に競馬場別の入口が表示されます。
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <SpecialPickCard pick={specialPick} date={todayStr} />
                    {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                        <WeeklyGradeRaces races={weeklyGradeRaces} />
                    )}
                </div>
            </section>

            <MiniFeatureSamples href={featuredHref} race={featuredRace?.race} />

            <AdUnit slot="8529703346" placement="inline" analyticsPlacement="home_after_value_preview" />

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Why UMA-FREE</p>
                        <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">出走表だけでは見落としやすい材料を、レースごとに整理</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                            人気やオッズだけで判断しにくいレースでも、過去の対戦、コースごとの馬番傾向、序盤の位置取り、AI偏差値を同じ画面で比較できます。新規の方は今日のレースから全体像をつかみ、リピーターの方は前回見たレースや重賞レースへすぐ戻れる構成にしています。
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { icon: <Target className="h-4 w-4" />, title: '買う理由を整理', text: '上位候補と不安材料を同時に確認' },
                            { icon: <TrendingUp className="h-4 w-4" />, title: '回収率の見直し', text: '的中ランキングから傾向を振り返る' },
                            { icon: <MapPin className="h-4 w-4" />, title: '競馬場別に確認', text: '中央・地方を同じ導線でチェック' },
                            { icon: <CalendarDays className="h-4 w-4" />, title: '日々の習慣化', text: '前回のレースへ戻りやすい導線' },
                        ].map((item) => (
                            <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-800 shadow-sm">
                                    {item.icon}
                                </div>
                                <p className="text-[13px] font-black text-slate-900">{item.title}</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section>
                <TopHitsDisplay initialHits={topHits} />
            </section>

            <AdUnit slot="1489598374" placement="inline" analyticsPlacement="home_after_top_hits" />

            <section>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="sec-title !mb-0">
                        <span className="bar bg-secondary"></span>
                        最新の分析記事
                    </h2>
                    <Link href="/articles" className="text-[11px] sm:text-[12px] font-semibold text-secondary hover:text-primary transition-colors pr-1">
                        すべて見る →
                    </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {latestArticles.slice(0, 3).map((article) => (
                        <Link href={`/articles/${article.slug}`} key={article.slug} className="article-card-v group shrink-0 w-full snap-start sm:snap-align-none">
                            <div className="article-thumb-v">
                                <Image src={article.eyecatch} alt={article.title} fill className="object-cover transition-transform group-hover:scale-105 duration-500" sizes="(max-width: 640px) 240px, (max-width: 1024px) 50vw, 25vw" />
                            </div>
                            <div className="article-body-v">
                                <span className="article-cat">{article.category}</span>
                                <p className="article-title line-clamp-2">{article.title}</p>
                                <span className="article-date">{new Date(article.date).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                    <NativeCardAd slot="1489598374" variant="article" className="shrink-0 w-full" analyticsPlacement="home_article_feed_1" />

                    {latestArticles.slice(3, 6).map((article) => (
                        <Link href={`/articles/${article.slug}`} key={article.slug} className="article-card-v group shrink-0 w-full snap-start sm:snap-align-none">
                            <div className="article-thumb-v">
                                <Image src={article.eyecatch} alt={article.title} fill className="object-cover transition-transform group-hover:scale-105 duration-500" sizes="(max-width: 640px) 240px, (max-width: 1024px) 50vw, 25vw" />
                            </div>
                            <div className="article-body-v">
                                <span className="article-cat">{article.category}</span>
                                <p className="article-title line-clamp-2">{article.title}</p>
                                <span className="article-date">{new Date(article.date).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                    <NativeCardAd slot="9407670747" variant="article" className="shrink-0 w-full" analyticsPlacement="home_article_feed_2" />
                </div>
            </section>

            <DisclaimerAlert />

            <details className="card accordion" open={false}>
                <summary>よくある質問<span className="chevron">▶</span></summary>
                <div className="acc-body">
                    <div className="grid gap-3">
                        {homepageFaqItems.map((item, index) => (
                            <div key={index} className="border-l-[3px] border-secondary-light/30 pl-3.5 py-2">
                                <h4 className="text-[13px] font-bold mb-1">Q. {item.question}</h4>
                                <p className="text-[12px] text-secondary leading-[1.7]">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-center">
                        <Link href="/faq" className="text-xs font-bold text-primary hover:underline">FAQページへ →</Link>
                    </div>
                </div>
            </details>

            <AdUnit slot="9407670747" placement="inline" analyticsPlacement="home_after_faq" />

            <details className="card accordion" open={false}>
                <summary>対応競馬場一覧（全24場）<span className="chevron">▶</span></summary>
                <div className="acc-body">
                    <div className="mb-3.5">
                        <h4 className="text-[12px] font-bold mb-1.5">中央競馬（JRA）10場</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'].map(venue => (
                                <span key={venue} className="text-[11px] font-semibold text-secondary bg-white border border-border px-2.5 py-1 rounded-md">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-[12px] font-bold mb-1.5">地方競馬（NAR）14場</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {['門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀'].map(venue => (
                                <span key={venue} className="text-[11px] font-semibold text-secondary bg-white border border-border px-2.5 py-1 rounded-md">
                                    {venue}
                                </span>
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] text-muted mt-2.5">
                        ※ばんえい競馬（帯広）は対応しておりません。
                    </p>
                </div>
            </details>
        </div>
    );
}
