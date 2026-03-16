'use client';

import { useState, useEffect } from 'react';
import { Adsense } from './Adsense';
import { usePathname } from 'next/navigation';

/**
 * モバイル専用・下部固定の追従広告（アンカー広告の代替）
 * 
 * AdSense自動アンカー広告の巨大化リスク（画面半分を覆うUX破壊）を防止するため、
 * 高さを物理的にCSSレベルで強制制限（max-h-[100px]）した安全な自社実装コンポーネント。
 * xlブレイクポイント未満（モバイル・タブレット）でのみ表示。
 */
export const MobileStickyAd = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const pathname = usePathname();

    // 広告を表示しないページ（ポリシー系・個人情報系）
    // GlobalAdManagerでも制御しているが念のためのガード
    const noAdPages = [
        '/about',
        '/contact',
        '/privacy',
        '/terms',
        '/advertising',
    ];
    const shouldShowAds = !noAdPages.some(path => pathname === path);

    useEffect(() => {
        setIsMounted(true);
        // FIXME: セッションストレージ等で閉じた状態を維持する処理を将来追加しても良い
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
    };

    // SSR時、非表示ページ、またはユーザーが閉じた場合はレンダリングしない
    if (!isMounted || !shouldShowAds || isDismissed) return null;

    return (
        <div 
            className="xl:hidden fixed bottom-0 left-0 right-0 w-full z-50 transition-transform duration-300 transform translate-y-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
            // セーフエリア（iPhoneのホームインジケータなど）への対応
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
            <div className="relative bg-white/95 backdrop-blur-sm border-t border-slate-200">
                {/* 閉じるボタン（絶対に配置し、UXを担保） */}
                <button
                    onClick={handleDismiss}
                    className="absolute -top-7 right-0 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-tl-lg border-t border-l border-slate-200 shadow-sm z-10 transition-colors"
                    aria-label="広告を閉じる"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* 
                  * 【超重要】広告コンテナの高さ制限
                  * AdSenseが巨大なバナーを挿入しようとしても、ここではね除ける
                  * overflow-hidden によりはみ出し部分をカット
                  */}
                <div className="w-full flex justify-center items-center overflow-hidden max-h-[100px] min-h-[50px] bg-slate-50 relative">
                    <div className="absolute top-1 left-2 text-[10px] text-gray-400 font-sans tracking-widest bg-white/80 px-1 rounded z-10 pointer-events-none">広告</div>
                    <Adsense
                        client="ca-pub-4411270831448240"
                        slot="8529703346" // モバイルアンカーにふさわしい既存のslot ID（必要に応じて差し替え）
                        refreshKey={`mobile-sticky-${pathname}`}
                        style={{ width: '100vw', height: '100%' }}
                        isResponsive={true}
                    />
                </div>
            </div>
        </div>
    );
};
