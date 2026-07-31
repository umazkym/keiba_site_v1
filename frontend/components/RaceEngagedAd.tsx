'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AdUnit, type AdUnitStatus } from '@/components/AdUnit';

declare global {
    interface Window {
        __umaRaceEngagedAdClaimedPage?: string;
        __umaRaceEngagedAdRequestOwner?: string;
    }
}

const RACE_ENGAGED_AD_CLAIM_EVENT = 'uma:race-engaged-ad-claim';

type RaceEngagedAdProps = {
    slot: string;
    pageKey: string;
};

/**
 * コア分析を読み終えた位置にだけ置く、モバイル試作用の広告枠。
 * 1ページでGoogleからfilledが返る枠を1つに制限し、レース切替では再読込しない。
 */
export const RaceEngagedAd = ({ slot, pageKey }: RaceEngagedAdProps) => {
    const ownerId = useId();
    const wrapperRef = useRef<HTMLElement>(null);
    const requestAttemptedRef = useRef(false);
    const [claimReady, setClaimReady] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [isNearViewport, setIsNearViewport] = useState(false);
    const [canRequestAd, setCanRequestAd] = useState(false);
    const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
    const [status, setStatus] = useState<AdUnitStatus>('loading');
    const [claimedElsewhere, setClaimedElsewhere] = useState(false);

    useEffect(() => {
        requestAttemptedRef.current = false;
        setClaimedElsewhere(window.__umaRaceEngagedAdClaimedPage === pageKey);
        setClaimReady(true);
    }, [pageKey]);

    useEffect(() => {
        const node = wrapperRef.current;
        if (!node || !claimReady || claimedElsewhere) return undefined;

        if (!('IntersectionObserver' in window)) {
            setIsNearViewport(true);
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) {
                setIsNearViewport(true);
                observer.disconnect();
            }
        }, { threshold: 0.01, rootMargin: '320px 0px 320px 0px' });
        observer.observe(node);

        return () => observer.disconnect();
    }, [claimReady, claimedElsewhere]);

    useEffect(() => {
        const node = wrapperRef.current;
        if (!node || !claimReady || claimedElsewhere || !('IntersectionObserver' in window)) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) setHasEnteredViewport(true);
        }, { threshold: 0.01 });
        observer.observe(node);

        return () => observer.disconnect();
    }, [claimReady, claimedElsewhere]);

    useEffect(() => {
        if (!isNearViewport || claimedElsewhere || canRequestAd || requestAttemptedRef.current) return;

        if (window.__umaRaceEngagedAdClaimedPage === pageKey) {
            setClaimedElsewhere(true);
            return;
        }
        if (window.__umaRaceEngagedAdRequestOwner && window.__umaRaceEngagedAdRequestOwner !== ownerId) {
            return;
        }

        window.__umaRaceEngagedAdRequestOwner = ownerId;
        requestAttemptedRef.current = true;
        setCanRequestAd(true);
    }, [canRequestAd, claimedElsewhere, isNearViewport, ownerId, pageKey]);

    useEffect(() => {
        const handleClaim = (event: Event) => {
            const detail = (event as CustomEvent<{ pageKey: string; ownerId: string }>).detail;
            if (!detail || detail.pageKey !== pageKey || detail.ownerId === ownerId) return;
            setClaimedElsewhere(true);
            setCanRequestAd(false);
        };

        window.addEventListener(RACE_ENGAGED_AD_CLAIM_EVENT, handleClaim);
        return () => {
            window.removeEventListener(RACE_ENGAGED_AD_CLAIM_EVENT, handleClaim);
            if (window.__umaRaceEngagedAdRequestOwner === ownerId && !isOwner) {
                delete window.__umaRaceEngagedAdRequestOwner;
            }
        };
    }, [isOwner, ownerId, pageKey]);

    const handleStatusChange = useCallback((nextStatus: AdUnitStatus) => {
        setStatus(nextStatus);
        if (nextStatus === 'unfilled') {
            if (window.__umaRaceEngagedAdRequestOwner === ownerId) {
                delete window.__umaRaceEngagedAdRequestOwner;
            }
            setCanRequestAd(false);
            return;
        }
        if (nextStatus !== 'filled') return;

        window.__umaRaceEngagedAdClaimedPage = pageKey;
        window.__umaRaceEngagedAdRequestOwner = ownerId;
        setIsOwner(true);
        window.dispatchEvent(new CustomEvent(RACE_ENGAGED_AD_CLAIM_EVENT, {
            detail: { pageKey, ownerId },
        }));
    }, [ownerId, pageKey]);

    if (!claimReady || (claimedElsewhere && !isOwner)) return null;

    // 画面外で未配信が確定した枠だけを畳む。画面内へ入った後は予約高を維持する。
    if (status === 'unfilled' && !hasEnteredViewport) return null;

    return (
        <section
            ref={wrapperRef}
            className="relative my-1.5 min-h-[250px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1.5 sm:my-2 sm:p-2"
            aria-label="スポンサーリンク"
            data-race-engaged-ad="true"
            data-ad-state={status}
        >
            <div className="mb-1 text-center text-[10px] font-semibold tracking-wider text-slate-400">
                広告
            </div>
            {canRequestAd && (
                <AdUnit
                    slot={slot}
                    placement="inline"
                    analyticsPlacement="race_after_analysis_engaged"
                    analyticsVariant="engaged_display"
                    refreshKey={`race-engaged-${pageKey}`}
                    minHeight="222px"
                    collapseUnfilled={false}
                    lazyRootMargin="320px 0px 320px 0px"
                    refreshRootMarginPx={240}
                    className="!my-0"
                    label=""
                    onStatusChange={handleStatusChange}
                />
            )}
        </section>
    );
};
