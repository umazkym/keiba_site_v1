import { getWakuClasses } from '@/lib/waku';

export function RaceNumberBadge({
    horseNumber,
    frameNumber,
    label,
}: {
    horseNumber: number | null;
    frameNumber: number | null;
    label?: string;
}) {
    if (horseNumber == null) return <span className="text-slate-500">—</span>;
    const colorClass = frameNumber == null
        ? 'border-slate-300 bg-white text-slate-950'
        : getWakuClasses(frameNumber);

    return (
        <span
            aria-label={label ?? `${frameNumber == null ? '' : `${frameNumber}枠 `}${horseNumber}番`}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1 font-mono text-xs font-black tabular-nums ${colorClass}`}
        >
            {horseNumber}
        </span>
    );
}

export function FrameNumberBadge({ frameNumber }: { frameNumber: number }) {
    const colorClass = getWakuClasses(frameNumber);
    return (
        <span
            aria-label={`${frameNumber}枠`}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1 font-mono text-xs font-black tabular-nums ${colorClass}`}
        >
            {frameNumber}
        </span>
    );
}
