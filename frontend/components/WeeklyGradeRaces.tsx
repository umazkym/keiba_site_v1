// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';

// グレードごとのスタイル定義（絵文字不使用・プロフェッショナルなデザイン）
const gradeStyles: Record<string, {
    card: string;
    badge: string;
    label: string;
}> = {
    G1: {
        card: 'border-l-[3px] border-l-amber-500 bg-amber-50/60 hover:bg-amber-50',
        badge: 'bg-amber-500 text-white',
        label: 'text-amber-900',
    },
    G2: {
        card: 'border-l-[3px] border-l-slate-400 bg-slate-50/60 hover:bg-slate-50',
        badge: 'bg-slate-500 text-white',
        label: 'text-slate-800',
    },
    G3: {
        card: 'border-l-[3px] border-l-orange-400 bg-orange-50/40 hover:bg-orange-50/70',
        badge: 'bg-orange-500 text-white',
        label: 'text-orange-900',
    },
};

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
}

export function WeeklyGradeRaces({ races, compact = false }: WeeklyGradeRacesProps) {
    if (!races || races.length === 0) {
        return null;
    }

    return (
        <section className={compact ? "" : "card"} id="weekly-grade-races">
            <div className={compact ? "" : "px-2.5 py-1.5 sm:px-4 sm:py-2"}>
                <div role="heading" aria-level={2} className={compact ? "sr-only" : "mb-1.5 flex items-center justify-between gap-2"}>
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold leading-tight text-gray-800 sm:text-base">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-primary, #2563eb)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span className="truncate">今週の重賞レース</span>
                    </span>
                    <span className="hidden text-[10px] font-bold text-slate-400 sm:inline">注目開催</span>
                </div>

                {/* 横並びでシンプル＆クリーンな「タグ」スタイル */}
                <div className={`flex gap-1.5 overflow-x-auto pb-0.5 ${compact ? 'flex-wrap justify-start' : 'flex-nowrap sm:flex-wrap sm:justify-start sm:gap-2.5'}`}>
                    {races.map((race) => {
                        const style = gradeStyles[race.grade] || gradeStyles.G3;
                        const displayName = cleanRaceName(race.race_name);

                        return (
                            <Link
                                key={race.race_id}
                                href={getRaceDetailPath(race.race_date, race.venue_name, race.race_number)}
                                className={`
                                    flex shrink-0 items-center gap-1.5 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg
                                    bg-white border border-slate-200 shadow-sm
                                    ${style.card}
                                    transition-all duration-200 group hover:shadow hover:border-primary/30
                                    no-underline active:scale-95
                                `}
                                style={{ borderLeftWidth: 0, borderBottomWidth: 0 }}
                            >
                                {/* グレードバッジ */}
                                <span className={`
                                    inline-flex items-center justify-center
                                    w-[27px] h-[17px] sm:w-[32px] sm:h-[20px] rounded text-[9px] sm:text-[10px] font-bold tracking-wide
                                    ${style.badge}
                                `}>
                                    {race.grade}
                                </span>

                                {/* レース名 */}
                                <span className={`max-w-[132px] truncate text-[12px] sm:max-w-none sm:text-[13px] font-bold ${style.label} leading-tight`}>
                                    {displayName}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
