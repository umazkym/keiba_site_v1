import { RacePrediction } from '@/lib/types';
import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';

// 馬番アイコン用のヘルパー関数とコンポーネント
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
    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-sm shrink-0 ${getWakuColorClasses(waku)}`}>
        {number}
    </div>
);

export const PredictionTable = ({ race }: { race: RacePrediction }) => {
    const isUnpredictable = !race.predictions.length || race.predictions.some(p => p.mark === '—');

    if (isUnpredictable) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>このレースは予測対象外です（新馬戦、障害戦など）。</p>
            </div>
        );
    }
    
    return (
        <>
            {/* PC (md以上) ではテーブル表示 */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-2 py-1 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">印</th>
                            <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase tracking-wider" colSpan={2}>馬番・馬名</th>
                            <th className="px-4 py-1 text-right text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-end gap-1">
                                <span className="whitespace-nowrap">能力偏差値</span>
                                <Tippy content={
                                    <div className='p-2 text-sm text-left max-w-xs bg-white text-gray-800 rounded-lg shadow-lg border'>
                                        <p className='font-bold mb-1'>能力偏差値とは？</p>
                                        <p className='text-xs'>過去のレースタイムなどから算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。</p>
                                    </div>
                                    } placement="top" interactive={true} theme="light-border" appendTo={() => document.body}
                                >
                                    <span className='w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help'>?</span>
                                </Tippy>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {race.predictions.map((p) => (
                            <tr key={`${race.id}-${p.horse_number}`} className="hover:bg-gray-50 transition-colors duration-200">
                                <td className="px-2 py-2 whitespace-nowrap text-center text-lg font-bold text-gray-800 w-12">{p.mark || '—'}</td>
                                <td className="px-2 py-2 whitespace-nowrap w-10">
                                    <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-800 truncate">{p.horse_name}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right font-semibold text-primary-dark">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* スマホ (md未満) ではカードリスト表示 */}
            <div className="md:hidden divide-y divide-gray-200">
                {race.predictions.map((p) => (
                    <div key={`${race.id}-${p.horse_number}-mobile`} className="p-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold text-gray-800 w-8 text-center">{p.mark || '—'}</span>
                                <div className="flex items-center gap-2">
                                    <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                    <span className="font-bold text-base text-gray-900 truncate">{p.horse_name}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-semibold text-primary-dark text-lg whitespace-nowrap">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">能力偏差値</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};