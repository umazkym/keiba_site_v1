// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace } from '@/lib/types';

// グレードごとの配色定義
const gradeStyles: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
    G1: {
        bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
        border: 'border-amber-300',
        text: 'text-amber-800',
        badge: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
        icon: '👑',
    },
    G2: {
        bg: 'bg-gradient-to-r from-slate-50 to-gray-50',
        border: 'border-slate-400',
        text: 'text-slate-700',
        badge: 'bg-gradient-to-r from-slate-500 to-gray-500 text-white',
        icon: '🥈',
    },
    G3: {
        bg: 'bg-gradient-to-r from-orange-50 to-amber-50',
        border: 'border-orange-300',
        text: 'text-orange-800',
        badge: 'bg-gradient-to-r from-orange-400 to-amber-500 text-white',
        icon: '🥉',
    },
};

function formatRaceDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00+09:00');
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}（${dayOfWeek}）`;
}

// レース名からグレード表記を除去して短縮する
function cleanRaceName(name: string): string {
    return name
        .replace(/\s*[（(](?:G[1-3]|GⅠ|GⅡ|GⅢ|Ｇ[１２３]|J・G[1-3])[）)]/g, '')
        .replace(/\s*\(.*?\)$/, '')
        .trim();
}

interface WeeklyGradeRacesProps {
    races: WeeklyGradeRace[];
}

export function WeeklyGradeRaces({ races }: WeeklyGradeRacesProps) {
    if (!races || races.length === 0) {
        return null;
    }

    return (
        <section className="card" id="weekly-grade-races">
            <div className="p-4 sm:p-5">
                <h2 className="sec-title justify-center">
                    <span className="bar bg-amber-500"></span>
                    🏆 今週の重賞
                </h2>
                <div className="grid gap-2.5 sm:gap-3">
                    {races.map((race) => {
                        const style = gradeStyles[race.grade] || gradeStyles.G3;
                        const raceDate = formatRaceDate(race.race_date);
                        const displayName = cleanRaceName(race.race_name);

                        return (
                            <Link
                                key={race.race_id}
                                href={`/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`}
                                className={`
                                    flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border
                                    ${style.bg} ${style.border}
                                    hover:shadow-md hover:-translate-y-0.5
                                    transition-all duration-200 group
                                `}
                            >
                                {/* グレードバッジ */}
                                <div className={`
                                    shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center
                                    ${style.badge} font-bold text-[11px] sm:text-xs shadow-sm
                                `}>
                                    {race.grade}
                                </div>

                                {/* レース情報 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[11px] sm:text-xs text-secondary font-medium">
                                            {raceDate}
                                        </span>
                                        <span className="text-[10px] text-secondary/60">|</span>
                                        <span className="text-[11px] sm:text-xs text-secondary font-medium">
                                            {race.venue_name} {race.race_number}R
                                        </span>
                                    </div>
                                    <p className={`text-[14px] sm:text-[15px] font-bold ${style.text} truncate`}>
                                        {style.icon} {displayName}
                                    </p>
                                </div>

                                {/* 矢印 */}
                                <div className="shrink-0 text-secondary/40 group-hover:text-primary transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <p className="text-[10px] sm:text-[11px] text-muted text-center mt-3">
                    ※ 枠順データは金曜11:30頃に反映されます
                </p>
            </div>
        </section>
    );
}
