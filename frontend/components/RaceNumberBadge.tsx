const FRAME_COLOR_CLASSES: Record<number, string> = {
    1: 'border-slate-400 bg-white text-slate-950',
    2: 'border-slate-950 bg-slate-950 text-white',
    3: 'border-red-600 bg-red-600 text-white',
    4: 'border-blue-600 bg-blue-600 text-white',
    5: 'border-yellow-400 bg-yellow-300 text-slate-950',
    6: 'border-emerald-600 bg-emerald-600 text-white',
    7: 'border-orange-500 bg-orange-500 text-slate-950',
    8: 'border-pink-500 bg-pink-500 text-slate-950',
};

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
        : FRAME_COLOR_CLASSES[frameNumber] ?? 'border-slate-300 bg-white text-slate-950';

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
    const colorClass = FRAME_COLOR_CLASSES[frameNumber] ?? 'border-slate-300 bg-white text-slate-950';
    return (
        <span
            aria-label={`${frameNumber}枠`}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1 font-mono text-xs font-black tabular-nums ${colorClass}`}
        >
            {frameNumber}
        </span>
    );
}
