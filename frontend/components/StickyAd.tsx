// frontend/components/StickyAd.tsx
'use client';

import { Adsense } from './Adsense';
import { useEffect, useState, useCallback } from 'react';

/**
 * デスクトップ右サイドバー追従広告
 * 
 * - xl (1280px) 以上の画面幅でのみ表示
 * - 400px以上スクロールしたら表示（ファーストビュー保護を強化）
 * - フッターに到達したら非表示（重なり防止）
 * - 閉じるボタン付き（UX向上）
 * - 300x250（ミディアムレクタングル）サイズ: 最もCTRが高い広告サイズ
 */
export const StickyAd = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || isDismissed) return;

        const handleScroll = () => {
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;

            // フッターに近づいたら非表示にする（フッター高さ約400px分の余裕）
            const nearFooter = scrollY + windowHeight > docHeight - 400;

            // 400px以上スクロール かつ フッター付近でない場合に表示
            setIsVisible(scrollY > 400 && !nearFooter);
        };

        // 初期チェック
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMounted, isDismissed]);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
        setIsVisible(false);
    }, []);

    // SSR & モバイルでは表示しない
    if (!isMounted || isDismissed) return null;

    return (
        <div
            className={`hidden xl:block fixed right-2 2xl:right-4 top-24 w-[300px] transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
            }`}
            style={{ zIndex: 30 }}
        >
            <div className="sticky top-24 bg-white rounded-xl shadow-lg p-3 border border-gray-100 relative">
                {/* 閉じるボタン */}
                <button
                    onClick={handleDismiss}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 shadow-sm z-10"
                    aria-label="広告を閉じる"
                    title="広告を閉じる"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="text-[10px] text-gray-400 text-center mb-1.5 tracking-wider select-none">
                    スポンサーリンク
                </div>
                <Adsense
                    client="ca-pub-4411270831448240"
                    slot="9407670747"
                    style={{ width: '100%', height: '250px' }}
                    isResponsive={false}
                />
            </div>
        </div>
    );
};