'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGoogleAdOverlaySnapshot, GOOGLE_AD_OVERLAY_EVENT } from '@/lib/google-ad-overlay';

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
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.height > 0
        && rect.bottom > 0;
};

const getVisibleTopAnchorHeight = () => {
    const overlay = getGoogleAdOverlaySnapshot();
    return overlay.topAnchorControlHeight;
};

export const getRaceTopObstructionHeight = () => {
    if (typeof window === 'undefined') return 128;

    const header = document.querySelector<HTMLElement>('[data-site-header]');
    const pageNavigation = document.querySelector<HTMLElement>('[data-race-selector-sticky]');
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

    useEffect(() => {
        if (typeof window === 'undefined' || items.length === 0) return undefined;

        let observer: IntersectionObserver | null = null;
        const targets = items
            .map((item) => ({ item, target: findTargetElement(item.targetIds) }))
            .filter((entry): entry is { item: TItem; target: HTMLElement } => Boolean(entry.target));

        const updateActiveSection = () => {
            const pivot = getRaceTopObstructionHeight() + 12;
            let nextActiveKey = items[0].key;
            for (const { item, target } of targets) {
                if (target.getBoundingClientRect().top <= pivot) nextActiveKey = item.key;
            }
            setActiveKey((current) => current === nextActiveKey ? current : nextActiveKey);
        };

        const connectObserver = () => {
            observer?.disconnect();
            const pivot = Math.min(getRaceTopObstructionHeight() + 12, window.innerHeight - 1);
            const bottomMargin = Math.max(0, window.innerHeight - pivot - 1);
            observer = new IntersectionObserver(updateActiveSection, {
                rootMargin: `-${pivot}px 0px -${bottomMargin}px 0px`,
                threshold: 0,
            });
            targets.forEach(({ target }) => observer?.observe(target));
            updateActiveSection();
        };

        connectObserver();
        window.addEventListener('resize', connectObserver);
        window.addEventListener(GOOGLE_AD_OVERLAY_EVENT, connectObserver);
        window.addEventListener('uma:header-metrics-change', connectObserver);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', connectObserver);
            window.removeEventListener(GOOGLE_AD_OVERLAY_EVENT, connectObserver);
            window.removeEventListener('uma:header-metrics-change', connectObserver);
        };
    }, [items]);

    const scrollToItem = useCallback((item: RaceSectionNavItem) => {
        setActiveKey(item.key);
        scrollToRaceSection(item.targetIds);
    }, []);

    return {
        activeKey,
        scrollToItem,
    };
};
