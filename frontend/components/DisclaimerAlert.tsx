'use client';
import React, { useId, useState } from 'react';

/**
 * 免責事項アラート
 *
 * PC/スマホともに1行に折りたたみ、クリックで詳細を開く。
 */
const DisclaimerAlert = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const bodyId = useId();

    return (
        <div className="my-2 w-full overflow-hidden rounded-r-lg border-l-4 border-amber-500 bg-amber-50 md:my-3">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={bodyId}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left md:py-2"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-amber-500 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate text-xs font-bold text-amber-800 md:text-sm">
                        免責事項：AI分析は参考情報です
                    </span>
                </div>
                <svg className={`h-4 w-4 shrink-0 text-amber-500 transition-transform duration-200 md:h-5 md:w-5 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isExpanded && (
                <div
                    id={bodyId}
                    className="space-y-1 border-t border-amber-200 px-3 pb-2 pt-1.5 text-[11px] leading-relaxed text-amber-700 md:space-y-1.5 md:pb-3 md:pt-2 md:text-xs"
                >
                    <p>当サイトが提供するAI偏差値および各種予想データは、過去のレース結果等に基づく統計的な参考情報であり、<strong>的中や利益を保証するものではありません。</strong></p>
                    <p>馬券の購入はユーザー様ご自身の判断と責任において行ってください。当サイトの情報を利用して生じたいかなる損害・損失についても、運営者は責任を負いかねます。</p>
                    <p className="pt-0.5 text-[10px] text-amber-600/80 md:text-xs md:text-amber-600/90">
                        ※20歳未満の方の勝馬投票券の購入は競馬法（第28条）により禁止されています。
                    </p>
                </div>
            )}
        </div>
    );
};

export default DisclaimerAlert;
