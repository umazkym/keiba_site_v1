'use client';

import { usePathname } from 'next/navigation';
import { AdUnit } from './AdUnit';

/**
 * フッター直前の全ページ共通広告
 * 
 * ページ最下部までスクロールしたユーザーに追加インプレッションを提供。
 * ポリシー系ページ（/about, /contact, /privacy）では非表示。
 */
export const FooterAd = () => {
    try {
        const pathname = usePathname();

        // 広告を表示しないページ（ポリシー系・個人情報系）
        const noAdPages = [
            '/about',
            '/contact',
            '/privacy',
        ];

        const shouldShow = !noAdPages.some(path => pathname === path);

        if (!shouldShow) return null;

        return (
            <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 pb-4">
                <AdUnit
                    slot="9407670747"
                    placement="banner"
                    label="スポンサーリンク"
                />
            </div>
        );
    } catch {
        return null;
    }
};
