'use client';

import { useCallback, useEffect, useState } from 'react';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';

type HomeStickyRaceCtaProps = {
    raceDate: string;
};

export function HomeStickyRaceCta({ raceDate }: HomeStickyRaceCtaProps) {
    const [isVisible, setIsVisible] = useState(false);

    const updateVisibility = useCallback(() => {
        const primaryCta = document.querySelector<HTMLElement>('[data-home-primary-race-cta]');
        if (!primaryCta) {
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
            frameId = window.requestAnimationFrame(updateVisibility);
        };
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
            headerObserver?.disconnect();
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [updateVisibility]);

    return (
        <div
            className={`home-sticky-race-cta ${isVisible ? 'home-sticky-race-cta-visible' : ''}`}
            aria-hidden={!isVisible}
        >
            <div className="mx-auto flex h-11 max-w-[1600px] items-center px-2 sm:px-4 md:px-6">
                <HomeRaceEntryLink
                    href={`/races/${raceDate}`}
                    raceDate={raceDate}
                    entryMethod="sticky_cta"
                    tabIndex={isVisible ? 0 : -1}
                    className="flex h-9 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-black text-white transition-colors duration-150 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 sm:mx-auto sm:max-w-md"
                >
                    本日のレース分析を見る <span className="ml-1" aria-hidden="true">→</span>
                </HomeRaceEntryLink>
            </div>
        </div>
    );
}
