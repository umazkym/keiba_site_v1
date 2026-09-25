'use client';

import { RacePrediction, MatchupRecord, HorsePrediction, MatchupData } from '@/lib/types';
import React, { startTransition, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getFilteredMatchups } from '@/lib/api';
import { getWakuNumber } from '@/lib/utils';
import { AccessibleInfo } from '@/components/AccessibleInfo';
import { HorseNumber } from '@/components/RaceParts';
import { getWakuClasses } from '@/lib/waku';
import { getTopAiPredictions, resolveWaku } from '@/lib/race-display';

const getWakuColorClasses = (waku: number | null): string => getWakuClasses(waku);

const HorseNumberCircle = ({ number, waku, compact = false }: { number: number, waku: number | null, compact?: boolean }) => (
    <div className={`${compact ? 'h-5 w-5 text-[10px] border' : 'h-7 w-7 text-sm border-2'} rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 ${getWakuColorClasses(waku)}`}>
        {number}
    </div>
);

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

// スマホは見本どおり「AI偏差値の上位5頭どうし」の5×5にする（2026-09-25 スマホの見直し）。
// 以前は全頭の表をスマホにも出していて、1マスが14〜21px・文字が8〜9pxになり、押し間違えやすかった。PC は全頭の表のまま。
const MOBILE_TOP_COUNT = 5;
// 見出しの行（28px）＋ 1行44px と間4px ＋ 上下の余白（8px・14px）
const getMobileGridHeight = (rows: number) => 50 + rows * 48;

const getMobileRowCount = (predictions: HorsePrediction[]) => (
    Math.max(2, getTopAiPredictions(predictions, MOBILE_TOP_COUNT).length)
);

const MobileTopFiveSkeleton = ({ rows }: { rows: number }) => (
    <div className="px-3.5 pb-3.5 pt-2" aria-hidden="true">
        <div className="rounded-lg bg-slate-50" style={{ height: getMobileGridHeight(rows) - 22 }} />
    </div>
);

type MatchupSelection = {
    rowHorse: HorsePrediction;
    colHorse: HorsePrediction;
    record: MatchupRecord;
};

