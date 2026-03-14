// frontend/components/StickyAd.tsx
'use client';

import { Adsense } from './Adsense';
import { useEffect, useState } from 'react';

/**
 * デスクトップ右サイドバー追従広告
 * 
 * - xl (1280px) 以上の画面幅でのみ表示
 * - 200px以上スクロールしたら表示（ファーストビュー保護）
 * - 300x250（ミディアムレクタングル）サイズ: 最もCTRが高い広告サイズ
 * - コンテンツの読み進めと並行して常に視界に入る位置
 */
export const StickyAd = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const handleScroll = () => {
            setIsVisible(window.scrollY > 200);
        };

        // 初期チェック
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMounted]);

    // SSR & モバイルでは表示しない
    if (!isMounted) return null;

    return (
        <div
            className={`hidden xl:block fixed right-4 top-24 w-[300px] transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
            }`}
            style={{ zIndex: 30 }}
        >
            <div className="sticky top-24 bg-white rounded-xl shadow-lg p-3 border border-gray-100">
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