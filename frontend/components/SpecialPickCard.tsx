'use client';

// 本日の分析注目馬。本命候補（◎で最も高いAI偏差値）だけを出す（2026-09-26 まで対抗以下の上位・地方の注目の切り替えがあった）。
// オッズは使っていないため、オッズを根拠にした呼び方（妙味・割安など）はしない。
import { useMemo } from 'react';
import Link from 'next/link';
import { SpecialPick, RaceDayPrediction } from "@/lib/types";
import { getRaceDetailPath } from '@/lib/race-url';
import {
    extractHomeSpecialPicks,
    type HomeSpecialPickSet,
} from '@/lib/home-page-summary';
import { getSurfaceLabel } from '@/lib/race-display';
import { HorseNumber, RacePlate } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

type Props = {
    pick?: SpecialPick | null;
    date?: string;
    predictions?: RaceDayPrediction | null;
    precomputedPicks?: HomeSpecialPickSet;
};

const getJstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// 本命候補だけを出す（2026-09-26 利用者の指定「本命候補のみでOK。タブは無くして」。対抗以下の上位・地方の注目の切り替えは外した）
export const SpecialPickCard = ({ pick: initialPick, date, predictions, precomputedPicks }: Props) => {
    const effectiveDate = date ?? getJstToday();

    // 予測データから注目馬を動的に抽出
    const extractedPicks = useMemo(() => {
        return precomputedPicks ?? extractHomeSpecialPicks(predictions ?? null, initialPick);
    }, [precomputedPicks, predictions, initialPick]);
    const currentPick = extractedPicks.favored;

    if (!currentPick) {
        return null;
    }

    const racePath = getRaceDetailPath(effectiveDate, currentPick.venue_name, currentPick.race_number);
    const raceMeta = [
        currentPick.race_name,
        currentPick.course_type || currentPick.distance ? `${getSurfaceLabel(currentPick.course_type)}${currentPick.distance ?? ''}${currentPick.distance ? 'm' : ''}` : null,
        currentPick.runners ? `${currentPick.runners}頭` : null,
    ].filter(Boolean).join(' · ');

    // スマホ：押すと出走表へ移る1行（R・条件／馬名・偏差値。枠線なし）。定型の説明文とボタンはPCだけ（2026-09-26 縦の高さの見直し）
    return (
        <div className="flex flex-col gap-2 md:gap-3.5">
            {/* スマホ：1行（枠線なし） */}
            <Link
                href={racePath}
                prefetch={false}
                aria-label={`${currentPick.venue_name}${currentPick.race_number}R ${currentPick.horse_name} AI偏差値${currentPick.deviation_score.toFixed(1)}。出走表を確認する`}
                className="flex items-center gap-2.5 rounded-lg transition-colors duration-150 hover:bg-slate-50 md:hidden"
            >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[12.5px] font-bold text-slate-500">
                        {currentPick.venue_name}{currentPick.race_number}R · {raceMeta}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                        {currentPick.horse_number != null && (
                            <HorseNumber number={currentPick.horse_number} waku={currentPick.waku_number} size={24} />
                        )}
                        <span className="min-w-0 break-words text-[20px] font-bold leading-tight text-slate-900">{currentPick.horse_name}</span>
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[10.5px] font-bold text-slate-500">AI偏差値</span>
                    <span className="font-num text-[30px] font-bold leading-none text-ai-deep">{currentPick.deviation_score.toFixed(1)}</span>
                </span>
                <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-400" />
            </Link>

            {/* PC */}
            <div className="hidden items-center gap-[18px] md:flex">
                <RacePlate venue={currentPick.venue_name} raceNumber={currentPick.race_number} size="m" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[12.5px] font-bold text-slate-500">{raceMeta}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                        {currentPick.horse_number != null && (
                            <HorseNumber number={currentPick.horse_number} waku={currentPick.waku_number} size={28} />
                        )}
                        <span className="min-w-0 break-words font-display text-[26px] font-bold text-slate-900">{currentPick.horse_name}</span>
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[12px] font-bold text-slate-500">AI偏差値</span>
                    <span className="font-num text-[46px] font-bold leading-none text-ai-deep">
                        {currentPick.deviation_score.toFixed(1)}
                    </span>
                </div>
            </div>

            <p className="hidden text-[13.5px] leading-relaxed text-slate-700 md:block">{currentPick.commentary}</p>

            <div className="hidden md:block">
                <Link href={racePath} prefetch={false} className="ui-btn ui-btn--secondary">
                    {currentPick.venue_name}{currentPick.race_number}Rの出走表を確認する
                    <LineIcon name="arrowR" size={17} className="block shrink-0" />
                </Link>
            </div>
        </div>
    );
};
