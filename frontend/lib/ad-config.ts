export const MANUAL_ADS_MODE = process.env.NEXT_PUBLIC_MANUAL_ADS_MODE ?? 'enabled';

export const isManualAdsEnabled = MANUAL_ADS_MODE === 'enabled';
