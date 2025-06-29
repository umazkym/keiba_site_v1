import { RacePrediction, MatchupRecord, HorsePrediction, MatchupData } from '@/lib/types';
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css'; 
import 'tippy.js/themes/light-border.css';
import { getFilteredMatchups } from '@/lib/api'; // ★★★ API関数をインポート

// --- ヘルパーコンポーネント (変更なし) ---
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

// --- ポップアップ（ツールチップ）のコンテンツ (変更なし) ---
const MatchupTooltipContent = ({ rowHorse, colHorse, record }: { rowHorse: HorsePrediction, colHorse: HorsePrediction, record: MatchupRecord }) => (
    <div className="text-left p-2 bg-white rounded-lg shadow-xl border border-gray-200">
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

// --- テーブルビュー ---
const TableView = ({ predictions, matchupData }: { predictions: HorsePrediction[], matchupData: MatchupData }) => {
    const { matchup_data } = matchupData;
    const sortedHorses = [...predictions].sort((a, b) => a.horse_number - b.horse_number);
    return (
        <div className="table-wrapper">
            <table className="matchup-table">
                <thead>
                    <tr>
                        <th className="sticky-col !p-1 text-center">馬名</th>
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
                                            content={record ? <MatchupTooltipContent rowHorse={rowHorse} colHorse={colHorse} record={record} /> : ''} 
                                            theme="light-border" 
                                            placement="top"
                                            animation="shift-away"
                                            interactive={true} // ★★★ 操作可能にする設定
                                            appendTo={() => document.body} // ★★★ 表示崩れを防ぐ設定
                                            delay={[100, 100]} // 表示と非表示の遅延
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


// --- 親コンポーネント (大幅修正) ---
export const MatchupTable = ({ race }: { race: RacePrediction }) => {
    // デフォルトの期間を過去2年間に設定
    const today = new Date();
    const twoYearsAgo = new Date(new Date().setFullYear(today.getFullYear() - 2));

    const [startDate, setStartDate] = useState(twoYearsAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [matchupData, setMatchupData] = useState<MatchupData | null>(race.matchup); // 初期データは全期間
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ★★★ 期間が変更されたらAPIを叩いてデータを再取得する
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

        // 初期表示時以外（日付が変更された時）にフェッチを実行
        if (race.matchup) { // race.matchupは初回ロード時のみ
            fetchFilteredData();
        }
    }, [race.id, startDate, endDate]);


    const isDataEmpty = !matchupData || Object.keys(matchupData.matchup_data).length === 0;

    return (
        <div className="matchup-container">
            <div className="flex flex-wrap justify-between items-center mb-4 border-b pb-2 gap-4">
                <div className='flex items-center gap-2'>
                    <h3 className="text-xl font-bold">直接対決データ</h3>
                    <Tippy 
                      content={
                        <div className='p-2 text-sm text-left max-w-xs bg-gray-700 text-white rounded-md'>
                          <p className='font-bold mb-1'>対戦成績の計算方法</p>
                          <p>このレースの出走馬同士が、過去に<strong className='text-yellow-300'>同じレース</strong>で直接対戦した際の成績（1着、2着、3着）を集計しています。指定された期間内の成績のみが表示されます。</p>
                        </div>
                      }
                      placement="top-start"
                    >
                      <span className='w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold cursor-help'>?</span>
                    </Tippy>
                </div>
                {/* ★★★ 期間フィルタリングUI ★★★ */}
                <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm"/>
                    <span>～</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm"/>
                </div>
            </div>
            
            {isLoading && <div className="text-center p-4">読み込み中...</div>}
            {error && <div className="text-center p-4 text-red-500">{error}</div>}

            {!isLoading && !error && (
                isDataEmpty 
                ? <div className="text-center text-gray-500 py-4"><p>指定された期間の直接対決データはありません。</p></div>
                : <TableView predictions={race.predictions} matchupData={matchupData} />
            )}
        </div>
    );
};