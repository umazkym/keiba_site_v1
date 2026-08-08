export type SocialPlatform =
    | 'x'
    | 'youtube'
    | 'threads'
    | 'instagram'
    | 'facebook'
    | 'tiktok'
    | 'pinterest'
    | 'bluesky';

export type SocialLink = {
    platform: SocialPlatform;
    label: string;
    url: string;
};

const socialLinkDefinitions: Array<{
    platform: SocialPlatform;
    label: string;
    configuredUrl: string | undefined;
}> = [
    {
        platform: 'x',
        label: '公式X',
        configuredUrl:
            process.env.NEXT_PUBLIC_SOCIAL_X_URL ||
            'https://x.com/umafree_ai',
    },
    {
        platform: 'youtube',
        label: '公式YouTube',
        configuredUrl:
            process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL ||
            'https://www.youtube.com/@uma-free_ai',
    },
    {
        platform: 'threads',
        label: '公式Threads',
        configuredUrl:
            process.env.NEXT_PUBLIC_SOCIAL_THREADS_URL ||
            'https://www.threads.net/@umafree_ai',
    },
    {
        platform: 'instagram',
        label: '公式Instagram',
        configuredUrl: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL,
    },
    {
        platform: 'facebook',
        label: '公式Facebook',
        configuredUrl: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL,
    },
    {
        platform: 'tiktok',
        label: '公式TikTok',
        configuredUrl: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL,
    },
    {
        platform: 'pinterest',
        label: '公式Pinterest',
        configuredUrl: process.env.NEXT_PUBLIC_SOCIAL_PINTEREST_URL,
    },
    {
        platform: 'bluesky',
        label: '公式Bluesky',
        configuredUrl: process.env.NEXT_PUBLIC_SOCIAL_BLUESKY_URL,
    },
];

export function getConfiguredSocialLinks(): SocialLink[] {
    return socialLinkDefinitions.flatMap((item) => {
        const url = item.configuredUrl?.trim();
        if (!url || !/^https:\/\//u.test(url)) return [];
        return [{ platform: item.platform, label: item.label, url }];
    });
}
