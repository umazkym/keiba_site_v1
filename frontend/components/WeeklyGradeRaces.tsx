// components/WeeklyGradeRaces.tsx
// 近日の重賞。G1/Jpn1 級の1レースだけを写真の入口で強調し、そのほかは短い一覧にする（DESIGN.md「ホーム」）。
import Link from 'next/link';
import { WeeklyGradeRace, RaceDayPrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';
import { getGradeRaceHubPathByName } from '@/lib/grade-race-content';
import {
    getGradeRaceSummaryKey,
    type GradeRaceTopHorse,
    type GradeRaceTopHorseMap,
} from '@/lib/home-page-summary';
import { formatRaceDateLabel, getSeason } from '@/lib/race-display';
import { GradeBadge, RacePlate } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

/** レース名からグレード接尾辞を除去 */
function cleanRaceName(name: string): string {
    return name
        .replace(/\s*[（(]?(?:G[1-3]|GI{1,3}|G[ⅠⅡⅢ]|Ｇ[１２３]|J・G[1-3]|Jpn(?:[1-3]|I{1,3}|[ⅠⅡⅢ]))[）)]?/giu, '')
        .replace(/[〔［\[].*?[〕］\]]/gu, '')
        .replace(/\s*地方重賞\s*$/u, '')
        .replace(/\s*重賞\s*$/u, '')
        .replace(/\s*[（(].*$/u, '')
        .replace(/\s*\(.*?\)$/, '')
        .trim();
}

function normalizeGrade(grade: string): string {
    return grade.replace(/\s+/g, '').toUpperCase();
}

function getRaceTypeLabel(race: WeeklyGradeRace): '中央' | '地方' {
    if (race.race_type === '地方' || normalizeGrade(race.grade).startsWith('JPN') || race.grade === '地方重賞') {
        return '地方';
    }
    return '中央';
}

function getGradeRank(grade: string): number {
    const normalized = normalizeGrade(grade);
    if (normalized === 'G1' || normalized === 'JPN1') return 1;
    if (normalized === 'G2' || normalized === 'JPN2') return 2;
    if (normalized === 'G3' || normalized === 'JPN3') return 3;
    return 4;
}

export function sortWeeklyGradeRaces(races: WeeklyGradeRace[]): WeeklyGradeRace[] {
    return [...races].sort((a, b) => {
        const gradeDiff = getGradeRank(a.grade) - getGradeRank(b.grade);
        if (gradeDiff !== 0) return gradeDiff;
        const dateDiff = a.race_date.localeCompare(b.race_date);
        if (dateDiff !== 0) return dateDiff;
        const typePriority = { '中央': 0, '地方': 1 };
        const typeDiff = typePriority[getRaceTypeLabel(a)] - typePriority[getRaceTypeLabel(b)];
        if (typeDiff !== 0) return typeDiff;
        return a.race_number - b.race_number;
    });
}

const findTopHorse = (
    race: WeeklyGradeRace,
    topHorses?: GradeRaceTopHorseMap,
    predictions?: RaceDayPrediction | null,
): GradeRaceTopHorse | null => {
    const summary = topHorses?.[getGradeRaceSummaryKey(race.race_date, race.venue_name, race.race_number)];
    if (summary) return summary;
    if (!predictions) return null;
    const allVenues = [...(predictions.jra ?? []), ...(predictions.nar ?? [])];
    const venue = allVenues.find(v => v.venue_name === race.venue_name);
    const predictionRace = venue?.races.find(r => r.race_number === race.race_number);
    if (!predictionRace || predictionRace.predictions.length === 0) return null;
    const favorite = predictionRace.predictions.find(p => p.mark === '◎') || predictionRace.predictions[0];
    return { horseName: favorite.horse_name, score: favorite.deviation_score };
};

function GradePhoto({ raceDate, className, sizes }: { raceDate: string; className: string; sizes: string }) {
    const base = `/images/photos/grade-${getSeason(raceDate)}`;
    return (
        // eslint-disable-next-line @next/next/no-img-element -- 事前に書き出したWebPを直接配信し、サーバーの画像最適化を使わない
        <img
            src={`${base}-720.webp`}
            srcSet={`${base}-720.webp 720w, ${base}-1200.webp 1200w`}
            sizes={sizes}
            alt=""
            loading="lazy"
            decoding="async"
            className={className}
        />
    );
}

function GradeRaceRow({ race }: { race: WeeklyGradeRace }) {
    return (
        <Link
            prefetch={false}
            href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
            className="flex min-h-[48px] min-w-0 items-center gap-2.5 border-b border-slate-200 py-2 last:border-b-0 transition-colors duration-150 hover:bg-slate-50"
        >
            <GradeBadge grade={race.grade} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">{cleanRaceName(race.race_name)}</span>
            <span className="shrink-0 whitespace-nowrap text-[12px] text-slate-500">
                {formatRaceDateLabel(race.race_date)} {race.venue_name}
            </span>
            <LineIcon name="chevR" size={16} className="block shrink-0 text-slate-500" />
        </Link>
    );
}

// PCのホームのヒーロー右上に重ねる小さなカード（強調する1レース）
export function HomeGradeMini({ races, topHorses }: { races: WeeklyGradeRace[]; topHorses?: GradeRaceTopHorseMap }) {
    const race = sortWeeklyGradeRaces(races)[0];
    if (!race) return null;
    const topHorse = findTopHorse(race, topHorses);
    const hubPath = getGradeRaceHubPathByName(race.race_name);
    return (
        <section className="w-[340px] overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(14,20,64,0.28)]" aria-label="今週の重賞">
            <div className="relative h-[150px]">
                <GradePhoto raceDate={race.race_date} sizes="340px" className="h-full w-full object-cover object-[62%_45%]" />
                <span className="absolute left-3 top-3 flex items-center gap-1.5">
                    <GradeBadge grade={race.grade} size="l" />
                    <span className="rounded-[7px] bg-night/80 px-2 py-1 text-[12px] font-bold text-white">今週の重賞</span>
                </span>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-3.5 pt-3">
                <Link
                    prefetch={false}
                    href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                    className="flex items-center gap-2.5"
                >
                    <RacePlate venue={race.venue_name} raceNumber={race.race_number} size="s" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[12px] font-bold text-slate-500">{formatRaceDateLabel(race.race_date)}</span>
                        <span className="truncate font-display text-[22px] font-extrabold leading-tight text-slate-900">{cleanRaceName(race.race_name)}</span>
                    </span>
                </Link>
                {topHorse ? (
                    <p className="flex items-center gap-2 text-[13px] text-slate-700">
                        <span className="font-bold text-ai-deep">AI上位評価</span>
                        <span className="min-w-0 flex-1 break-words font-bold text-slate-900">{topHorse.horseName}</span>
                        <span className="font-num text-[16px] font-bold text-ai-deep">{topHorse.score?.toFixed(1) ?? '--'}</span>
                    </p>
                ) : (
                    <p className="text-[12.5px] leading-relaxed text-slate-500">出走馬が確定したあと、全頭のAI偏差値を公開します。</p>
                )}
                {hubPath && (
                    <Link prefetch={false} href={hubPath} className="flex min-h-[40px] items-center gap-2 border-t border-slate-200 pt-1.5 text-[13.5px] font-bold text-slate-900 hover:text-brand-700">
                        <LineIcon name="book" size={17} className="block shrink-0 text-brand-700" />
                        <span className="flex-1">過去のデータと傾向を見る</span>
                        <LineIcon name="chevR" size={16} className="block shrink-0 text-slate-500" />
                    </Link>
                )}
            </div>
        </section>
    );
}

interface WeeklyGradeRacesProps {
    races: WeeklyGradeRace[];
    // 旧来の指定（true なら variant="compact"）
    compact?: boolean;
    // feature：写真の入口＋そのほかの一覧（スマホのホーム）／list：強調する1レース以外の一覧（PCのホームの右列）／compact：レース画面の小さな一覧
    variant?: 'feature' | 'list' | 'compact';
    predictions?: RaceDayPrediction | null;
    topHorses?: GradeRaceTopHorseMap;
    title?: string;
}

export function WeeklyGradeRaces({ races, compact = false, variant, predictions, topHorses, title = "近日の重賞レース" }: WeeklyGradeRacesProps) {
    if (!races || races.length === 0) {
        return null;
    }
    const mode = variant ?? (compact ? 'compact' : 'feature');
    const sortedRaces = sortWeeklyGradeRaces(races);
    const focusRace = sortedRaces[0];
    const otherRaces = sortedRaces.slice(1);

    if (mode === 'compact') {
        const visible = sortedRaces.slice(0, 6);
        return (
            <section id="weekly-grade-races" aria-label={title}>
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-ai" aria-hidden="true" />
                    近日の重賞
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((race) => (
                        <Link
                            key={race.race_id}
                            prefetch={false}
                            href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                            aria-label={`${getRaceTypeLabel(race)} ${race.grade} ${cleanRaceName(race.race_name)} ${formatRaceDateLabel(race.race_date)} ${race.venue_name}${race.race_number}R`}
                            className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 transition-colors duration-150 hover:border-brand-300"
                        >
                            <GradeBadge grade={race.grade} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900">{cleanRaceName(race.race_name)}</span>
                            <span className="shrink-0 text-[11.5px] text-slate-500">{formatRaceDateLabel(race.race_date)}</span>
                        </Link>
                    ))}
                </div>
            </section>
        );
    }

    if (mode === 'list') {
        if (otherRaces.length === 0) return null;
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="weekly-grade-races-more-heading">
                <h2 id="weekly-grade-races-more-heading" className="race-section-heading !text-[17px]">そのほかの重賞</h2>
                <div className="flex flex-col">
                    {otherRaces.slice(0, 8).map((race) => <GradeRaceRow key={race.race_id} race={race} />)}
                </div>
            </section>
        );
    }

    const topHorse = findTopHorse(focusRace, topHorses, predictions);
    const racePath = getRaceDetailPath(focusRace.race_date, focusRace.venue_name, focusRace.race_number);
    const hubPath = getGradeRaceHubPathByName(focusRace.race_name);
    // 下に「そのほかの重賞」が続かないときは、最後のリンクの下線を消す（カードの枠と二重にしない）
    const lastLinkLine = otherRaces.length > 0 ? '' : 'last:border-b-0';

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" id="weekly-grade-races" aria-labelledby="weekly-grade-races-heading">
            <div className="relative h-[190px] md:h-[230px]">
                <GradePhoto raceDate={focusRace.race_date} sizes="(min-width: 1024px) 460px, 100vw" className="h-full w-full object-cover object-[55%_40%]" />
                <span className="absolute left-3.5 top-3.5 flex items-center gap-2">
                    <GradeBadge grade={focusRace.grade} size="l" />
                    <span className="rounded-[7px] bg-night/80 px-2.5 py-1 text-[12.5px] font-bold text-white">{title === '近日の重賞レース' ? '今週の重賞' : title}</span>
                </span>
            </div>
            {/* スマホは写真→日付を12px、最後のリンクの下線と下の余白を詰める（2026-09-25 スマホの見直し）。PCは今のまま */}
            <div className="flex flex-col gap-2.5 px-4 pb-2 pt-3 md:px-5 md:pb-5 md:pt-4">
                <div className="flex items-center gap-3">
                    <RacePlate venue={focusRace.venue_name} raceNumber={focusRace.race_number} size="s" />
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[13px] font-bold text-slate-500">{formatRaceDateLabel(focusRace.race_date)} · {getRaceTypeLabel(focusRace)}</span>
                        <h2 id="weekly-grade-races-heading" className="text-[24px] font-extrabold leading-tight text-slate-900 md:text-[28px]">{cleanRaceName(focusRace.race_name)}</h2>
                    </div>
                </div>
                {topHorse ? (
                    <p className="flex items-center gap-2 rounded-lg bg-ai-soft/60 px-3 py-2 text-[14px] text-slate-700">
                        <span className="text-[12.5px] font-bold text-ai-deep">AI上位評価</span>
                        <span className="min-w-0 flex-1 break-words font-bold text-slate-900">{topHorse.horseName}</span>
                        <span className="font-num text-[20px] font-bold text-ai-deep">{topHorse.score?.toFixed(1) ?? '--'}</span>
                    </p>
                ) : (
                    <p className="text-[13.5px] leading-relaxed text-slate-700">出走馬が確定したあと、全頭のAI偏差値と展開予測をここに公開します。</p>
                )}
                <div className="flex flex-col border-t border-slate-200">
                    <Link prefetch={false} href={racePath} className={`flex min-h-[46px] items-center gap-2.5 border-b border-slate-200 text-[14px] font-bold text-slate-900 hover:text-brand-700 ${lastLinkLine}`}>
                        <LineIcon name="gauge" size={18} className="block shrink-0 text-brand-700" />
                        <span className="flex-1">当日のAI偏差値を見る</span>
                        <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
                    </Link>
                    {hubPath && (
                        <Link prefetch={false} href={hubPath} className={`flex min-h-[46px] items-center gap-2.5 border-b border-slate-200 text-[14px] font-bold text-slate-900 hover:text-brand-700 ${lastLinkLine}`}>
                            <LineIcon name="book" size={18} className="block shrink-0 text-brand-700" />
                            <span className="flex-1">過去のデータと傾向を見る</span>
                            <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
                        </Link>
                    )}
                </div>
                {otherRaces.length > 0 && (
                    <details className="group">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-[13.5px] font-bold text-slate-700">
                            <span>そのほかの重賞</span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                                {otherRaces.length}件
                                <LineIcon name="chevD" size={16} className="block transition-transform duration-150 group-open:rotate-180" />
                            </span>
                        </summary>
                        <div className="flex flex-col">
                            {otherRaces.map((race) => <GradeRaceRow key={race.race_id} race={race} />)}
                        </div>
                    </details>
                )}
            </div>
        </section>
    );
}
