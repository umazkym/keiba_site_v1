'use client';

import { useCallback, useEffect, useState } from 'react';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';
import { getGoogleAdOverlaySnapshot, GOOGLE_AD_OVERLAY_EVENT } from '@/lib/google-ad-overlay';

type HomeStickyRaceCtaProps = {
    raceDate: string;
    raceCount: number;
};

export function HomeStickyRaceCta({ raceDate, raceCount }: HomeStickyRaceCtaProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [bottomAnchorHeight, setBottomAnchorHeight] = useState<number>(() => getGoogleAdOverlaySnapshot().bottomAnchorHeight);

    const updateVisibility = useCallback(() => {
        const primaryCta = document.querySelector<HTMLElement>('[data-home-primary-race-cta]');
        if (!primaryCta) {
            setIsVisible(false);
            return;
        }

        // ページの最下部付近（フッター）までスクロールした場合はフッター文言との重なりを防ぐため退避
        const scrollBottom = window.innerHeight + window.scrollY;
        const pageHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
        );
        const isNearBottom = scrollBottom >= pageHeight - 200;

        if (isNearBottom) {
            setIsVisible(false);
            return;
        }

        const headerOffset = Number.parseFloat(
            window.getComputedStyle(document.documentElement).getPropertyValue('--site-header-offset'),
        ) || 0;
        setIsVisible(primaryCta.getBoundingClientRect().bottom <= headerOffset);
    }, []);

    useEffect(() => {
        let frameId = 0;
        const requestUpdate = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(() => {
                const overlay = getGoogleAdOverlaySnapshot();
                setBottomAnchorHeight(overlay.bottomAnchorHeight);
                updateVisibility();
            });
        };

        const handleOverlayChange = () => requestUpdate();
        window.addEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange as EventListener);

        const header = document.querySelector<HTMLElement>('[data-site-header]');
        const headerObserver = header ? new MutationObserver(requestUpdate) : null;

        if (header) {
            headerObserver?.observe(header, { attributes: true, attributeFilter: ['class', 'data-site-header-visible'] });
        }
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        requestUpdate();

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange as EventListener);
            headerObserver?.disconnect();
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [updateVisibility]);

    return (
        <div
            className={`home-sticky-race-cta ${isVisible ? 'home-sticky-race-cta-visible' : ''}`}
            style={{
                bottom: bottomAnchorHeight > 0
                    ? `calc(${bottomAnchorHeight}px + env(safe-area-inset-bottom, 0px) + var(--safari-bottom-offset, 0px))`
                    : 'calc(env(safe-area-inset-bottom, 0px) + var(--safari-bottom-offset, 0px))',
            }}
            aria-hidden={!isVisible}
        >
            {/* Safariタブ変色防止: ビューポート最下端にサイト背景色の物理シールドを配置し
                Safariの色サンプリングが青色ボタンを検出しないようにする */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[6px]" style={{ background: '#f8fafc' }} aria-hidden="true" />
            <div className="relative mx-auto flex max-w-[1600px] items-center justify-center px-3 pb-[8px] pt-[2px] sm:px-4 md:px-6">
                <HomeRaceEntryLink
                    href={`/races/${raceDate}`}
                    raceDate={raceDate}
                    entryMethod="sticky_cta"
                    tabIndex={isVisible ? 0 : -1}
                    className="flex h-11 w-full items-center rounded-full bg-blue-600 pl-3 pr-2 text-white shadow-lg transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 sm:max-w-md"
                >
                    {raceCount > 0 && (
                        <span className="mr-2 shrink-0 rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-black">本日{raceCount}R</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-center text-[13px] sm:text-sm font-black">本日のレース分析を見る</span>
                    <span className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-black" aria-hidden="true">→</span>
                </HomeRaceEntryLink>
            </div>
        </div>
    );
}
