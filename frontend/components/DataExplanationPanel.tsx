/**
 * データ解説パネル コンポーネント
 *
 * AI偏差値、このコースの枠順傾向、その他の統計分析指標の意味を
 * 初心者にもわかりやすく説明する折りたたみ式パネル
 * あくまで参考情報・推定値であることを明確化
 */

import React, { useState } from 'react';

interface DataExplanationPanelProps {
    showAdvanced?: boolean;
}

interface ExplanationItem {
    title: string;
    description: string;
    example: string;
    importance: 'high' | 'medium' | 'low';
}

export const DataExplanationPanel: React.FC<DataExplanationPanelProps> = ({
    showAdvanced = true,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const basicExplanations: ExplanationItem[] = [
        {
            title: 'AI偏差値',
            description: '偏差値50を平均とした馬の総合的な能力評価スコアです。',
            example: '偏差値が高いほど、AIが高い能力を持っていると推定しています。',
            importance: 'high',
        },
        {
            title: '勝率・複勝率',
            description: '過去のレースにおける1着、または3着以内に入った割合です。',
            example: '基礎的な成績の安定度を示す指標です。',
            importance: 'high',
        },
    ];

    const advancedExplanations: ExplanationItem[] = [
        {
            title: 'このコースの枠順傾向',
            description: 'そのコース・距離における枠番別の有利不利を独自スコア化したものです。',
            example: 'プラススコアは外枠有利、マイナススコアは内枠有利の傾向を示します。',
            importance: 'medium',
        },
        {
            title: 'その他の指標（過去対決・脚質予測など）',
            description: '出走馬同士の直接対決データや、序盤の位置取り予測などの補足データです。',
            example: '展開や相性を考慮する際のサブ指標としてご活用ください。',
            importance: 'medium',
        },
    ];

    const renderExplanationItem = (item: ExplanationItem) => (
        <div key={item.title} className="mb-5 pb-5 border-b border-gray-100 last:border-0">
            <h4 className="font-bold text-gray-800 mb-2">{item.title}</h4>
            <p className="text-gray-700 text-sm mb-3 leading-relaxed">{item.description}</p>
            <div className="bg-blue-50 px-4 py-3 rounded text-sm text-gray-700 border-l-4 border-blue-400">
                {item.example}
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-gray-200 rounded-lg mb-2 sm:mb-4 overflow-hidden">
            {/* アコーディオンのヘッダー */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-2.5 sm:p-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 text-left">
                    <h4 className="font-bold text-gray-800 text-xs sm:text-base">AI指標について</h4>
                </div>
                <span className="text-sm font-semibold text-primary">
                    {isExpanded ? '詳細を閉じる' : '詳細を見る'}
                </span>
            </button>

            {/* アコーディオンのコンテンツ */}
            {isExpanded && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                    {/* 基本指標セクション */}
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-800 text-base mb-4 pb-2 border-b-2 border-primary">
                            基本指標
                        </h3>
                        <p className="text-sm text-gray-600 mb-5">
                            レース分析における基本の3指標です。
                        </p>
                        <div>
                            {basicExplanations.map(renderExplanationItem)}
                        </div>
                    </div>

                    {/* 高度な指標セクション */}
                    {showAdvanced && (
                        <div>
                            <h3 className="font-bold text-gray-800 text-base mb-4 pb-2 border-b-2 border-gray-400">
                                その他の指標
                            </h3>
                            <p className="text-sm text-gray-600 mb-5">
                                多角的な分析に用いる補助的な指標です。
                            </p>
                            <div>
                                {advancedExplanations.map(renderExplanationItem)}
                            </div>
                        </div>
                    )}

                    {/* 免責事項 */}
                    <div className="mt-8 pt-6 border-t-2 border-gray-200 bg-amber-50 -mx-6 -mb-6 px-6 py-5 rounded-b-lg">
                        <p className="text-sm text-gray-700 leading-relaxed">
                            <strong>ご注意:</strong> これらの指標は過去データに基づく統計的な分析結果です。当日の馬の状態や天候、騎手の判断など、数値化できない要素も多数あります。予想の参考としてご活用ください。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
