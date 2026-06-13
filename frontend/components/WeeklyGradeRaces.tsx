// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace, RaceDayPrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';

/** レース名からグレード接尾辞を除去 */
function cleanRaceName(name: string): string {
    return name
        .replace(/\s*[（(](?:G[1-3]|GⅠ|GⅡ|GⅢ|Ｇ[１２３]|J・G[1-3])[）)]/g, '')
        .replace(/\s*\(.*?\)$/, '')
        .trim();
}

interface WeeklyGradeRacesProps {
    races: WeeklyGradeRace[];
    compact?: boolean;
    predictions?: RaceDayPrediction | null;
}

export function WeeklyGradeRaces({ races, compact = false, predictions }: WeeklyGradeRacesProps) {
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

    // G1レースとその他(G2, G3)に分類
    const g1Races = races.filter(r => r.grade === 'G1');
    const otherRaces = races.filter(r => r.grade !== 'G1');

    return (
        <section className={compact ? "" : "card rounded-xl"} id="weekly-grade-races">
            <div className={compact ? "" : "px-3 py-2 sm:px-4 sm:py-3"}>
                <div role="heading" aria-level={2} className={compact ? "sr-only" : "mb-2.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5"}>
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-tight text-gray-800 sm:text-base">
                        <span className="w-1 h-4 sm:h-5 rounded-sm shrink-0 bg-amber-500"></span>
                        <span className="truncate">今週の重賞レース</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">注目開催</span>
                </div>

                {/* G1レースの強調表示（フルワイド専用カード） */}
                {g1Races.length > 0 && (
                    <div className="grid gap-3 mb-3">
                        {g1Races.map((race) => {
                            const displayName = cleanRaceName(race.race_name);
                            const topHorse = findTopHorse(race.venue_name, race.race_number);

                            return (
                                <Link
                                    key={race.race_id}
                                    href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                                    className="grade-focus card rounded-xl no-underline"
                                >
                                    <span className="badge badge-amber text-[10px] sm:text-xs">
                                        {race.grade} 注目開催
                                    </span>
                                    <h2>{displayName}</h2>
                                    <p>
                                        {race.venue_name} {race.race_number}R · {race.race_date.replace(/-/g, '/')}。公開データをもとに、枠順と展開材料を確認できます。
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
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* G2, G3等のコンパクトな横スクロールリスト */}
                {otherRaces.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap sm:flex-wrap sm:justify-start sm:gap-2">
                        {otherRaces.map((race) => {
                            const displayName = cleanRaceName(race.race_name);
                            const badgeColorClass = race.grade === 'G2' ? 'badge-slate' : 'badge-green';

                            return (
                                <Link
                                    key={race.race_id}
                                    href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                                    className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:shadow hover:border-blue-500/30 no-underline active:scale-95"
                                >
                                    {/* グレードバッジ */}
                                    <span className={`badge ${badgeColorClass}`}>
                                        {race.grade}
                                    </span>

                                    {/* レース名 */}
                                    <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 leading-tight">
                                        {displayName}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
