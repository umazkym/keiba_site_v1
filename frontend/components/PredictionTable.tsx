// frontend/components/PredictionTable.tsx
'use client';

import { RacePrediction } from '@/lib/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { sendPredictionTableViewEvent } from '../lib/analytics';
import { AccessibleInfo } from '@/components/AccessibleInfo';
import { FinishBadge, HorseNumber, MarkGlyph, PositionChip, ScoreBar } from '@/components/RaceParts';
import {
    getFinishRanks,
    getPositionLabels,
    getUnpredictableReason,
    hasRaceResults,
    normalizeMark,
    resolveWaku,
} from '@/lib/race-display';

type SortKey = 'ai' | 'number' | 'finish';

const LEGEND: Array<[string, string]> = [['◎', '本命'], ['○', '対抗'], ['▲', '単穴'], ['△', '連下'], ['☆', '星']];

export const PredictionTable = ({ race, refreshKey = '' }: { race: RacePrediction, refreshKey?: string }) => {
    const pathname = usePathname();
    const observerRef = useRef<HTMLDivElement>(null);
    const hasResults = hasRaceResults(race);
    const [sortKey, setSortKey] = useState<SortKey>('ai');

    useEffect(() => {
        const el = observerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                sendPredictionTableViewEvent({
                    pagePath: pathname || '',
                    raceId: race.id,
                    raceNumber: race.race_number,
                });
                observer.disconnect();
            }
        }, { threshold: 0.3 });

        observer.observe(el);
        return () => observer.disconnect();
    }, [pathname, race.id, race.race_number]);

    const positions = useMemo(() => getPositionLabels(race.predictions), [race.predictions]);
    const finishRanks = useMemo(() => getFinishRanks(race), [race]);
    const rows = useMemo(() => {
        // APIはAI偏差値の高い順で返す。馬番順・着順はここで並べ替える
        if (sortKey === 'number') return [...race.predictions].sort((a, b) => a.horse_number - b.horse_number);
        if (sortKey === 'finish') {
            return [...race.predictions].sort((a, b) => (finishRanks.get(a.horse_number) ?? 99) - (finishRanks.get(b.horse_number) ?? 99));
        }
        return race.predictions;
    }, [race.predictions, sortKey, finishRanks]);

    const unpredictableReason = getUnpredictableReason(race);
    const sortOptions: Array<[SortKey, string]> = [['ai', 'AI偏差値順'], ['number', '馬番順'], ...(hasResults ? [['finish', '着順'] as [SortKey, string]] : [])];

    const heading = (
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 pb-2.5 pt-3 md:px-5 md:pb-3.5 md:pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="race-prediction-heading" className="race-section-heading race-section-heading--flush race-prediction-heading !m-0">
                    AI偏差値
                </h2>
                {!unpredictableReason && (
                    <div className="flex gap-1.5" role="group" aria-label="並べ替え">
                        {sortOptions.map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSortKey(key)}
                                aria-pressed={sortKey === key}
                                className={`inline-flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-[12px] font-bold transition-colors duration-150 ${sortKey === key
                                    ? 'border-navy bg-navy text-white'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {!unpredictableReason && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="印の凡例">
                    {LEGEND.map(([mark, label]) => (
                        <span key={mark} className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-700">
                            <MarkGlyph mark={mark} size={15} />
                            {label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );

    const unpredictableNote = unpredictableReason && (
        <p className="mx-3 mt-3 rounded-lg bg-slate-100 px-3 py-2.5 text-[13px] leading-relaxed text-slate-700 md:mx-5">
            {unpredictableReason.endsWith('ため') ? `${unpredictableReason}、このレースはAI偏差値を算出していません。` : unpredictableReason}
        </p>
    );

    if (race.predictions.length === 0) {
        return (
            <div>
                {heading}
                {unpredictableNote}
            </div>
        );
    }

    return (
        <div>
            {heading}
            {unpredictableNote}
            <div ref={observerRef} className="w-full overflow-x-auto" data-refresh-key={refreshKey || undefined}>
                <table className="race-prediction-table">
                    <colgroup>
                        <col className="w-[30px] md:w-[48px]" />
                        <col className="w-[40px] md:w-[56px]" />
                        <col />
                        <col className="w-[76px] md:w-[210px]" />
                        <col className="hidden md:table-column md:w-[104px]" />
                        {hasResults && <col className="w-[36px] md:w-[64px]" />}
                    </colgroup>
                    <thead>
                        <tr>
                            <th className="text-center">印</th>
                            <th className="whitespace-nowrap text-center">馬番</th>
                            <th className="text-left">
                                馬名<span className="md:hidden"> · 位置</span>
                            </th>
                            <th className="text-right md:text-left">
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    AI偏差値
                                    <AccessibleInfo
                                        label="AI偏差値の説明を表示"
                                        buttonClassName="h-6 w-6 bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-300"
                                    >
                                        <span className="mb-1 block font-bold text-navy">AI偏差値とは？</span>
                                        過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。
                                    </AccessibleInfo>
                                </span>
                            </th>
                            <th className="hidden whitespace-nowrap text-left md:table-cell">位置取り</th>
                            {hasResults && <th className="text-center">着</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((p) => {
                            const isTopPick = normalizeMark(p.mark) === '◎';
                            const position = positions.get(p.horse_number);
                            return (
                                <tr key={`${race.id}-${p.horse_number}`} className={isTopPick ? 'is-top-pick' : undefined}>
                                    <td className="text-center">
                                        <MarkGlyph mark={p.mark} size={17} />
                                    </td>
                                    <td className="text-center">
                                        <HorseNumber number={p.horse_number} waku={resolveWaku(p, race.predictions.length)} size={28} />
                                    </td>
                                    <td className="min-w-0">
                                        <span className="flex min-w-0 flex-col gap-1">
                                            {p.detail_page_indexable ? (
                                                <Link
                                                    prefetch={false}
                                                    href={`/horses/${encodeURIComponent(p.horse_id)}`}
                                                    className="truncate text-[15px] font-bold text-slate-900 transition-colors duration-150 hover:text-brand-700 md:text-base"
                                                >
                                                    {p.horse_name}
                                                </Link>
                                            ) : (
                                                <span className="truncate text-[15px] font-bold text-slate-900 md:text-base">{p.horse_name}</span>
                                            )}
                                            <span className="md:hidden">
                                                <PositionChip label={position} className="text-[11.5px]" />
                                            </span>
                                        </span>
                                    </td>
                                    <td className="text-right md:text-left">
                                        {unpredictableReason ? (
                                            <span className="font-num text-[17px] font-semibold text-slate-400" aria-label="算出なし">—</span>
                                        ) : (
                                        <>
                                        <span className="md:hidden">
                                            <ScoreBar score={p.deviation_score} highlight={isTopPick} />
                                        </span>
                                        <span className="hidden md:inline-flex">
                                            <ScoreBar
                                                score={p.deviation_score}
                                                highlight={isTopPick}
                                                layout="row"
                                                barClassName="w-[120px] h-2"
                                                numberClassName="text-[18px] w-11 text-right"
                                            />
                                        </span>
                                        </>
                                        )}
                                    </td>
                                    <td className="hidden md:table-cell">
                                        <PositionChip label={position} className="text-[13px]" />
                                    </td>
                                    {hasResults && (
                                        <td className="text-center">
                                            <FinishBadge rank={finishRanks.get(p.horse_number)} size={26} />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
