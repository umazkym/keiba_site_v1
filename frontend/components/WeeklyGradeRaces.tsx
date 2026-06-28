// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace, RaceDayPrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';
import { getGradeRaceHubPathByName } from '@/lib/grade-race-content';

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

function isFocusRace(race: WeeklyGradeRace): boolean {
    const normalized = normalizeGrade(race.grade);
    return normalized === 'G1' || normalized === 'JPN1';
}

function formatRaceDate(date: string): string {
    return date.replace(/-/g, '/');
}

interface WeeklyGradeRacesProps {
    races: WeeklyGradeRace[];
    compact?: boolean;
    predictions?: RaceDayPrediction | null;
    title?: string;
}

export function WeeklyGradeRaces({ races, compact = false, predictions, title = "近日の重賞レース" }: WeeklyGradeRacesProps) {
    if (!races || races.length === 0) {
        return null;
    }

    // 本日の開催データから該当レースの本命馬(◎)の情報を検索
    const findTopHorse = (venueName: string, raceNumber: number) => {
        if (!predictions) return null;
        const allVenues = [...(predictions.jra ?? []), ...(predictions.nar ?? [])];
        const venue = allVenues.find(v => v.venue_name === venueName);
        const race = venue?.races.find(r => r.race_number === raceNumber);
        if (!race || race.predictions.length === 0) return null;
        const favorite = race.predictions.find(p => p.mark === '◎') || race.predictions[0];
        return {
            horseName: favorite.horse_name,
            score: favorite.deviation_score,
        };
    };

    const sortedRaces = [...races].sort((a, b) => {
        const dateDiff = a.race_date.localeCompare(b.race_date);
        if (dateDiff !== 0) return dateDiff;
        const typePriority = { '中央': 0, '地方': 1 };
        const typeDiff = typePriority[getRaceTypeLabel(a)] - typePriority[getRaceTypeLabel(b)];
        if (typeDiff !== 0) return typeDiff;
        return a.race_number - b.race_number;
    });
    const focusRaces = sortedRaces.filter(isFocusRace);
    const otherRaces = sortedRaces.filter(race => !isFocusRace(race));
    const jraOtherRaces = otherRaces.filter(race => getRaceTypeLabel(race) === '中央');
    const narOtherRaces = otherRaces.filter(race => getRaceTypeLabel(race) === '地方');

    const renderCompactRaceGroup = (label: '中央' | '地方', groupRaces: WeeklyGradeRace[]) => {
        if (groupRaces.length === 0) return null;

        return (
            <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span>{label}の重賞</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap sm:flex-wrap sm:justify-start sm:gap-2">
                    {groupRaces.map((race) => {
                        const displayName = cleanRaceName(race.race_name);
                        const badgeColorClass = getGradeBadgeClass(race.grade);

                        return (
                            <Link
                                key={race.race_id}
                                prefetch={false}
                                href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                                className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:shadow hover:border-blue-500/30 no-underline active:scale-95"
                            >
                                <span className={`badge ${badgeColorClass}`}>
                                    {formatGrade(race.grade)}
                                </span>
                                <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 leading-tight">
                                    {displayName}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 leading-none">
                                    {race.race_date.slice(5).replace('-', '/')} {race.venue_name}{race.race_number}R
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <section className={compact ? "" : "card rounded-xl"} id="weekly-grade-races">
            <div className={compact ? "" : "px-3 py-2 sm:px-4 sm:py-3"}>
                <div role="heading" aria-level={2} className={compact ? "sr-only" : "mb-2.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5"}>
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-tight text-gray-800 sm:text-base">
                        <span className="w-1 h-4 sm:h-5 rounded-sm shrink-0 bg-amber-500"></span>
                        <span className="truncate">{title}</span>
                    </span>
                </div>

                {/* G1/Jpn1級の強調表示（フルワイド専用カード） */}
                {focusRaces.length > 0 && (
                    <div className="grid gap-3 mb-3">
                        {focusRaces.map((race) => {
                            const displayName = cleanRaceName(race.race_name);
                            const topHorse = findTopHorse(race.venue_name, race.race_number);
                            const raceTypeLabel = getRaceTypeLabel(race);
                            const racePath = getRaceDetailPath(race.race_date, race.venue_name, race.race_number);
                            const hubPath = getGradeRaceHubPathByName(race.race_name);

                            return (
                                <article
                                    key={race.race_id}
                                    className="grade-focus card rounded-xl"
                                >
                                    <span className="badge badge-amber text-[10px] sm:text-xs">
                                        {raceTypeLabel} {formatGrade(race.grade)} 注目開催
                                    </span>
                                    <h2>{displayName}</h2>
                                    <p>
                                        {race.venue_name} {race.race_number}R · {formatRaceDate(race.race_date)}。公開データをもとに、出走馬の評価や展開材料を確認できます。
                                    </p>

                                    {topHorse && (
                                        <div className="top-horse">
                                            <div>
                                                <span className="badge badge-blue">AI上位評価</span>
                                                <strong style={{ display: 'block', marginTop: '5px' }}>{topHorse.horseName}</strong>
                                            </div>
                                            <span className="grade-score">{topHorse.score?.toFixed(1) || '--'}</span>
                                        </div>
                                    )}

                                    <div className={`mt-1 grid gap-2 ${hubPath ? 'sm:grid-cols-2' : ''}`}>
                                        {hubPath && (
                                            <Link
                                                prefetch={false}
                                                href={hubPath}
                                                className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-center text-xs font-bold text-white no-underline transition-colors hover:bg-primary"
                                            >
                                                重賞データを見る
                                            </Link>
                                        )}
                                        <Link
                                            prefetch={false}
                                            href={racePath}
                                            className={`inline-flex min-h-[38px] items-center justify-center rounded-lg px-3 py-2 text-center text-xs font-bold no-underline transition-colors ${hubPath
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

                {otherRaces.length > 0 && (
                    <div className="grid gap-2">
                        {renderCompactRaceGroup('中央', jraOtherRaces)}
                        {renderCompactRaceGroup('地方', narOtherRaces)}
                    </div>
                )}
            </div>
        </section>
    );
}
