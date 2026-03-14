'use client';

import { Adsense } from './Adsense';

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
};

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * 統一広告ユニットコンポーネント
 * 
 * CLS（Cumulative Layout Shift）防止のためmin-heightを予約。
 * 配置タイプに応じた最適なサイズとスタイルを自動適用。
 * 開発環境ではプレースホルダーを表示。
 */
export const AdUnit = ({
    slot,
    placement = 'inline',
    className = '',
    label = 'スポンサーリンク',
}: AdUnitProps) => {
    // 配置タイプに応じたスタイル設定
    const placementStyles: Record<AdPlacement, {
        containerClass: string;
        minHeight: string;
        adStyle: React.CSSProperties;
    }> = {
        inline: {
            containerClass: 'my-5 sm:my-6 bg-slate-50/50 border border-slate-100/80 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center',
            minHeight: '100px',
            adStyle: { width: '100%', minHeight: '100px' },
        },
        banner: {
            containerClass: 'my-6 sm:my-8 bg-slate-50/80 border border-slate-100 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-center justify-center',
            minHeight: '120px',
            adStyle: { width: '100%', minHeight: '120px' },
        },
        sidebar: {
            containerClass: 'mb-4',
            minHeight: '250px',
            adStyle: { width: '100%', minHeight: '250px' },
        },
    };

    const config = placementStyles[placement];

    return (
        <div
            className={`ad-unit-container ${config.containerClass} ${className}`}
            style={{ minHeight: config.minHeight }}
        >
            <div className="ad-highlight">
                {label && (
                    <div className="text-[10px] text-gray-400 text-center mb-1 tracking-wider select-none">
                        {label}
                    </div>
                )}
                <Adsense
                    client={AD_CLIENT}
                    slot={slot}
                    style={config.adStyle}
                    isResponsive={true}
                />
            </div>
        </div>
    );
};
