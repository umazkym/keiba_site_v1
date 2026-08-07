'use client';

import { useEffect } from 'react';

/**
 * Safari iOS (特にSafari 26以降) において、ツールの高さ変化や
 * アドレスバーの出入りで env(safe-area-inset-bottom) が追従しない現象を補正するコンポーネント。
 * visualViewport APIの変調をリアルタイムにスキャンし、CSS変数 `--safari-bottom-offset` へ反映します。
 */
export function SafariViewportShim() {
    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) {
            return undefined;
        }

        const root = document.documentElement;

        const updateViewportOffset = () => {
            const vv = window.visualViewport;
            if (!vv) return;

            // visualViewportから下部ツールの実高（ツールバーやアドレスバーの高さ）を算出
            const bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            root.style.setProperty('--safari-bottom-offset', `${bottomOffset}px`);
        };

        const vv = window.visualViewport;
        vv.addEventListener('resize', updateViewportOffset);
        vv.addEventListener('scroll', updateViewportOffset);
        window.addEventListener('resize', updateViewportOffset);

        updateViewportOffset();

        return () => {
            vv.removeEventListener('resize', updateViewportOffset);
            vv.removeEventListener('scroll', updateViewportOffset);
            window.removeEventListener('resize', updateViewportOffset);
        };
    }, []);

    return null;
}
