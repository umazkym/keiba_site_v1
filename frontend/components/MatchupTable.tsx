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
const HorseNumberCircle = ({ number, waku }: { number: number, waku: number | null }) => (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm border-2 shadow-sm shrink-0 ${getWakuColorClasses(waku)}`}>
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
    return (
        <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="matchup-table w-full">
                <thead>
                    <tr>
                        <th className="sticky-col !p-1 text-center whitespace-nowrap w-[140px]">馬名</th>
                        {sortedHorses.map(horse => (
                            <th key={horse.horse_id} className="p-1 w-11">
                                <div className='flex flex-col items-center justify-center h-full gap-0.5'>
                                    <HorseNumberCircle number={horse.horse_number} waku={horse.waku_number} />
                                    <span className='text-xs font-bold whitespace-nowrap'>{horse.horse_name.substring(0, 4)}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedHorses.map((rowHorse) => (
                        <tr key={rowHorse.horse_id}>
                            <th className="sticky-col p-1 w-[140px]">
                                <div className='flex items-center h-full px-1 gap-2'>
                                    <HorseNumberCircle number={rowHorse.horse_number} waku={rowHorse.waku_number} />
                                    <span className='text-sm font-semibold whitespace-nowrap truncate'>{rowHorse.horse_name}</span>
                                </div>
                            </th>
                            {sortedHorses.map((colHorse) => {
                                if (colHorse.horse_id === rowHorse.horse_id) return <td key={colHorse.horse_id} className="self-match w-11 bg-gray-100"></td>;
                                const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                let content = <div className="net-wins-cell"><span className="text-gray-400">-</span></div>;
                                let cellClass = 'no-match bg-gray-50';
                                let textColorClass = 'text-gray-500';

                                if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                                    const netWins = record.win - record.loss;
                                    if (netWins > 0) {
                                        cellClass = 'matchup-win bg-green-100';
                                        textColorClass = 'text-green-700';
                                    } else if (netWins < 0) {
                                        cellClass = 'matchup-loss bg-red-100';
                                        textColorClass = 'text-red-700';
                                    } else {
                                        cellClass = 'matchup-draw bg-gray-200';
                                        textColorClass = 'text-gray-700';
                                    }
                                    content = (
                                        <div className="net-wins-cell">
                                            <span className={`net-wins-number font-bold text-sm ${textColorClass}`}>{netWins > 0 ? `+${netWins}` : netWins}</span>
                                            <span className="wld-text text-xs text-gray-600">({record.win}-{record.loss}-{record.draw})</span>
                                        </div>
                                    );
                                }
                                return (
                                    <td key={colHorse.horse_id} className={`p-1 w-11 ${cellClass}`}>
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
            <div className="p-2">
                <label htmlFor="horse-select" className="block text-xs font-medium text-gray-700 mb-1.5">基準馬:</label>
                <select
                    id="horse-select"
                    value={selectedHorseId}
                    onChange={(e) => setSelectedHorseId(e.target.value)}
                    className="block w-full p-1.5 border border-gray-300 rounded text-base sm:text-xs"
                >
                    {sortedHorsesForSelect.map(h => (
                        <option key={h.horse_id} value={h.horse_id}>
                            {h.horse_number}番 {h.horse_name}
                        </option>
                    ))}
                </select>

                <div className="mt-2 space-y-1">
                    {sortedHorsesForSelect.filter(h => h.horse_id !== selectedHorseId).map(opponent => {
                        const record = matchupData?.matchup_data[`${selectedHorse.horse_id}_vs_${opponent.horse_id}`];
                        const netWins = record ? record.win - record.loss : 0;

                        let resultText = <span className="text-gray-500 text-xs">-</span>;
                        let bgColor = 'bg-gray-50';
                        if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                            if (netWins > 0) {
                                bgColor = 'bg-green-100';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-green-700">
                                            +{netWins}
                                        </span>
                                        <span className="text-[10px] text-green-600 ml-0.5">({record.win}-{record.loss}-{record.draw})</span>
                                    </>
                                );
                            } else if (netWins < 0) {
                                bgColor = 'bg-red-100';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-red-700">
                                            {netWins}
                                        </span>
                                        <span className="text-[10px] text-red-600 ml-0.5">({record.win}-{record.loss}-{record.draw})</span>
                                    </>
                                );
                            } else {
                                bgColor = 'bg-gray-200';
                                resultText = (
                                    <>
                                        <span className="font-bold text-sm text-gray-700">
                                            {netWins}
                                        </span>
                                        <span className="text-[10px] text-gray-600 ml-0.5">({record.win}-{record.loss}-{record.draw})</span>
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
                                <div className={`flex justify-between items-center px-2 py-1.5 ${bgColor} rounded border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer`}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 flex-shrink-0 ${getWakuColorClasses(opponent.waku_number)}`}>
                                            {opponent.horse_number}
                                        </div>
                                        <span className="font-medium text-gray-800 text-sm truncate">{opponent.horse_name.substring(0, 5)}</span>
                                    </div>
                                    <div className="text-xs whitespace-nowrap ml-1 flex-shrink-0">{resultText}</div>
                                </div>
                            </Tippy>
                        );
                    })}
                </div>
            </div>
        );
    };


    return (
        <div className="bg-white rounded-lg">
            <Tippy singleton={source} theme="light-border" placement="top" animation="shift-away" interactive={true} appendTo={() => document.body} delay={[100, 200]} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-2 md:p-3 border-b gap-2">
                <div className='flex items-center gap-2'>
                    <h3 className="text-xs md:text-sm font-bold whitespace-nowrap">過去対決成績</h3>
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
                        <span className='w-4 h-4 md:w-5 md:h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs md:text-sm font-bold cursor-help flex-shrink-0'>?</span>
                    </Tippy>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 text-xs md:text-sm w-full md:w-auto">
                    <label htmlFor="start-date" className="text-gray-600 font-semibold md:font-medium shrink-0">期間:</label>
                    <div className="flex items-center gap-1 w-full md:w-auto">
                        <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 p-1 rounded text-xs md:text-sm flex-1 md:flex-none w-full md:w-auto" />
                        <span className="text-gray-500 shrink-0">～</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-300 p-1 rounded text-xs md:text-sm flex-1 md:flex-none w-full md:w-auto" />
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