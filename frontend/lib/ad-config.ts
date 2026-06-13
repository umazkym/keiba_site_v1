export const MANUAL_ADS_MODE = process.env.NEXT_PUBLIC_MANUAL_ADS_MODE ?? 'enabled';
export const ADSENSE_AUTO_ADS_MODE = process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE ?? 'manual-only';
export const ADSENSE_OFFERWALL_MODE = process.env.NEXT_PUBLIC_ADSENSE_OFFERWALL_MODE ?? 'enabled';
export const REWARDED_AD_MODE = process.env.NEXT_PUBLIC_REWARDED_AD_MODE ?? 'fallback';
export const FULLSCREEN_AD_MODE = process.env.NEXT_PUBLIC_FULLSCREEN_AD_MODE ?? 'disabled';

export const isManualAdsEnabled = MANUAL_ADS_MODE === 'enabled';
export const isAdsenseAutoAdsEnabled = ADSENSE_AUTO_ADS_MODE === 'enabled';
export const isAdsenseOfferwallEnabled = ADSENSE_OFFERWALL_MODE === 'enabled';
export const shouldLoadAdsensePageLevelScript = isAdsenseAutoAdsEnabled || isAdsenseOfferwallEnabled;
export const isRewardedAdsEnabled = REWARDED_AD_MODE === 'enabled' && FULLSCREEN_AD_MODE === 'enabled';
