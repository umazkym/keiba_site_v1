export type AffiliateContext =
    | 'race_after_prediction'
    | 'race_after_premium_data'
    | 'race_after_top_hits'
    | 'article_footer'
    | 'home_goods'
    | 'home_nar_voting'
    | 'site_header';

export type AffiliateCampaignType = 'voting' | 'product';

export type AffiliateProvider =
    | 'rakuten_keiba'
    | 'spat4'
    | 'oddspark'
    | 'rakuten'
    | 'amazon'
    | 'official';

export type RaceType = 'jra' | 'nar';
export type RakutenKeibaMode = 'legacy' | 'qualified_nar';
export type RakutenKeibaPlacement =
    | 'site_header'
    | 'home_nar_voting'
    | 'race_after_prediction_nar'
    | 'race_after_prediction_jra'
    | 'race_after_top_hits';

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
    rakutenMode?: RakutenKeibaMode;
    ctaOnly?: boolean;
    showDescription?: boolean;
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
    rakutenMode?: RakutenKeibaMode;
};

const DEFAULT_VOTING_NOTICE = '※馬券の購入は20歳以上の方のみ対象です。';
const DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL = 'https://ad2.trafficgate.net/t/r/14/1958/318200_397641';

const normalizeTrafficGateUrl = (value: string | undefined) => {
    const candidate = value?.trim();
    if (!candidate) return DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL;

    try {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'https:' && parsed.hostname === 'ad2.trafficgate.net') {
            return parsed.toString();
        }
    } catch {
        // 不正な公開環境値では既存の検証済みリンクへ戻す。
    }

    return DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL;
};

export const RAKUTEN_KEIBA_MODE: RakutenKeibaMode =
    process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_MODE === 'qualified_nar'
        ? 'qualified_nar'
        : 'legacy';

export const shouldShowRakutenKeibaHeader = (
    mode: RakutenKeibaMode = RAKUTEN_KEIBA_MODE
) => mode !== 'qualified_nar';

export const RAKUTEN_KEIBA_AFFILIATE_URLS: Record<RakutenKeibaPlacement, string> = {
    site_header: normalizeTrafficGateUrl(process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_SITE_HEADER_URL),
    home_nar_voting: normalizeTrafficGateUrl(process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_HOME_NAR_URL),
    race_after_prediction_nar: normalizeTrafficGateUrl(process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_RACE_NAR_URL),
    race_after_prediction_jra: normalizeTrafficGateUrl(process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_RACE_JRA_URL),
    race_after_top_hits: normalizeTrafficGateUrl(process.env.NEXT_PUBLIC_RAKUTEN_KEIBA_TOP_HITS_URL),
};

export const getRakutenKeibaPlacement = (
    context: AffiliateContext,
    raceType?: RaceType
): RakutenKeibaPlacement => {
    if (context === 'site_header') return 'site_header';
    if (context === 'home_nar_voting') return 'home_nar_voting';
    if (context === 'race_after_top_hits') return 'race_after_top_hits';
    return raceType === 'jra' ? 'race_after_prediction_jra' : 'race_after_prediction_nar';
};

export const getRakutenKeibaAffiliateUrl = (
    context: AffiliateContext,
    raceType?: RaceType
) => {
    return RAKUTEN_KEIBA_AFFILIATE_URLS[getRakutenKeibaPlacement(context, raceType)];
};

export const AFFILIATE_CAMPAIGNS: AffiliateCampaign[] = [
    {
        id: 'rakuten-keiba-default',
        enabled: true,
        type: 'voting',
        title: '楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で',
        description: '',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction', 'race_after_premium_data', 'race_after_top_hits', 'home_nar_voting'],
        weight: 1200,
        rakutenMode: 'legacy',
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'rakuten-keiba-main',
                provider: 'rakuten_keiba',
                label: '今すぐチェック',
                url: DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'rakuten-keiba-jra-audience',
        enabled: true,
        type: 'voting',
        title: '楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で',
        description: '',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction', 'race_after_top_hits'],
        weight: 1200,
        rakutenMode: 'legacy',
        raceScope: {
            raceTypes: ['jra'],
        },
        links: [
            {
                id: 'rakuten-keiba-jra-main',
                provider: 'rakuten_keiba',
                label: '今すぐチェック',
                url: DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'rakuten-keiba-qualified-nar-race',
        enabled: true,
        type: 'voting',
        title: '楽天競馬を初めて利用する方へ',
        description: '地方競馬全場に対応。会員登録には楽天会員情報と銀行口座の登録が必要です。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['race_after_prediction'],
        weight: 1200,
        rakutenMode: 'qualified_nar',
        ctaOnly: true,
        showDescription: true,
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'rakuten-keiba-qualified-nar-race-main',
                provider: 'rakuten_keiba',
                label: '新規登録キャンペーンを確認',
                url: DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'rakuten-keiba-qualified-nar-home',
        enabled: true,
        type: 'voting',
        title: '楽天競馬を初めて利用する方へ',
        description: '地方競馬全場に対応。会員登録には楽天会員情報と銀行口座の登録が必要です。',
        attention: DEFAULT_VOTING_NOTICE,
        contexts: ['home_nar_voting'],
        weight: 1200,
        rakutenMode: 'qualified_nar',
        ctaOnly: true,
        showDescription: true,
        raceScope: {
            raceTypes: ['nar'],
        },
        links: [
            {
                id: 'rakuten-keiba-qualified-nar-home-main',
                provider: 'rakuten_keiba',
                label: '新規登録キャンペーンを確認',
                url: DEFAULT_RAKUTEN_KEIBA_AFFILIATE_URL,
                enabled: true,
            },
        ],
    },
    {
        id: 'horse-plush-equinox-doudeuce',
        enabled: false,
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
        enabled: false,
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
        enabled: false,
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
    rakutenMode = RAKUTEN_KEIBA_MODE,
}: AffiliateFilter) => {
    return AFFILIATE_CAMPAIGNS.filter((campaign) => {
        if (campaign.enabled === false) return false;
        if (campaign.rakutenMode && campaign.rakutenMode !== rakutenMode) return false;
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
