import { RacePrediction } from '@/lib/types';
import React, { useMemo } from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';

const mergePredictionsWithResults = (race: RacePrediction) => {
    if (!race.results || race.results.length === 0) {
        return race.predictions.map(p => ({ ...p, rank: null }));
    }
    const resultsMap = new Map(race.results.map(r => [r.horse_number, r.rank]));
    return race.predictions.map(p => ({
        ...p,
        rank: resultsMap.get(p.horse_number) ?? null,
    }));
};

const getRowStyle = (mark: string, rank: number | null): string => {
    if (rank === null || !mark || !['◎', '〇', '▲', '△', '☆'].includes(mark)) {
        return '';
    }
    if (rank <= 3) {
        return 'bg-amber-50';
    }
    return '';
};

export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');
    const predictionsWithResults = useMemo(() => mergePredictionsWithResults(race), [race]);
    const hasResults = predictionsWithResults.some(p => p.rank !== null);

    if (isUnpredictable) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="bg-primary text-white p-3 border-b border-gray-200">
                     <h3 className="text-lg font-bold flex items-center">
                        <span className="bg-primary-dark text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 font-mono text-base shadow-inner">{race.race_number}R</span>
                        {race.race_name}
                    </h3>
                    <p className="text-sm text-blue-100 mt-1 ml-12">{race.course_type}{race.distance}m</p>
                </div>
                <div className="p-6 text-center text-gray-500">
                    <p>このレースは予測対象外です（新馬戦、障害戦など）。</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="bg-primary text-white p-3 border-b border-gray-200">
                <h3 className="text-lg font-bold flex items-center">
                    <span className="bg-primary-dark text-white rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 font-mono text-base shadow-inner">{race.race_number}R</span>
                    {race.race_name}
                </h3>
                <p className="text-sm text-blue-100 mt-1 ml-12">{race.course_type}{race.distance}m</p>
            </div>

            {/* PC (md以上) ではテーブル表示 */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            {hasResults && <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">着順</th>}
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">印</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">馬番</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">馬名</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-end gap-1">
                                <span>AI偏差値</span>
                                <Tippy content={<div className='p-2 text-sm text-left max-w-xs bg-gray-700 text-white rounded-md'><p>過去のレース走破タイムを元に、AIが独自に算出した能力指数です。数値が高いほど、能力が高いと評価しています。</p></div>} placement="top">
                                    <span className='w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help'>?</span>
                                </Tippy>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {predictionsWithResults.map((p) => (
                            <tr key={`${race.id}-${p.horse_number}`} className={`${getRowStyle(p.mark, p.rank)} hover:bg-gray-50 transition-colors duration-200`}>
                                {hasResults && <td className="px-4 py-3 whitespace-nowrap text-center font-semibold text-gray-800">{p.rank ? `${p.rank}` : '－'}</td>}
                                <td className="px-4 py-3 whitespace-nowrap text-center text-lg font-bold text-gray-800">{p.mark || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-center text-gray-700">{p.horse_number}</td>
                                <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-800">{p.horse_name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-primary-dark">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* スマホ (md未満) ではカードリスト表示 */}
            <div className="md:hidden divide-y divide-gray-200">
                {predictionsWithResults.map((p) => (
                    <div key={`${race.id}-${p.horse_number}-mobile`} className={`p-4 ${getRowStyle(p.mark, p.rank)}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-bold text-gray-800 w-8 text-center">{p.mark || '—'}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 font-semibold bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center border">{p.horse_number}</span>
                                    <span className="font-bold text-base text-gray-900">{p.horse_name}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-semibold text-primary-dark text-lg">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</div>
                                <div className="text-xs text-gray-500">AI偏差値</div>
                            </div>
                        </div>
                        {hasResults && p.rank && (
                            <div className="mt-2 text-right">
                                <span className="text-sm font-bold bg-gray-200 text-gray-800 px-2 py-1 rounded">結果: {p.rank}着</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};