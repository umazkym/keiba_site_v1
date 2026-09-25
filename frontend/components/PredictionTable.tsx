// frontend/components/PredictionTable.tsx
'use client';

import { RacePrediction } from '@/lib/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { sendPredictionTableViewEvent } from '../lib/analytics';
import { AccessibleInfo } from '@/components/AccessibleInfo';
import { SegmentedControl } from '@/components/SegmentedControl';
import { HorseNumber, MarkGlyph, PositionChip, ScoreBar } from '@/components/RaceParts';
import {
    getPositionLabels,
    getUnpredictableReason,
    normalizeMark,
    resolveWaku,
} from '@/lib/race-display';

type SortKey = 'ai' | 'number';

// 当該レースの着順は表示せず、AI偏差値順と馬番順だけを切り替える。
export const PredictionTable = ({
    race,
    refreshKey = '',
}: {
    race: RacePrediction,
    refreshKey?: string,
}) => {
    const pathname = usePathname();
    const observerRef = useRef<HTMLDivElement>(null);
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
    const rows = useMemo(() => {
        // APIはAI偏差値の高い順で返す。結果の有無で表示を変えない。
        if (sortKey === 'number') return [...race.predictions].sort((a, b) => a.horse_number - b.horse_number);
        return race.predictions;
    }, [race.predictions, sortKey]);

    const unpredictableReason = getUnpredictableReason(race);
    const sortOptions: Array<[SortKey, string]> = [['ai', 'AI偏差値順'], ['number', '馬番順']];
    // 印の凡例は出さない（2026-09-26 利用者の指定）。印の意味は読み上げ用の名前（MarkGlyph）に残る

    const heading = (
        <div className="flex flex-col gap-1.5 border-b border-slate-200 px-3 pb-2 pt-2.5 md:gap-2 md:px-5 md:pb-3.5 md:pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                    <h2 id="race-prediction-heading" className="race-section-heading race-section-heading--flush race-prediction-heading !m-0">
                        AI偏差値
                    </h2>
                    {/* スマホは表の列見出しの行を出さず、説明の「?」を見出しの横に置く（2026-09-26 画面の案D） */}
                    {!unpredictableReason && (
                        <span className="md:hidden">
                            <AccessibleInfo
                                label="AI偏差値の説明を表示"
                                buttonClassName="h-6 w-6 bg-slate-200 text-[12px] font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-300"
                            >
                                <span className="mb-1 block font-bold text-navy">AI偏差値とは？</span>
                                過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。
                            </AccessibleInfo>
                        </span>
                    )}
                </span>
                {!unpredictableReason && (
                    <SegmentedControl
                        ariaLabel="並べ替え"
                        value={sortKey}
                        onChange={setSortKey}
                        options={sortOptions.map(([key, label]) => ({ value: key, label }))}
                    />
                )}
            </div>

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
                    </colgroup>
                    {/* スマホは列見出しの行を画面に出さない（読み上げには残す）。印・馬番・偏差値は見た目で分かり、凡例は上にある */}
                    <thead className="race-prediction-thead">
                        <tr>
                            <th className="text-center">印</th>
                            <th className="whitespace-nowrap text-center">馬番</th>
                            <th className="text-left">
                                馬名<span className="md:hidden"> · 位置</span>
                            </th>
                            <th className="!py-0 text-right md:text-left">
                                    <span className="md:hidden">AI偏差値</span>
                                    <span className="hidden md:inline">
                                    <AccessibleInfo
                                        label="AI偏差値の説明を表示"
                                        buttonClassName="h-8 gap-1 whitespace-nowrap text-[11px] font-bold text-slate-500 md:h-10 md:text-xs"
                                        trigger={(
                                            <>
                                                AI偏差値
                                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 text-slate-700" aria-hidden="true">?</span>
                                            </>
                                        )}
                                    >
                                        <span className="mb-1 block font-bold text-navy">AI偏差値とは？</span>
                                        過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。
                                    </AccessibleInfo>
                                    </span>
                            </th>
                            <th className="hidden whitespace-nowrap text-left md:table-cell">位置取り</th>
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
                                        <span className="flex min-w-0 flex-col gap-0.5 leading-[1.3] md:gap-1 md:leading-normal">
                                            {p.detail_page_indexable ? (
                                                <Link
                                                    prefetch={false}
                                                    href={`/horses/${encodeURIComponent(p.horse_id)}`}
                                                    className="break-words text-[15px] font-bold text-slate-900 transition-colors duration-150 hover:text-brand-700 md:text-base"
                                                >
                                                    {p.horse_name}
                                                </Link>
                                            ) : (
                                                <span className="break-words text-[15px] font-bold text-slate-900 md:text-base">{p.horse_name}</span>
                                            )}
                                            <span className="flex md:hidden">
                                                <PositionChip label={position} className="text-[11.5px] leading-[1.3]" />
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
