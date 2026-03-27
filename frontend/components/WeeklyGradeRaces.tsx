// components/WeeklyGradeRaces.tsx
import Link from 'next/link';
import { WeeklyGradeRace } from '@/lib/types';

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

/**
 * 日付文字列 (YYYY-MM-DD) を JST として正しくフォーマットする。
 * new Date() はローカルTZで解釈するため、UTC文字列として扱って
 * 日付ズレを防ぐ。
 */
function formatRaceDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d); // ローカル日付として建てる
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${m}/${d}（${dayOfWeek}）`;
}

/** レース名からグレード接尾辞を除去 */
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
            <div className="p-3 sm:p-4">
                <h2 style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '15px', fontWeight: 700, margin: '0 0 8px',
                    color: 'var(--color-heading, #1a1a2e)',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-primary, #2563eb)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    今週の重賞レース
                </h2>

                {/* 横スクロール（モバイル） / 横並びラップ（PC） */}
                <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-2 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
                    {races.map((race) => {
                        const style = gradeStyles[race.grade] || gradeStyles.G3;
                        const raceDate = formatRaceDate(race.race_date);
                        const displayName = cleanRaceName(race.race_name);

                        return (
                            <Link
                                key={race.race_id}
                                href={`/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`}
                                className={`
                                    shrink-0 snap-start flex items-center gap-2 py-2 px-3 rounded-lg
                                    w-[220px] sm:w-auto sm:flex-1 sm:min-w-[180px]
                                    ${style.card}
                                    transition-colors duration-150 group
                                    no-underline
                                `}
                            >
                                {/* グレードバッジ */}
                                <span className={`
                                    shrink-0 inline-flex items-center justify-center
                                    w-[34px] h-[22px] rounded text-[10px] font-bold tracking-wide
                                    ${style.badge}
                                `}>
                                    {race.grade}
                                </span>

                                {/* レース情報 */}
                                <div className="flex-1 min-w-0">
                                    <span className={`text-[12px] sm:text-[13px] font-bold ${style.label} truncate block leading-tight`}>
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-secondary block leading-tight">
                                        {raceDate} {race.venue_name}{race.race_number}R
                                    </span>
                                </div>

                                {/* 矢印 */}
                                <svg className="shrink-0 w-3.5 h-3.5 text-secondary/30 group-hover:text-primary transition-colors"
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
