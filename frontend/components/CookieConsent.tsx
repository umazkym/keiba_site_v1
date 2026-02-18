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
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 shadow-lg px-4 py-4 sm:py-5 animate-slide-up"
            role="dialog"
            aria-label="Cookie使用の同意"
        >
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                <div className="flex-1 text-sm text-gray-600 leading-relaxed">
                    <p>
                        当サイトでは、サービス向上とアクセス分析のためにCookieを使用しています。
                        詳細は
                        <Link href="/privacy" className="text-primary font-semibold underline decoration-1 decoration-primary/30 hover:decoration-primary/60 ml-1">
                            プライバシーポリシー
                        </Link>
                        をご確認ください。
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                        onClick={handleDecline}
                        className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
                    >
                        拒否
                    </button>
                    <button
                        onClick={handleAccept}
                        className="flex-1 sm:flex-initial px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm"
                    >
                        同意する
                    </button>
                </div>
            </div>
        </div>
    );
};
