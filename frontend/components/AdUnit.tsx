'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { Adsense } from './Adsense';
import { sendAdImpressionEvent, type AdFormat } from '../lib/analytics';
import { isManualAdsEnabled, shouldSuppressAdsInDevelopment } from '@/lib/ad-config';
import { useAdViewableEvent } from '@/hooks/useAdViewableEvent';

/**
 * 広告ユニットの配置タイプ
 * - inline: コンテンツ内埋め込み（最も自然でCTR高）
 * - banner: セクション間バナー（視認性重視）
 * - sidebar: サイドバー用（デスクトップ向け）
 */
type AdPlacement = 'inline' | 'banner' | 'sidebar';

type AdUnitProps = {
    /** 広告スロットID */
    slot: string;
    /** 配置タイプ */
    placement?: AdPlacement;
    /** GA4計測用の詳細な広告位置名 */
    analyticsPlacement?: string;
    /** カスタムクラス名 */
    className?: string;
    /** 追加ラベルテキスト */
    label?: string;
    /** レース切替等で広告をリフレッシュしたい場合に変更する一意キー */
    refreshKey?: string;
    /** CLS対策としてページ側で広告枠の予約高を明示したい場合に指定 */
    minHeight?: string;
    /** 未配信時に枠を畳むか。CLSを抑えるため通常はfalseのまま使う */
    collapseUnfilled?: boolean;
    /** 初回読み込み時に広告リクエストを開始するビューポート外余白 */
    lazyRootMargin?: string;
    /** レース切替などの再読み込み時に即時リクエストを許可するビューポート外余白(px) */
    refreshRootMarginPx?: number;
};

const AD_CLIENT = 'ca-pub-4411270831448240';

const AD_FORMAT_BY_PLACEMENT: Record<AdPlacement, AdFormat> = {
    inline: 'display_inline',
    banner: 'display_banner',
    sidebar: 'display_sidebar',
};

/**
 * 統一広告ユニットコンポーネント
 * 
 * CLS（Cumulative Layout Shift）防止のためmin-heightを予約。
 * 配置タイプに応じた最適なサイズとスタイルを自動適用。
 * 開発環境ではプレースホルダーを表示。
 * 
 * 広告がロードされるまでラベルは非表示にし、
 * 未配信時も予約した高さを保ち、本文やカード位置を動かさない。
 * 
 * refreshKeyが変わると広告が完全リフレッシュされる。
 */