const MatchupDetails = ({ rowHorse, colHorse, record }: MatchupSelection) => (
    <div className="max-w-xl text-left text-slate-700">
        <h4 className="font-bold border-b border-slate-200 pb-1 mb-2">{rowHorse.horse_name} vs {colHorse.horse_name}</h4>
        <div className="mb-2 text-center text-[15px] font-semibold sm:text-lg">
            <span className="text-green-500">{record.win}</span>
            <span className="text-slate-500 mx-1">-</span>
            <span className="text-red-500">{record.loss}</span>
            <span className="text-slate-500 mx-1">-</span>
            <span className="text-slate-500">{record.draw}</span>
        </div>
        {record.history.length > 0 && (
            <ul className="space-y-2 text-xs max-h-40 overflow-y-auto pr-2">
                {record.history.slice().reverse().map((h, index) => {
                    const rowRank = rowHorse.horse_id === h.p1_horse_id ? h.p1_rank : h.p2_rank;
                    const colRank = colHorse.horse_id === h.p1_horse_id ? h.p1_rank : h.p2_rank;
                    const isWin = rowRank < colRank;
                    return (
                        <li key={index} className="border-t border-slate-200 pt-1">
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
                                        <span className='min-w-0 break-words text-[11px] font-semibold text-slate-700'>{rowHorse.horse_name}</span>
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
                                                    className="block h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
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

const getCellTone = (record: MatchupRecord) => {
    const diff = record.win - record.loss;
    if (diff > 0) return 'bg-turf-soft text-turf-deep';
    if (diff < 0) return 'bg-[#FCE4E8] text-[#C8364A]';
    return 'bg-slate-50 text-slate-500';
};

const MobileTopFiveView = ({ predictions, matchupData, onSelect }: { predictions: HorsePrediction[]; matchupData: MatchupData; onSelect: (selection: MatchupSelection) => void }) => {
    const { matchup_data } = matchupData;
    const horses = getTopAiPredictions(predictions, MOBILE_TOP_COUNT);
    const runnerCount = predictions.length;
    if (horses.length < 2) {
        return (
            <p className="px-3.5 py-5 text-center text-sm text-slate-500">
                AI偏差値のある馬が2頭未満のため、対戦成績を出せません。
            </p>
        );
    }
    // 狭い比較表は馬番と先頭3文字を縦に並べる。全文は出走表で確認でき、読み上げにも残す。
    const gridStyle = {
        gridTemplateColumns: `minmax(44px, 1fr) repeat(${horses.length}, 44px)`,
    } satisfies CSSProperties;

    return (
        <div className="grid gap-1 px-3.5 pb-3.5 pt-2 max-[359px]:gap-0.5 max-[359px]:px-1" style={gridStyle}>
            <span aria-hidden="true" />
            {horses.map((horse) => (
                <span key={`head-${horse.horse_id}`} className="flex h-7 items-center justify-center" title={horse.horse_name}>
                    <HorseNumber number={horse.horse_number} waku={resolveWaku(horse, runnerCount)} size={24} />
                </span>
            ))}
            {horses.map((rowHorse) => (
                <React.Fragment key={rowHorse.horse_id}>
                    <span className="flex h-11 min-w-0 flex-col items-center justify-center gap-0.5" aria-label={`${rowHorse.horse_number}番 ${rowHorse.horse_name}`}>
                        <HorseNumber number={rowHorse.horse_number} waku={resolveWaku(rowHorse, runnerCount)} size={20} />
                        <span className="whitespace-nowrap text-[12.5px] font-bold leading-none text-slate-900" aria-hidden="true">{Array.from(rowHorse.horse_name).slice(0, 3).join('')}</span>
                    </span>
                    {horses.map((colHorse) => {
                        const key = `${rowHorse.horse_id}-${colHorse.horse_id}`;
                        if (colHorse.horse_id === rowHorse.horse_id) {
                            return <span key={key} className="h-11 rounded-md bg-slate-100" aria-hidden="true" />;
                        }
                        const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                        if (!record || (record.win === 0 && record.loss === 0 && record.draw === 0)) {
                            return (
                                <span key={key} className="flex h-11 items-center justify-center text-[13px] text-slate-400" aria-label={`${rowHorse.horse_name}と${colHorse.horse_name}の対戦はありません`}>
                                    —
                                </span>
                            );
                        }
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onSelect({ rowHorse, colHorse, record })}
                                className={`flex h-11 w-full cursor-pointer items-center justify-center rounded-md font-num text-[14px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${getCellTone(record)}`}
                                aria-label={`${rowHorse.horse_name}から見た${colHorse.horse_name}との対戦 ${record.win}勝${record.loss}敗${record.draw > 0 ? `${record.draw}分` : ''}。詳細を表示`}
                            >
                                {record.win}-{record.loss}{record.draw > 0 ? `-${record.draw}` : ''}
                            </button>
                        );
                    })}
                </React.Fragment>
            ))}
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
    const [isPeriodOpen, setIsPeriodOpen] = useState(false);

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
    const mobileRows = getMobileRowCount(race.predictions);
    const mobileMinHeight = getMobileGridHeight(mobileRows);
    const desktopMinHeight = 50 + Math.max(1, runnerCount) * 36;
    const stableRegionStyle = {
        '--matchup-mobile-min-height': `${mobileMinHeight}px`,
        '--matchup-desktop-min-height': `${desktopMinHeight}px`,
    } as CSSProperties;

    return (
        <div className="race-panel overflow-hidden">
            <div className="race-section-toolbar flex flex-col gap-1 px-3.5 pt-1.5 md:flex-row md:items-center md:justify-between md:gap-2 md:border-b md:border-slate-200 md:px-5 md:py-4">
                <div className='flex min-h-11 items-center gap-2 md:min-h-0'>
                    <h2 id="race-matchup-heading" className="race-section-heading race-section-heading--flush !mb-0 whitespace-nowrap">対戦成績</h2>
                    <AccessibleInfo
                        label="過去対決成績の説明を表示"
                        buttonClassName="hit-44 after:-inset-x-2.5 h-6 w-6 bg-slate-200 text-xs font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-300"
                    >
                        <span className="mb-1 block font-bold text-slate-900">過去対決成績とは？</span>
                        <span className="block">出走馬同士が過去に同じレースで直接対決した際の成績です。</span>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                            <li><strong>スマホ：</strong>AI偏差値の上位5頭どうしを、行の馬から見た勝ち-負けで表示します。</li>
                            <li><strong>PC：</strong>全頭の勝ち越し数（勝ち数 - 負け数）と、勝-負-分の内訳です。</li>
                            <li><strong>集計期間：</strong>日付欄から変更できます。</li>
                        </ul>
                    </AccessibleInfo>
                    <button
                        type="button"
                        onClick={() => setIsPeriodOpen((current) => !current)}
                        aria-expanded={isPeriodOpen}
                        aria-controls="matchup-period-panel"
                        className="-mr-2 ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 md:hidden"
                    >
                        集計期間 {formatCompactDate(startDate)}–{formatCompactDate(endDate)}
                        <span aria-hidden="true" className="text-slate-400">{isPeriodOpen ? '閉じる' : '⌄'}</span>
                    </button>
                </div>
                {isPeriodOpen && (
                    <div id="matchup-period-panel" className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2 md:hidden">
                        <input aria-label="集計開始日" type="date" value={startDate} onChange={e => setDateRange(current => ({ ...current, startDate: e.target.value }))} className="min-h-11 min-w-0 rounded border border-slate-300 bg-white px-2 text-[11px]" />
                        <span className="shrink-0 text-slate-400">–</span>
                        <input aria-label="集計終了日" type="date" value={endDate} onChange={e => setDateRange(current => ({ ...current, endDate: e.target.value }))} className="min-h-11 min-w-0 rounded border border-slate-300 bg-white px-2 text-[11px]" />
                    </div>
                )}
                <p className="text-[13px] leading-[1.6] text-slate-500 md:hidden">AI上位5頭の対戦（行の馬の勝ち-負け）</p>
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
                        <div className="md:hidden">
                            <MobileTopFiveSkeleton rows={mobileRows} />
                        </div>
                        <div className="hidden md:block">
                            <MatchupMatrixSkeleton runnerCount={runnerCount} />
                        </div>
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
                                <MobileTopFiveView predictions={race.predictions} matchupData={matchupData} onSelect={setSelectedMatchup} />
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
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-xs font-bold text-slate-600 transition-colors duration-150 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
