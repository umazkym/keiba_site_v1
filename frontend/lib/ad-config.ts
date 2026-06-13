export const MANUAL_ADS_MODE = process.env.NEXT_PUBLIC_MANUAL_ADS_MODE ?? 'enabled';
export const ADSENSE_AUTO_ADS_MODE = process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE ?? 'enabled';
export const ADSENSE_OFFERWALL_MODE = process.env.NEXT_PUBLIC_ADSENSE_OFFERWALL_MODE ?? 'enabled';
export const REWARDED_AD_MODE = process.env.NEXT_PUBLIC_REWARDED_AD_MODE ?? 'fallback';
export const FULLSCREEN_AD_MODE = process.env.NEXT_PUBLIC_FULLSCREEN_AD_MODE ?? 'disabled';
export const SHOW_DEV_AD_PLACEHOLDERS = process.env.NEXT_PUBLIC_SHOW_DEV_AD_PLACEHOLDERS ?? 'disabled';

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