export const AdUnit = ({
    slot,
    placement = 'inline',
    analyticsPlacement,
    className = '',
    label = 'スポンサーリンク',
    refreshKey = '',
    minHeight,
    collapseUnfilled = false,
    lazyRootMargin,
    refreshRootMarginPx,
}: AdUnitProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adLoaded, setAdLoaded] = useState(false);
    const [adUnfilled, setAdUnfilled] = useState(false);

    // refreshKeyが変わったらステートをリセット
    useEffect(() => {
        setAdLoaded(false);
        setAdUnfilled(false);
    }, [refreshKey]);

    // MutationObserverで広告のロード完了を検知
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const applyAdStatus = () => {
            // ins要素にdata-ad-statusが設定されたらステータスを更新
            const ins = container.querySelector('ins.adsbygoogle');
            if (ins) {
                const status = ins.getAttribute('data-ad-status');
                if (status === 'filled') {
                    setAdLoaded(true);
                    setAdUnfilled(false);
                    sendAdImpressionEvent({
                        placement: analyticsPlacement ?? placement,
                        format: AD_FORMAT_BY_PLACEMENT[placement],
                        slot,
                    });
                    observer.disconnect();
                    return true;
                } else if (status?.startsWith('unfill')) {
                    setAdUnfilled(true);
                    setAdLoaded(false);
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
    }, [refreshKey, placement, analyticsPlacement, slot]); // refreshKey変更時にobserverも再設定

    // 配置タイプに応じたスタイル設定
    const placementStyles: Record<AdPlacement, {
        wrapperClass: string;
        contentClass: string;
        reserveClass: string;
        adStyle: React.CSSProperties;
    }> = {
        inline: {
            wrapperClass: 'my-1 sm:my-3 w-full',
            contentClass: 'flex flex-col items-center justify-center',
            reserveClass: 'ad-slot-reserve-inline',
            adStyle: { width: '100%' },
        },
        banner: {
            wrapperClass: 'my-2 sm:my-4 w-full',
            contentClass: 'flex flex-col items-center justify-center',
            reserveClass: 'ad-slot-reserve-banner',
            adStyle: { width: '100%' },
        },
        sidebar: {
            wrapperClass: 'mb-4 w-full',
            contentClass: '',
            reserveClass: 'ad-slot-reserve-sidebar',
            adStyle: { width: '100%' },
        },
    };

    const config = placementStyles[placement];
    const reservedMinHeight = minHeight;
    const effectiveLazyRootMargin = lazyRootMargin ?? (
        placement === 'sidebar'
            ? '500px 0px 500px 0px'
            : '720px 0px 720px 0px'
    );
    const effectiveRefreshRootMarginPx = refreshRootMarginPx ?? (
        placement === 'sidebar' ? 500 : 560
    );
    const adStyle = useMemo(
        () => ({
            ...placementStyles[placement].adStyle,
            ...(reservedMinHeight ? { minHeight: reservedMinHeight } : {}),
        }),
        [placement, reservedMinHeight]
    );

    // unfilledの場合も、原則として予約した高さは残してCLSを防ぐ。
    // どうしても畳みたい箇所だけ collapseUnfilled を明示する。
    const shouldCollapse = adUnfilled && collapseUnfilled;
    const spacerStyle = reservedMinHeight ? { minHeight: reservedMinHeight } : undefined;

    useAdViewableEvent({
        targetRef: containerRef,
        isFilled: adLoaded,
        refreshKey,
        ad: {
            placement: analyticsPlacement ?? placement,
            format: AD_FORMAT_BY_PLACEMENT[placement],
            slot,
        },
    });

    if (!isManualAdsEnabled || shouldSuppressAdsInDevelopment) return null;

    return (
        <div
            className={`ad-layout-wrapper relative ${collapseUnfilled ? 'ad-collapse-unfilled' : 'ad-preserve-space'} ${config.wrapperClass} ${className} ${shouldCollapse ? 'hidden m-0 p-0' : ''}`}
            data-ad-state={adLoaded ? 'filled' : adUnfilled ? 'unfilled' : 'loading'}
        >
            {/* Googleが広告DOMの祖先へmin-height:0を指定しても、通常フローのスペーサーで高さを維持する。 */}
            <div className={`ad-layout-spacer ${config.reserveClass}`} style={spacerStyle} aria-hidden="true" />
            <div
                className={`ad-slot-shell absolute inset-0 w-full ${config.contentClass} ${adUnfilled ? 'invisible pointer-events-none' : ''} ${!adLoaded ? 'pointer-events-none' : ''}`}
            >
                <div ref={containerRef} className="ad-unit-container relative h-full w-full">
                    {/* スクロール中の再描画負荷を抑えるため、広告待機面は静止表示にする。 */}
                    {!adLoaded && !adUnfilled && (
                        <div className="absolute inset-0 z-0 flex items-center justify-center rounded-lg bg-slate-50 pointer-events-none">
                            <span className="text-[10px] font-semibold tracking-wider text-slate-300">広告</span>
                        </div>
                    )}
                    <div className={`ad-highlight relative z-10 w-full ${!adLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 transition-opacity duration-500'}`}>
                        {/* 広告がロードされた場合のみラベルを表示 */}
                        {label && adLoaded && (
                            <div className="mb-1 select-none text-center text-[10px] tracking-wider text-gray-400">
                                {label}
                            </div>
                        )}
                        <Adsense
                            client={AD_CLIENT}
                            slot={slot}
                            refreshKey={refreshKey}
                            style={adStyle}
                            isResponsive={true}
                            lazyRootMargin={effectiveLazyRootMargin}
                            refreshRootMarginPx={effectiveRefreshRootMarginPx}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
