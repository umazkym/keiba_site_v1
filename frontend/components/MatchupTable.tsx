import { RacePrediction, MatchupRecord, HorsePrediction } from '@/lib/types';
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; 
import 'tippy.js/themes/light-border.css';

type ViewType = 'table' | 'cards';

// --- ヘルパーコンポーネント ---
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
    <div className="text-left p-2">
        <h4 className="font-bold border-b border-gray-200 pb-1 mb-2">{rowHorse.horse_name} vs {colHorse.horse_name}</h4>
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

// --- テーブルビュー用のコンポーネント ---
const WinLossPieChart = ({ win, loss, draw }: { win: number, loss: number, draw: number }) => {
    const data = [ { name: 'Win', value: win }, { name: 'Loss', value: loss }, { name: 'Draw', value: draw } ].filter(d => d.value > 0);
    const COLORS = { Win: '#10B981', Loss: '#EF4444', Draw: '#A1A1AA' };
    if (data.length === 0) return <div className='w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500'>対戦なし</div>;
    return (
        <div className='w-14 h-14 relative'>
            <ResponsiveContainer>
                <PieChart>
                    <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={16} outerRadius={24} paddingAngle={2}>
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />)}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none">{win + loss + draw}</div>
        </div>
    );
};

const TableView = ({ race }: { race: RacePrediction }) => {
    const { predictions, matchup } = race;
    if (!matchup) return null;
    const { matchup_data } = matchup;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    const totalRecords = sortedHorses.reduce((acc, horse) => {
        let win = 0, loss = 0, draw = 0;
        sortedHorses.forEach(opponent => {
            if (horse.horse_id !== opponent.horse_id) {
                const record = matchup_data[`${horse.horse_id}_vs_${opponent.horse_id}`];
                if (record) { win += record.win; loss += record.loss; draw += record.draw; }
            }
        });
        acc[horse.horse_id] = { win, loss, draw };
        return acc;
    }, {} as Record<string, { win: number, loss: number, draw: number }>);

    return (
        <div className="table-wrapper">
            <table className="matchup-table">
                <thead>
                    <tr>
                        <th className="sticky-col !p-1 text-center">馬名</th>
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
                            {sortedHorses.map((colHorse) => {
                                if (colHorse.horse_id === rowHorse.horse_id) return <td key={colHorse.horse_id} className="self-match"></td>;

                                const record = matchup_data[`${rowHorse.horse_id}_vs_${colHorse.horse_id}`];
                                let content = <div className="net-wins-cell"><span className="text-gray-400">-</span></div>;
                                let cellClass = 'no-match';
                                let recordExists = record && (record.win > 0 || record.loss > 0 || record.draw > 0);

                                if (recordExists) {
                                    const netWins = record.win - record.loss;
                                    if (netWins > 0) cellClass = 'matchup-win';
                                    else if (netWins < 0) cellClass = 'matchup-loss';
                                    else cellClass = 'matchup-draw';

                                    content = (
                                        <div className="net-wins-cell">
                                            <span className={`net-wins-number ${cellClass}`}>
                                                {netWins > 0 ? `+${netWins}` : netWins}
                                            </span>
                                            <span className="wld-text">
                                                ({record.win}-{record.loss}-{record.draw})
                                            </span>
                                        </div>
                                    );
                                }
                                return (
                                    <td key={colHorse.horse_id} className={`p-0 ${cellClass}`}>
                                        {/* ★★★ 修正点: Tippy の content を render プロパティに変更 */}
                                        <Tippy render={() => (record ? <MatchupTooltipContent rowHorse={rowHorse} colHorse={colHorse} record={record} /> : <></>)} theme="light-border" placement="top" animation={false} disabled={!record}>
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

// --- カードビュー ---
const DuelCard = ({ horse1, horse2, record }: { horse1: HorsePrediction; horse2: HorsePrediction; record?: MatchupRecord }) => {
    const totalGames = record ? record.win + record.loss : 0;
    const h1WinRate = totalGames > 0 && record ? (record.win / totalGames) * 100 : 50;
    const h1WakuClass = getWakuColorClasses(horse1.waku_number).split(' ')[0];
    
    const content = (
        <div className="duel-card">
            <div className="horse-profile">
                <HorseNumberCircle number={horse1.horse_number} waku={horse1.waku_number} />
                <span className="horse-name">{horse1.horse_name}</span>
            </div>
            <div className="duel-center">
                <div className="score">
                    {record ? `${record.win} - ${record.loss}` : '0 - 0'}
                    {record && record.draw > 0 && <span className="draw-score">-{record.draw}</span>}
                </div>
                <div className="dominance-bar-container">
                    <div className={`dominance-bar ${h1WakuClass}`} style={{ width: `${h1WinRate}%` }}></div>
                </div>
            </div>
            <div className="horse-profile">
                <HorseNumberCircle number={horse2.horse_number} waku={horse2.waku_number} />
                <span className="horse-name">{horse2.horse_name}</span>
            </div>
        </div>
    );
    
    return (
        /* ★★★ 修正点: Tippy の content を render プロパティに変更し、colHorse の参照を horse2 に修正 */
        <Tippy render={() => (record ? <MatchupTooltipContent rowHorse={horse1} colHorse={horse2} record={record} /> : <></>)} theme="light-border" placement="top" animation={false} disabled={!record}>
            {content}
        </Tippy>
    );
};

const CardView = ({ race }: { race: RacePrediction }) => {
    const { predictions, matchup } = race;
    if (!matchup) return null;
    const { matchup_data } = matchup;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    const pairs: { horse1: HorsePrediction; horse2: HorsePrediction }[] = [];
    for (let i = 0; i < sortedHorses.length; i++) {
        for (let j = i + 1; j < sortedHorses.length; j++) {
            pairs.push({ horse1: sortedHorses[i], horse2: sortedHorses[j] });
        }
    }
    return (
        <div className="card-grid">
            {pairs.map(({ horse1, horse2 }) => (
                <DuelCard
                    key={`${horse1.horse_id}-${horse2.horse_id}`}
                    horse1={horse1}
                    horse2={horse2}
                    record={matchup_data[`${horse1.horse_id}_vs_${horse2.horse_id}`]}
                />
            ))}
        </div>
    );
};


// --- 親コンポーネント ---
export const MatchupTable = ({ race }: { race: RacePrediction }) => {
    const [view, setView] = useState<ViewType>('table');

    if (!race.matchup?.matchup_data || Object.keys(race.matchup.matchup_data).length === 0) {
        return <div className="matchup-container text-center text-gray-500"><p>このレースの直接対決データはありません。</p></div>;
    }

    const buttonClass = (buttonView: ViewType) => 
        `px-3 py-1 text-sm rounded-md transition-colors duration-200 ${
            view === buttonView 
            ? 'bg-blue-600 text-white font-semibold shadow-md' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`;

    return (
        <div className="matchup-container">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-xl font-bold">直接対決データ</h3>
                <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                    <button onClick={() => setView('table')} className={buttonClass('table')}>テーブル表示</button>
                    <button onClick={() => setView('cards')} className={buttonClass('cards')}>カード表示</button>
                </div>
            </div>
            {view === 'table' && <TableView race={race} />}
            {view === 'cards' && <CardView race={race} />}
        </div>
    );
};