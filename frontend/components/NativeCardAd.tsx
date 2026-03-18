'use client';

import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * ネイティブカード広告
 * 
 * 記事カード・コンテンツカードと完全に同じスタイリングで広告を表示。
 * Google AdSenseのインフィード広告フォーマットを使用し、
 * 周囲のカードに自然に溶け込ませることでCTRを最大化する。
 * 
 * AdSenseポリシー準拠: Google側が自動で「広告」ラベルを付与するため、
 * 視覚的に馴染みつつもポリシー違反にならない。
 */

type NativeCardAdProps = {
    slot: string;
    refreshKey?: string;
    /** カードのスタイルパターン */
    variant: 'article' | 'pick' | 'venue';
    className?: string;
};

export const NativeCardAd = ({ slot, refreshKey = '', variant = 'article', className = '' }: NativeCardAdProps) => {
    // バリアントに応じたスタイル
    const variantStyles: Record<string, { container: string; height: string }> = {
        // 記事カードに擬態: .article-card と同じ border/radius/shadow
        article: {
            container: 'flex items-center border border-border rounded-xl overflow-hidden bg-white transition-all duration-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]',
            height: '90px', // 記事カードと同等の高さ
        },
        // 注目馬カードに擬態: .pick-card と同じスタイル
        pick: {
            container: 'relative border border-border rounded-xl overflow-hidden bg-white transition-all duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]',
            height: '120px',
        },
        // 競馬場リンクに擬態: .venue-link と同じスタイル
        venue: {
            container: 'bg-white border border-border rounded-xl overflow-hidden transition-all duration-200',
            height: '100px',
        },
    };

    const style = variantStyles[variant] || variantStyles.article;

    return (
        <div className={`${style.container} ${className}`}>
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
