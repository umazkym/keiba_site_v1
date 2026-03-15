'use client';
import { usePathname } from 'next/navigation';
import { StickyAd } from './StickyAd';

/**
 * グローバル広告マネージャー
 * 
 * 広告収益最大化戦略:
 * 
 * 1. Google Auto Ads（アンカー広告・ビネット広告）
 *    → layout.tsx の adsbygoogle.js スクリプトが自動処理
 *    → カスタムAnchorAd/InterstitialAdは不要（Google ML最適化の方が効果的）
 * 
 * 2. 手動配置広告
 *    → 各ページコンポーネント内に AdUnit を配置（高価値ポジション）
 *    → StickyAd: デスクトップサイドバー追従広告
 * 
 * 3. 広告非表示ページ
 *    → /about, /contact, /privacy: ポリシー/個人情報系ページでは非表示
 */
export const GlobalAdManager = () => {
    try {
        const pathname = usePathname();

        // 広告を表示しないページ（ポリシー系・個人情報系）
        const noAdPages = [
            '/about',
            '/contact',
            '/privacy',
        ];

        const shouldShowAds = !noAdPages.some(path => pathname === path);

        if (!shouldShowAds) {
            return null;
        }

        // デスクトップサイドバー追従広告の表示条件
        // コンテンツが長いページ（レース詳細・記事詳細）で特に効果的
        const showStickyAd = pathname.startsWith('/races/') ||
            pathname.startsWith('/articles/') ||
            pathname === '/faq' ||
            pathname === '/' ||
            pathname === '/articles' ||
            pathname === '/about-ai';

        return (
            <>
                {/* デスクトップ: 右サイドバー追従広告（xl以上の画面幅で表示） */}
                {showStickyAd && <StickyAd />}
            </>
        );
    } catch (error) {
        // エラー時は何も表示しない（usePathname が null コンテキストで失敗した場合）
        console.debug('GlobalAdManager error:', error);
        return null;
    }
};