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
        <div className="table-wrapper">
            <table className="matchup-table" style={{ minWidth: `${160 + sortedHorses.length * 52}px` }}>
                <thead>
                    <tr>
                        <th className="sticky-col !p-1 text-center">馬名</th>
                        {sortedHorses.map(horse => (
                            <th key={horse.horse_id} className="p-1" style={{ minWidth: '52px' }}>
                                <div className='flex flex-col items-center justify-center h-full gap-1'>
                                    <HorseNumberCircle number={horse.horse_number} waku={horse.waku_number} />
                                    <span className='text-[10px] font-bold whitespace-nowrap'>{horse.horse_name.substring(0, 3)}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedHorses.map((rowHorse) => (
                        <tr key={rowHorse.horse_id}>
                            <th className="sticky-col p-1">
                                <div className='flex items-center h-full px-2 gap-2'>
                                    <HorseNumberCircle number={rowHorse.horse_number} waku={rowHorse.waku_number} />
                                    <span className='text-sm font-semibold whitespace-nowrap'>{rowHorse.horse_name}</span>
                                </div>
                            </th>
                            {sortedHorses.map((colHorse) => {
                                if (colHorse.horse_id === rowHorse.horse_id) return <td key={colHorse.horse_id} className="self-match"></td>;
                                const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                let content = <div className="net-wins-cell"><span className="text-gray-400">-</span></div>;
                                let cellClass = 'no-match';
                                if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                                    const netWins = record.win - record.loss;
                                    if (netWins > 0) cellClass = 'matchup-win';
                                    else if (netWins < 0) cellClass = 'matchup-loss';
                                    else cellClass = 'matchup-draw';
                                    content = (
                                        <div className="net-wins-cell">
                                            <span className={`net-wins-number ${cellClass}`}>{netWins > 0 ? `+${netWins}` : netWins}</span>
                                            <span className="wld-text">({record.win}-{record.loss}-{record.draw})</span>
                                        </div>
                                    );
                                }
                                return (
                                    <td key={colHorse.horse_id} className={`p-0 ${cellClass}`}>
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
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const [startDate, setStartDate] = useState(yearStart.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    
    const [matchupData, setMatchupData] = useState<MatchupData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [source, target] = useSingleton();
    
    // スマホ用 state
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
            <div className="p-4">
                <label htmlFor="horse-select" className="block text-sm font-medium text-gray-700 mb-2">基準にする馬を選択してください:</label>
                <select 
                    id="horse-select"
                    value={selectedHorseId}
                    onChange={(e) => setSelectedHorseId(e.target.value)}
                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                >
                    {sortedHorsesForSelect.map(h => (
                        <option key={h.horse_id} value={h.horse_id}>
                            {h.horse_number}番 {h.horse_name}
                        </option>
                    ))}
                </select>

                <div className="mt-4 space-y-2">
                    {sortedHorsesForSelect.filter(h => h.horse_id !== selectedHorseId).map(opponent => {
                        const record = matchupData?.matchup_data[`${selectedHorse.horse_id}_vs_${opponent.horse_id}`];
                        const netWins = record ? record.win - record.loss : 0;
                        
                        let resultText = <span className="text-gray-500">対戦なし</span>;
                        if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                            resultText = (
                                <>
                                    <span className={netWins > 0 ? 'text-green-600' : netWins < 0 ? 'text-red-600' : 'text-gray-700'}>
                                        {netWins > 0 ? `+${netWins}` : netWins}
                                    </span>
                                    <span className="text-xs ml-1 text-gray-500">({record.win}-{record.loss}-{record.draw})</span>
                                </>
                            );
                        }

                        return (
                             <div key={opponent.horse_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                                 <div className="flex items-center gap-2">
                                     <HorseNumberCircle number={opponent.horse_number} waku={opponent.waku_number} />
                                     <span className="font-medium text-gray-800">{opponent.horse_name}</span>
                                 </div>
                                <div className="font-bold text-lg">{resultText}</div>
                             </div>
                        );
                    })}
                </div>
            </div>
        );
    };


    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <Tippy singleton={source} theme="light-border" placement="top" animation="shift-away" interactive={true} appendTo={() => document.body} delay={[100, 200]} />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b gap-4">
                <div className='flex items-center gap-2'>
                    <h3 className="text-base font-bold hidden md:block">直接対決データ</h3>
                     <Tippy 
                        content={
                            <div className='p-2 text-sm text-left max-w-xs bg-white text-gray-800 rounded-lg shadow-lg border'>
                                <p className='font-bold mb-1 border-b pb-1'>直接対決データとは？</p>
                                <p className='text-xs mt-2'>この表は、出走馬同士が過去に<strong className='font-bold'>同じレースで直接対決</strong>した際の成績をまとめたものです。</p>
                                <ul className='text-xs mt-2 list-disc list-inside space-y-1'>
                                    <li><strong>数値：</strong>左の馬から見た勝ち越し数です。（勝ち数 - 負け数）</li>
                                    <li><strong>( )内の数字：</strong>(勝ち数 - 負け数 - 引き分け数) の内訳です。</li>
                                    <li><strong>集計期間：</strong>右上のカレンダーで自由に変更できます。</li>
                                </ul>
                            </div>
                        }
                        placement="top-start" interactive={true} theme="light-border" appendTo={() => document.body}
                    >
                        <span className='w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold cursor-help'>?</span>
                    </Tippy>
                </div>
                <div className="flex items-center gap-2 text-sm self-end w-full md:w-auto">
                    <label htmlFor="start-date" className="text-gray-600 font-semibold shrink-0">集計期間:</label>
                    <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm w-full"/>
                    <span className="text-gray-500">～</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm w-full"/>
                </div>
            </div>
            
            {isLoading && <div className="text-center p-8 text-gray-500">対決データを読み込み中...</div>}
            {error && <div className="text-center p-8 text-red-500">{error}</div>}

            {!isLoading && !error && matchupData && (
                isDataEmpty 
                ? <div className="text-center text-gray-500 py-6"><p>指定された期間の直接対決データはありません。</p></div>
                : <>
                    <div className="hidden lg:block">
                        <TableView predictions={race.predictions} matchupData={matchupData} tippySingleton={target} />
                    </div>
                    <div className="lg:hidden">
                        {renderMobileView()}
                    </div>
                  </>
            )}
        </div>
    );
};