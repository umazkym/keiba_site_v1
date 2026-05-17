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
        <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="mb-1 text-sm font-bold text-gray-800">{item.title}</h4>
            <p className="mb-2 text-xs leading-relaxed text-gray-700 sm:text-sm">{item.description}</p>
            <div className="rounded border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
                {item.example}
            </div>
        </div>
    );

    return (
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:mb-4">
            {/* アコーディオンのヘッダー */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-2.5 sm:p-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 text-left">
                    <h4 className="font-bold text-gray-800 text-xs sm:text-base">AI指標について</h4>
                </div>
                <span className="text-xs font-semibold text-primary sm:text-sm">
                    {isExpanded ? '詳細を閉じる' : '詳細を見る'}
                </span>
            </button>

            {/* アコーディオンのコンテンツ */}
            {isExpanded && (
                <div className="border-t border-gray-200 bg-slate-50 p-3 sm:p-4">
                    {/* 基本指標セクション */}
                    <div className="mb-4">
                        <h3 className="mb-2 border-b-2 border-primary pb-2 text-sm font-bold text-gray-800">
                            基本指標
                        </h3>
                        <p className="mb-3 text-xs text-gray-600 sm:text-sm">
                            レース分析でまず確認したい基本指標です。
                        </p>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {basicExplanations.map(renderExplanationItem)}
                        </div>
                    </div>

                    {/* 高度な指標セクション */}
                    {showAdvanced && (
                        <div>
                            <h3 className="mb-2 border-b-2 border-gray-400 pb-2 text-sm font-bold text-gray-800">
                                その他の指標
                            </h3>
                            <p className="mb-3 text-xs text-gray-600 sm:text-sm">
                                多角的な分析に用いる補助的な指標です。
                            </p>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {advancedExplanations.map(renderExplanationItem)}
                            </div>
                        </div>
                    )}

                    {/* 免責事項 */}
                    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
                        <p className="text-xs leading-relaxed text-gray-700 sm:text-sm">
                            <strong>ご注意:</strong> これらの指標は過去データに基づく統計的な分析結果です。当日の馬の状態や天候、騎手の判断など、数値化できない要素も多数あります。予想の参考としてご活用ください。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
