'use client';

import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Adsense } from './Adsense';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendAdImpressionEvent } from '../lib/analytics';
import { isManualAdsEnabled, shouldSuppressAdsInDevelopment } from '@/lib/ad-config';

type StickyVariant = 'control' | 'delayed' | 'compact';

const STICKY_VARIANT_KEY = 'mobile_sticky_ad_variant_v2';
const RACE_PAGE_STICKY_SCROLL_THRESHOLD = 520;

const stickyVariantConfig: Record<StickyVariant, {
    scrollThreshold: number;
    height: number;
    minHeight: number;
    maxHeight: number;
    placement: string;
}> = {
    control: {
        scrollThreshold: 500,
        height: 70,
        minHeight: 50,
        maxHeight: 80,
        placement: 'sticky_bottom_control',
    },
    delayed: {
        scrollThreshold: 900,
        height: 70,
        minHeight: 50,
        maxHeight: 80,
        placement: 'sticky_bottom_delayed',
    },
    compact: {
        scrollThreshold: 650,
        height: 56,
        minHeight: 48,
        maxHeight: 64,
        placement: 'sticky_bottom_compact',
    },
};

const resolveStickyVariant = (): StickyVariant => {
    if (typeof window === 'undefined') return 'control';

    try {
        const stored = window.localStorage.getItem(STICKY_VARIANT_KEY);
        if (stored === 'control' || stored === 'delayed' || stored === 'compact') {
            return stored;
        }

        const bucket = Math.floor(Math.random() * 3);
        const next: StickyVariant = bucket === 0 ? 'control' : bucket === 1 ? 'delayed' : 'compact';
        window.localStorage.setItem(STICKY_VARIANT_KEY, next);
        return next;
    } catch {
        return 'control';
    }
};

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
    const [variant, setVariant] = useState<StickyVariant>('control');
    const pathname = usePathname();
    // ★ レース切替リフレッシュ対応: searchParamsのraceを取得
    // pathnameはレース切替（?race=3&venue=東京）で変化しないため、
    // 追従広告が同じ広告を表示し続けてバナーブラインドネスを引き起こしていた
    const searchParams = useSearchParams();
    const raceParam = searchParams.get('race') || '';
    const containerRef = useRef<HTMLDivElement>(null);
    const isRacePage = pathname.startsWith('/races/');
    const variantConfig = useMemo(() => {
        const baseConfig = stickyVariantConfig[variant];
        if (!isRacePage) return baseConfig;

        return {
            ...stickyVariantConfig.compact,
            // 6/12-13の実績ではオファーウォール停止中にアンカー相当枠の表示回数が不足したため、
            // レース閲覧を邪魔しない範囲で表示開始を早める。
            scrollThreshold: RACE_PAGE_STICKY_SCROLL_THRESHOLD,
            placement: 'sticky_bottom_race_compact_balanced',
        };
    }, [isRacePage, variant]);
    const analyticsVariant = isRacePage ? `${variant}_race_compact_balanced` : variant;
    const stickyAdStyle = useMemo<CSSProperties>(
        () => ({ display: 'inline-block', width: '100%', height: `${variantConfig.height}px` }),
        [variantConfig.height]
    );

    // 広告を表示しないページガード
    const noAdPages = [
        '/about',
        '/contact',
        '/privacy',
        '/terms',
        '/advertising',
    ];
    const shouldShowAds =
        isManualAdsEnabled &&
        !shouldSuppressAdsInDevelopment &&
        !noAdPages.some(path => pathname === path);

    useEffect(() => {
        setIsMounted(true);
        setVariant(resolveStickyVariant());
    }, []);

    // モバイル広告A/B:
    // control=500px表示、delayed=900px表示、compact=650px表示かつ低めの枠。
    // variantはlocalStorageに保存し、同一ユーザーでは比較条件を固定する。
    useEffect(() => {
        if (!isMounted) return;
        const handleScroll = () => {
            if (window.scrollY > variantConfig.scrollThreshold) {
                setHasScrolled(true);
                window.removeEventListener('scroll', handleScroll);
            }
        };
        // 初期チェック
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMounted, variantConfig.scrollThreshold, pathname, raceParam]);

    // パス変更・レース切替でリフレッシュする際、ステータスを戻す
    // ★ raceParam追加: pathname + raceParam両方の変化に反応
    useEffect(() => {
        setAdStatus('loading');
        setHasScrolled(false);
    }, [pathname, raceParam]);

    // MutationObserverで広告のロード完了/空振り(unfilled)を検知
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applyAdStatus = () => {
            const ins = container.querySelector('ins.adsbygoogle');
            if (ins) {
                const status = ins.getAttribute('data-ad-status');
                if (status === 'filled') {
                    setAdStatus('filled');
                    sendAdImpressionEvent({
                        placement: variantConfig.placement,
                        format: 'sticky_bottom',
                        slot: '8529703346',
                        variant: analyticsVariant,
                    });
                    observer.disconnect();
                    return true;
                } else if (status?.startsWith('unfill')) {
                    setAdStatus('unfilled');
                    observer.disconnect();
                    return true;
                }
            }
            return false;
        };

        const observer = new MutationObserver(() => {
            applyAdStatus();
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-ad-status'],
        });

        applyAdStatus();
        const statusTimer = window.setTimeout(applyAdStatus, 1000);

        return () => {
            window.clearTimeout(statusTimer);
            observer.disconnect();
        };
    }, [pathname, raceParam, variantConfig.placement, analyticsVariant]);  // ★ raceParam追加: レース切替時もMutationObserverを再作成

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
            data-ad-variant={analyticsVariant}
            className={`xl:hidden fixed bottom-0 left-0 right-0 w-full z-50 transition-all duration-500 transform shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[120px] opacity-0 pointer-events-none'
            }`}
            style={{
                bottom: isRacePage ? 'calc(env(safe-area-inset-bottom, 0px) + 56px)' : 0,
                paddingBottom: isRacePage ? 0 : 'env(safe-area-inset-bottom, 0)',
            }}
        >
            <div className={`relative bg-white/95 backdrop-blur-sm border-t border-slate-200 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                {/* 閉じるボタン（絶対に配置し、UXを担保） */}
                <button
                    onClick={handleDismiss}
                    className="absolute -top-9 right-0 flex h-9 w-9 items-center justify-center rounded-tl-lg border-l border-t border-slate-200 bg-white/95 text-slate-500 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-700"
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
                <div
                    className="relative flex w-full items-center justify-center overflow-hidden bg-slate-50"
                    style={{
                        maxHeight: `${variantConfig.maxHeight}px`,
                        minHeight: `${variantConfig.minHeight}px`,
                    }}
                >
                    <div className="absolute top-1 left-2 text-[10px] text-gray-400 font-sans tracking-widest bg-white/80 px-1 rounded z-10 pointer-events-none">広告</div>
                    <Adsense
                        client="ca-pub-4411270831448240"
                        slot="8529703346" 
                        refreshKey={`mobile-sticky-${pathname}-${raceParam}`}
                        style={stickyAdStyle}
                        isResponsive={false}
                        lazyRootMargin="0px 0px 0px 0px"
                        refreshRootMarginPx={0}
                    />
                </div>
            </div>
        </div>
    );
};
