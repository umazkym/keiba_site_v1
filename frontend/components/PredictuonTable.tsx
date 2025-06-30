import { RacePrediction } from '@/lib/types';
import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';

export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');

    return (
        <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm bg-white">
            <div className="bg-gray-800 text-white p-3 border-b border-gray-200">
                <h3 className="text-lg font-bold">
                    <span className="bg-white text-gray-800 rounded-full w-8 h-8 inline-flex items-center justify-center mr-3 font-mono">{race.race_number}R</span>
                    {race.race_name}
                </h3>
                <p className="text-sm text-gray-300 mt-1 ml-12">{race.course_type}{race.distance}m</p>
            </div>

            {isUnpredictable ? (
                <div className="p-6 text-center text-gray-500">
                    <p>このレースは予測対象外です（新馬戦、障害戦など）。</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">印</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">馬番</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">馬名</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center justify-end gap-1">
                                    <span>AI偏差値</span>
                                    <Tippy 
                                      content={
                                        <div className='p-2 text-sm text-left max-w-xs bg-gray-700 text-white rounded-md'>
                                          <p>過去のレース走破タイムを元に、AIが独自に算出した能力指数です。数値が高いほど、能力が高いと評価しています。</p>
                                        </div>
                                      }
                                      placement="top"
                                    >
                                      <span className='w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help'>?</span>
                                    </Tippy>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {race.predictions.map((p) => (
                                <tr key={`${race.id}-${p.horse_number}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-lg font-bold">{p.mark || '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-gray-700">{p.horse_number}</td>
                                    <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{p.horse_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-red-600">
                                        {p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};