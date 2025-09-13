// frontend/components/InterstitialAd.tsx
'use client';

import { useState, useEffect } from 'react';
import { Adsense } from './Adsense';

export const InterstitialAd = () => {
    const [showAd, setShowAd] = useState(false);
    const [hasShown, setHasShown] = useState(false);

    useEffect(() => {
        // セッションストレージでこのセッションで既に表示したかチェック
        const shown = sessionStorage.getItem('interstitialShown');
        if (shown) {
            setHasShown(true);
            return;
        }

        const handleScroll = () => {
            // ページの50%以上スクロールしたら表示
            const scrollPercentage = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
            
            if (scrollPercentage > 50 && !hasShown) {
                setShowAd(true);
                setHasShown(true);
                sessionStorage.setItem('interstitialShown', 'true');
                window.removeEventListener('scroll', handleScroll);
            }
        };

        // 30秒経過後にも表示
        const timer = setTimeout(() => {
            if (!hasShown) {
                setShowAd(true);
                setHasShown(true);
                sessionStorage.setItem('interstitialShown', 'true');
            }
        }, 30000);

        window.addEventListener('scroll', handleScroll);
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(timer);
        };
    }, [hasShown]);

    if (!showAd) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 relative">
                <button
                    onClick={() => setShowAd(false)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    aria-label="閉じる"
                >
                    ×
                </button>
                
                <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">スポンサーからのお知らせ</h3>
                    <p className="text-sm text-gray-600 mt-1">広告は5秒後にスキップできます</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded">
                    <Adsense
                        client="ca-pub-4411270831448240"
                        slot="8529703346"
                        style={{ width: '100%', height: '250px' }}
                    />
                </div>
                
                <div className="mt-4 text-center">
                    <CountdownButton onComplete={() => setShowAd(false)} />
                </div>
            </div>
        </div>
    );
};

const CountdownButton = ({ onComplete }: { onComplete: () => void }) => {
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    return (
        <button
            onClick={onComplete}
            disabled={countdown > 0}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                countdown > 0 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            }`}
        >
            {countdown > 0 ? `広告をスキップ (${countdown}秒)` : '広告を閉じる'}
        </button>
    );
};