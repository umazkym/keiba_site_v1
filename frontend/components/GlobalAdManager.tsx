'use client';
import { usePathname } from 'next/navigation';
import { MobileStickyAd } from './MobileStickyAd';

/**
 * グローバル広告マネージャー
 * 
 * 広告収益最大化戦略:
 * 
 * 1. Google Auto Ads（全画面広告のみON）
 *    → layout.tsx の adsbygoogle.js スクリプトが自動処理
 * 
 * 2. 手動配置広告
 *    → 各ページコンポーネント内に AdUnit を配置（高価値ポジション）
 *    → MobileStickyAd: モバイル下部追従広告
 * 
 * 3. 広告非表示ページ
 *    → /about, /contact, /privacy, /terms, /advertising: ポリシー/個人情報系ページ
 */
export const GlobalAdManager = () => {
    try {
        const pathname = usePathname();

        // 広告を表示しないページ（ポリシー系・個人情報系）
        const noAdPages = [
            '/about',
            '/contact',
            '/privacy',
            '/terms',
            '/advertising',
        ];

        const shouldShowAds = !noAdPages.some(path => pathname === path);

        if (!shouldShowAds) {
            return null;
        }

        return (
            <>
                {/* モバイル用下部追従広告（PCなど広い画面ではコンポーネント側で制御/非表示） */}
                <MobileStickyAd />
            </>
        );
    } catch (error) {
        // エラー時は何も表示しない（usePathname が null コンテキストで失敗した場合）
        console.debug('GlobalAdManager error:', error);
        return null;
    }
};