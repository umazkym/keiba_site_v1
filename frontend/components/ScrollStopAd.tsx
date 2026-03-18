'use client';

import { useRef, useState, useEffect } from 'react';
import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * Scroll-Stop Hack (ボタン隣接の極限隙間) 広告コンポーネント
 * 
 * RaceNavigation（次レースへボタン）の直上に配置し、
 * 指の着地ポイント付近で自然な誤タップを誘発する強力な配置。
 * 
 * レスポンシブ（高さ可変）だとボタンのY座標がずれてUXが悪化するため、
 * 高さを固定したバナー指名買い（height: 100px）を行う。
 */
export const ScrollStopAd = ({ slot, refreshKey = '' }: { slot: string, refreshKey?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adLoaded, setAdLoaded] = useState(false);
    const [adUnfilled, setAdUnfilled] = useState(false);

    useEffect(() => {
        setAdLoaded(false);
        setAdUnfilled(false);
    }, [refreshKey]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new MutationObserver(() => {
            const ins = container.querySelector('ins.adsbygoogle');
            if (ins) {
                const status = ins.getAttribute('data-ad-status');
                if (status === 'filled') { 
                    setAdLoaded(true); 
                    observer.disconnect(); 
                } else if (status === 'unfilled') { 
                    setAdUnfilled(true); 
                    observer.disconnect(); 
                }
            }
        });
        observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ad-status'] });
        return () => observer.disconnect();
    }, [refreshKey]);

    return (
        <div ref={containerRef} className={`w-full flex flex-col items-center justify-center ${adUnfilled ? 'hidden' : 'min-h-[100px]'}`}>
            <div className="w-full max-w-[320px] sm:max-w-full relative">
                {/* ギリギリを攻める極小の「スポンサーリンク」 */}
                {adLoaded && <div className="text-[9px] text-gray-300 text-right mb-[1px] select-none leading-none pr-1">Sponsored</div>}
                
                <div className={`w-full overflow-hidden flex justify-center ${!adLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
                    <Adsense
                        client={AD_CLIENT}
                        slot={slot}
                        refreshKey={refreshKey}
                        // ★ ボタン付近は高さ固定バナーが必須（ボタンの無用なジャンプを防ぎつつ、指との距離を計算可能にするため）
                        style={{ display: 'inline-block', width: '100%', height: '100px' }}
                        isResponsive={false}
                    />
                </div>
            </div>
        </div>
    );
};
