// その日のレースの行（R番号・レース名・芝ダ距離・頭数・AI 1位）。ホームの会場の一覧と開催日ボードで同じ形を使う。
// 「AI 1位」の言葉は行ごとに繰り返さず、一覧の上に1回だけ出す（RaceListCaption。2026-09-26 画面の案D）。
import Link from 'next/link';
import type { BoardRace } from '@/lib/race-day-summary';
import { getSurfaceLabel } from '@/lib/race-display';
import { GradeBadge, HorseNumber, RaceNumberBox } from '@/components/RaceParts';

// APIの理由は「新馬戦のため、予測対象外です。」の形で届く。「新馬戦のため対象外」の短い形にそろえる
export const unpredictableText = (reason: string | null) => {
    if (!reason) return 'AI偏差値の対象外';
    const base = reason.replace(/[、,]?\s*(予測|AI偏差値の)?対象外(です)?。?$/, '').replace(/。$/, '');
    if (!base) return 'AI偏差値の対象外';
    return base.endsWith('ため') ? `${base}対象外` : base;
};

export function RaceListCaption({ className = '' }: { className?: string }) {
    return (
        <p className={`flex justify-between text-[11px] font-bold text-slate-400 ${className}`} aria-hidden="true">
            <span>レース</span>
            <span>AI 1位</span>
        </p>
    );
}

export function CompactRaceRow({ race, onClick }: { race: BoardRace; onClick?: () => void }) {
    return (
        <li className="border-b border-slate-200 last:border-b-0">
            <Link
                href={race.href}
                prefetch={false}
                onClick={onClick}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 transition-colors duration-150 hover:bg-slate-50"
            >
                <RaceNumberBox raceNumber={race.raceNumber} size={28} />
                <span className="flex min-w-0 flex-col leading-[1.35]">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-bold text-slate-900">{race.name}</span>
                        <GradeBadge grade={race.grade} />
                    </span>
                    <span className="whitespace-nowrap text-[12px] text-slate-500">
                        {getSurfaceLabel(race.courseType)}{race.distance ?? ''}{race.distance ? 'm' : ''}
                        {race.runners > 0 ? ` · ${race.runners}頭` : ''}
                    </span>
                </span>
                {race.top ? (
                    <span className="flex max-w-[168px] flex-col items-end gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold leading-snug text-slate-900">
                            <HorseNumber number={race.top.number} waku={race.top.waku} size={20} />
                            <span className="break-words">{race.top.name}</span>
                        </span>
                        <span className="font-num text-[15px] font-bold leading-none text-ai-deep">
                            <span className="sr-only">AI 1位 AI偏差値</span>
                            {race.top.score.toFixed(1)}
                        </span>
                    </span>
                ) : (
                    <span className="max-w-[120px] text-right text-[11.5px] leading-snug text-slate-500">{unpredictableText(race.unpredictableReason)}</span>
                )}
            </Link>
        </li>
    );
}
