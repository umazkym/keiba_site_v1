// レース画面・開催日ボードで使う小さな部品。ポートフォリオ（lib.mjs の plate・gradeBadge・markGlyph・
// horseNo・scoreBar・posChip・finishBadge・surface）と同じ形にしている。
import type { CSSProperties } from 'react';
import { getWakuClasses } from '@/lib/waku';
import {
    getGradeKey,
    getGradeLabel,
    getSurfaceKey,
    getSurfaceLabel,
    normalizeMark,
    type PositionLabel,
} from '@/lib/race-display';

const PLATE_SIZES = {
    xs: { box: 34, venue: 9.5, number: 17 },
    s: { box: 44, venue: 10.5, number: 21 },
    m: { box: 60, venue: 12, number: 30 },
    l: { box: 84, venue: 14, number: 42 },
    xl: { box: 112, venue: 18, number: 58 },
} as const;

// 会場×R番号のプレート（紺地に白）。
export function RacePlate({
    venue,
    raceNumber,
    size = 'm',
    className = '',
}: {
    venue: string;
    raceNumber: number;
    size?: keyof typeof PLATE_SIZES;
    className?: string;
}) {
    const s = PLATE_SIZES[size];
    return (
        <span
            className={`inline-flex shrink-0 flex-col items-center justify-center bg-navy leading-none text-white ${className}`}
            style={{ width: s.box, height: s.box, borderRadius: Math.round(s.box * 0.2) }}
            aria-label={`${venue}${raceNumber}R`}
        >
            <span className="font-bold tracking-[0.06em] opacity-[0.86]" style={{ fontSize: s.venue }} aria-hidden="true">
                {venue}
            </span>
            <span className="font-num font-bold tracking-[-0.01em]" style={{ fontSize: s.number, marginTop: Math.round(s.box * 0.05) }} aria-hidden="true">
                {raceNumber}
                <span style={{ fontSize: Math.round(s.number * 0.5), marginLeft: 1 }}>R</span>
            </span>
        </span>
    );
}

// R番号の四角（開催日ボードの行・次のレース）。
export function RaceNumberBox({
    raceNumber,
    size = 36,
    state = 'normal',
}: {
    raceNumber: number;
    size?: number;
    state?: 'normal' | 'done' | 'next';
}) {
    const tone = state === 'next'
        ? 'bg-brand-600 text-white'
        : state === 'done'
            ? 'bg-slate-100 text-slate-500'
            : 'bg-navy text-white';
    return (
        <span
            className={`inline-flex shrink-0 items-baseline justify-center font-num font-bold leading-none ${tone}`}
            style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), paddingTop: Math.round(size * 0.22), fontSize: Math.round(size * 0.5) }}
            aria-hidden="true"
        >
            {raceNumber}
            <span style={{ fontSize: Math.round(size * 0.28), marginLeft: 1 }}>R</span>
        </span>
    );
}

const GRADE_SIZE_CLASS = {
    s: 'text-[11px] px-1.5 py-0.5',
    m: 'text-[12.5px] px-[7px] py-[3px]',
    l: 'text-[15px] px-[9px] py-1',
} as const;

export function GradeBadge({ grade, size = 's' }: { grade: string | null | undefined; size?: keyof typeof GRADE_SIZE_CLASS }) {
    const key = getGradeKey(grade);
    const label = getGradeLabel(grade);
    if (!key || !label) return null;
    return <span className={`grade-badge grade-badge--${key} ${GRADE_SIZE_CLASS[size]}`}>{label}</span>;
}

const MARK_CLASS: Record<string, string> = {
    '◎': 'text-ai-deep font-extrabold',
    '○': 'text-brand-700 font-extrabold',
    '▲': 'text-navy font-bold',
    '△': 'text-slate-500 font-bold',
    '☆': 'text-slate-500 font-bold',
};

export function MarkGlyph({ mark, size = 17 }: { mark: string | null | undefined; size?: number }) {
    const value = normalizeMark(mark);
    const style: CSSProperties = { width: size, fontSize: value ? size : size - 3 };
    if (!value) {
        return <span className="inline-block text-center leading-none text-slate-300" style={style} aria-label="印なし">－</span>;
    }
    return <span className={`inline-block text-center leading-none ${MARK_CLASS[value] ?? 'font-bold text-slate-500'}`} style={style}>{value}</span>;
}

