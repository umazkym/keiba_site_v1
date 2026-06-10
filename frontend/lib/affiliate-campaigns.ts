export type AffiliateContext =
    | 'race_after_prediction'
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

const DEFAULT_VOTING_NOTICE = '勝馬投票券の購入は20歳以上から。分析データは参考情報として、無理のない範囲でご利用ください。';

export const AFFILIATE_CAMPAIGNS: AffiliateCampaign[] = [
    {
        id: 'rakuten-keiba-default',
        enabled: true,
        type: 'voting',
        title: '地方競馬のオッズと投票会員登録を確認',
        description: '地方競馬全場の発売状況とオッズをまとめて確認できます。楽天銀行口座をお持ちの方は、楽天競馬の投票会員登録手続きへ進めます。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction', 'race_after_top_hits', 'home_nar_voting'],
        weight: 520,
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'rakuten-keiba-main',
                provider: 'rakuten_keiba',
                label: '楽天競馬で詳細を見る',
                url: 'https://ad2.trafficgate.net/t/r/14/1958/318200_397641',
                enabled: true,
            },
        ],
    },
    {
        id: 'horse-plush-equinox-doudeuce',
        enabled: true,
        type: 'product',
        title: 'サラブレッドコレクション GBぬいぐるみ',
        description: 'イクイノックス・ドウデュースのGBサイズ。棚やデスクに置きやすい競走馬グッズです。',
        contexts: ['race_after_top_hits', 'article_footer', 'home_goods'],
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
        title: '競馬系Tシャツ',
        description: '馬券や競馬用語をそのまま着るタイプの文字Tシャツ。観戦日や部屋着向けです。',
        contexts: ['race_after_top_hits', 'article_footer', 'home_goods'],
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
        title: '実使用の古蹄鉄',
        description: '栗東トレセンのサラブレッドが実際に使用した蹄鉄。玄関やデスクまわりに置けます。',
        contexts: ['race_after_top_hits', 'article_footer', 'home_goods'],
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
                label: 'SPAT4で確認',
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
                label: 'オッズパークで確認',
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
