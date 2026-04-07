'use client';

import { useState, useEffect, useRef } from 'react';
import { Adsense } from './Adsense';
import { usePathname } from 'next/navigation';
import { sendAdImpressionEvent } from '../lib/analytics';

/**
 * モバイル専用・下部固定の追従広告（アンカー広告の代替）
 * 
 * AdSense自動アンカー広告の巨大化リスクを防止するための自社実装コンポーネント。
 * xlブレイクポイント未満（モバイル・タブレット）でのみ表示。
 * 
 * ★変更点: AdSense側から広告が返ってこない(unfilled)場合、
 * 空の枠だけが表示されてしまうのを出さないようにステータスを監視します。
 */
export const MobileStickyAd = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [adStatus, setAdStatus] = useState<'loading' | 'filled' | 'unfilled'>('loading');
    const [hasScrolled, setHasScrolled] = useState(false);
    const pathname = usePathname();
    const containerRef = useRef<HTMLDivElement>(null);

    // 広告を表示しないページガード
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
    }, []);

    // ★ ビューアビリティ改善: 300px以上スクロールしてから表示（ファーストビュー保護）
    useEffect(() => {
        if (!isMounted) return;
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setHasScrolled(true);
                window.removeEventListener('scroll', handleScroll);
            }
        };
        // 初期チェック
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMounted]);;

    // パス変更（レース切替など）でリフレッシュする際、ステータスを戻す
    useEffect(() => {
        setAdStatus('loading');
    }, [pathname]);

    // MutationObserverで広告のロード完了/空振り(unfilled)を検知
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new MutationObserver(() => {
            const ins = container.querySelector('ins.adsbygoogle');
            if (ins) {
                const status = ins.getAttribute('data-ad-status');
                if (status === 'filled') {
                    setAdStatus('filled');
                    sendAdImpressionEvent('sticky_bottom');
                    observer.disconnect();
                } else if (status === 'unfilled') {
                    setAdStatus('unfilled');
                    observer.disconnect();
                }
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-ad-status'],
        });

        return () => observer.disconnect();
    }, [pathname]);

    const handleDismiss = () => {
        setIsDismissed(true);
    };

    // SSR時、非表示ページ、閉じた後、または「枠が空(unfilled)」と確定した場合は完全にDOMから消す（裏に隠れていたコンテンツを被せないため）
    if (!isMounted || !shouldShowAds || isDismissed || adStatus === 'unfilled' || !hasScrolled) return null;

    // loading中は「見えない」がDOMには存在する（AdSenseに表示領域を計測させるため必須）
    // filledになったらスーッと下から現れる
    const isVisible = adStatus === 'filled';

    return (
        <div 
            ref={containerRef}
            className={`xl:hidden fixed bottom-0 left-0 right-0 w-full z-50 transition-all duration-500 transform shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[120px] opacity-0 pointer-events-none'
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
            <div className={`relative bg-white/95 backdrop-blur-sm border-t border-slate-200 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
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
                  * 広告コンテナの高さ制限
                  * overflow-hidden によりはみ出し部分をカット
                  */}
                <div className="w-full flex justify-center items-center overflow-hidden max-h-[80px] min-h-[50px] bg-slate-50 relative">
                    <div className="absolute top-1 left-2 text-[10px] text-gray-400 font-sans tracking-widest bg-white/80 px-1 rounded z-10 pointer-events-none">広告</div>
                    <Adsense
                        client="ca-pub-4411270831448240"
                        slot="8529703346" 
                        refreshKey={`mobile-sticky-${pathname}`}
                        // ★ 70pxに拡大: 320x100や300x50フォーマットも配信対象にし、eCPM・viewable率を向上
                        // データ根拠: Active View 27-45% → max-h拡大でviewable閾値（50%面積+1秒）を満たしやすくする
                        style={{ display: 'inline-block', width: '100%', height: '70px' }}
                        isResponsive={false}
                    />
                </div>
            </div>
        </div>
    );
};