export function HorseNumber({ number, waku, size = 28 }: { number: number; waku: number | null | undefined; size?: number }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] font-num font-bold leading-none ${getWakuClasses(waku)}`}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
        >
            {number}
        </span>
    );
}

// AI偏差値：数字＋横棒（30〜80を棒の長さにする）。◎は琥珀、ほかはインディゴ。
export function ScoreBar({
    score,
    highlight = false,
    barClassName = 'w-16 h-[5px]',
    numberClassName = 'text-[18px]',
    layout = 'column',
}: {
    score: number | null | undefined;
    highlight?: boolean;
    barClassName?: string;
    numberClassName?: string;
    layout?: 'column' | 'row';
}) {
    if (score == null) {
        return (
            <span className={`inline-flex ${layout === 'column' ? 'flex-col items-end gap-0.5' : 'items-center gap-2'}`}>
                <span className={`font-num font-semibold leading-none text-slate-400 ${numberClassName}`}>--</span>
                <span className="text-[11px] leading-none text-slate-500">データ不足</span>
            </span>
        );
    }
    const ratio = Math.max(0.04, Math.min(1, (score - 30) / 50));
    const numberColor = highlight ? 'text-ai-deep' : score < 50 ? 'text-slate-500' : 'text-slate-900';
    return (
        <span className={`inline-flex ${layout === 'column' ? 'flex-col items-end gap-1' : 'items-center gap-2.5'}`}>
            <span className={`font-num font-bold leading-none tabular-nums ${numberColor} ${numberClassName}`}>{score.toFixed(1)}</span>
            <span className={`block overflow-hidden rounded-full bg-slate-100 ${barClassName}`} aria-hidden="true">
                <span className={`block h-full rounded-full ${highlight ? 'bg-ai' : 'bg-brand-600'}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </span>
        </span>
    );
}

const POSITION_INDEX: Record<PositionLabel, number> = { 後方: 0, 中団: 1, 先行: 2 };

export function PositionChip({ label, className = 'text-[12px]' }: { label: PositionLabel | null | undefined; className?: string }) {
    if (!label) return <span className={`text-slate-400 ${className}`}>—</span>;
    const index = POSITION_INDEX[label];
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-slate-700 ${className}`}>
            <span className="inline-flex gap-0.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-navy' : 'bg-slate-300'}`} />
                ))}
            </span>
            {label}
        </span>
    );
}

export function FinishBadge({ rank, size = 26 }: { rank: number | null | undefined; size?: number }) {
    if (rank == null) return <span className="text-[12px] text-slate-400">—</span>;
    const tone = rank === 1
        ? 'bg-navy text-white border-navy'
        : rank <= 3
            ? 'bg-white text-navy border-navy'
            : 'bg-transparent text-slate-500 border-transparent';
    return (
        <span
            className={`inline-flex items-center justify-center rounded-full border-[1.5px] font-num font-bold leading-none ${tone}`}
            style={{ minWidth: size, height: size, fontSize: Math.round(size * 0.55) }}
            aria-label={`${rank}着`}
        >
            {rank}
        </span>
    );
}

const SURFACE_DOT: Record<string, string> = { turf: 'bg-turf', dirt: 'bg-dirt', jump: 'bg-jump' };

export function SurfaceLabel({
    courseType,
    distance,
    className = 'text-[13px]',
}: {
    courseType: string | null | undefined;
    distance: number | null | undefined;
    className?: string;
}) {
    const key = getSurfaceKey(courseType);
    if (!key && !distance) return null;
    return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-slate-700 ${className}`}>
            {key && <span className={`h-2 w-2 rounded-full ${SURFACE_DOT[key]}`} aria-hidden="true" />}
            <span>
                {getSurfaceLabel(courseType)}
                {distance ? <><span className="ml-px font-num font-semibold">{distance}</span><span className="text-[0.85em]">m</span></> : null}
            </span>
        </span>
    );
}
