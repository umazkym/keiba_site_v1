export type AffiliateContext =
    | 'race_after_prediction'
    | 'race_after_premium_data'
    | 'race_after_top_hits'
    | 'article_footer'
    | 'home_goods'
    | 'home_nar_voting';

export type AffiliateCampaignType = 'voting' | 'product';

export type AffiliateProvider =
    | 'rakuten_keiba'
    | 'spat4'
    | 'oddspark'
    | 'rakuten'
    | 'amazon'
    | 'official';

export type RaceType = 'jra' | 'nar';

export type AffiliateLink = {
    id: string;
    provider: AffiliateProvider;
    label: string;
    url: string;
    enabled?: boolean;
};

export type AffiliateCampaign = {
    id: string;
    enabled?: boolean;
    type: AffiliateCampaignType;
    title: string;
    description?: string;
    attention?: string;
    fallbackVisualLabel?: string;
    contexts: AffiliateContext[];
    weight?: number;
    startAt?: string;
    endAt?: string;
    raceScope?: {
        raceTypes?: RaceType[];
        includeVenues?: string[];
        excludeVenues?: string[];
    };
    links: AffiliateLink[];
};

export type AffiliateFilter = {
    context: AffiliateContext;
    raceType?: RaceType;
    venueName?: string;
    now?: Date;
};

const DEFAULT_VOTING_NOTICE = '※馬券の購入は20歳以上の方のみ対象です。';
const RAKUTEN_KEIBA_AFFILIATE_URL = 'https://ad2.trafficgate.net/t/r/14/1958/318200_397641';

export const AFFILIATE_CAMPAIGNS: AffiliateCampaign[] = [
    {
        id: 'rakuten-keiba-default',
        enabled: true,
        type: 'voting',
        title: '地方競馬のオッズを楽天競馬で確認',
        description: 'AI偏差値を確認した後は、楽天競馬側で最新オッズや発売状況を確認できます。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction', 'race_after_premium_data', 'race_after_top_hits', 'home_nar_voting'],
        weight: 1200,
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'rakuten-keiba-main',
                provider: 'rakuten_keiba',
                label: '楽天競馬でオッズを確認',
                url: RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'rakuten-keiba-jra-audience',
        enabled: true,
        type: 'voting',
        title: '地方競馬も確認する方へ',
        description: '中央競馬の分析とあわせて地方競馬も見る場合は、楽天競馬で開催情報やオッズを確認できます。初めて利用する方は、会員登録方法や対象条件をリンク先でご確認ください。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction', 'race_after_top_hits'],
        weight: 1200,
        raceScope: {
            raceTypes: ['jra'],
        },
        links: [
            {
                id: 'rakuten-keiba-jra-main',
                provider: 'rakuten_keiba',
                label: '楽天競馬の案内を見る',
                url: RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'horse-plush-equinox-doudeuce',
        enabled: true,
        type: 'product',
        title: 'サラブレッドコレクション ぬいぐるみ（イクイノックス / ドウデュース）',
        description: 'イクイノックス・ドウデュースの競走馬ぬいぐるみ（高さ約20cm）。デスクやリビングにも馴染みやすく、競馬ファンへのギフトとしても人気です。',
        fallbackVisualLabel: 'ぬいぐるみ',
        contexts: ['race_after_prediction', 'race_after_top_hits', 'article_footer', 'home_goods'],
        weight: 100,
        links: [
            {
                id: 'horse-plush-rakuten',
                provider: 'rakuten',
                label: '楽天市場で見る',
                url: 'https://item.rakuten.co.jp/shizuya/21700/',
                enabled: true,
            },
            {
                id: 'horse-plush-amazon',
                provider: 'amazon',
                label: 'Amazonで見る',
                url: 'https://amzn.to/4vuaGZK',
                enabled: true,
            },
        ],
    },
    {
        id: 'keiba-tshirt-collection',
        enabled: true,
        type: 'product',
        title: '競馬用語・名言Tシャツ｜競馬場の観戦やギフトに',
        description: '競馬用語や名セリフをプリントしたTシャツ。競馬場での観戦はもちろん、競馬好きへのプレゼントとしても喜ばれます。',
        fallbackVisualLabel: 'Tシャツ',
        contexts: ['race_after_prediction', 'race_after_top_hits', 'article_footer', 'home_goods'],
        weight: 80,
        links: [
            {
                id: 'keiba-tshirt-rakuten',
                provider: 'rakuten',
                label: '楽天市場で見る',
                url: 'https://item.rakuten.co.jp/irodori-ic/keibakeimaome/',
                enabled: true,
            },
            {
                id: 'keiba-tshirt-amazon',
                provider: 'amazon',
                label: 'Amazonで見る',
                url: 'https://amzn.to/4vvXBiG',
                enabled: true,
            },
        ],
    },
    {
        id: 'horseshoe-lucky-charm',
        enabled: true,
        type: 'product',
        title: '栗東トレセン実使用 幸運の馬蹄（古蹄鉄）',
        description: '栗東トレーニングセンターで実際にレースを走った馬の蹄鉄。古来より幸運のシンボルとされており、インテリアや縁起物として飾れます。',
        fallbackVisualLabel: '馬蹄グッズ',
        contexts: ['race_after_prediction', 'race_after_top_hits', 'article_footer', 'home_goods'],
        weight: 70,
        links: [
            {
                id: 'horseshoe-rakuten',
                provider: 'rakuten',
                label: '楽天市場で見る',
                url: 'https://item.rakuten.co.jp/penguinfly/10000002/?iasid=07rpp_10095___2u-mq6lqd6k-2v-4078b962-0ebc-461f-9928-f7f3e6bbf567',
                enabled: true,
            },
            {
                id: 'horseshoe-amazon',
                provider: 'amazon',
                label: 'Amazonで見る',
                url: 'https://amzn.to/4amrU3b',
                enabled: true,
            },
        ],
    },
    {
        id: 'spat4-future',
        enabled: false,
        type: 'voting',
        title: 'このレースを投票サイトで確認',
        description: '地方競馬の発売状況やオッズは、投票サイト側で最新情報を確認できます。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction'],
        weight: 30,
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'spat4-main',
                provider: 'spat4',
                label: 'SPAT4で馬券投票する',
                url: '',
                enabled: true,
            },
        ],
    },
    {
        id: 'oddspark-future',
        enabled: false,
        type: 'voting',
        title: 'このレースを投票サイトで確認',
        description: '地方競馬の発売状況やオッズは、投票サイト側で最新情報を確認できます。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction'],
        weight: 20,
        raceScope: {
            raceTypes: ['nar'],
            excludeVenues: ['門別', '浦和', '船橋', '大井', '川崎'],
        },
        links: [
            {
                id: 'oddspark-main',
                provider: 'oddspark',
                label: 'オッズパークで馬券投票する',
                url: '',
                enabled: true,
            },
        ],
    },
];

