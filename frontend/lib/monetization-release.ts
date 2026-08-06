export const MONETIZATION_FIXED_ROLLOUT_ID = 'UMA-FREE-TRAFFIC-RECOVERY-2026-08';

export type MonetizationReleaseAttribution = {
    release_policy: 'experiment' | 'fixed';
    fixed_rollout_id?: string;
};

export const getMonetizationReleaseAttribution = (): MonetizationReleaseAttribution => {
    const isFixedRollout =
        process.env.NEXT_PUBLIC_RACE_REVENUE_EXPERIMENT_MODE === 'engaged_display'
        && process.env.NEXT_PUBLIC_ARTICLE_RACE_BRIDGE_MODE === 'on'
        && process.env.NEXT_PUBLIC_ARTICLE_AD_PLACEMENT_MODE === 'variant'
        && process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_MODE === 'qualified_nar';

    return isFixedRollout
        ? {
            release_policy: 'fixed',
            fixed_rollout_id: MONETIZATION_FIXED_ROLLOUT_ID,
        }
        : { release_policy: 'experiment' };
};
