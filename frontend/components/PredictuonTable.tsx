import { RacePrediction } from '@/lib/types';
import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';

export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');

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
                            {/* ★★★ 修正箇所: 着順のヘッダーを削除 ★★★ */}
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
                        {race.predictions.map((p) => (
                            <tr key={`${race.id}-${p.horse_number}`} className="hover:bg-gray-50 transition-colors duration-200">
                                {/* ★★★ 修正箇所: 着順のセルを削除 ★★★ */}
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
                {race.predictions.map((p) => (
                    <div key={`${race.id}-${p.horse_number}-mobile`} className="p-4">
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
                        {/* ★★★ 修正箇所: 着順表示ブロックを完全に削除 ★★★ */}
                    </div>
                ))}
            </div>
        </div>
    );
};