const isActiveByDate = (campaign: AffiliateCampaign, now: Date) => {
    const currentTime = now.getTime();
    if (campaign.startAt && Number.isFinite(Date.parse(campaign.startAt))) {
        const startTime = new Date(campaign.startAt).getTime();
        if (currentTime < startTime) return false;
    }
    if (campaign.endAt && Number.isFinite(Date.parse(campaign.endAt))) {
        const endTime = new Date(campaign.endAt).getTime();
        if (currentTime > endTime) return false;
    }
    return true;
};

export const getActiveAffiliateLinks = (campaign: AffiliateCampaign) => {
    return campaign.links.filter((link) => {
        return link.enabled !== false && link.url.trim().length > 0;
    });
};

const matchesRaceScope = (campaign: AffiliateCampaign, raceType?: RaceType, venueName?: string) => {
    const scope = campaign.raceScope;
    if (!scope) return true;

    if (scope.raceTypes && (!raceType || !scope.raceTypes.includes(raceType))) {
        return false;
    }

    if (scope.includeVenues && venueName && !scope.includeVenues.includes(venueName)) {
        return false;
    }

    if (scope.excludeVenues && venueName && scope.excludeVenues.includes(venueName)) {
        return false;
    }

    return true;
};

export const getAffiliateCampaignsForContext = ({
    context,
    raceType,
    venueName,
    now = new Date(),
}: AffiliateFilter) => {
    return AFFILIATE_CAMPAIGNS.filter((campaign) => {
        if (campaign.enabled === false) return false;
        if (!campaign.contexts.includes(context)) return false;
        if (!isActiveByDate(campaign, now)) return false;
        if (!matchesRaceScope(campaign, raceType, venueName)) return false;
        return getActiveAffiliateLinks(campaign).length > 0;
    });
};

const hashString = (value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
};

export const selectWeightedAffiliateCampaign = (
    campaigns: AffiliateCampaign[],
    seed: string
) => {
    if (campaigns.length === 0) return null;
    const totalWeight = campaigns.reduce((sum, campaign) => sum + Math.max(1, campaign.weight ?? 1), 0);
    let cursor = hashString(seed) % totalWeight;

    for (const campaign of campaigns) {
        cursor -= Math.max(1, campaign.weight ?? 1);
        if (cursor < 0) return campaign;
    }

    return campaigns[0];
};
