// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace, RaceDayPrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';
import { getGradeRaceHubPathByName } from '@/lib/grade-race-content';
import {
    getGradeRaceSummaryKey,
    type GradeRaceTopHorseMap,
} from '@/lib/home-page-summary';

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

function formatGrade(grade: string): string {
    return grade === '地方重賞' ? '重賞' : grade;
}

function getRaceTypeLabel(race: WeeklyGradeRace): '中央' | '地方' {
    if (race.race_type === '地方' || normalizeGrade(race.grade).startsWith('JPN') || race.grade === '地方重賞') {
        return '地方';
    }
    return '中央';
}

function getGradeBadgeClass(grade: string): string {
    const normalized = normalizeGrade(grade);
    if (normalized === 'G1' || normalized === 'JPN1') return 'badge-amber';
    if (normalized === 'G2' || normalized === 'JPN2') return 'badge-slate';
    if (normalized === 'G3' || normalized === 'JPN3') return 'badge-green';
    return 'badge-purple';
}

function getGradeRank(grade: string): number {
    const normalized = normalizeGrade(grade);
    if (normalized === 'G1' || normalized === 'JPN1') return 1;
    if (normalized === 'G2' || normalized === 'JPN2') return 2;
    if (normalized === 'G3' || normalized === 'JPN3') return 3;
    return 4;
}

function formatRaceDate(date: string): string {
    return date.replace(/-/g, '/');
}

interface WeeklyGradeRacesProps {
    races: WeeklyGradeRace[];
    compact?: boolean;
    predictions?: RaceDayPrediction | null;
    topHorses?: GradeRaceTopHorseMap;
    title?: string;
}

