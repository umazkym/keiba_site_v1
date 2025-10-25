/**
 * データ解説パネル コンポーネント
 *
 * AI偏差値、枠順傾向スコア、その他の統計分析指標の意味を
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
            description:
                '機械学習により算出した馬の能力スコアを偏差値形式で表示。50が平均値。数値が高いほど統計分析では能力が高く評価されています。ただし、あくまで推定値です。',
            example: '偏差値70の馬：平均的な馬より能力が高い / 偏差値50の馬：平均的な能力',
            importance: 'high',
        },
        {
            title: '複勝率',
            description:
                'その馬が1着・2着・3着のいずれかに入った割合。複勝率が高い馬は安定して上位入賞する傾向があります。',
            example: '複勝率60%：3回に2回は上位3着以内に入る / 複勝率30%：3回に1回程度',
            importance: 'high',
        },
        {
            title: '勝率',
            description: 'その馬が1着（優勝）した割合。勝率が高い馬は圧倒的な実力差があります。',
            example: '勝率20%：5回に1回は勝利 / 勝率10%：10回に1回の勝利',
            importance: 'high',
        },
    ];

    const advancedExplanations: ExplanationItem[] = [
        {
            title: '枠順傾向スコア',
            description:
                'その競馬場・距離での「枠番による有利・不利」を数値化。プラスなら外枠有利、マイナスなら内枠有利を示します。',
            example: '京都芝2000m：+18%（外枠が圧倒的に有利） / 東京ダート：+8%（外枠やや有利）',
            importance: 'medium',
        },
        {
            title: '過去対決成績',
            description:
                '同じレースに出走した2頭が、過去に対戦した際の勝敗記録。直接的な実力比較ができます。',
            example: 'A馬 vs B馬：A馬が過去3回中2回勝利（勝率67%）',
            importance: 'medium',
        },
        {
            title: '脚質パターン予測',
            description:
                '過去データから分析した「どの馬がどのような走法をする可能性が高いか」。レース展開の参考に活用できます。',
            example: '「3番が先行する可能性が高い」なら、3番の脚質や成績に注目する価値があります',
            importance: 'medium',
        },
        {
            title: '回収率',
            description:
                'その馬への投資額に対する払戻額の割合。100%以上なら利益が出ることを示します。',
            example: '回収率150%：100円投じて150円戻ってきた / 回収率80%：100円投じて80円戻ってきた（20円損失）',
            importance: 'low',
        },
    ];

    const renderExplanationItem = (item: ExplanationItem) => (
        <div
            key={item.title}
            className="border-l-4 pl-4 mb-4"
            style={{
                borderLeftColor:
                    item.importance === 'high'
                        ? '#ef4444'
                        : item.importance === 'medium'
                          ? '#eab308'
                          : '#9ca3af'
            }}
        >
            <div className="flex items-center gap-2 mb-2">
                <div
                    className={`w-2 h-2 rounded-full ${
                        item.importance === 'high'
                            ? 'bg-red-500'
                            : item.importance === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                    }`}
                />
                <h4 className="font-bold text-gray-800">{item.title}</h4>
            </div>
            <p className="text-gray-700 text-sm mb-2">{item.description}</p>
            <div className="bg-gray-50 p-3 rounded border-l-2 border-blue-500 text-xs text-gray-600">
                <strong>例：</strong> {item.example}
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
            {/* アコーディオンのヘッダー */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3 flex-1 text-left">
                    <h4 className="font-bold text-gray-800">AI指標について</h4>
                </div>
                <span className="text-sm font-semibold text-primary">
                    {isExpanded ? '詳細を閉じる' : '詳細を見る'}
                </span>
            </button>

            {/* アコーディオンのコンテンツ */}
            {isExpanded && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <p className="text-sm text-gray-600 mb-6">
                        各AI指標の意味を理解することで、より効果的に予想できます。
                    </p>

                    {/* 基本指標セクション */}
                    <div className="mb-6">
                        <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            初心者向け（重要度：高）
                        </h4>
                        <div>
                            {basicExplanations.map(renderExplanationItem)}
                        </div>
                    </div>

                    {/* 高度な指標セクション */}
                    {showAdvanced && (
                        <div>
                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                応用編（重要度：中～低）
                            </h4>
                            <div>
                                {advancedExplanations.map(renderExplanationItem)}
                            </div>
                        </div>
                    )}

                    {/* 免責事項 */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                            ※ これらのAI指標は参考情報です。実際のレース結果は予測できない多くの要因に左右されます。最終的な馬券購入の判断は、ご自身の責任でお願いします。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
