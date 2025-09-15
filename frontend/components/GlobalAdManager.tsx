'use client';
import { usePathname } from 'next/navigation';
import { Adsense } from './Adsense';
// import { AnchorAd } from './AnchorAd'; // 審査通過まで無効化
// import { StickyAd } from './StickyAd'; // 審査通過まで無効化
// import { InterstitialAd } from './InterstitialAd'; // 審査通過まで無効化

export const GlobalAdManager = () => {
    const pathname = usePathname();
    const adClient = "ca-pub-4411270831448240";
    
    const noAdPages = [
        '/about', 
        '/contact', 
        '/privacy',
    ];
    
    const shouldShowAds = !noAdPages.some(path => pathname === path);
    
    if (!shouldShowAds) {
        return null;
    }
    
    // ==============================================================================
    // ▼▼▼▼▼【ここから修正】▼▼▼▼▼
    //
    // AdSense審査中は、Googleの自動広告に任せるのが最も安全です。
    // そのため、手動での広告配置コンポーネントは一旦すべてコメントアウトします。
    // layout.tsxで読み込んでいるAdSenseスクリプトが自動的に最適な場所に広告を表示してくれます。
    //
    // ==============================================================================

    return (
        <>
            {/* 現在のコードでは、トップページやレースページに手動で広告を配置する
                ロジックが組まれていますが、審査中はこれらを一旦停止します。
                審査に通過し、PV数が増えてきたら、これらの広告を段階的に復活させて
                効果を測定していくのが王道の戦略です。

                <AnchorAd />
                <StickyAd />
                <InterstitialAd />
            */}
        </>
    );
};