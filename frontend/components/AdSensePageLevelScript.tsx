'use client';

import { useEffect } from 'react';
import { hasSiteScrollLock, hasVisibleGoogleDialog } from '@/lib/page-scroll-lock';
import { sendAdsenseOfferwallViewEvent } from '@/lib/analytics';
import { publishGoogleAdOverlaySnapshot } from '@/lib/google-ad-overlay';

type AdSensePageLevelScriptProps = {
    enabled: boolean;
};

const SCRIPT_ID = 'uma-adsense-page-level-script';
const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const GOOGLE_UI_SELECTOR = '.fc-dialog-container, .fc-monetization-dialog-container, .fc-consent-root, ins.adsbygoogle-noablate[data-anchor-status]';
const OFFERWALL_SELECTOR = '.fc-monetization-dialog-container';

const isVisibleAnchor = (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0) {
        return false;
    }
    const isTopArea = rect.top <= 80 && rect.bottom > 0;
    const isBottomArea = rect.bottom >= window.innerHeight - 20;
    return rect.height >= 20 && (isTopArea || isBottomArea);
};

const getVisibleGoogleAnchors = () => Array.from(document.querySelectorAll<HTMLElement>(
    'ins.adsbygoogle-noablate[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-status="displayed"], .fc-ablate-drawer-tab',
)).filter(isVisibleAnchor);

const isVisibleOfferwall = () => Array.from(document.querySelectorAll<HTMLElement>(OFFERWALL_SELECTOR)).some((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0
        && rect.height >= 120
        && rect.width >= window.innerWidth * 0.6;
});

/**
 * 自動広告・オファーウォール用のページレベルスクリプト。
 *
 * Reactのhydration完了後に読み込み、広告スクリプトが初期HTMLを
 * hydration前に書き換えることによるテキスト不一致を防ぐ。
 */
export const AdSensePageLevelScript = ({ enabled }: AdSensePageLevelScriptProps) => {
    useEffect(() => {
        if (!enabled) return;

        const baseline = {
            bodyOverflow: document.body.style.overflow,
            bodyPaddingTop: document.body.style.paddingTop,
            bodyPaddingBottom: document.body.style.paddingBottom,
            htmlOverflow: document.documentElement.style.overflow,
        };
        let observedGoogleUi = Boolean(document.querySelector(GOOGLE_UI_SELECTOR));
        let wasBlocking = false;
        let restoreTimer = 0;
        let frameId = 0;
        let offerwallWasVisible = false;

        const restoreIfReleased = () => {
            const dialogIsVisible = hasVisibleGoogleDialog();
            const offerwallVisible = isVisibleOfferwall();
            const visibleAnchors = getVisibleGoogleAnchors();
            const topAnchorHeight = visibleAnchors.reduce((height, element) => {
                const rect = element.getBoundingClientRect();
                return rect.top <= 80 && rect.bottom > 0 ? Math.max(height, Math.ceil(rect.bottom)) : height;
            }, 0);
            const bottomAnchorHeight = visibleAnchors.reduce((height, element) => {
                const rect = element.getBoundingClientRect();
                return rect.bottom >= window.innerHeight - 20 ? Math.max(height, Math.ceil(rect.height)) : height;
            }, 0);
            const anchorIsVisible = topAnchorHeight > 0 || bottomAnchorHeight > 0;
            const isBlocking = dialogIsVisible || anchorIsVisible;
            observedGoogleUi = observedGoogleUi || Boolean(document.querySelector(GOOGLE_UI_SELECTOR));

            publishGoogleAdOverlaySnapshot({
                offerwallVisible,
                dialogVisible: dialogIsVisible,
                topAnchorHeight,
                bottomAnchorHeight,
            });

            if (offerwallVisible && !offerwallWasVisible) {
                sendAdsenseOfferwallViewEvent({
                    path_group: window.location.pathname.startsWith('/races') ? '/races' : 'other',
                });
            }
            offerwallWasVisible = offerwallVisible;

            if (isBlocking) {
                wasBlocking = true;
                window.clearTimeout(restoreTimer);
                return;
            }
            if ((!observedGoogleUi && !wasBlocking) || hasSiteScrollLock()) return;

            window.clearTimeout(restoreTimer);
            restoreTimer = window.setTimeout(() => {
                if (hasVisibleGoogleDialog() || getVisibleGoogleAnchors().length > 0 || hasSiteScrollLock()) return;

                const scrollTop = window.scrollY;
                if (document.body.style.overflow === 'hidden') {
                    document.body.style.overflow = baseline.bodyOverflow;
                }
                if (document.documentElement.style.overflow === 'hidden') {
                    document.documentElement.style.overflow = baseline.htmlOverflow;
                }
                document.body.style.paddingTop = baseline.bodyPaddingTop;
                document.body.style.paddingBottom = baseline.bodyPaddingBottom;
                window.requestAnimationFrame(() => window.scrollTo({ top: scrollTop, behavior: 'auto' }));
                wasBlocking = false;
            }, 240);
        };

        const requestCheck = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(restoreIfReleased);
        };
        const observer = new MutationObserver(requestCheck);
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['aria-hidden', 'data-anchor-status'],
        });
        window.addEventListener('pageshow', requestCheck);
        window.addEventListener('popstate', requestCheck);
        window.addEventListener('resize', requestCheck);
        requestCheck();

        const existingScript =
            document.getElementById(SCRIPT_ID) ||
            document.querySelector(`script[src^="${SCRIPT_SRC}"]`);

        if (!existingScript) {
            const script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.async = true;
            script.src = `${SCRIPT_SRC}?client=ca-pub-4411270831448240`;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(restoreTimer);
            observer.disconnect();
            window.removeEventListener('pageshow', requestCheck);
            window.removeEventListener('popstate', requestCheck);
            window.removeEventListener('resize', requestCheck);
            publishGoogleAdOverlaySnapshot({
                offerwallVisible: false,
                dialogVisible: false,
                topAnchorHeight: 0,
                bottomAnchorHeight: 0,
            });
        };
    }, [enabled]);

    return null;
};
