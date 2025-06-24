import { RacePrediction } from '@/lib/types';
import React from 'react';

const PositionIndicator = ({ position }: { position: number | null }) => {
    if (position === null) return <span className="text-gray-400">-</span>;
    const normalizedScore = 50 + position * 15;
    const posPercent = Math.max(0, Math.min(100, normalizedScore));
    return (
        <div className="w-full bg-gray-200 h-4 rounded-full relative overflow-hidden my-1">
            <div 
                className="bg-green-500 h-4 rounded-full absolute" 
                style={{ width: '10px', left: `calc(${posPercent}% - 5px)` }}
                title={`1C指標: ${position.toFixed(2)}`}
            ></div>
        </div>
    );
};

export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');

    return (
        <div className="my-4 overflow-hidden rounded-lg border border-gray-200 shadow-lg bg-white">
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
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">偏差値</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">1Cスタート指標</th>
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
                                    <td className="px-6 py-3 whitespace-nowrap">
                                        <PositionIndicator position={p.start_1c_indicator} />
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