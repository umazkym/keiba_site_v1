'use client';

import { useEffect } from 'react';
import { hasSiteScrollLock, hasVisibleGoogleDialog } from '@/lib/page-scroll-lock';

type AdSensePageLevelScriptProps = {
    enabled: boolean;
};

const SCRIPT_ID = 'uma-adsense-page-level-script';
const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const GOOGLE_UI_SELECTOR = '.fc-dialog-container, .fc-monetization-dialog-container, .fc-consent-root, ins.adsbygoogle-noablate[data-anchor-status]';

const isVisibleAnchor = (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0
        && rect.height >= 24
        && rect.width >= window.innerWidth * 0.45
        && (rect.top <= 8 || rect.bottom >= window.innerHeight - 8);
};

const hasVisibleGoogleAnchor = () => Array.from(document.querySelectorAll<HTMLElement>(
    'ins.adsbygoogle-noablate[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-status="displayed"]',
)).some(isVisibleAnchor);

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

        const restoreIfReleased = () => {
            const dialogIsVisible = hasVisibleGoogleDialog();
            const anchorIsVisible = hasVisibleGoogleAnchor();
            const isBlocking = dialogIsVisible || anchorIsVisible;
            observedGoogleUi = observedGoogleUi || Boolean(document.querySelector(GOOGLE_UI_SELECTOR));

            if (isBlocking) {
                wasBlocking = true;
                window.clearTimeout(restoreTimer);
                return;
            }
            if ((!observedGoogleUi && !wasBlocking) || hasSiteScrollLock()) return;

            window.clearTimeout(restoreTimer);
            restoreTimer = window.setTimeout(() => {
                if (hasVisibleGoogleDialog() || hasVisibleGoogleAnchor() || hasSiteScrollLock()) return;

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
        observer.observe(document.documentElement, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style', 'aria-hidden', 'data-anchor-status'],
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
        };
    }, [enabled]);

    return null;
};
