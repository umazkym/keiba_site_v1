'use client';

import { Adsense } from './Adsense';

export const AnchorAd = () => {
    // 本番環境以外では広告を表示しない
    if (process.env.NODE_ENV !== 'production') {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-sm z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
            <div className="container mx-auto p-1 flex justify-center">
                {/* このスタイルはGoogle AdSenseのアンカー広告の一般的なサイズです */}
                <Adsense
                    client="ca-pub-4411270831448240"
                    slot="9407670747" // ★★★ ここを修正 ★★★
                    style={{ width: '320px', height: '50px' }}
                    className="adsbygoogle"
                    isResponsive={false}
                />
            </div>
        </div>
    );
};