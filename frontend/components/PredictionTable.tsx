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
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-2 py-1 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">印</th>
                            <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase tracking-wider" colSpan={2}>馬番・馬名</th>
                            <th className="px-4 py-1 text-right text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-end gap-1">
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
                                    <tr className="hover:bg-gray-50 transition-colors duration-200">
                                        <td className="px-2 py-2 whitespace-nowrap text-center text-lg font-bold text-gray-800 w-12">{p.mark || '—'}</td>
                                        <td className="px-2 py-2 whitespace-nowrap w-10">
                                            <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-800 truncate">{p.horse_name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right font-semibold text-primary-dark">{p.deviation_score != null ? p.deviation_score.toFixed(2) : '---'}</td>
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
            <div className="md:hidden divide-y divide-border bg-white">
                {race.predictions.map((p, index) => {
                    const adSlot = shouldShowAd(index, race.predictions.length);
                    return (
                        <React.Fragment key={`${race.id}-${p.horse_number}-mobile`}>
                            <div className="p-2 transition-colors hover:bg-slate-50">
                                <div className="flex items-center gap-2">
                                    {/* 左側: 印と馬番 (横並び・コンパクト化) */}
                                    <div className="flex flex-row items-center gap-2 shrink-0 min-w-[3.5rem]">
                                        <span className="text-lg font-extrabold text-text-primary leading-none w-5 text-center">{p.mark || '—'}</span>
                                        <HorseNumberCircle number={p.horse_number} waku={p.waku_number} />
                                    </div>

                                    {/* 中央: 馬名 */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="font-bold text-sm text-text-primary truncate">{p.horse_name}</div>
                                    </div>

                                    {/* 右側: 偏差値 */}
                                    <div className="flex flex-col items-end shrink-0 w-14 justify-center">
                                        <div className="font-bold text-primary text-base font-mono tracking-tight leading-none">
                                            {p.deviation_score != null ? p.deviation_score.toFixed(1) : '--'}
                                        </div>
                                        <div className="text-[10px] text-text-muted scale-90 origin-right mt-0.5">偏差値</div>
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