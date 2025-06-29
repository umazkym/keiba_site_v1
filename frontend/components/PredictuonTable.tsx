import { RacePrediction } from '@/lib/types';
import React from 'react';

// ★★★ 1Cスタート指標のチャートをこのファイルに移動 ★★★
const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    if (!predictions || predictions.length === 0 || predictions.every(p => p.start_1c_indicator === null)) {
        return null; // データがない場合は何も表示しない
    }

    const validPredictions = predictions.filter(p => p.start_1c_indicator !== null);
    const scores = validPredictions.map(p => p.start_1c_indicator!);
    const minScore = Math.min(...scores, -2); // 最小値を-2に固定
    const maxScore = Math.max(...scores, 2);  // 最大値を2に固定
    const scoreRange = maxScore - minScore;

    const getPosition = (score: number | null) => {
        if (score === null || scoreRange <= 0.01) return 50; // 中央に配置
        // スコアを0-100の範囲に正規化 (5%のマージンを持たせる)
        return 5 + ((score - minScore) / scoreRange) * 90;
    };
    
    return (
        <div className="my-4 p-4 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-2 text-gray-700">AI スタート位置予測 (1コーナー)</h4>
            <div className="w-full h-8 bg-gray-100 rounded-full relative flex items-center">
                {/* 背景のグラデーション */}
                <div className="absolute inset-0 flex">
                    <div className="w-1/3 bg-yellow-100/70 rounded-l-full"></div>
                    <div className="w-1/3 bg-blue-100/70"></div>
                    <div className="w-1/3 bg-red-100/70 rounded-r-full"></div>
                </div>
                {/* 縦の区切り線 */}
                <div className="absolute top-0 bottom-0 left-1/3 border-l border-dashed border-gray-400/50"></div>
                <div className="absolute top-0 bottom-0 left-2/3 border-l border-dashed border-gray-400/50"></div>

                {/* 各馬のマーカー */}
                {validPredictions.map(p => (
                    <Tippy key={p.horse_id} content={`${p.horse_name} (${p.start_1c_indicator?.toFixed(2)})`}>
                        <div 
                            className="absolute w-2 h-5 bg-gray-600 rounded-full border border-white shadow-md"
                            style={{ left: `calc(${getPosition(p.start_1c_indicator)}% - 4px)` }}
                        />
                    </Tippy>
                ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                <span>後方</span>
                <span>中団</span>
                <span>先行</span>
            </div>
        </div>
    );
};


export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');

    return (
        <div className="my-4">
             {/* ★★★ スタート位置チャートをここに表示 ★★★ */}
            <StartPositionChart predictions={race.predictions} />

            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-lg bg-white">
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
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">AI偏差値</th>
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
        </div>
    );
};