import { RacePrediction, MatchupRecord } from '@/lib/types';
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; 
import 'tippy.js/themes/light-border.css';

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

const MatchupTooltipContent = ({ rowHorseName, colHorseName, record }: { rowHorseName: string, colHorseName: string, record: MatchupRecord }) => (
    <div className="text-left p-2">
        <h4 className="font-bold border-b border-gray-200 pb-1 mb-2">{rowHorseName} vs {colHorseName}</h4>
        <div className="font-semibold mb-2 text-center text-lg">
            <span className="text-green-500">{record.win}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-red-500">{record.loss}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-gray-500">{record.draw}</span>
        </div>
        {record.history.length > 0 && (
            <ul className="space-y-2 text-xs max-h-40 overflow-y-auto">
                {record.history.slice().reverse().map((h, index) => {
                    const isWin = h.p1_rank < h.p2_rank;
                    return (
                        <li key={index} className="border-t border-gray-200 pt-1">
                            <div className="font-semibold">{new Date(h.race_date).toLocaleDateString()} {h.venue_name}</div>
                            <div>
                                {h.p1_rank}着 vs {h.p2_rank}着
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

const WinLossPieChart = ({ win, loss, draw }: { win: number, loss: number, draw: number }) => {
    const data = [
        { name: 'Win', value: win },
        { name: 'Loss', value: loss },
        { name: 'Draw', value: draw },
    ].filter(d => d.value > 0);

    const COLORS = { Win: '#10B981', Loss: '#EF4444', Draw: '#A1A1AA' };

    if (data.length === 0) {
        return <div className='w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500'>対戦なし</div>;
    }

    return (
        <div className='w-14 h-14 relative'>
            <ResponsiveContainer>
                <PieChart>
                    <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={16} outerRadius={24} paddingAngle={2}>
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />)}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none">
                {win + loss + draw}
            </div>
        </div>
    );
};


export const MatchupTable = ({ race }: { race: RacePrediction }) => {
    if (!race.matchup?.matchup_data || Object.keys(race.matchup.matchup_data).length === 0) {
        return (
            <div className="matchup-container text-center text-gray-500">
                <p>このレースの直接対決データはありません。</p>
            </div>
        );
    }

    const { predictions, matchup: { matchup_data } } = race;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);

    const totalRecords = sortedHorses.reduce((acc, horse) => {
        let win = 0, loss = 0, draw = 0;
        sortedHorses.forEach(opponent => {
            if (horse.horse_id !== opponent.horse_id) {
                const record = matchup_data[`${horse.horse_id}_vs_${opponent.horse_id}`];
                if (record) {
                    win += record.win; loss += record.loss; draw += record.draw;
                }
            }
        });
        acc[horse.horse_id] = { win, loss, draw };
        return acc;
    }, {} as Record<string, { win: number, loss: number, draw: number }>);


    return (
        <div className="matchup-container">
            <h3 className="text-xl font-bold text-center mb-4">直接対決データ</h3>
            <div className="table-wrapper">
                <table className="matchup-table">
                    <thead>
                        <tr>
                            <th className="sticky-col"></th>
                            <th className="p-1 text-xs text-center font-normal sticky-col-2">VS 全体</th>
                            {sortedHorses.map(horse => (
                                <th key={horse.horse_id} className="p-1">
                                    <div className='flex flex-col items-center justify-center h-full gap-1'>
                                        <HorseNumberCircle number={horse.horse_number} waku={horse.waku_number} />
                                        <span className='text-xs font-normal whitespace-nowrap'>{horse.horse_name}</span>
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
                                <td className="p-1 align-middle sticky-col-2">
                                    <div className='flex flex-col items-center justify-center'>
                                        <WinLossPieChart {...totalRecords[rowHorse.horse_id]}/>
                                        <div className='text-xs font-mono mt-1'>
                                            <span className="text-green-600 font-semibold">{totalRecords[rowHorse.horse_id].win}</span>-
                                            <span className="text-red-600 font-semibold">{totalRecords[rowHorse.horse_id].loss}</span>-
                                            <span className="text-gray-500">{totalRecords[rowHorse.horse_id].draw}</span>
                                        </div>
                                    </div>
                                </td>
                                {/* ★★★ ここからが修正箇所 ★★★ */}
                                {sortedHorses.map((colHorse) => {
                                    // 対角線（自分自身との対戦）のセルは専用スタイルを適用
                                    if (colHorse.horse_number === rowHorse.horse_number) {
                                        return <td key={colHorse.horse_id} className="self-match"></td>;
                                    }

                                    // 対角線以外のすべてのセルのデータを取得・表示
                                    const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                    const netWins = record ? record.win - record.loss : 0;
                                    
                                    let cellClass = 'no-match';
                                    let content = <span className="text-gray-400">-</span>;

                                    if (record && (record.win > 0 || record.loss > 0 || record.draw > 0)) {
                                        if (netWins > 0) cellClass = 'matchup-win';
                                        else if (netWins < 0) cellClass = 'matchup-loss';
                                        else cellClass = 'matchup-draw';
                                        
                                        content = <span>{netWins > 0 ? `+${netWins}`: netWins}</span>;
                                    }

                                    return (
                                        <td key={colHorse.horse_id} className={`font-bold text-lg ${cellClass}`}>
                                            {record ? (
                                                <Tippy 
                                                    content={<MatchupTooltipContent rowHorseName={rowHorse.horse_name} colHorseName={colHorse.horse_name} record={record} />} 
                                                    theme="light-border" 
                                                    placement="top" 
                                                    animation="shift-away"
                                                >
                                                    {content}
                                                </Tippy>
                                            ) : (
                                                content
                                            )}
                                        </td>
                                    );
                                })}
                                {/* ★★★ 修正箇所ここまで ★★★ */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-center items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-300"></div>勝ち越し</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-300"></div>負け越し</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-100 border border-yellow-300"></div>五分</div>
            </div>
        </div>
    );
};