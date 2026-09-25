'use client';

// 本日の分析注目馬。本命候補（◎で最も高いAI偏差値）・対抗以下の上位（◎以外の印で最も高い）・地方の注目。
// オッズは使っていないため、オッズを根拠にした呼び方（妙味・割安など）はしない。
import { useState, useEffect, useMemo } from 'react';
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

type TabKey = 'favored' | 'value' | 'nar';

const TAB_LABELS: Record<TabKey, string> = {
    favored: '本命候補',
    value: '対抗以下の上位',
    nar: '地方の注目',
};

const getJstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const SpecialPickCard = ({ pick: initialPick, date, predictions, precomputedPicks }: Props) => {
    const [activeTab, setActiveTab] = useState<TabKey>('favored');
    const effectiveDate = date ?? getJstToday();

    // 予測データから注目馬を動的に抽出
    const extractedPicks = useMemo(() => {
        return precomputedPicks ?? extractHomeSpecialPicks(predictions ?? null, initialPick);
    }, [precomputedPicks, predictions, initialPick]);

    // NARのピックが無い場合は、デフォルトタブをfavoredにし、narタブを選べなくする
    useEffect(() => {
        if (activeTab === 'nar' && !extractedPicks.nar) {
            setActiveTab('favored');
        }
    }, [extractedPicks.nar, activeTab]);

    const currentPick = useMemo(() => {
        if (activeTab === 'value' && extractedPicks.value) return extractedPicks.value;
        if (activeTab === 'nar' && extractedPicks.nar) return extractedPicks.nar;
        return extractedPicks.favored;
    }, [activeTab, extractedPicks]);

    if (!currentPick) {
        return null;
    }

    const tabs = (['favored', 'value', 'nar'] as TabKey[]).filter((key) => key === 'favored' || extractedPicks[key]);
    const racePath = getRaceDetailPath(effectiveDate, currentPick.venue_name, currentPick.race_number);
    const raceMeta = [
        currentPick.race_name,
        currentPick.course_type || currentPick.distance ? `${getSurfaceLabel(currentPick.course_type)}${currentPick.distance ?? ''}${currentPick.distance ? 'm' : ''}` : null,
        currentPick.runners ? `${currentPick.runners}頭` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="flex flex-col gap-3.5">
            {tabs.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="注目馬の種類">
                    {tabs.map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            aria-pressed={activeTab === key}
                            className={`inline-flex h-11 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-150 sm:h-9 ${activeTab === key
                                ? 'border-navy bg-navy text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'
                                }`}
                        >
                            {TAB_LABELS[key]}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-start gap-3 md:flex-nowrap md:items-center md:gap-[18px]">
                <RacePlate venue={currentPick.venue_name} raceNumber={currentPick.race_number} size="s" className="md:hidden" />
                <RacePlate venue={currentPick.venue_name} raceNumber={currentPick.race_number} size="m" className="hidden md:inline-flex" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[12.5px] font-bold text-slate-500">{raceMeta}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                        {currentPick.horse_number != null && (
                            <HorseNumber number={currentPick.horse_number} waku={currentPick.waku_number} size={28} />
                        )}
                        <span className="min-w-0 break-words font-display text-[22px] font-extrabold text-slate-900 md:text-[26px]">
                            {currentPick.horse_name}
                        </span>
                    </span>
                </div>
                <div className="flex w-full items-baseline justify-between gap-1 md:w-auto md:flex-col md:items-end">
                    <span className="text-[12px] font-bold text-slate-500">AI偏差値</span>
                    <span className="font-num text-[38px] font-bold leading-none text-ai-deep md:text-[46px]">
                        {currentPick.deviation_score.toFixed(1)}
                    </span>
                </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-slate-700">{currentPick.commentary}</p>

            <div>
                <Link href={racePath} prefetch={false} className="ui-btn ui-btn--secondary w-full md:w-auto">
                    {currentPick.venue_name}{currentPick.race_number}Rの出走表を確認する
                    <LineIcon name="arrowR" size={17} className="block shrink-0" />
                </Link>
            </div>
        </div>
    );
};
