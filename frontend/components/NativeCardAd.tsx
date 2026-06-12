'use client';

import { useEffect, useRef, useState } from 'react';
import { Adsense } from './Adsense';
import { sendAdImpressionEvent } from '@/lib/analytics';
import { isManualAdsEnabled } from '@/lib/ad-config';

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * ネイティブカード広告
 * 
 * 記事カード・コンテンツカードの流れに合わせて広告を表示。
 * Google AdSenseのインフィード広告フォーマットを使用し、
 * 周囲のカードに自然に馴染ませつつ、明示ラベルでコンテンツと区別する。
 */

type NativeCardAdProps = {
    slot: string;
    refreshKey?: string;
    /** カードのスタイルパターン */
    variant: 'article' | 'pick' | 'venue';
    className?: string;
    analyticsPlacement?: string;
};

export const NativeCardAd = ({ slot, refreshKey = '', variant = 'article', className = '', analyticsPlacement = 'native_card' }: NativeCardAdProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adUnfilled, setAdUnfilled] = useState(false);

    useEffect(() => {
        setAdUnfilled(false);
    }, [refreshKey]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;

        const container = containerRef.current;
        if (!container) return;

        const applyAdStatus = () => {
            const ins = container.querySelector('ins.adsbygoogle');
            if (!ins) return false;

            const status = ins.getAttribute('data-ad-status');
            if (status === 'filled') {
                sendAdImpressionEvent({
                    placement: analyticsPlacement,
                    format: 'native_card',
                    slot,
                    variant,
                });
                observer.disconnect();
                return true;
            } else if (status?.startsWith('unfill')) {
                setAdUnfilled(true);
                observer.disconnect();
                return true;
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
    }, [refreshKey, analyticsPlacement, slot, variant]);

    // バリアントに応じたスタイル
    const variantStyles: Record<string, { container: string; height: string }> = {
        article: {
            container: 'relative flex items-center border border-border rounded-xl overflow-hidden bg-white transition-all duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]',
            height: '76px', // モバイルの記事カードに合わせて控えめに確保
        },
        pick: {
            container: 'relative border border-border rounded-xl overflow-hidden bg-white transition-all duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]',
            height: '120px',
        },
        venue: {
            container: 'relative bg-white border border-border rounded-xl overflow-hidden transition-all duration-200',
            height: '100px',
        },
    };

    const style = variantStyles[variant] || variantStyles.article;

    if (!isManualAdsEnabled) return null;

    return (
        <div
            ref={containerRef}
            className={`${style.container} ${className} ${adUnfilled ? 'invisible pointer-events-none' : ''}`}
            style={{ minHeight: style.height }}
            aria-hidden={adUnfilled ? true : undefined}
        >
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-white/85 text-[9px] text-slate-400 font-medium z-10 pointer-events-none">
                広告
            </div>
            <Adsense
                client={AD_CLIENT}
                slot={slot}
                refreshKey={refreshKey}
                style={{ display: 'inline-block', width: '100%', height: style.height }}
                isResponsive={false}
            />
        </div>
    );
};
