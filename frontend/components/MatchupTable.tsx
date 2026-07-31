'use client';

import { RacePrediction, MatchupRecord, HorsePrediction, MatchupData } from '@/lib/types';
import React, { startTransition, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getFilteredMatchups } from '@/lib/api';
import { getWakuNumber } from '@/lib/utils';
import { AccessibleInfo } from '@/components/AccessibleInfo';

const getWakuColorClasses = (waku: number | null): string => {
    switch (waku) {
        case 1: return 'bg-white text-black border-gray-500';
        case 2: return 'bg-black text-white border-gray-700';
        case 3: return 'bg-red-500 text-white border-red-700';
        case 4: return 'bg-blue-600 text-white border-blue-800';
        case 5: return 'bg-yellow-400 text-black border-yellow-600';
        case 6: return 'bg-green-500 text-white border-green-700';
        case 7: return 'bg-orange-500 text-white border-orange-700';
        case 8: return 'bg-pink-500 text-white border-pink-700';
        default: return 'bg-gray-200 text-black border-gray-400';
    }
};

const HorseNumberCircle = ({ number, waku, compact = false }: { number: number, waku: number | null, compact?: boolean }) => (
    <div className={`${compact ? 'h-5 w-5 text-[10px] border' : 'h-7 w-7 text-sm border-2'} rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 ${getWakuColorClasses(waku)}`}>
        {number}
    </div>
);

const getShortHorseName = (horseName: string): string => {
    const trimmedName = horseName.trim();
    if (!trimmedName) return '-';
    return Array.from(trimmedName).slice(0, 3).join('');
};

const formatCompactDate = (date: string): string => {
    const [, month, day] = date.split('-');
    if (!month || !day) return date;
    return `${Number(month)}/${Number(day)}`;
};

const matchupCache = new Map<string, MatchupData>();

const getDefaultDateRange = (raceDateString: string) => {
    const raceDate = new Date(`${raceDateString}T00:00:00Z`);
    const dayBeforeRace = new Date(raceDate);
    dayBeforeRace.setUTCDate(raceDate.getUTCDate() - 1);
    const yearStart = new Date(Date.UTC(raceDate.getUTCFullYear(), 0, 1));
    return {
        startDate: yearStart.toISOString().split('T')[0],
        endDate: dayBeforeRace.toISOString().split('T')[0],
    };
};

const MatchupMatrixSkeleton = ({ runnerCount }: { runnerCount: number }) => {
    const rows = Math.max(1, runnerCount);
    const compact = runnerCount >= 16;
    return (
        <div className="overflow-hidden bg-white" aria-hidden="true">
            <div className={`${compact ? 'h-[42px]' : 'h-[50px]'} border-b border-slate-200 bg-slate-50`} />
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className={`${compact ? 'h-[21px]' : 'h-[28px]'} border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                >
                    <div className="h-full w-[18%] border-r border-slate-100 bg-slate-100/70" />
                </div>
            ))}
        </div>
    );
};

const MobileHorseBadge = ({ horse, totalHorses }: { horse: HorsePrediction, totalHorses: number }) => {
    const resolvedWaku = (horse.waku_number && horse.waku_number >= 1 && horse.waku_number <= 8)
        ? horse.waku_number
        : getWakuNumber(horse.horse_number, totalHorses);
    return (
        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold leading-none ${getWakuColorClasses(resolvedWaku)}`}>
            {horse.horse_number}
        </span>
    );
};

type MatchupSelection = {
    rowHorse: HorsePrediction;
    colHorse: HorsePrediction;
    record: MatchupRecord;
};

