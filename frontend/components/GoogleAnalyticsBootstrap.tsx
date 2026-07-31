'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
    ANALYTICS_MEASUREMENT_RELEASE_ID,
    consumeSuppressedPageViewPath,
} from '@/lib/analytics';

type GoogleAnalyticsBootstrapProps = {
    gaId: string;
};

const buildConsentScript = () => `
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.__umaGaReady = false;
    window.gtag('consent', 'default', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
    });
`;

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/**
 * GA4本体のload完了後にconfigと初回page_viewを送る。
 * レース切替はRaceTabs側で抑止し、実ページ遷移だけをpage_viewとして扱う。
 */
export function GoogleAnalyticsBootstrap({ gaId }: GoogleAnalyticsBootstrapProps) {
    const pathname = usePathname();
    const lastPageViewPathRef = useRef<string | null>(null);

    const sendPageView = useCallback((nextPathname: string) => {
        if (!gaId || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

        const normalizedPath = normalizePath(nextPathname);
        window.gtag('event', 'page_view', {
            page_location: window.location.href,
            page_path: normalizedPath,
            page_title: document.title,
            measurement_release_id: ANALYTICS_MEASUREMENT_RELEASE_ID,
        });
        if (process.env.NODE_ENV !== 'production') {
            const currentCount = Number(document.documentElement.dataset.umaGaPageViewCount ?? '0');
            document.documentElement.dataset.umaGaPageViewCount = String(currentCount + 1);
            document.documentElement.dataset.umaGaLastPagePath = normalizedPath;
        }
        lastPageViewPathRef.current = normalizedPath;
    }, [gaId]);

    const initializeAnalytics = useCallback(() => {
        if (!gaId || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
        if (window.__umaGaReady) return;

        window.gtag('js', new Date());
        window.gtag('config', gaId, { send_page_view: false });
        sendPageView(window.location.pathname);
        window.__umaGaReady = true;
        window.dispatchEvent(new Event('uma:ga-ready'));
    }, [gaId, sendPageView]);

    useEffect(() => {
        if (!gaId || typeof window === 'undefined' || !window.__umaGaReady) return;

        const normalizedPath = normalizePath(pathname);
        if (consumeSuppressedPageViewPath(normalizedPath)) {
            lastPageViewPathRef.current = normalizedPath;
            return;
        }
        if (lastPageViewPathRef.current === normalizedPath) return;

        sendPageView(normalizedPath);
    }, [gaId, pathname, sendPageView]);

    return (
        <>
            <script
                id="uma-ga-bootstrap"
                dangerouslySetInnerHTML={{ __html: buildConsentScript() }}
            />
            {gaId && (
                <Script
                    id="uma-ga-script"
                    src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
                    strategy="afterInteractive"
                    onLoad={initializeAnalytics}
                    onReady={initializeAnalytics}
                />
            )}
        </>
    );
}
