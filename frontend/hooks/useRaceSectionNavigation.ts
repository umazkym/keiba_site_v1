'use client';

import { useCallback, useEffect, useState } from 'react';

export type RaceSectionNavItem = {
    key: string;
    targetIds: string[];
};

const findTargetElement = (targetIds: string[]) => {
    if (typeof document === 'undefined') return null;

    return targetIds
        .map((id) => document.getElementById(id))
        .find((element): element is HTMLElement => Boolean(element));
};

const isVisible = (element: HTMLElement | null) => {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().height > 0;
};

const getVisibleTopAnchorHeight = () => {
    const candidates = document.querySelectorAll<HTMLElement>(
        'ins.adsbygoogle-noablate[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-status="displayed"]',
    );

    return Array.from(candidates).reduce((height, element) => {
        if (!isVisible(element)) return height;
        const rect = element.getBoundingClientRect();
        if (rect.top > 8 || rect.bottom < 24) return height;
        return Math.max(height, Math.min(rect.height, 160));
    }, 0);
};

export const getRaceTopObstructionHeight = () => {
    if (typeof window === 'undefined') return 128;

    const header = document.querySelector<HTMLElement>('[data-site-header]');
    const pageNavigation = window.innerWidth >= 1024
        ? document.querySelector<HTMLElement>('[data-race-jump-nav]')
        : document.querySelector<HTMLElement>('[data-race-mobile-selector]');
    const headerHeight = isVisible(header) ? header!.getBoundingClientRect().height : 0;
    const navigationHeight = isVisible(pageNavigation) ? pageNavigation!.getBoundingClientRect().height : 0;

    return Math.ceil(headerHeight + navigationHeight + getVisibleTopAnchorHeight() + 8);
};

const getScrollBehavior = (): ScrollBehavior => {
    if (typeof window === 'undefined') return 'auto';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
};

export const scrollToRaceSection = (targetIds: string[]) => {
    if (typeof window === 'undefined') return;

    const target = findTargetElement(targetIds);
    if (!target) return;

    const top = window.scrollY + target.getBoundingClientRect().top - getRaceTopObstructionHeight();
    window.scrollTo({ top: Math.max(0, top), behavior: getScrollBehavior() });
};

export const useRaceSectionNavigation = <TItem extends RaceSectionNavItem>(items: readonly TItem[]) => {
    const [activeKey, setActiveKey] = useState(items[0]?.key ?? '');

    const updateActiveSection = useCallback(() => {
        if (typeof window === 'undefined' || items.length === 0) return;

        const pivot = getRaceTopObstructionHeight() + 12;
        let nextActiveKey = items[0].key;

        for (const item of items) {
            const target = findTargetElement(item.targetIds);
            if (!target) continue;

            if (target.getBoundingClientRect().top <= pivot) {
                nextActiveKey = item.key;
            }
        }

        setActiveKey(nextActiveKey);
    }, [items]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let frameId = 0;
        const requestUpdate = () => {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateActiveSection);
        };

        requestUpdate();
        const firstTimer = window.setTimeout(requestUpdate, 400);
        const secondTimer = window.setTimeout(requestUpdate, 1200);
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(firstTimer);
            window.clearTimeout(secondTimer);
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [updateActiveSection]);

    const scrollToItem = useCallback((item: RaceSectionNavItem) => {
        setActiveKey(item.key);
        scrollToRaceSection(item.targetIds);
    }, []);

    return {
        activeKey,
        scrollToItem,
    };
};
