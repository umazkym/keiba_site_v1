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
                '過去の競走成績から機械学習で算出した馬の総合力。50が平均で、数値が高いほど能力が高いと評価されます。',
            example: '偏差値60の馬は平均以上、偏差値70の馬は非常に高い能力を持つと推定されます',
            importance: 'high',
        },
        {
            title: '勝率',
            description: 'これまでのレースで1着になった割合。馬の勝つ力を示す基本的な指標です。',
            example: '勝率20%なら5回に1回勝利、10%なら10回に1回勝利する計算です',
            importance: 'high',
        },
        {
            title: '複勝率',
            description:
                '1着・2着・3着のいずれかに入った割合。勝てなくても安定して上位に入る馬を見極められます。',
            example: '複勝率60%なら5回中3回は3着以内、40%なら5回中2回程度です',
            importance: 'high',
        },
    ];

    const advancedExplanations: ExplanationItem[] = [
        {
            title: '枠順傾向スコア',
            description:
                'コースごとの枠番の有利不利を数値化した指標。プラスは外枠有利、マイナスは内枠有利を意味します。',
            example: 'スコア+15%なら外枠の方が勝ちやすく、-10%なら内枠の方が有利な傾向があります',
            importance: 'medium',
        },
        {
            title: '過去対決成績',
            description:
                '今回出走する馬同士が過去にどちらが勝ったかの記録。相性の良し悪しが分かります。',
            example: 'A馬とB馬が過去5回対戦してA馬が4勝なら、A馬の方が相性が良いと言えます',
            importance: 'medium',
        },
        {
            title: '脚質パターン予測',
            description:
                'レース序盤でどの馬が先頭集団を形成するかの予測。展開を読む際の参考になります。',
            example: '「1番と5番が逃げる」予測なら、序盤のペースが速くなる可能性があります',
            importance: 'medium',
        },
        {
            title: '回収率',
            description:
                'その馬に賭け続けた場合の収支。100%を超えると利益が出る計算です。',
            example: '回収率120%なら100円賭けて平均120円戻る計算で、長期的には利益が出ます',
            importance: 'low',
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
