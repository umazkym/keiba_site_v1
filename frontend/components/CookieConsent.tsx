'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Cookie同意バナー
 * GDPR/AdSenseポリシー準拠のためのCookie使用同意UI
 * localStorageで同意状態を管理
 */
export const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // localStorageから同意状態を確認
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            // 少し遅延させて表示（UX向上）
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie-consent', 'accepted');
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookie-consent', 'declined');
        // 拒否時: GPT・AdSenseを非パーソナライズモードに切り替える
        if (typeof window !== 'undefined') {
            // GPT (Google Publisher Tag) の非パーソナライズ設定
            if ((window as any).googletag && (window as any).googletag.cmd) {
                (window as any).googletag.cmd.push(() => {
                    (window as any).googletag.pubads().setPrivacySettings({
                        nonPersonalizedAds: true,
                    });
                });
            }
            // AdSense 非パーソナライズフラグ
            (window as any).adsbygoogle = (window as any).adsbygoogle || [];
            (window as any).adsbygoogle.requestNonPersonalizedAds = 1;
        }
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div
            className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[9999] max-w-[calc(100vw-2rem)] sm:max-w-md glass rounded-2xl shadow-elevated border border-slate-200/60 p-4 sm:p-5 animate-slide-up"
            role="dialog"
            aria-label="Cookie使用の同意"
        >
            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="text-[13px] sm:text-sm text-text-secondary leading-[1.6]">
                    <p>
                        当サイトでは、アクセス分析のためにCookieを使用しています。
                        詳細は
                        <Link href="/privacy" className="text-primary font-semibold hover:underline ml-1">
                            プライバシーポリシー
                        </Link>
                        をご覧ください。
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full">
                    <button
                        onClick={handleDecline}
                        className="flex-1 px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-text-secondary hover:text-text-primary bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all duration-200 shadow-sm"
                    >
                        拒否
                    </button>
                    <button
                        onClick={handleAccept}
                        className="flex-[2] px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition-all duration-200 active:scale-95"
                    >
                        同意する
                    </button>
                </div>
            </div>
        </div>
    );
};
