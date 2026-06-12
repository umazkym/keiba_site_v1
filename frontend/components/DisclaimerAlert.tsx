'use client';
import React, { useState } from 'react';

/**
 * 免責事項アラート
 * 
 * モバイル: 1行に折りたたみ、タップで展開（ファーストビューを予測データに集中）
 * デスクトップ: 従来通り全文表示
 */
const DisclaimerAlert = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg shadow-sm mb-2 mt-1.5 relative overflow-hidden">
            {/* モバイル: コンパクト1行表示（タップで展開） */}
            <div className="md:hidden">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                >
                    <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-amber-500 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-bold text-amber-800">免責事項：AI分析は参考情報です</span>
                    </div>
                    <svg className={`w-4 h-4 text-amber-500 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {isExpanded && (
                    <div className="px-3 pb-2.5 text-xs text-amber-700 leading-relaxed space-y-1.5 border-t border-amber-200 pt-2">
                        <p>当サイトが提供するAI偏差値および各種予想データは、過去のレース結果等に基づく統計的な参考情報であり、<strong>的中や利益を保証するものではありません。</strong></p>
                        <p>馬券の購入はユーザー様ご自身の判断と責任において行ってください。</p>
                        <p className="text-[10px] text-amber-600/80">※20歳未満の方の勝馬投票券の購入は競馬法（第28条）により禁止されています。</p>
                    </div>
                )}
            </div>
            {/* デスクトップ: 従来通り全文表示 */}
            <div className="hidden md:block p-3">
                <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-bold text-amber-800">
                            【免責事項】馬券のご購入は自己責任で
                        </h3>
                        <div className="mt-1.5 text-xs text-amber-700 leading-relaxed space-y-1.5">
                            <p>当サイトが提供するAI偏差値および各種予想データは、過去のレース結果等に基づく統計的な参考情報であり、<strong>的中や利益を保証するものではありません。</strong></p>
                            <p>馬券の購入はユーザー様ご自身の完全な判断と責任において行ってください。当サイトの情報を利用して生じたいかなる損害・損失についても、運営者は一切の責任を負いかねます。</p>
                            <p className="text-xs text-amber-600/90 pt-1">※20歳未満の方の勝馬投票券の購入は競馬法（第28条）により禁止されています。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisclaimerAlert;
