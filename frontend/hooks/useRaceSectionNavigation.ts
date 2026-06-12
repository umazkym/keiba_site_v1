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

const getScrollOffset = () => {
    if (typeof window === 'undefined') return 82;
    return window.innerWidth < 640 ? 72 : 86;
};

export const scrollToRaceSection = (targetIds: string[]) => {
    if (typeof window === 'undefined') return;

    const target = findTargetElement(targetIds);
    if (!target) return;

    const top = window.scrollY + target.getBoundingClientRect().top - getScrollOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
};

export const useRaceSectionNavigation = <TItem extends RaceSectionNavItem>(items: readonly TItem[]) => {
    const [activeKey, setActiveKey] = useState(items[0]?.key ?? '');

    const updateActiveSection = useCallback(() => {
        if (typeof window === 'undefined' || items.length === 0) return;

        const pivot = window.innerWidth < 640 ? 118 : 132;
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
