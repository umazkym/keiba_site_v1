'use client';

import { usePathname } from 'next/navigation';
import { Adsense } from './Adsense';
import { AnchorAd } from './AnchorAd';

export const GlobalAdManager = () => {
    const pathname = usePathname();
    const adClient = "ca-pub-4411270831448240";

    // 広告を表示したくないページのパスリスト
    const noAdPages = ['/about', '/contact', '/privacy'];

    // 現在のパスが広告を表示しないページリストに含まれているかチェック
    const shouldShowAds = !noAdPages.some(path => pathname === path);

    // 広告を表示すべきでない場合は何もレンダリングしない
    if (!shouldShowAds) {
        return null;
    }

    return (
        <>
            {/* ヘッダー下広告 */}
            <div className="container py-4">
                <div className="adsense-wrapper" role="complementary" aria-label="広告">
                    <Adsense
                        client={adClient}
                        slot="8529703346" // ヘッダー下用の広告スロットID
                        style={{ width: "100%", height: "90px" }}
                    />
                </div>
            </div>
            {/* アンカー広告 */}
            <AnchorAd />
        </>
    );
};