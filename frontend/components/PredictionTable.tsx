// frontend/components/PredictuonTable.tsx

import { RacePrediction } from '@/lib/types';
import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/themes/light-border.css';
import { Adsense } from './Adsense';

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
    const reason = race.predictions?.[0]?.unpredictable_reason;

    if (isUnpredictable) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>{reason || 'このレースは予測対象外です（新馬戦、障害戦など）。'}</p>
            </div>
        );
    }
    
    // 広告コンポーネントを定義（異なるスロットIDで複数配置）
    const InFeedAd = ({ slot }: { slot: string }) => (
        <div className="py-2">
            <Adsense
                client="ca-pub-4411270831448240"
                slot={slot}
                style={{ minHeight: '80px' }}
            />
        </div>
    );
    
    // 広告挿入位置を決定する関数
    const shouldShowAd = (index: number, totalCount: number): string | null => {
        // 3位と4位の間（index=2）
        if (index === 2) return "1489598374";
        // 6位と7位の間（index=5）、10頭以上いる場合
        if (index === 5 && totalCount > 8) return "8529703346";
        // 10位と11位の間（index=9）、14頭以上いる場合
        if (index === 9 && totalCount > 12) return "1489598374";
        return null;
    };
    
    return (
        <>
            {/* PC (md以上) ではテーブル表示 */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-primary/20">
                        <tr>
                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">印</th>
                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider" colSpan={2}>馬番・馬名</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-end gap-1">
                                <span className="whitespace-nowrap">AI偏差値</span>
                                <Tippy content={
                                    <div className='p-2 text-sm text-left max-w-xs bg-white text-gray-800 rounded-lg shadow-lg border'>
                                        <p className='font-bold mb-1'>AI偏差値とは？</p>
                                        <p className='text-xs'>過去のレースタイムなどからAIが算出した馬の能力指数です。数値が高いほど、高く評価していることを示します。</p>
                                    </div>
                                    } placement="top" interactive={true} theme="light-border" appendTo={() => document.body}
                                >
                                    <span className='w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help'>?</span>
                                </Tippy>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {race.predictions.map((p, index) => {
                            const adSlot = shouldShowAd(index, race.predictions.length);
                            return (
                                <React.Fragment key={`${race.id}-${p.horse_number}`}>
                                    <tr className="border-b border-gray-100 hover:bg-blue-50/50 transition-all duration-200 hover:shadow-sm">
                                        <td className="px-3 py-3 whitespace-nowrap text-center text-xl font-extrabold text-gray-800 w-14">{p.mark || '—'}</td>
                                        <td className="px-3 py-3 whitespace-nowrap w-12">
                                            <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap font-semibold text-gray-900 truncate">{p.horse_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-lg font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</td>
                                    </tr>
                                    {adSlot && (
                                        <tr>
                                            <td colSpan={4}>
                                                <InFeedAd slot={adSlot} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* スマホ (md未満) ではカードリスト表示 */}
            <div className="md:hidden divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {race.predictions.map((p, index) => {
                    const adSlot = shouldShowAd(index, race.predictions.length);
                    return (
                        <React.Fragment key={`${race.id}-${p.horse_number}-mobile`}>
                             <div className="p-3 bg-white hover:bg-blue-50/50 transition-colors duration-200">
                                 <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-3">
                                         <span className="text-2xl font-extrabold text-gray-800 w-10 text-center">{p.mark || '—'}</span>
                                         <div className="flex items-center gap-2">
                                             <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                             <span className="font-bold text-base text-gray-900 truncate max-w-[140px]">{p.horse_name}</span>
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         <div className="font-bold text-primary text-xl whitespace-nowrap">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</div>
                                         <div className="text-[10px] text-gray-500 whitespace-nowrap font-medium">AI偏差値</div>
                                     </div>
                                 </div>
                             </div>
                             {adSlot && <InFeedAd slot={adSlot} />}
                        </React.Fragment>
                    );
                })}
            </div>
        </>
    );
};