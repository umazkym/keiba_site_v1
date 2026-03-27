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

                {/* モバイルでスクロールせず横全体に収まるレイアウト。等分グリッドで配置 */}
                <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${races.length}, minmax(0, 1fr))` }}>
                    {races.map((race) => {
                        const style = gradeStyles[race.grade] || gradeStyles.G3;
                        const raceDate = formatRaceDate(race.race_date);
                        const displayName = cleanRaceName(race.race_name);

                        return (
                            <Link
                                key={race.race_id}
                                href={`/races/${race.race_date}?race=${race.race_number}&venue=${encodeURIComponent(race.venue_name)}`}
                                className={`
                                    flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg text-center
                                    ${style.card}
                                    transition-colors duration-150 group shrink-0
                                    no-underline shadow-sm hover:shadow active:scale-95
                                `}
                                style={{ borderLeftWidth: 0, borderBottomWidth: '3px' }}
                            >
                                {/* グレードバッジ */}
                                <span className={`
                                    inline-flex items-center justify-center
                                    w-[34px] h-[22px] rounded text-[10px] font-bold tracking-wide
                                    ${style.badge}
                                `}>
                                    {race.grade}
                                </span>

                                {/* レース情報（縦配置で超省スペース化） */}
                                <span className={`text-[11px] sm:text-[13px] font-bold ${style.label} mt-1.5 line-clamp-1 w-full leading-tight`}>
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
