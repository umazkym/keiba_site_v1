// frontend/components/StickyAd.tsx
'use client';

import { Adsense } from './Adsense';
import { useEffect, useState } from 'react';

export const StickyAd = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // 300px以上スクロールしたら表示
            setIsVisible(window.scrollY > 300);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // モバイルデバイスでは表示しない
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        return null;
    }

    return (
        <div 
            className={`hidden xl:block fixed right-4 top-24 w-[300px] transition-opacity duration-500 ${
                isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ zIndex: 30 }}
        >
            <div className="sticky top-24 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
                <div className="text-xs text-gray-500 text-center mb-1">スポンサーリンク</div>
                <Adsense
                    client="ca-pub-4411270831448240"
                    slot="9407670747"
                    style={{ width: '100%', height: '600px' }}
                    isResponsive={false}
                />
            </div>
        </div>
    );
};