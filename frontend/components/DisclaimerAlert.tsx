import React from 'react';

const DisclaimerAlert = () => {
    return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 sm:p-5 rounded-r-lg shadow-sm mb-6 mt-4 relative overflow-hidden group">
            <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold text-amber-800 mb-1">
                        【免責事項】馬券のご購入は自己責任で
                    </h3>
                    <div className="mt-2 text-xs sm:text-sm text-amber-700 leading-relaxed space-y-2">
                        <p>
                            当サイトが提供するAI偏差値および各種予想データは、過去のレース結果等に基づく統計的な参考情報であり、<strong>的中や利益を保証するものではありません。</strong>
                        </p>
                        <p>
                            馬券の購入はユーザー様ご自身の完全な判断と責任において行ってください。当サイトの情報を利用して生じたいかなる損害・損失についても、運営者は一切の責任を負いかねます。
                        </p>
                        <p className="text-xs text-amber-600/90 pt-1">
                            ※20歳未満の方の勝馬投票券の購入は競馬法（第28条）により禁止されています。
                        </p>
                    </div>
                </div>
            </div>
            
            {/* 装飾用背景パターン */}
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-24 h-24 text-amber-900" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M12 2L1 21h22L12 2zm0 3.83L19.5 19h-15L12 5.83zM11 16h2v2h-2v-2zm0-7h2v5h-2V9z" />
                </svg>
            </div>
        </div>
    );
};

export default DisclaimerAlert;
