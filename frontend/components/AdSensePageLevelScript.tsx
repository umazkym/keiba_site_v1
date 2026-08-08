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
const TOP_ANCHOR_CONTROL_SELECTOR = '.fc-ablate-drawer-tab, .fc-ablate-drawer-btn';
const TOP_ANCHOR_CONTROL_MAX_HEIGHT = 32;

const isVisibleAnchor = (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0) {
        return false;
    }
    // 上部アンカーは画面上端に固定されるため、top <= 10 で十分。
    // 以前の 80px はヘッダー下の要素まで拾い、空白の原因になっていた。
    const isTopArea = rect.top <= 10 && rect.bottom > 0;
    const isBottomArea = rect.bottom >= window.innerHeight - 20;
    return rect.height >= 20 && (isTopArea || isBottomArea);
};

const getVisibleGoogleAnchors = () => Array.from(document.querySelectorAll<HTMLElement>(
    'ins.adsbygoogle-noablate, .fc-ablate-drawer-tab, .fc-ablate-drawer-btn, [id^="aswift_"][style*="position"], [id^="google_ads_iframe"][style*="position"]',
)).filter(isVisibleAnchor);

const getTopAnchorControlHeight = (topAnchorHeight: number) => {
    if (topAnchorHeight <= 0) return 0;

    const measuredControlHeight = Array.from(document.querySelectorAll<HTMLElement>(TOP_ANCHOR_CONTROL_SELECTOR))
        .reduce((height, element) => {
            if (!isVisibleAnchor(element)) return height;
            const rect = element.getBoundingClientRect();
            if (rect.top > 10 || rect.bottom <= 0) return height;
            return Math.max(height, Math.ceil(rect.bottom));
        }, 0);

    // Google側のDOM構造が変わって操作部を直接取得できない場合も、
    // 展開した広告本体の高さへ追従せず、折りたたみボタン相当だけを予約する。
    return Math.min(
        measuredControlHeight > 0 ? measuredControlHeight : topAnchorHeight,
        TOP_ANCHOR_CONTROL_MAX_HEIGHT,
    );
};

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
            const topAnchorControlHeight = getTopAnchorControlHeight(topAnchorHeight);
            const anchorIsVisible = topAnchorHeight > 0 || bottomAnchorHeight > 0;
            const isBlocking = dialogIsVisible || anchorIsVisible;
            observedGoogleUi = observedGoogleUi || Boolean(document.querySelector(GOOGLE_UI_SELECTOR));

            publishGoogleAdOverlaySnapshot({
                offerwallVisible,
                dialogVisible: dialogIsVisible,
                topAnchorHeight,
                topAnchorControlHeight,
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

                // overflowの復帰のみ行う。
                // body paddingはGoogle AdSenseスクリプト自身が管理するため、
                // こちらで上書きリセットすると競合してちらつきの原因になる。
                if (document.body.style.overflow === 'hidden') {
                    document.body.style.overflow = baseline.bodyOverflow;
                }
                if (document.documentElement.style.overflow === 'hidden') {
                    document.documentElement.style.overflow = baseline.htmlOverflow;
                }
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
                topAnchorControlHeight: 0,
                bottomAnchorHeight: 0,
            });
        };
    }, [enabled]);

    return null;
};
