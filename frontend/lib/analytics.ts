import { sendClarityEvent } from '@/lib/clarity';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
        __umaGaReady?: boolean;
    }
}

/**
 * GA4 カスタムイベント送信用ヘルパー関数群
 * (注: App RouterではClinet Component内から呼び出すことを想定しています)
 */

export type ContentCategory = 'race_prediction' | 'data_analysis' | 'news' | 'other';
export type PredictAccuracy = 'hit' | 'miss' | 'none';
export type AdFormat =
    | 'display_inline'
    | 'display_banner'
    | 'display_sidebar'
    | 'in_feed'
    | 'native_card'
    | 'sticky_bottom'
    | 'multiplex';

export type AdImpressionParams = {
    placement: string;
    format: AdFormat;
    slot?: string;
    variant?: string;
};

export type AdViewableParams = AdImpressionParams;

export type RewardGateEventName =
    | 'reward_gate_view'
    | 'reward_gate_click'
    | 'reward_ad_ready'
    | 'reward_ad_requested'
    | 'reward_ad_started'
    | 'reward_ad_granted'
    | 'reward_ad_closed'
    | 'reward_ad_unavailable'
    | 'reward_fallback_used'
    | 'premium_data_view';

export type RewardGateEventParams = {
    race_id?: string;
    race_date?: string;
    venue_name?: string;
    race_number?: number;
    race_name?: string;
    gate_placement?: string;
    reward_type?: string;
    ad_unit_path?: string;
    ad_status?: string;
    result?: string;
    reason?: string;
};

export type AffiliateClickParams = {
    campaign_id: string;
    link_id: string;
    provider: string;
    context: string;
    campaign_type: string;
    race_type?: string;
    venue_name?: string;
};

export type AffiliateImpressionParams = {
    campaign_id: string;
    link_id: string;
    provider: string;
    providers?: string;
    context: string;
    campaign_type: string;
    link_count: number;
    race_type?: string;
    venue_name?: string;
};

export type RaceNavigationMethod =
    | 'race_selector'
    | 'previous_button'
    | 'next_button'
    | 'analysis_next_button'
    | 'same_day_list';

export type HomeRaceEntryMethod =
    | 'hero_cta'
    | 'sticky_cta'
    | 'grade_fallback'
    | 'venue_card';

export type ArticleRaceDestinationType = 'exact_race' | 'race_date' | 'today';
export type ArticleRacePreviewState = 'available' | 'metadata_only' | 'unavailable' | 'generic';

type ArticleRaceAttribution = {
    article_slug: string;
    link_placement: string;
    destination_type: ArticleRaceDestinationType;
    link_path: string;
    race_id?: string;
    race_name?: string;
    race_date?: string;
    preview_state?: ArticleRacePreviewState;
    stored_at: number;
};

const ARTICLE_RACE_ATTRIBUTION_KEY = 'uma_article_race_attribution_v1';
const ARTICLE_RACE_ATTRIBUTION_TTL_MS = 30 * 60 * 1000;
const YOUTUBE_ATTRIBUTION_KEY = 'uma_youtube_attribution_v1';
const SOCIAL_VIDEO_ATTRIBUTION_KEY = 'uma_social_video_attribution_v2';
const SOCIAL_VIDEO_ATTRIBUTION_TTL_MS = 30 * 60 * 1000;
const ORGANIC_VIDEO_PLATFORMS = new Set([
    'threads',
    'instagram',
    'facebook',
    'tiktok',
    'pinterest',
    'bluesky',
]);

type SocialVideoAttribution = {
    source_platform: string;
    source_content_key: string;
    video_format: 'venue_long' | 'short';
    source_venue: string;
    stored_at: number;
};

function storeArticleRaceAttribution(attribution: ArticleRaceAttribution): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(ARTICLE_RACE_ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
        // ストレージが使えない環境ではイベント送信だけを維持する。
    }
}

function consumeArticleRaceAttribution(raceId?: string): ArticleRaceAttribution | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(ARTICLE_RACE_ATTRIBUTION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ArticleRaceAttribution;
        const expired = !parsed.stored_at || Date.now() - parsed.stored_at > ARTICLE_RACE_ATTRIBUTION_TTL_MS;
        const wrongRace = Boolean(parsed.race_id && raceId && parsed.race_id !== raceId);
        if (expired || wrongRace) {
            window.sessionStorage.removeItem(ARTICLE_RACE_ATTRIBUTION_KEY);
            return null;
        }
        window.sessionStorage.removeItem(ARTICLE_RACE_ATTRIBUTION_KEY);
        return parsed;
    } catch {
        // sessionStorage自体が拒否された環境では、追加操作を行わず通常計測を続ける。
        return null;
    }
}

