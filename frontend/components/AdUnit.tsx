'use client';

import { useRef, useState, useEffect } from 'react';
import { Adsense } from './Adsense';
import { SkeletonBox as SkeletonLoader } from './SkeletonLoader';
import { sendAdImpressionEvent } from '../lib/analytics';

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
    /** カスタムクラス名 */
    className?: string;
    /** 追加ラベルテキスト */
    label?: string;
    /** レース切替等で広告をリフレッシュしたい場合に変更する一意キー */
    refreshKey?: string;
};

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * 統一広告ユニットコンポーネント
 * 
 * CLS（Cumulative Layout Shift）防止のためmin-heightを予約。
 * 配置タイプに応じた最適なサイズとスタイルを自動適用。
 * 開発環境ではプレースホルダーを表示。
 * 
 * 広告がロードされるまでラベルは非表示にし、
 * unfilled時にはコンテナごと折りたたまれる（CSS側で制御）。
 * 
 * refreshKeyが変わると広告が完全リフレッシュされる。
 */
export const AdUnit = ({
    slot,
    placement = 'inline',
    className = '',
    label = 'スポンサーリンク',
    refreshKey = '',
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

        const observer = new MutationObserver(() => {
            // ins要素にdata-ad-statusが設定されたらステータスを更新
            const ins = container.querySelector('ins.adsbygoogle');
            if (ins) {
                const status = ins.getAttribute('data-ad-status');
                if (status === 'filled') {
                    setAdLoaded(true);
                    setAdUnfilled(false);
                    // ★ 深層分析による改善: インフィード広告等の表示もGA4へ送る
                    sendAdImpressionEvent(placement);
                    observer.disconnect();
                } else if (status === 'unfilled') {
                    setAdUnfilled(true);
                    setAdLoaded(false);
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
    }, [refreshKey]); // refreshKey変更時にobserverも再設定

    // 配置タイプに応じたスタイル設定
    const placementStyles: Record<AdPlacement, {
        containerClass: string;
        minHeight: string;
        adStyle: React.CSSProperties;
    }> = {
        inline: {
            containerClass: 'my-1 sm:my-3 flex flex-col items-center justify-center w-full',
            // ★ Viewability改善: 0→90pxに変更
            // 広告がビューポートに十分な面積を確保し、Active View viewable判定の閾値（50%表示 + 1秒）を満たしやすくする
            // AdSenseデータ: viewability 35.17% → 50%目標
            minHeight: '90px',
            adStyle: { width: '100%' },
        },
        banner: {
            containerClass: 'my-2 sm:my-4 flex flex-col items-center justify-center w-full',
            minHeight: '80px',
            adStyle: { width: '100%', minHeight: '80px' },
        },
        sidebar: {
            containerClass: 'mb-4 w-full',
            minHeight: '200px',
            adStyle: { width: '100%', minHeight: '200px' },
        },
    };

    const config = placementStyles[placement];

    // unfilledの場合はCSSのminHeightを外し、非表示にする
    const containerStyle = adUnfilled ? { display: 'none' } : { minHeight: config.minHeight };

    return (
        <div
            ref={containerRef}
            className={`ad-unit-container ${config.containerClass} ${className} ${adUnfilled ? 'hidden m-0 p-0' : ''} relative`}
            style={containerStyle}
        >
            {/* 広告未ロード時（リフレッシュ中含む）はスケルトンを表示して視線を繋ぎ止める */}
            {!adLoaded && !adUnfilled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 rounded-xl z-0">
                    <SkeletonLoader className="w-[90%] h-[80%] rounded-lg opacity-50" />
                </div>
            )}
            <div className={`ad-highlight w-full z-10 relative ${!adLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
                {/* 広告がロードされた場合のみラベルを表示 */}
                {label && adLoaded && (
                    <div className="text-[10px] text-gray-400 text-center mb-1 tracking-wider select-none">
                        {label}
                    </div>
                )}
                <Adsense
                    client={AD_CLIENT}
                    slot={slot}
                    refreshKey={refreshKey}
                    style={config.adStyle}
                    isResponsive={true}
                />
            </div>
        </div>
    );
};