const MatchupDetails = ({ rowHorse, colHorse, record }: MatchupSelection) => (
    <div className="max-w-xl text-left text-slate-700">
        <h4 className="font-bold border-b border-gray-200 pb-1 mb-2">{rowHorse.horse_name} vs {colHorse.horse_name}</h4>
        <div className="font-semibold mb-2 text-center text-lg">
            <span className="text-green-500">{record.win}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-red-500">{record.loss}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-gray-500">{record.draw}</span>
        </div>
        {record.history.length > 0 && (
            <ul className="space-y-2 text-xs max-h-40 overflow-y-auto pr-2">
                {record.history.slice().reverse().map((h, index) => {
                    const rowRank = rowHorse.horse_id === h.p1_horse_id ? h.p1_rank : h.p2_rank;
                    const colRank = colHorse.horse_id === h.p1_horse_id ? h.p1_rank : h.p2_rank;
                    const isWin = rowRank < colRank;
                    return (
                        <li key={index} className="border-t border-gray-200 pt-1">
                            <div className="font-semibold">{new Date(h.race_date).toLocaleDateString()} {h.venue_name}</div>
                            <div>
                                {rowRank}着 vs {colRank}着
                                <span className={`ml-2 font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                                    {isWin ? '勝利' : '敗北'}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        )}
    </div>
);

const TableView = ({ predictions, matchupData, onSelect }: { predictions: HorsePrediction[]; matchupData: MatchupData; onSelect: (selection: MatchupSelection) => void }) => {
    const { matchup_data } = matchupData;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    const isCompact = sortedHorses.length >= 16;
    const firstColPercent = isCompact ? 24 : 20;
    const horseColPercent = (100 - firstColPercent) / Math.max(sortedHorses.length, 1);

    return (
        <div className="table-wrapper">
            <table className="matchup-table w-full table-fixed text-center">
                <colgroup>
                    <col style={{ width: `${firstColPercent}%` }} />
                    {sortedHorses.map((horse) => (
                        <col key={horse.horse_id} style={{ width: `${horseColPercent}%` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-1 py-2 text-left text-[11px] font-bold text-slate-500">馬名</th>
                        {sortedHorses.map(horse => {
                            const resolvedWaku = (horse.waku_number && horse.waku_number >= 1 && horse.waku_number <= 8)
                                ? horse.waku_number
                                : getWakuNumber(horse.horse_number, sortedHorses.length);
                            return (
                                <th key={horse.horse_id} className="px-0.5 py-1" title={horse.horse_name}>
                                    <div className='flex items-center justify-center'>
                                        <HorseNumberCircle number={horse.horse_number} waku={resolvedWaku} compact={isCompact} />
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedHorses.map((rowHorse, rowIndex) => {
                        const resolvedWaku = (rowHorse.waku_number && rowHorse.waku_number >= 1 && rowHorse.waku_number <= 8)
                            ? rowHorse.waku_number
                            : getWakuNumber(rowHorse.horse_number, sortedHorses.length);
                        return (
                            <tr key={rowHorse.horse_id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                <th className="border-b border-slate-100 px-1 py-1 text-left sticky-col">
                                    <div className='flex min-w-0 items-center gap-1.5'>
                                        <HorseNumberCircle number={rowHorse.horse_number} waku={resolvedWaku} compact={isCompact} />
                                        <span className='truncate text-[11px] font-semibold text-slate-700' title={rowHorse.horse_name}>{rowHorse.horse_name}</span>
                                    </div>
                                </th>
                                {sortedHorses.map((colHorse) => {
                                    if (colHorse.horse_id === rowHorse.horse_id) return <td key={colHorse.horse_id} className="border-b border-slate-100 bg-slate-100"></td>;
                                    const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                    let content = <div className="flex h-7 items-center justify-center"><span className="text-[11px] text-slate-300">-</span></div>;
                                    let cellClass = 'bg-white';
                                    let textColorClass = 'text-slate-500';

                                    if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                                        const netWins = record.win - record.loss;
                                        if (netWins > 0) {
                                            cellClass = 'bg-emerald-50';
                                            textColorClass = 'text-green-700';
                                        } else if (netWins < 0) {
                                            cellClass = 'bg-rose-50';
                                            textColorClass = 'text-red-700';
                                        } else {
                                            cellClass = 'bg-slate-100';
                                            textColorClass = 'text-slate-700';
                                        }
                                        content = (
                                            <div className="flex h-7 flex-col items-center justify-center leading-none">
                                                <span className={`font-bold ${isCompact ? 'text-[11px]' : 'text-xs'} ${textColorClass}`}>{netWins > 0 ? `+${netWins}` : netWins}</span>
                                                {!isCompact && (
                                                    <span className="mt-0.5 w-full truncate text-center text-[9px] tracking-tighter text-slate-500">{record.win}-{record.loss}-{record.draw}</span>
                                                )}
                                            </div>
                                        );
                                    }
                                    return (
                                        <td key={colHorse.horse_id} className={`border-b border-slate-100 p-0 ${cellClass}`}>
                                            {record ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onSelect({ rowHorse, colHorse, record })}
                                                    className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                                                    aria-label={`${rowHorse.horse_name}から見た${colHorse.horse_name}との対戦詳細を表示`}
                                                >
                                                    {content}
                                                </button>
                                            ) : content}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const MobileMatrixView = ({ predictions, matchupData, onSelect }: { predictions: HorsePrediction[]; matchupData: MatchupData; onSelect: (selection: MatchupSelection) => void }) => {
    const { matchup_data } = matchupData;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    const isFullGate = sortedHorses.length >= 16;
    const firstColPercent = isFullGate ? 12 : 18;
    const horseColPercent = (100 - firstColPercent) / Math.max(sortedHorses.length, 1);
    const rowHeightClass = isFullGate ? 'h-[21px]' : 'h-[24px]';
    const resultTextClass = isFullGate ? 'text-[8px]' : 'text-[9px]';
    const headerNameHeightClass = isFullGate ? 'h-[34px]' : 'h-[38px]';

    return (
        <div className="table-wrapper">
            <table className={`matchup-table w-full table-fixed text-center ${isFullGate ? 'matchup-table-compact' : ''}`}>
                <colgroup>
                    <col style={{ width: `${firstColPercent}%` }} />
                    {sortedHorses.map((horse) => (
                        <col key={horse.horse_id} style={{ width: `${horseColPercent}%` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className={`px-0.5 py-1.5 text-left text-[9px] font-bold text-slate-500 ${isFullGate ? 'align-middle' : 'align-bottom'}`}>馬名</th>
                        {sortedHorses.map((horse) => (
                            <th key={horse.horse_id} className={`border-l border-slate-100 px-0 py-1.5 ${isFullGate ? 'align-middle' : 'align-bottom'}`} title={horse.horse_name}>
                                <div className={`flex flex-col items-center gap-0.5 ${isFullGate ? 'justify-center' : 'justify-end'}`}>
                                    <MobileHorseBadge horse={horse} totalHorses={sortedHorses.length} />
                                    {!isFullGate && (
                                        <span
                                            className={`${headerNameHeightClass} text-[8px] font-semibold leading-none text-slate-600`}
                                            style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                                        >
                                            {getShortHorseName(horse.horse_name)}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedHorses.map((rowHorse, rowIndex) => (
                        <tr key={rowHorse.horse_id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                            <th className={`border-b border-slate-100 px-0.5 text-left mobile-sticky-col ${rowHeightClass}`}>
                                <div className="flex min-w-0 items-center gap-0.5">
                                    <MobileHorseBadge horse={rowHorse} totalHorses={sortedHorses.length} />
                                    <span className="min-w-0 truncate text-[9px] font-semibold leading-none text-slate-700" title={rowHorse.horse_name}>
                                        {getShortHorseName(rowHorse.horse_name)}
                                    </span>
                                </div>
                            </th>
                            {sortedHorses.map((colHorse) => {
                                if (colHorse.horse_id === rowHorse.horse_id) {
                                    return (
                                        <td key={colHorse.horse_id} className="border-b border-l border-slate-100 bg-slate-100 p-0">
                                            <div className={`${rowHeightClass} flex items-center justify-center`}>
                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                            </div>
                                        </td>
                                    );
                                }

                                const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                let cellClass = 'bg-white';
                                let textColorClass = 'text-slate-400';
                                let displayValue = '-';

                                if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                                    const netWins = record.win - record.loss;
                                    displayValue = netWins > 0 ? `+${netWins}` : `${netWins}`;
                                    if (netWins > 0) {
                                        cellClass = 'bg-emerald-50';
                                        textColorClass = 'text-green-700';
                                    } else if (netWins < 0) {
                                        cellClass = 'bg-rose-50';
                                        textColorClass = 'text-red-700';
                                    } else {
                                        cellClass = 'bg-slate-100';
                                        textColorClass = 'text-slate-700';
                                    }
                                }

                                const cellContent = (
                                    <div className={`${rowHeightClass} flex items-center justify-center leading-none`}>
                                        <span className={`${resultTextClass} font-bold ${textColorClass}`}>{displayValue}</span>
                                    </div>
                                );

                                return (
                                    <td key={colHorse.horse_id} className={`border-b border-l border-slate-100 p-0 ${cellClass}`}>
                                        {record ? (
                                            <button
                                                type="button"
                                                onClick={() => onSelect({ rowHorse, colHorse, record })}
                                                className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                                                aria-label={`${rowHorse.horse_name}から見た${colHorse.horse_name}との対戦詳細を表示`}
                                            >
                                                {cellContent}
                                            </button>
                                        ) : cellContent}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const MatchupTable = ({ race }: { race: RacePrediction }) => {
    const defaultDateRange = useMemo(
        () => getDefaultDateRange(race.race_date),
        [race.race_date],
    );
    const [dateRange, setDateRange] = useState(() => ({
        raceId: race.id,
        ...defaultDateRange,
    }));
    const { startDate, endDate } = dateRange;

    const [matchupData, setMatchupData] = useState<MatchupData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMatchup, setSelectedMatchup] = useState<MatchupSelection | null>(null);

    // レース切り替え時は集計期間をレース日に合わせ直します。
    useEffect(() => {
        setDateRange({ raceId: race.id, ...defaultDateRange });
    }, [defaultDateRange, race.id]);

    useEffect(() => {
        if (dateRange.raceId !== race.id) return undefined;

        const controller = new AbortController();
        const cacheKey = `${race.id}:${startDate}:${endDate}`;
        const cached = matchupCache.get(cacheKey);
        if (cached) {
            setMatchupData(cached);
            setIsLoading(false);
            setError(null);
            return () => controller.abort();
        }

        const fetchFilteredData = async () => {
            setIsLoading(true);
            setError(null);
            setMatchupData(null);
            try {
                const data = await getFilteredMatchups(race.id, startDate, endDate, controller.signal);
                if (!data) throw new Error('matchup_data_unavailable');
                matchupCache.set(cacheKey, data);
                startTransition(() => setMatchupData(data));
            } catch (e) {
                if (controller.signal.aborted) return;
                setError('データの取得に失敗しました。');
                console.error(e);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };
        fetchFilteredData();

        return () => controller.abort();
    }, [dateRange.raceId, endDate, race.id, startDate]);

    useEffect(() => {
        setSelectedMatchup(null);
    }, [race.id, startDate, endDate]);

    const isDateRangeCurrent = dateRange.raceId === race.id;
    const showLoadingState = isLoading || !isDateRangeCurrent;
    const isDataEmpty = !matchupData || Object.keys(matchupData.matchup_data).length === 0;
    const runnerCount = race.predictions.length;
    const mobileMinHeight = 50 + Math.max(1, runnerCount) * (runnerCount >= 16 ? 21 : 28);
    const desktopMinHeight = 50 + Math.max(1, runnerCount) * 36;
    const stableRegionStyle = {
        '--matchup-mobile-min-height': `${mobileMinHeight}px`,
        '--matchup-desktop-min-height': `${desktopMinHeight}px`,
    } as CSSProperties;

    return (
        <div className="race-panel overflow-hidden">
            <div className="flex flex-col gap-1.5 border-b border-slate-200 p-2 md:flex-row md:items-center md:justify-between md:p-3">
                <div className='flex items-center gap-2'>
                    <h3 id="race-matchup-heading" className="race-section-heading mb-0 whitespace-nowrap">過去対決成績</h3>
                    <AccessibleInfo
                        label="過去対決成績の説明を表示"
                        buttonClassName="h-6 w-6 bg-slate-200 text-xs font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-300"
                    >
                        <span className="mb-1 block font-bold text-slate-900">過去対決成績とは？</span>
                        <span className="block">出走馬同士が過去に同じレースで直接対決した際の成績です。</span>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                            <li><strong>数値：</strong>左の馬から見た勝ち越し数（勝ち数 - 負け数）。</li>
                            <li><strong>内訳：</strong>勝-負-分の順です。</li>
                            <li><strong>集計期間：</strong>日付欄から変更できます。</li>
                        </ul>
                    </AccessibleInfo>
                </div>
                <details className="w-full rounded-lg border border-slate-200 bg-slate-50 md:hidden">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-[11px] font-semibold text-slate-600">
                        <span>集計期間 {formatCompactDate(startDate)}–{formatCompactDate(endDate)}</span>
                        <span aria-hidden="true" className="text-slate-400">⌄</span>
                    </summary>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-slate-200 bg-white p-2">
                        <input aria-label="集計開始日" type="date" value={startDate} onChange={e => setDateRange(current => ({ ...current, startDate: e.target.value }))} className="min-w-0 rounded border border-slate-300 p-2 text-[11px]" />
                        <span className="shrink-0 text-slate-400">–</span>
                        <input aria-label="集計終了日" type="date" value={endDate} onChange={e => setDateRange(current => ({ ...current, endDate: e.target.value }))} className="min-w-0 rounded border border-slate-300 p-2 text-[11px]" />
                    </div>
                </details>
                <div className="hidden w-full flex-col gap-1 text-[11px] md:flex md:w-auto md:flex-row md:items-center md:gap-2 md:text-sm">
                    <label htmlFor="start-date" className="shrink-0 font-semibold text-slate-500 md:font-medium">期間</label>
                    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1 md:flex md:w-auto">
                        <input id="start-date" type="date" value={startDate} onChange={e => setDateRange(current => ({ ...current, startDate: e.target.value }))} className="min-w-0 rounded border border-slate-300 p-1 text-[11px] md:w-auto md:text-sm" />
                        <span className="shrink-0 text-slate-400">-</span>
                        <input aria-label="集計終了日" type="date" value={endDate} onChange={e => setDateRange(current => ({ ...current, endDate: e.target.value }))} className="min-w-0 rounded border border-slate-300 p-1 text-[11px] md:w-auto md:text-sm" />
                    </div>
                </div>
            </div>

            <div
                className="min-h-[var(--matchup-mobile-min-height)] md:min-h-[var(--matchup-desktop-min-height)]"
                style={stableRegionStyle}
                aria-live="polite"
            >
                {showLoadingState && (
                    <div aria-busy="true" aria-label="対決データを読み込み中">
                        <MatchupMatrixSkeleton runnerCount={runnerCount} />
                    </div>
                )}
                {!showLoadingState && error && (
                    <div className="flex min-h-[inherit] items-center justify-center p-6 text-center text-sm text-red-600">
                        {error}
                    </div>
                )}

                {!showLoadingState && !error && matchupData && (
                    isDataEmpty
                        ? <div className="flex min-h-[inherit] items-center justify-center p-6 text-center text-sm text-slate-500"><p>指定された期間の直接対決データはありません。</p></div>
                        : <>
                            <div className="hidden md:block">
                                <TableView predictions={race.predictions} matchupData={matchupData} onSelect={setSelectedMatchup} />
                            </div>
                            <div className="md:hidden">
                                <MobileMatrixView predictions={race.predictions} matchupData={matchupData} onSelect={setSelectedMatchup} />
                            </div>
                        </>
                )}
            </div>

            {selectedMatchup && (
                <section className="border-t border-slate-200 bg-slate-50 p-3" aria-live="polite" aria-label="選択した対戦成績の詳細">
                    <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-slate-500">選択した組み合わせ</p>
                        <button
                            type="button"
                            onClick={() => setSelectedMatchup(null)}
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-xs font-bold text-slate-600 transition-colors duration-150 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                            閉じる
                        </button>
                    </div>
                    <MatchupDetails {...selectedMatchup} />
                </section>
            )}
        </div>
    );
};
