import { RacePrediction, MatchupRecord, HorsePrediction, MatchupData } from '@/lib/types';
import React, { useState, useEffect } from 'react';
import Tippy, { useSingleton } from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';
import { getFilteredMatchups } from '@/lib/api';

// ヘルパー関数: 枠番の背景色と文字色を決定
const getWakuColorClasses = (wakuNumber: number) => {
    switch (wakuNumber) {
        case 1: return 'bg-white text-gray-900 border border-gray-300';
        case 2: return 'bg-black text-white';
        case 3: return 'bg-red-500 text-white';
        case 4: return 'bg-blue-500 text-white';
        case 5: return 'bg-yellow-400 text-gray-900';
        case 6: return 'bg-green-500 text-white';
        case 7: return 'bg-orange-500 text-white';
        case 8: return 'bg-pink-500 text-white';
        default: return 'bg-gray-200 text-gray-700';
    }
};

// ヘルパーコンポーネント: 枠番表示
const HorseNumberCircle = ({ waku, horseNumber }: { waku: number; horseNumber: number }) => (
    <div className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full ${getWakuColorClasses(waku)}`}>
        {horseNumber}
    </div>
);

// ヘルパーコンポーネント: ツールチップの内容
const MatchupTooltipContent = ({ matchup }: { matchup: MatchupRecord | null }) => {
    if (!matchup) return null;

    return (
        <div className="text-sm p-2">
            <h5 className="font-bold border-b pb-1 mb-1">{matchup.race_name}</h5>
            <p className="text-xs text-gray-600 mb-2">{matchup.date} {matchup.course_name} {matchup.race_number}R ({matchup.distance}m)</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                <div className="font-bold">{matchup.horse_a_name}</div>
                <div className="text-right">{matchup.horse_a_finish_order}着</div>
                <div className="text-gray-500">({matchup.horse_a_popularity}人気)</div>
                <div className="font-bold">{matchup.horse_b_name}</div>
                <div className="text-right">{matchup.horse_b_finish_order}着</div>
                <div className="text-gray-500">({matchup.horse_b_popularity}人気)</div>
            </div>
        </div>
    );
};

// ヘルパーコンポーネント: テーブルビュー
const TableView = ({
    headers,
    rows,
    horsePredictions,
    singletonSource,
}: {
    headers: HorsePrediction[];
    rows: (HorsePrediction & { data: MatchupData })[];
    horsePredictions: HorsePrediction[];
    singletonSource: any;
}) => (
    <div className="table-wrapper">
        <table className="matchup-table">
            <thead>
                <tr>
                    <th className="sticky-col bg-gray-50 z-20">馬名</th>
                    {headers.map((h, i) => (
                        <th key={h.horse_id} className="text-center bg-gray-50 z-10">
                            <div className="flex flex-col items-center">
                                <HorseNumberCircle waku={h.waku_number} horseNumber={h.horse_number} />
                                <span className="mt-1 text-xs font-semibold">{h.horse_name_short}</span>
                            </div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((rowHorse, rowIndex) => (
                    <tr key={rowHorse.horse_id}>
                        <td className="sticky-col flex items-center gap-2 py-2 bg-white z-20">
                            <HorseNumberCircle waku={rowHorse.waku_number} horseNumber={rowHorse.horse_number} />
                            <span className="font-semibold">{rowHorse.horse_name}</span>
                        </td>
                        {horsePredictions.map((colHorse, colIndex) => {
                            const matchup = rowHorse.data[colHorse.horse_id];
                            const isSelf = rowHorse.horse_id === colHorse.horse_id;
                            const hasMatchup = matchup && (matchup.wins !== 0 || matchup.losses !== 0 || matchup.draws !== 0);

                            let cellClass = '';
                            let netWinsText = '';
                            let wldText = '';
                            let netWinsClass = '';

                            if (isSelf) {
                                cellClass = 'self-match';
                            } else if (hasMatchup) {
                                netWinsText = String(matchup.wins - matchup.losses);
                                wldText = `(${matchup.wins}-${matchup.losses}-${matchup.draws})`;
                                if (matchup.wins > matchup.losses) {
                                    cellClass = 'matchup-win';
                                    netWinsClass = 'matchup-win';
                                } else if (matchup.losses > matchup.wins) {
                                    cellClass = 'matchup-loss';
                                    netWinsClass = 'matchup-loss';
                                } else { // draws
                                    cellClass = 'matchup-draw';
                                    netWinsClass = 'matchup-draw';
                                }
                            } else {
                                cellClass = 'no-match text-gray-400';
                                netWinsText = '-';
                                wldText = '(0-0-0)';
                            }

                            return (
                                <td key={colHorse.horse_id} className={`text-center ${cellClass}`}>
                                    {isSelf ? (
                                        <div className="flex flex-col items-center justify-center h-full min-h-[56px] text-gray-500">
                                            <span>自身</span>
                                        </div>
                                    ) : hasMatchup ? (
                                        <Tippy singleton={singletonSource} content={<MatchupTooltipContent matchup={matchup.latest_matchup} />} delay={[200, 0]}>
                                            <div className="net-wins-cell">
                                                <span className={`net-wins-number ${netWinsClass}`}>{netWinsText}</span>
                                                <span className="wld-text">{wldText}</span>
                                            </div>
                                        </Tippy>
                                    ) : (
                                        <div className="net-wins-cell">
                                            <span className="net-wins-number">{netWinsText}</span>
                                            <span className="wld-text">{wldText}</span>
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


export const MatchupTable = ({ race }: { race: RacePrediction }) => {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [matchupData, setMatchupData] = useState<MatchupData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // 今日から過去2年間の日付をデフォルトとして設定
    useEffect(() => {
        const today = new Date();
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(today.getFullYear() - 2);

        setStartDate(twoYearsAgo.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (!race || !startDate || !endDate) return;

        const fetchMatchups = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getFilteredMatchups(race.race_id, startDate, endDate);
                setMatchupData(data);
            } catch (err) {
                console.error("Failed to fetch filtered matchups:", err);
                setError("対戦成績データの取得に失敗しました。");
                setMatchupData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMatchups();
    }, [race, startDate, endDate]);

    const horses = race.predictions.sort((a, b) => a.horse_number - b.horse_number);
    const rows = horses.map(horse => ({
        ...horse,
        data: matchupData?.[horse.horse_id] || {},
    }));

    const [source, target] = useSingleton();

    return (
        <div className="bg-white rounded-lg">
            <Tippy singleton={source} theme="light-border" placement="top" animation="shift-away" interactive={true} appendTo={() => document.body} delay={[100, 200]} />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-2 border-b gap-2">
                <div className='flex items-center gap-2'>
                    <h3 className="text-sm font-bold hidden md:block whitespace-nowrap">過去対決成績</h3>
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
                            <span className='w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold cursor-help'>?</span>
                        </Tippy>
                </div>
                <div className="flex items-center gap-1 text-sm self-end w-full md:w-auto">
                    <label htmlFor="start-date" className="text-gray-600 font-semibold shrink-0">期間:</label>
                    <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm w-full"/>
                    <span className="text-gray-500">～</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border-gray-300 p-1 rounded-md text-sm w-full"/>
                </div>
            </div>
            
            {isLoading && (
                <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p>データを読み込み中...</p>
                </div>
            )}
            {error && <div className="p-4 text-center text-red-500">{error}</div>}
            {!isLoading && !error && (!matchupData || Object.keys(matchupData).length === 0) && (
                 <div className="p-4 text-center text-gray-500">
                    この期間の対戦データはありません。
                 </div>
            )}
            {!isLoading && !error && matchupData && Object.keys(matchupData).length > 0 && (
                <TableView
                    headers={horses}
                    rows={rows}
                    horsePredictions={horses}
                    singletonSource={target}
                />
            )}
        </div>
    );
};