export function WeeklyGradeRaces({ races, compact = false, predictions, topHorses, title = "近日の重賞レース" }: WeeklyGradeRacesProps) {
    if (!races || races.length === 0) {
        return null;
    }

    // 本日の開催データから該当レースの本命馬(◎)の情報を検索
    const findTopHorse = (race: WeeklyGradeRace) => {
        const summary = topHorses?.[getGradeRaceSummaryKey(race.race_date, race.venue_name, race.race_number)];
        if (summary) return summary;

        if (!predictions) return null;
        const allVenues = [...(predictions.jra ?? []), ...(predictions.nar ?? [])];
        const venue = allVenues.find(v => v.venue_name === race.venue_name);
        const predictionRace = venue?.races.find(r => r.race_number === race.race_number);
        if (!predictionRace || predictionRace.predictions.length === 0) return null;
        const favorite = predictionRace.predictions.find(p => p.mark === '◎') || predictionRace.predictions[0];
        return {
            horseName: favorite.horse_name,
            score: favorite.deviation_score,
        };
    };

    const sortedRaces = [...races].sort((a, b) => {
        const gradeRankA = getGradeRank(a.grade);
        const gradeRankB = getGradeRank(b.grade);
        if (gradeRankA !== gradeRankB) return gradeRankA - gradeRankB;

        const dateDiff = a.race_date.localeCompare(b.race_date);
        if (dateDiff !== 0) return dateDiff;

        const typePriority = { '中央': 0, '地方': 1 };
        const typeDiff = typePriority[getRaceTypeLabel(a)] - typePriority[getRaceTypeLabel(b)];
        if (typeDiff !== 0) return typeDiff;

        return a.race_number - b.race_number;
    });

    const focusRaces = sortedRaces.slice(0, 1);
    const listRaces = compact ? sortedRaces.slice(0, 3) : sortedRaces.slice(1);
    const compactRemainingRaces = compact ? sortedRaces.slice(3) : [];
    const jraListRaces = listRaces.filter(race => getRaceTypeLabel(race) === '中央');
    const narListRaces = listRaces.filter(race => getRaceTypeLabel(race) === '地方');

    const renderCompactRaceGroup = (
        label: '中央' | '地方',
        groupRaces: WeeklyGradeRace[],
        allowMobileCollapse = true,
    ) => {
        if (groupRaces.length === 0) return null;

        const renderRaceLink = (race: WeeklyGradeRace, className = '') => {
            const displayName = cleanRaceName(race.race_name);
            const badgeColorClass = getGradeBadgeClass(race.grade);

            return (
                <Link
                    key={race.race_id}
                    prefetch={false}
                    href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                    className={`inline-flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 no-underline transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/50 ${className}`}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <span className={`badge shrink-0 ${badgeColorClass}`}>
                            {formatGrade(race.grade)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-bold leading-tight text-slate-900 group-hover:text-blue-600 sm:text-[13px]">
                            {displayName}
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[10px] font-bold leading-none text-slate-500">
                            {race.race_date.slice(5).replace('-', '/')} {race.venue_name}{race.race_number}R
                        </span>
                        <span aria-hidden="true" className="text-xs font-bold text-blue-600">→</span>
                    </div>
                </Link>
            );
        };

        return (
            <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span>{label}の重賞</span>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                    {groupRaces.slice(0, 3).map((race) => renderRaceLink(race))}
                    {groupRaces.slice(3).map((race) => renderRaceLink(race, allowMobileCollapse ? 'hidden sm:inline-flex' : ''))}
                </div>
                {allowMobileCollapse && groupRaces.length > 3 && (
                    <details className="group sm:hidden">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                            ほか{groupRaces.length - 3}件を表示
                        </summary>
                        <div className="mt-1.5 grid gap-1.5">
                            {groupRaces.slice(3).map((race) => renderRaceLink(race))}
                        </div>
                    </details>
                )}
            </div>
        );
    };

    const renderRaceSummaryLink = (race: WeeklyGradeRace, className = '') => (
        <Link
            key={race.race_id}
            prefetch={false}
            href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
            aria-label={`${getRaceTypeLabel(race)} ${formatGrade(race.grade)} ${cleanRaceName(race.race_name)} ${race.race_date.slice(5).replace('-', '/')} ${race.venue_name}${race.race_number}R`}
            className={`inline-flex min-h-[44px] min-w-0 items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 no-underline transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/50 ${className}`}
        >
            <div className="flex min-w-0 items-center gap-1.5">
                <span className={`badge shrink-0 ${getGradeBadgeClass(race.grade)}`}>
                    {formatGrade(race.grade)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-800 sm:text-xs">
                    {cleanRaceName(race.race_name)}
                </span>
            </div>
            <span aria-hidden="true" className="shrink-0 text-xs font-bold text-blue-600">→</span>
        </Link>
    );

    return (
        <section className={compact ? "" : "grade-races-panel"} id="weekly-grade-races">
            <div className={compact ? "" : "px-3 py-2 sm:px-4 sm:py-3"}>
                <div role="heading" aria-level={2} className={compact ? "sr-only" : "mb-2.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5"}>
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-tight text-gray-800 sm:text-base">
                        <span className="truncate">{title}</span>
                    </span>
                </div>

                {/* G1/Jpn1級の強調表示（フルワイド専用カード） */}
                {!compact && focusRaces.length > 0 && (
                    <div className="grid gap-2 mb-2">
                        {focusRaces.map((race) => {
                            const displayName = cleanRaceName(race.race_name);
                            const topHorse = findTopHorse(race);
                            const raceTypeLabel = getRaceTypeLabel(race);
                            const racePath = getRaceDetailPath(race.race_date, race.venue_name, race.race_number);
                            const hubPath = getGradeRaceHubPathByName(race.race_name);

                            return (
                                <article
                                    key={race.race_id}
                                    className="grade-focus p-2.5 sm:p-4"
                                >
                                    <span className="badge badge-blue text-[9.5px] sm:text-xs">
                                        {raceTypeLabel} {formatGrade(race.grade)} 注目開催
                                    </span>
                                    <h2 className="!text-[15px] sm:!text-[20px] font-black mt-1 mb-0.5">{displayName}</h2>
                                    <p className="text-[11px] leading-relaxed text-slate-600 mb-2">
                                        {race.venue_name} {race.race_number}R · {formatRaceDate(race.race_date)}。公開データをもとに、出走馬の評価や展開材料を確認できます。
                                    </p>

                                    {topHorse && (
                                        <div className="top-horse py-1.5 px-2">
                                            <div>
                                                <span className="badge badge-blue text-[9px]">AI上位評価</span>
                                                <strong className="block text-xs mt-0.5">{topHorse.horseName}</strong>
                                            </div>
                                            <span className="grade-score text-sm">{topHorse.score?.toFixed(1) || '--'}</span>
                                        </div>
                                    )}

                                    <div className={`mt-1.5 grid gap-1.5 ${hubPath ? 'sm:grid-cols-2' : ''}`}>
                                        {hubPath && (
                                            <Link
                                                prefetch={false}
                                                href={hubPath}
                                                className="inline-flex min-h-8 items-center justify-center rounded-lg bg-slate-950 px-2.5 py-1 text-center text-[11.5px] font-bold text-white no-underline transition-colors duration-150 hover:bg-primary"
                                            >
                                                重賞データを見る
                                            </Link>
                                        )}
                                        <Link
                                            prefetch={false}
                                            href={racePath}
                                            className={`inline-flex min-h-8 items-center justify-center rounded-lg px-2.5 py-1 text-center text-[11.5px] font-bold no-underline transition-colors duration-150 ${hubPath
                                                ? 'border border-slate-200 bg-white text-slate-700 hover:border-primary/30 hover:text-primary'
                                                : 'bg-slate-950 text-white hover:bg-primary'
                                                }`}
                                        >
                                            当日のAI偏差値を見る
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {!compact && listRaces.length > 0 && (
                    <details className="group">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-100">
                            <span>そのほかの重賞</span>
                            <span className="text-slate-500">{listRaces.length}件</span>
                        </summary>
                        <div className="mt-2 grid gap-2">
                            {renderCompactRaceGroup('中央', jraListRaces)}
                            {renderCompactRaceGroup('地方', narListRaces)}
                        </div>
                    </details>
                )}

                {compact && (
                    <div className="grid gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            <span>近日の重賞</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                            {listRaces.map((race) => renderRaceSummaryLink(race))}
                            {compactRemainingRaces.map((race) => renderRaceSummaryLink(race, 'hidden sm:inline-flex'))}
                        </div>
                        {compactRemainingRaces.length > 0 && (
                        <details className="group mt-1.5 sm:hidden">
                            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                                ほか{compactRemainingRaces.length}件を表示
                            </summary>
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                {compactRemainingRaces.map((race) => renderRaceSummaryLink(race))}
                            </div>
                        </details>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
