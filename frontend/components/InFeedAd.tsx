'use client';

import { useEffect, useRef, useState } from 'react';
import { Adsense } from './Adsense';
import { sendAdImpressionEvent } from '@/lib/analytics';

type InFeedAdProps = {
    /** 広告スロットID（省略時はインフィード専用スロットを使用） */
    slot?: string;
    /** レース切替等でリフレッシュするためのキー */
    refreshKey?: string;
    /** GA4計測用の詳細な広告位置名 */
    analyticsPlacement?: string;
    /** カードデザインに合わせるための追加CSSクラス */
    className?: string;
};

const AD_CLIENT = 'ca-pub-4411270831448240';
// ★ AdSenseで新規作成した「インフィード」形式の専用スロット
const INFEED_SLOT = '7367648888';
const INFEED_LAYOUT_KEY = '-g0+4h+46-dp+9m';

/**
 * インフィード広告専用コンポーネント
 * 
 * ★ 重要な変更: ディスプレイ形式スロット → インフィード形式スロットに移行
 * 
 * AdSense管理画面で「インフィード広告」として作成したスロットを使用。
 * data-ad-format="fluid" + data-ad-layout-key により、
 * Googleがコンテンツカードに溶け込むネイティブ広告を配信する。
 * 
 * AdSenseの注意: コンテナの高さは固定してはいけない（fluid形式の要件）。
 * → 旧実装の height: 280px 固定を削除し、display: block に変更。
 */
export const InFeedAd = ({
    slot,
    refreshKey = '',
    analyticsPlacement = 'infeed',
    className = '',
}: InFeedAdProps) => {
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
                    format: 'in_feed',
                    slot: slot || INFEED_SLOT,
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
    }, [refreshKey, analyticsPlacement, slot]);

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden rounded-xl border-l-[3px] border-l-blue-200 border border-y-slate-200 border-r-slate-200 shadow-sm relative w-full bg-slate-50 p-1.5 sm:p-3 mt-2 mb-2 ${adUnfilled ? 'invisible pointer-events-none' : ''} ${className}`}
            style={{ minHeight: '180px' }}
            aria-hidden={adUnfilled ? true : undefined}
        >

            {/* 広告ラベル: コンテンツとの誤認を防ぐための表示 */}
            <div className="absolute top-0 right-0 max-w-fit px-2 py-0.5 rounded-bl text-[9px] text-slate-400 font-medium tracking-wider bg-slate-100/80 z-10 pointer-events-none">
                広告
            </div>

            {/* 
              * ★ インフィード形式: fluid + layoutKey
              * 高さ固定なし（AdSenseの要件: コンテナの高さは変更可能でなければならない）
              * Googleがサイトデザインに合った広告を自動配信
              */}
            <Adsense
                client={AD_CLIENT}
                slot={slot || INFEED_SLOT}
                refreshKey={refreshKey}
                style={{ display: 'block', minHeight: '160px' }}
                format="fluid"
                layoutKey={INFEED_LAYOUT_KEY}
                isResponsive={false}
            />
        </div>
    );
};
