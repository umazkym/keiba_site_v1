'use client';

import { useState } from 'react';

/**
 * DataExplainer - AI偏差値データの読み方を解説する折りたたみ式コンポーネント
 * 
 * レースページに配置し、初回訪問ユーザーのデータ理解を支援する。
 * AdSense審査における「コンテンツの付加価値」を高める重要なコンポーネント。
 */
export function DataExplainer() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors"
                aria-expanded={isOpen}
                aria-controls="data-explainer-content"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <span className="font-bold text-blue-800 text-sm sm:text-base">データの読み方ガイド</span>
                </div>
                <svg
                    className={`w-5 h-5 text-blue-600 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {isOpen && (
                <div
                    id="data-explainer-content"
                    className="px-4 pb-4 border-t border-blue-200"
                >
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                        {/* AI偏差値 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                                AI偏差値とは
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                過去5年以上のレース結果データを機械学習モデルで分析し、
                                各馬の能力を<strong className="text-gray-800">偏差値（平均50、標準偏差10）</strong>で数値化したものです。
                                偏差値が高いほど、AIが高い能力を推定していることを示します。
                            </p>
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                                <span className="font-semibold">目安：</span>
                                60以上 = 上位クラス / 55〜59 = やや有利 / 50前後 = 平均的 / 45以下 = やや不利
                            </div>
                        </div>

                        {/* 対戦成績 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                                対戦成績とは
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                同じレースに出走した馬同士の過去の直接対決結果を集計したデータです。
                                <strong className="text-gray-800">勝率や着順比較</strong>から、
                                相性の良い/悪い組み合わせを見つけることができます。
                            </p>
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                                <span className="font-semibold">活用法：</span>
                                対戦相手との相性を確認し、馬券の組み合わせを検討する際に活用できます。
                            </div>
                        </div>

                        {/* 枠順傾向 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                                枠順傾向とは
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                各競馬場・距離・コースにおける枠番（ゲート位置）ごとの
                                <strong className="text-gray-800">有利・不利の傾向</strong>を過去データから分析したものです。
                                内枠有利/外枠有利はコースによって大きく異なります。
                            </p>
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                                <span className="font-semibold">注意点：</span>
                                枠順の有利・不利は距離やコース形態により異なります。
                            </div>
                        </div>

                        {/* 利用上のご注意 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-red-400" />
                                ご利用にあたって
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                本データは統計分析に基づく参考情報であり、
                                <strong className="text-gray-800">的中を保証するものではありません</strong>。
                                馬場状態、展開、騎手の力量など、数値化が難しい要素も多く存在します。
                            </p>
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                                <span className="font-semibold">お願い：</span>
                                投票は余裕資金で、楽しみの範囲でお願いいたします。
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
