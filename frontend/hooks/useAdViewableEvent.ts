'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { sendAdViewableEvent, type AdViewableParams } from '@/lib/analytics';

type UseAdViewableEventOptions = {
    targetRef: RefObject<HTMLElement | null>;
    isFilled: boolean;
    refreshKey?: string;
    ad: AdViewableParams;
};

/**
 * 配信済み広告が実際に視認されたかを、広告枠単位で一度だけ計測する。
 */
export const useAdViewableEvent = ({
    targetRef,
    isFilled,
    refreshKey = '',
    ad,
}: UseAdViewableEventOptions) => {
    const hasSentRef = useRef(false);
    const { placement, format, slot, variant } = ad;

    useEffect(() => {
        hasSentRef.current = false;
    }, [refreshKey, placement, format, slot, variant]);

    useEffect(() => {
        if (!isFilled || typeof window === 'undefined' || hasSentRef.current) return undefined;

        const target = targetRef.current;
        if (!target) return undefined;

        if (!('IntersectionObserver' in window)) {
            hasSentRef.current = true;
            sendAdViewableEvent({ placement, format, slot, variant });
            return undefined;
        }

        let isVisible = false;
        let timer: number | null = null;
        const observer = new IntersectionObserver(([entry]) => {
            isVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5);

            if (!isVisible) {
                if (timer !== null) {
                    window.clearTimeout(timer);
                    timer = null;
                }
                return;
            }

            if (timer !== null || hasSentRef.current) return;

            timer = window.setTimeout(() => {
                if (!isVisible || hasSentRef.current) return;
                hasSentRef.current = true;
                sendAdViewableEvent({ placement, format, slot, variant });
                observer.disconnect();
            }, 1000);
        }, { threshold: [0, 0.5, 1] });

        observer.observe(target);

        return () => {
            if (timer !== null) window.clearTimeout(timer);
            observer.disconnect();
        };
    }, [format, isFilled, placement, slot, targetRef, variant]);
};
