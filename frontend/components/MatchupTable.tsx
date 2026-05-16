import { RacePrediction, MatchupRecord, HorsePrediction, MatchupData } from '@/lib/types';
import React, { useState, useEffect } from 'react';
import Tippy, { useSingleton } from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';
import { getFilteredMatchups } from '@/lib/api';

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

const MatchupTooltipContent = ({ rowHorse, colHorse, record }: { rowHorse: HorsePrediction, colHorse: HorsePrediction, record: MatchupRecord }) => (
    <div className="text-left p-2 bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm">
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

const TableView = ({ predictions, matchupData, tippySingleton }: { predictions: HorsePrediction[], matchupData: MatchupData, tippySingleton: any }) => {
    const { matchup_data } = matchupData;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    const isCompact = sortedHorses.length >= 16;
    const firstColPercent = isCompact ? 15 : 19;
    const horseColPercent = (100 - firstColPercent) / Math.max(sortedHorses.length, 1);

    return (
        <div className="overflow-hidden border border-slate-200 bg-white">
            <table className="w-full table-fixed border-collapse text-center">
                <colgroup>
                    <col style={{ width: `${firstColPercent}%` }} />
                    {sortedHorses.map((horse) => (
                        <col key={horse.horse_id} style={{ width: `${horseColPercent}%` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-1 py-2 text-left text-[11px] font-bold text-slate-500">馬名</th>
                        {sortedHorses.map(horse => (
                            <th key={horse.horse_id} className="px-0.5 py-1" title={horse.horse_name}>
                                <div className='flex items-center justify-center'>
                                    <HorseNumberCircle number={horse.horse_number} waku={horse.waku_number} compact={isCompact} />
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedHorses.map((rowHorse, rowIndex) => (
                        <tr key={rowHorse.horse_id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                            <th className="border-b border-slate-100 px-1 py-1 text-left">
                                <div className='flex min-w-0 items-center gap-1.5'>
                                    <HorseNumberCircle number={rowHorse.horse_number} waku={rowHorse.waku_number} compact={isCompact} />
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
                                        <Tippy
                                            singleton={tippySingleton}
                                            content={record ? <MatchupTooltipContent rowHorse={rowHorse} colHorse={colHorse} record={record} /> : ''}
                                        >
                                            {content}
                                        </Tippy>
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
    // race.race_date (例: "2025-08-18") を基準に日付オブジェクトを生成します。
    // タイムゾーンの問題を避けるため、UTCとして扱います。
    const raceDate = new Date(race.race_date + 'T00:00:00Z');

    // レース開催日の前日を計算します。
    const dayBeforeRace = new Date(raceDate);
    dayBeforeRace.setUTCDate(raceDate.getUTCDate() - 1);

    // レース開催年の1月1日を計算します。
    const yearStart = new Date(Date.UTC(raceDate.getUTCFullYear(), 0, 1));

    // toISOString()は 'YYYY-MM-DDTHH:mm:ss.sssZ' 形式なので、'T'で分割して日付部分のみ取得します。
    const [startDate, setStartDate] = useState(yearStart.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(dayBeforeRace.toISOString().split('T')[0]);

    const [matchupData, setMatchupData] = useState<MatchupData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [source, target] = useSingleton();

    const sortedHorsesForSelect = React.useMemo(() => [...race.predictions].sort((a, b) => a.horse_number - b.horse_number), [race.predictions]);
    const [selectedHorseId, setSelectedHorseId] = useState<string>(sortedHorsesForSelect[0]?.horse_id || '');

    // ▼▼▼▼▼【クリティカルバグ修正: 2R以降のモバイル対戦成績が空になる問題】▼▼▼▼▼
    // 原因: useState初期値は初回マウント時のrace.predictionsの馬IDで固定される
    //       VenuePanelが再マウントされないため、raceが変わっても古い馬IDのまま
    //       → renderMobileView()でfindがnullを返す → 何も表示されない
    // 修正: race.idが変わったらselectedHorseId/startDate/endDateをリセット
    useEffect(() => {
        const newHorses = [...race.predictions].sort((a, b) => a.horse_number - b.horse_number);
        if (newHorses.length > 0) {
            setSelectedHorseId(newHorses[0].horse_id);
        }
        // 日付範囲もレースに合わせてリセット
        const newRaceDate = new Date(race.race_date + 'T00:00:00Z');
        const newDayBefore = new Date(newRaceDate);
        newDayBefore.setUTCDate(newRaceDate.getUTCDate() - 1);
        const newYearStart = new Date(Date.UTC(newRaceDate.getUTCFullYear(), 0, 1));
        setStartDate(newYearStart.toISOString().split('T')[0]);
        setEndDate(newDayBefore.toISOString().split('T')[0]);
    }, [race.id]);
    // ▲▲▲▲▲【修正ここまで】▲▲▲▲▲


    useEffect(() => {
        const fetchFilteredData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getFilteredMatchups(race.id, startDate, endDate);
                setMatchupData(data);
            } catch (e) {
                setError("データの取得に失敗しました。");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFilteredData();
    }, [race.id, startDate, endDate]);

    const isDataEmpty = !matchupData || Object.keys(matchupData.matchup_data).length === 0;

    const renderMobileView = () => {
        const selectedHorse = sortedHorsesForSelect.find(h => h.horse_id === selectedHorseId);
        if (!selectedHorse) return null;

        return (
        <div className="p-2.5">
            <label htmlFor="horse-select" className="mb-1.5 block text-xs font-bold text-slate-600">基準馬</label>
                <select
                    id="horse-select"
                    value={selectedHorseId}
                    onChange={(e) => setSelectedHorseId(e.target.value)}
                    className="block w-full rounded-md border border-slate-300 bg-white p-2 text-base"
                >
                    {sortedHorsesForSelect.map(h => (
                        <option key={h.horse_id} value={h.horse_id}>
                            {h.horse_number}番 {h.horse_name}
                        </option>
                    ))}
                </select>

                <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {sortedHorsesForSelect.filter(h => h.horse_id !== selectedHorseId).map(opponent => {
                        const record = matchupData?.matchup_data[`${selectedHorse.horse_id}_vs_${opponent.horse_id}`];
                        const netWins = record ? record.win - record.loss : 0;

                        let resultText = <span className="text-slate-400 text-xs">-</span>;
                        let bgColor = 'bg-white';
                        let borderColor = 'border-slate-200';
                        if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                            if (netWins > 0) {
                                bgColor = 'bg-emerald-50';
                                borderColor = 'border-emerald-100';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-green-700">
                                            +{netWins}
                                        </span>
                                    </>
                                );
                            } else if (netWins < 0) {
                                bgColor = 'bg-rose-50';
                                borderColor = 'border-rose-100';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-red-700">
                                            {netWins}
                                        </span>
                                    </>
                                );
                            } else {
                                bgColor = 'bg-slate-100';
                                borderColor = 'border-slate-200';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-slate-700">
                                            {netWins}
                                        </span>
                                    </>
                                );
                            }
                        }

                        return (
                            <Tippy
                                key={opponent.horse_id}
                                content={record ? <MatchupTooltipContent rowHorse={selectedHorse} colHorse={opponent} record={record} /> : ''}
                                placement="top"
                                interactive={true}
                                theme="light-border"
                                appendTo={() => document.body}
                                delay={[100, 200]}
                            >
                                <div className={`flex min-h-[42px] items-center justify-between gap-1 rounded-md border px-2 py-1.5 ${bgColor} ${borderColor}`}>
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <HorseNumberCircle number={opponent.horse_number} waku={opponent.waku_number} compact />
                                        <span className="truncate text-xs font-semibold text-slate-700">{opponent.horse_name}</span>
                                    </div>
                                    <div className="ml-1 flex-shrink-0 whitespace-nowrap text-xs">{resultText}</div>
                                </div>
                            </Tippy>
                        );
                    })}
                </div>
            </div>
        );
    };


    return (
        <div className="bg-white">
            <Tippy singleton={source} theme="light-border" placement="top" animation="shift-away" interactive={true} appendTo={() => document.body} delay={[100, 200]} />

            <div className="flex flex-col gap-2 border-b border-slate-200 p-2.5 md:flex-row md:items-center md:justify-between md:p-3">
                <div className='flex items-center gap-2'>
                    <h3 className="whitespace-nowrap text-xs font-bold text-slate-800 md:text-sm">過去対決成績</h3>
                    <Tippy
                        content={
                            <div className='p-2 text-sm text-left max-w-xs bg-white text-gray-800 rounded-lg shadow-lg border'>
                                <p className='font-bold mb-1 border-b pb-1'>過去対決成績とは？</p>
                                <p className='text-xs mt-2'>出走馬同士が過去に同じレースで直接対決した際の成績です。</p>
                                <ul className='text-xs mt-2 list-disc list-inside space-y-1'>
                                    <li><strong>数値：</strong>左の馬から見た勝ち越し数（勝ち数 - 負け数）。</li>
                                    <li><strong>( )内の数字：</strong>(勝-負-分) の内訳です。</li>
                                    <li><strong>集計期間：</strong>右上のカレンダーで変更できます。</li>
                                </ul>
                            </div>
                        }
                        placement="top-start" interactive={true} theme="light-border" appendTo={() => document.body}
                    >
                        <span className='flex h-4 w-4 flex-shrink-0 cursor-help items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white md:h-5 md:w-5 md:text-sm'>?</span>
                    </Tippy>
                </div>
                <div className="flex w-full flex-col gap-1 text-xs md:w-auto md:flex-row md:items-center md:gap-2 md:text-sm">
                    <label htmlFor="start-date" className="shrink-0 font-semibold text-slate-500 md:font-medium">期間</label>
                    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1 md:flex md:w-auto">
                        <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="min-w-0 rounded border border-slate-300 p-1 text-xs md:w-auto md:text-sm" />
                        <span className="shrink-0 text-slate-400">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="min-w-0 rounded border border-slate-300 p-1 text-xs md:w-auto md:text-sm" />
                    </div>
                </div>
            </div>

            {isLoading && <div className="text-center p-6 text-gray-500">対決データを読み込み中...</div>}
            {error && <div className="text-center p-6 text-red-500">{error}</div>}

            {!isLoading && !error && matchupData && (
                isDataEmpty
                    ? <div className="text-center text-gray-500 py-4"><p>指定された期間の直接対決データはありません。</p></div>
                    : <>
                        <div className="hidden md:block">
                            <TableView predictions={race.predictions} matchupData={matchupData} tippySingleton={target} />
                        </div>
                        <div className="md:hidden">
                            {renderMobileView()}
                        </div>
                    </>
            )}
        </div>
    );
};
