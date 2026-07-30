'use client';

import { useEffect } from 'react';


export function PwaRegistration() {
    useEffect(() => {
        if (
            process.env.NODE_ENV !== 'production'
            || !('serviceWorker' in navigator)
        ) {
            return;
        }
        const register = () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // PWA登録が失敗しても通常のサイト表示は維持する。
            });
        };
        window.addEventListener('load', register, { once: true });
        return () => window.removeEventListener('load', register);
    }, []);
    return null;
}