function clearArticleRaceAttribution(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(ARTICLE_RACE_ATTRIBUTION_KEY);
    } catch {
        // ストレージが使えない環境でもYouTube流入の計測は継続する。
    }
}

function captureSocialVideoAttribution(sourceVenue: string): SocialVideoAttribution | null {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const source = (searchParams.get('utm_source') || '').trim().toLowerCase();
    const medium = (searchParams.get('utm_medium') || '').trim().toLowerCase();
    const campaign = (searchParams.get('utm_campaign') || '').trim().toLowerCase();
    const utmContent = (searchParams.get('utm_content') || '').trim().slice(0, 100);
    const isYouTubeVideoLink = source === 'youtube' && medium === 'video' && Boolean(utmContent);
    const isYouTubeProfileLink = source === 'youtube' && medium === 'profile';
    const isOrganicSocialVideo =
        ORGANIC_VIDEO_PLATFORMS.has(source) &&
        medium === 'organic_social' &&
        (campaign === 'daily_race_video' || campaign === 'profile');
    if (!isYouTubeVideoLink && !isYouTubeProfileLink && !isOrganicSocialVideo) return null;
    const contentKey =
        utmContent ||
        (source === 'youtube' ? 'channel_profile' : `${source}_profile`);

    const attribution: SocialVideoAttribution = {
        source_platform: source,
        source_content_key: contentKey,
        video_format:
            source !== 'youtube' ||
            isYouTubeProfileLink ||
            contentKey.startsWith('short_')
                ? 'short'
                : 'venue_long',
        source_venue: sourceVenue,
        stored_at: Date.now(),
    };
    try {
        window.sessionStorage.setItem(SOCIAL_VIDEO_ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
        // sessionStorageが拒否されても現在URLから返した属性で計測する。
    }
    return attribution;
}

export function captureSocialVideoEntryAttribution(): void {
    if (typeof window === 'undefined') return;
    const isRaceDetail = /^\/races\/\d{4}-\d{2}-\d{2}\/[^/]+\/\d+\/?$/u.test(window.location.pathname);
    if (isRaceDetail) return;
    captureSocialVideoAttribution('');
}

/** 旧コンポーネント・テスト向けの互換エクスポート。 */
export const captureYouTubeEntryAttribution = captureSocialVideoEntryAttribution;

function consumeSocialVideoAttribution(sourceVenue: string): SocialVideoAttribution | null {
    if (typeof window === 'undefined') return null;
    const captured = captureSocialVideoAttribution(sourceVenue);
    if (captured) {
        try {
            window.sessionStorage.removeItem(SOCIAL_VIDEO_ATTRIBUTION_KEY);
            window.sessionStorage.removeItem(YOUTUBE_ATTRIBUTION_KEY);
        } catch {
            // 現在URLの属性を返せるため削除失敗は無視する。
        }
        return captured;
    }
    try {
        const raw =
            window.sessionStorage.getItem(SOCIAL_VIDEO_ATTRIBUTION_KEY) ||
            window.sessionStorage.getItem(YOUTUBE_ATTRIBUTION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SocialVideoAttribution & {
            source_video_key?: string;
        };
        const contentKey = parsed.source_content_key || parsed.source_video_key || '';
        const expired =
            !parsed.stored_at ||
            Date.now() - parsed.stored_at > SOCIAL_VIDEO_ATTRIBUTION_TTL_MS;
        if (expired || !contentKey) {
            window.sessionStorage.removeItem(SOCIAL_VIDEO_ATTRIBUTION_KEY);
            window.sessionStorage.removeItem(YOUTUBE_ATTRIBUTION_KEY);
            return null;
        }
        window.sessionStorage.removeItem(SOCIAL_VIDEO_ATTRIBUTION_KEY);
        window.sessionStorage.removeItem(YOUTUBE_ATTRIBUTION_KEY);
        return {
            source_platform: parsed.source_platform || 'youtube',
            source_content_key: contentKey,
            video_format: parsed.video_format,
            source_venue: parsed.source_venue || sourceVenue,
            stored_at: parsed.stored_at,
        };
    } catch {
        return null;
    }
}

type QueuedAnalyticsEvent = {
    eventName: string;
    params: Record<string, unknown>;
};

const MAX_QUEUED_EVENTS = 100;
const queuedAnalyticsEvents: QueuedAnalyticsEvent[] = [];
let isGaReadyListenerAttached = false;

const compactParams = (params: Record<string, unknown>) => {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
};

const flushQueuedAnalyticsEvents = () => {
    if (typeof window === 'undefined' || !window.__umaGaReady || typeof window.gtag !== 'function') return;

    while (queuedAnalyticsEvents.length > 0) {
        const event = queuedAnalyticsEvents.shift();
        if (event) window.gtag('event', event.eventName, event.params);
    }
};

const ensureGaReadyListener = () => {
    if (typeof window === 'undefined' || isGaReadyListenerAttached) return;
    isGaReadyListenerAttached = true;
    window.addEventListener('uma:ga-ready', flushQueuedAnalyticsEvents, { once: true });
};

const sendAnalyticsEvent = (eventName: string, params: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return;

    const compactedParams = compactParams(params);
    if (window.__umaGaReady && typeof window.gtag === 'function') {
        window.gtag('event', eventName, compactedParams);
        return;
    }

    if (queuedAnalyticsEvents.length >= MAX_QUEUED_EVENTS) {
        queuedAnalyticsEvents.shift();
    }
    queuedAnalyticsEvents.push({ eventName, params: compactedParams });
    ensureGaReadyListener();
};

const inferPageType = () => {
    if (typeof window === 'undefined') return 'unknown';

    const pathname = window.location.pathname;
    if (pathname === '/') return 'home';
    if (pathname === '/articles') return 'articles_index';
    if (pathname.startsWith('/articles/')) return 'article';
    if (/^\/races\/\d{4}-\d{2}-\d{2}\/[^/]+\/\d{1,2}$/.test(pathname)) return 'race_detail';
    if (pathname.startsWith('/races/')) return 'race_day';
    if (pathname.startsWith('/keiba-data')) return 'data_guide';
    if (pathname.startsWith('/results/')) return 'results';
    if (pathname === '/faq') return 'faq';
    return 'other';
};

/**
 * 予想表が画面内に表示された際に送信するイベント。
 * 記事の読了とは意味が異なるため、read_complete とは分離する。
 */
export const sendPredictionTableViewEvent = (params: {
    pagePath: string;
    raceId: string;
    raceNumber: number;
}) => {
    sendAnalyticsEvent('prediction_table_view', {
        page_path: params.pagePath,
        race_id: params.raceId,
        race_number: params.raceNumber,
    });
    sendClarityEvent('prediction_table_view', {
        race_number: params.raceNumber,
    });
};

/**
 * AdSenseが広告を配信した時点で送信する互換イベント。
 * 実視認の判定には sendAdViewableEvent を使用する。
 */
export const sendAdImpressionEvent = (params: string | AdImpressionParams) => {
    const normalized =
        typeof params === 'string'
            ? { placement: params, format: 'display_inline' as const }
            : params;

    sendAnalyticsEvent('ad_impression_custom', {
        ad_placement: normalized.placement,
        ad_format: normalized.format,
        ad_slot: normalized.slot,
        ad_variant: normalized.variant,
        ad_page_type: inferPageType(),
    });
    sendClarityEvent('ad_impression_custom', {
        ad_placement: normalized.placement,
        ad_format: normalized.format,
        ad_page_type: inferPageType(),
    });
};

/**
 * 広告枠の50%以上が1秒間画面内にあったときに送信する実視認イベント。
 */
export const sendAdViewableEvent = (params: AdViewableParams) => {
    const eventParams = {
        ad_placement: params.placement,
        ad_format: params.format,
        ad_slot: params.slot,
        ad_variant: params.variant,
        ad_page_type: inferPageType(),
    };

    sendAnalyticsEvent('ad_viewable_custom', eventParams);
    sendClarityEvent('ad_viewable_custom', {
        ad_placement: params.placement,
        ad_format: params.format,
        ad_page_type: eventParams.ad_page_type,
    });
};

/**
 * ホームから当日レースへ進む入口を計測する。
 * ホームのクイックバックと、その後の予想表閲覧を入口別に比較するために使う。
 */
export const sendHomeRaceEntryClickEvent = (params: {
    race_date: string;
    entry_method: HomeRaceEntryMethod;
    race_type?: 'jra' | 'nar';
    venue_name?: string;
}) => {
    sendAnalyticsEvent('home_race_entry_click', params);
    sendClarityEvent('home_race_entry_click', {
        home_entry_method: params.entry_method,
        race_type: params.race_type,
        venue_name: params.venue_name,
    });
};

/**
 * レースページ内でユーザーが実際に見たレースを計測する。
 * 日付ページ全体のPVだけでは、リピーターが何レース分確認しているかが見えないため、
 * 収益改善の判断軸として競馬場・レース番号単位のイベントを送る。
 */
export const sendRaceViewEvent = (params: {
    race_id?: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    race_type: 'jra' | 'nar';
}) => {
    const socialVideoAttribution = consumeSocialVideoAttribution(params.venue_name);
    if (socialVideoAttribution) clearArticleRaceAttribution();
    const articleAttribution = socialVideoAttribution ? null : consumeArticleRaceAttribution(params.race_id);
    const isYouTubeAttribution = socialVideoAttribution?.source_platform === 'youtube';
    const attributedParams = socialVideoAttribution
        ? isYouTubeAttribution
          ? {
            ...params,
            entry_source: 'youtube',
            source_video_key: socialVideoAttribution.source_content_key,
            video_format: socialVideoAttribution.video_format,
            source_venue: socialVideoAttribution.source_venue,
          }
          : {
            ...params,
            entry_source: 'social_video',
            source_platform: socialVideoAttribution.source_platform,
            source_content_key: socialVideoAttribution.source_content_key,
            video_format: socialVideoAttribution.video_format,
            source_venue: socialVideoAttribution.source_venue,
        }
        : articleAttribution
          ? {
            ...params,
            entry_source: 'article',
            source_article_slug: articleAttribution.article_slug,
            article_entry_method: articleAttribution.link_placement,
            article_destination_type: articleAttribution.destination_type,
        }
          : params;
    sendAnalyticsEvent('race_view', attributedParams);
    sendClarityEvent('race_view', {
        race_type: params.race_type,
        venue_name: params.venue_name,
        race_number: params.race_number,
        entry_source: socialVideoAttribution
            ? isYouTubeAttribution
                ? 'youtube'
                : 'social_video'
            : articleAttribution
              ? 'article'
              : 'direct_or_other',
        source_platform: socialVideoAttribution?.source_platform,
        source_content_key: socialVideoAttribution?.source_content_key,
        source_video_key: isYouTubeAttribution
            ? socialVideoAttribution?.source_content_key
            : undefined,
        video_format: socialVideoAttribution?.video_format,
        article_entry_method: articleAttribution?.link_placement,
    });
};

/**
 * 中央・地方タブの切り替えを計測する。
 * 仮想PVにはせず、実ページ表示と画面内操作を明確に分ける。
 */
export const sendRaceGroupSelectEvent = (params: {
    race_date: string;
    race_type: 'jra' | 'nar';
}) => {
    sendAnalyticsEvent('race_group_select', params);
    sendClarityEvent('race_group_select', {
        race_type: params.race_type,
    });
};

/**
 * 同一日ページ内の競馬場タブ切り替えを計測する。
 */
export const sendRaceVenueSelectEvent = (params: {
    race_date: string;
    race_type: 'jra' | 'nar';
    venue_name: string;
}) => {
    sendAnalyticsEvent('race_venue_select', params);
    sendClarityEvent('race_venue_select', {
        race_type: params.race_type,
        venue_name: params.venue_name,
    });
};

/**
 * 同一競馬場内での前後レース・レース番号選択を計測する。
 */
export const sendRaceNavigationEvent = (params: {
    race_date: string;
    venue_name: string;
    race_type: 'jra' | 'nar';
    from_race_number: number;
    to_race_number: number;
    navigation_method: RaceNavigationMethod;
}) => {
    sendAnalyticsEvent('race_navigation', params);
    sendClarityEvent('race_navigation', {
        race_type: params.race_type,
        venue_name: params.venue_name,
        navigation_method: params.navigation_method,
    });
};

/**
 * 記事本文の末尾まで到達した際に1回だけ送信する。
 */
export const sendArticleReadCompleteEvent = (params: {
    article_slug: string;
    article_category: string;
    reading_time_min: number;
    page_path: string;
}) => {
    sendAnalyticsEvent('article_read_complete', params);
    sendClarityEvent('article_read_complete', {
        article_category: params.article_category,
    });
};

/**
 * 記事からレースページへ進んだクリックを計測する。
 */
export const sendArticleRaceClickEvent = (params: {
    article_slug: string;
    article_category: string;
    link_path: string;
    link_placement: string;
    destination_type: ArticleRaceDestinationType;
    race_id?: string;
    race_name?: string;
    race_date?: string;
    preview_state?: ArticleRacePreviewState;
}) => {
    storeArticleRaceAttribution({
        ...params,
        stored_at: Date.now(),
    });
    sendAnalyticsEvent('article_race_click', params);
    sendClarityEvent('article_race_click', {
        article_category: params.article_category,
        link_placement: params.link_placement,
        destination_type: params.destination_type,
        preview_state: params.preview_state,
    });
};

export const sendArticleRacePreviewViewEvent = (params: {
    article_slug: string;
    article_category: string;
    race_id: string;
    race_name: string;
    race_date: string;
    preview_state: ArticleRacePreviewState;
    link_placement: string;
}) => {
    sendAnalyticsEvent('article_race_preview_view', params);
    sendClarityEvent('article_race_preview_view', {
        article_category: params.article_category,
        preview_state: params.preview_state,
        link_placement: params.link_placement,
    });
};

/**
 * AI予想などの結果を確認・閲覧した際に送信するイベント
 * リワード広告視聴後の遷移や、有料枠のアンロック時に活用する
 * @param accuracy - 予想が的中したかどうかのフラグ
 */
export const sendPredictionViewEvent = (accuracy: PredictAccuracy) => {
    sendAnalyticsEvent('prediction_view', {
        predict_accuracy: accuracy,
    });
};

/**
 * リワード広告ゲートの表示、押下、広告開始、報酬付与、解放後閲覧までを計測する。
 * GA4でファネルを組めるよう、イベント名を細かく分けて送る。
 */
export const sendRewardGateEvent = (eventName: RewardGateEventName, params: RewardGateEventParams = {}) => {
    sendAnalyticsEvent(eventName, params);
    sendClarityEvent(eventName, {
        venue_name: params.venue_name,
        gate_placement: params.gate_placement,
        ad_status: params.ad_status,
        result: params.result,
        reason: params.reason,
    });
};

export const sendAffiliateClickEvent = (params: AffiliateClickParams) => {
    sendAnalyticsEvent('affiliate_click', {
        ...params,
        affiliate_page_type: inferPageType(),
    });
    sendClarityEvent('affiliate_click', {
        affiliate_link_id: params.link_id,
        affiliate_provider: params.provider,
        affiliate_context: params.context,
        affiliate_campaign_type: params.campaign_type,
        race_type: params.race_type,
    });
};

export const sendAffiliateImpressionEvent = (params: AffiliateImpressionParams) => {
    sendAnalyticsEvent('affiliate_impression', {
        ...params,
        affiliate_page_type: inferPageType(),
    });
    sendClarityEvent('affiliate_impression', {
        affiliate_link_id: params.link_id,
        affiliate_provider: params.provider,
        affiliate_context: params.context,
        affiliate_campaign_type: params.campaign_type,
        race_type: params.race_type,
    });
};

export const sendWebVitalEvent = (params: {
    metric_name: string;
    metric_id: string;
    value: number;
    rating: string;
    navigation_type: string;
    release_id: string;
}) => {
    sendAnalyticsEvent('web_vital', {
        ...params,
        page_path: typeof window === 'undefined' ? undefined : window.location.pathname,
        page_type: inferPageType(),
    });
};

export const sendAdsenseOfferwallViewEvent = (params: { path_group: string }) => {
    sendAnalyticsEvent('adsense_offerwall_view', {
        path_group: params.path_group,
        page_path: typeof window === 'undefined' ? undefined : window.location.pathname,
        page_type: inferPageType(),
    });
    sendClarityEvent('adsense_offerwall_view', {
        path_group: params.path_group,
        page_type: inferPageType(),
    });
};

export const sendAdExperimentExposureEvent = (params: {
    experiment_id: string;
    variant: string;
    slot_id: string;
    page_type?: string;
}) => {
    sendAnalyticsEvent('ad_experiment_exposure', {
        ...params,
        page_type: params.page_type || inferPageType(),
    });
};
