'use client';
import { usePathname } from 'next/navigation';
import { Adsense } from './Adsense';
import { AnchorAd } from './AnchorAd';
import { StickyAd } from './StickyAd';
import { InterstitialAd } from './InterstitialAd';

export const GlobalAdManager = () => {
    const pathname = usePathname();
    const adClient = "ca-pub-4411270831448240";
    
    const noAdPages = [
        '/about', 
        '/contact', 
        '/privacy',
    ];
    
    const shouldShowAds = !noAdPages.some(path => pathname === path);
    const isTopPage = pathname === '/';
    const isRacePage = pathname.startsWith('/races/');
    
    if (!shouldShowAds) {
        return null;
    }
    
    return (
        <>
            {/* トップページ: ヘッダー下に目立つ広告 */}
            {isTopPage && (
                <div className="container py-4">
                    <div className="ad-highlight max-w-4xl mx-auto">
                        <Adsense
                            client={adClient}
                            slot="8529703346"
                            style={{ width: "100%", height: "120px" }}
                        />
                    </div>
                </div>
            )}
            
            {/* レースページ: コンテンツの上部に広告 */}
            {isRacePage && (
                <>
                    <div className="container py-3">
                        <div className="ad-highlight max-w-4xl mx-auto">
                            <Adsense
                                client={adClient}
                                slot="8529703346"
                                style={{ width: "100%", height: "90px" }}
                            />
                        </div>
                    </div>
                    {/* スティッキーサイドバー広告 */}
                    <StickyAd />
                </>
            )}
            
            {/* アンカー広告: 全ページ共通 */}
            {shouldShowAds && <AnchorAd />}
            
            {/* インタースティシャル広告: レースページのみ */}
            {isRacePage && <InterstitialAd />}
        </>
    );
};