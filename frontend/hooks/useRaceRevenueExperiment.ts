'use client';

import { useEffect, useRef, useState } from 'react';
import {
    RACE_ENGAGED_AD_SLOT,
    RACE_LEGACY_INFEED_SLOT,
    RACE_REVENUE_EXPERIMENT_ID,
    RACE_REVENUE_EXPERIMENT_MODE,
    canRunRaceRevenueExperiment,
    type RaceRevenueVariant,
} from '@/lib/ad-config';
import {
    sendAdExperimentExposureEvent,
    setAnalyticsUserProperties,
} from '@/lib/analytics';
import { setClarityTag } from '@/lib/clarity';

const ASSIGNMENT_STORAGE_KEY = 'uma-free:mobile-race-engaged-ad:v1';
const EXPOSURE_STORAGE_KEY = 'uma-free:mobile-race-engaged-ad:exposure:v1';
const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

type RaceRevenueExperimentState = {
    ready: boolean;
    eligible: boolean;
    variant: RaceRevenueVariant;
};

const getStoredVariant = (): RaceRevenueVariant | null => {
    try {
        const stored = window.sessionStorage.getItem(ASSIGNMENT_STORAGE_KEY);
        return stored === 'legacy' || stored === 'engaged_display' ? stored : null;
    } catch {
        return null;
    }
};

const storeVariant = (variant: RaceRevenueVariant) => {
    try {
        window.sessionStorage.setItem(ASSIGNMENT_STORAGE_KEY, variant);
    } catch {
        // sessionStorageが利用できない場合も、現在のページ内では同じstateを使い続ける。
    }
};

const markExposureOncePerTabSession = (experimentValue: string): boolean => {
    try {
        if (window.sessionStorage.getItem(EXPOSURE_STORAGE_KEY) === experimentValue) {
            return false;
        }
        window.sessionStorage.setItem(EXPOSURE_STORAGE_KEY, experimentValue);
        return true;
    } catch {
        // sessionStorageが使えない場合は、コンポーネント内のrefで重複だけを防ぐ。
        return true;
    }
};

export const useRaceRevenueExperiment = () => {
    const [state, setState] = useState<RaceRevenueExperimentState>({
        ready: RACE_REVENUE_EXPERIMENT_MODE === 'legacy',
        eligible: false,
        variant: 'legacy',
    });
    const hasSentExposureRef = useRef(false);

    useEffect(() => {
        if (RACE_REVENUE_EXPERIMENT_MODE === 'legacy' || !canRunRaceRevenueExperiment) {
            setState({ ready: true, eligible: false, variant: 'legacy' });
            return;
        }

        const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
        if (!isMobile) {
            setState({ ready: true, eligible: false, variant: 'legacy' });
            return;
        }

        let variant: RaceRevenueVariant;
        if (RACE_REVENUE_EXPERIMENT_MODE === 'engaged_display') {
            variant = 'engaged_display';
        } else {
            variant = getStoredVariant() ?? (Math.random() < 0.5 ? 'legacy' : 'engaged_display');
            storeVariant(variant);
        }

        setState({ ready: true, eligible: true, variant });
    }, []);

    useEffect(() => {
        if (!state.ready || !state.eligible || hasSentExposureRef.current) return;
        hasSentExposureRef.current = true;

        const slotId = state.variant === 'engaged_display'
            ? RACE_ENGAGED_AD_SLOT
            : RACE_LEGACY_INFEED_SLOT;
        const experimentValue = `${RACE_REVENUE_EXPERIMENT_ID}:${state.variant}`;

        setAnalyticsUserProperties({
            monetization_experiment: experimentValue,
            monetization_variant: state.variant,
            ad_experiment_id: RACE_REVENUE_EXPERIMENT_ID,
            ad_experiment_variant: state.variant,
        });
        setClarityTag('monetization_experiment', RACE_REVENUE_EXPERIMENT_ID);
        setClarityTag('monetization_variant', state.variant);
        setClarityTag('ad_experiment_id', RACE_REVENUE_EXPERIMENT_ID);
        setClarityTag('ad_experiment_variant', state.variant);
        if (!markExposureOncePerTabSession(experimentValue)) return;

        sendAdExperimentExposureEvent({
            experiment_id: RACE_REVENUE_EXPERIMENT_ID,
            variant: state.variant,
            slot_id: slotId,
            ad_placement: state.variant === 'engaged_display'
                ? 'race_after_analysis_engaged'
                : 'race_after_top_hits_infeed',
            page_type: 'race',
        });
    }, [state]);

    return {
        ...state,
        engagedAdSlot: RACE_ENGAGED_AD_SLOT,
        shouldRenderLegacySlot: state.ready && state.variant === 'legacy',
        shouldRenderEngagedSlot: state.ready && state.eligible && state.variant === 'engaged_display',
    };
};
