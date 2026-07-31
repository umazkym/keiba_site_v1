export const MANUAL_ADS_MODE = process.env.NEXT_PUBLIC_MANUAL_ADS_MODE ?? 'enabled';
export const ADSENSE_AUTO_ADS_MODE = process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE ?? 'enabled';
export const ADSENSE_OFFERWALL_MODE = process.env.NEXT_PUBLIC_ADSENSE_OFFERWALL_MODE ?? 'enabled';
export const REWARDED_AD_MODE = process.env.NEXT_PUBLIC_REWARDED_AD_MODE ?? 'fallback';
export const FULLSCREEN_AD_MODE = process.env.NEXT_PUBLIC_FULLSCREEN_AD_MODE ?? 'disabled';
export const SHOW_DEV_AD_PLACEHOLDERS = process.env.NEXT_PUBLIC_SHOW_DEV_AD_PLACEHOLDERS ?? 'disabled';
const configuredDevAdTestStatus = process.env.NEXT_PUBLIC_DEV_AD_TEST_STATUS;
export const DEV_AD_TEST_STATUS =
    configuredDevAdTestStatus === 'filled' || configuredDevAdTestStatus === 'unfilled'
        ? configuredDevAdTestStatus
        : '';

export type RaceRevenueExperimentMode = 'legacy' | 'split' | 'engaged_display';
export type RaceRevenueVariant = 'legacy' | 'engaged_display';

const configuredRaceRevenueExperimentMode = process.env.NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE;
export const RACE_REVENUE_EXPERIMENT_MODE: RaceRevenueExperimentMode =
    configuredRaceRevenueExperimentMode === 'split' || configuredRaceRevenueExperimentMode === 'engaged_display'
        ? configuredRaceRevenueExperimentMode
        : 'legacy';
export const RACE_ENGAGED_AD_SLOT = (process.env.NEXT_PUBLIC_RACE_ENGAGED_AD_SLOT ?? '').trim();
export const RACE_REVENUE_EXPERIMENT_ID = 'MOBILE-RACE-ENGAGED-AD-2026-08';
export const RACE_LEGACY_INFEED_SLOT = '7367648888';

export const isManualAdsEnabled = MANUAL_ADS_MODE === 'enabled';
export const isAdsenseAutoAdsEnabled = ADSENSE_AUTO_ADS_MODE === 'enabled';
export const isAdsenseOfferwallEnabled = ADSENSE_OFFERWALL_MODE === 'enabled';
export const isProductionRuntime = process.env.NODE_ENV === 'production';
export const shouldShowDevAdPlaceholders =
    !isProductionRuntime && SHOW_DEV_AD_PLACEHOLDERS === 'enabled';
export const shouldSuppressAdsInDevelopment =
    !isProductionRuntime && !shouldShowDevAdPlaceholders;
export const shouldLoadAdsensePageLevelScript =
    isProductionRuntime && (isAdsenseAutoAdsEnabled || isAdsenseOfferwallEnabled);
export const isRewardedAdsEnabled = REWARDED_AD_MODE === 'enabled' && FULLSCREEN_AD_MODE === 'enabled';
export const canRunRaceRevenueExperiment =
    RACE_REVENUE_EXPERIMENT_MODE === 'legacy' || /^\d{10}$/.test(RACE_ENGAGED_AD_SLOT);
