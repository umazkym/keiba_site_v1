import { sendClarityEvent } from '@/lib/clarity';
import { RACE_REVENUE_EXPERIMENT_ID } from '@/lib/ad-config';
import { getBrowserMonetizationContext } from '@/lib/monetization-context';
import { getMonetizationReleaseAttribution } from '@/lib/monetization-release';

export const ANALYTICS_MEASUREMENT_RELEASE_ID =
    process.env.NEXT_PUBLIC_ANALYTICS_RELEASE_ID ?? '2026-08-01-ga-route-v2';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
        __umaGaReady?: boolean;
        __umaSuppressedPageViewPath?: string;
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
const DATA_UPCOMING_ATTRIBUTION_KEY = 'uma_data_upcoming_attribution_v1';
const ORGANIC_VIDEO_PLATFORMS = new Set([
    'threads',
    'instagram',
    'facebook',
    'tiktok',
    'pinterest',
    'bluesky',
]);
const NORMAL_SOCIAL_PLATFORMS = new Set(['x', 'threads']);

export type SocialVideoAttribution = {
    source_platform: string;
    source_content_key: string;
    video_format: 'venue_long' | 'short' | 'none';
    source_venue: string;
    post_type: string;
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

function storeDataUpcomingAttribution(raceId: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(DATA_UPCOMING_ATTRIBUTION_KEY, JSON.stringify({
            race_id: raceId,
            stored_at: Date.now(),
        }));
    } catch {
        // 保存不可でもクリックイベント自体は送信する。
    }
}

function consumeDataUpcomingAttribution(raceId?: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = window.sessionStorage.getItem(DATA_UPCOMING_ATTRIBUTION_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { race_id?: string; stored_at?: number };
        const expired = !parsed.stored_at || Date.now() - parsed.stored_at > ARTICLE_RACE_ATTRIBUTION_TTL_MS;
        const matches = Boolean(raceId && parsed.race_id === raceId);
        window.sessionStorage.removeItem(DATA_UPCOMING_ATTRIBUTION_KEY);
        return !expired && matches;
    } catch {
        return false;
    }
}

export function parseSocialAttributionSearch(
    search: string,
    sourceVenue: string,
    storedAt = Date.now(),
): SocialVideoAttribution | null {
    const searchParams = new URLSearchParams(search);
    const source = (searchParams.get('utm_source') || '').trim().toLowerCase();
    const medium = (searchParams.get('utm_medium') || '').trim().toLowerCase();
    const campaign = (searchParams.get('utm_campaign') || '').trim().toLowerCase();
    const utmContent = (searchParams.get('utm_content') || '').trim().slice(0, 100);
    const utmTerm = (searchParams.get('utm_term') || '').trim().slice(0, 60);
    const isYouTubeVideoLink =
        source === 'youtube'
        && medium === 'video'
        && Boolean(utmContent)
        && (campaign === 'daily_race_video_v2' || campaign === 'daily_race_video');
    const isYouTubeProfileLink = source === 'youtube' && medium === 'profile';
    const isOrganicSocialVideo =
        ORGANIC_VIDEO_PLATFORMS.has(source) &&
        medium === 'organic_social' &&
        (campaign === 'daily_race_video' || campaign === 'daily_race_video_v2' || campaign === 'profile');
    const isNormalSocialPost =
        NORMAL_SOCIAL_PLATFORMS.has(source)
        && medium === 'organic_social'
        && campaign === 'race_post_v2'
        && Boolean(utmContent);
    if (!isYouTubeVideoLink && !isYouTubeProfileLink && !isOrganicSocialVideo && !isNormalSocialPost) {
        return null;
    }
    const contentKey =
        utmContent ||
        (source === 'youtube' ? 'channel_profile' : `${source}_profile`);

    const postTypeFromContent = utmContent.match(/^(.+?)-\d{8}-[a-f0-9]{12}$/u)?.[1] || '';
    return {
        source_platform: source,
        source_content_key: contentKey,
        video_format:
            isNormalSocialPost
                ? 'none'
                : source !== 'youtube' ||
            isYouTubeProfileLink ||
            /(^|_)short(_|$)/u.test(contentKey)
                ? 'short'
                : 'venue_long',
        source_venue: sourceVenue,
        post_type: utmTerm || postTypeFromContent || (campaign === 'profile' ? 'profile' : 'social_video'),
        stored_at: storedAt,
    };
}

function captureSocialVideoAttribution(sourceVenue: string): SocialVideoAttribution | null {
    if (typeof window === 'undefined') return null;
    const attribution = parseSocialAttributionSearch(window.location.search, sourceVenue);
    if (!attribution) return null;
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
            post_type: parsed.post_type || 'social_video',
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

const normalizePagePath = (pathname: string) => {
    const normalized = pathname.replace(/\/+$/, '');
    return normalized || '/';
};

/**
 * 同一レースページ内の選択状態だけをURLへ反映する。
 * App Router側でpathnameが更新されても、次のpage_viewを明示的に抑止する。
 */
export const suppressNextPageViewPath = (pathname: string) => {
    if (typeof window === 'undefined') return;

    window.__umaSuppressedPageViewPath = normalizePagePath(pathname);
};

export const replaceRaceHistoryPathWithoutPageView = (pathname: string) => {
    if (typeof window === 'undefined') return;

    const normalizedPath = normalizePagePath(pathname);
    suppressNextPageViewPath(normalizedPath);
    window.history.replaceState(window.history.state, '', normalizedPath);
};

export const consumeSuppressedPageViewPath = (pathname: string) => {
    if (typeof window === 'undefined') return false;

    const normalizedPath = normalizePagePath(pathname);
    if (window.__umaSuppressedPageViewPath !== normalizedPath) return false;

    delete window.__umaSuppressedPageViewPath;
    return true;
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

    const compactedParams = compactParams({
        measurement_release_id: ANALYTICS_MEASUREMENT_RELEASE_ID,
        ...getBrowserMonetizationContext(),
        ...params,
    });
    if (process.env.NODE_ENV !== 'production') {
        const debugKey = `umaEventCount${eventName.replace(/(^|_)([a-z])/g, (_, __, letter: string) => letter.toUpperCase())}`;
        const currentCount = Number(document.documentElement.dataset[debugKey] ?? '0');
        document.documentElement.dataset[debugKey] = String(currentCount + 1);
        document.documentElement.dataset.umaLastAnalyticsEvent = eventName;
    }
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

export const setAnalyticsUserProperties = (properties: Record<string, string>) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('set', 'user_properties', compactParams(properties));
};

const inferPageType = () => getBrowserMonetizationContext().page_type;

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
        experiment_id: normalized.variant ? RACE_REVENUE_EXPERIMENT_ID : undefined,
        ad_page_type: inferPageType(),
    });
    sendClarityEvent('ad_impression_custom', {
        ad_placement: normalized.placement,
        ad_format: normalized.format,
        ad_slot: normalized.slot,
        ad_variant: normalized.variant,
        experiment_id: normalized.variant ? RACE_REVENUE_EXPERIMENT_ID : undefined,
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
        experiment_id: params.variant ? RACE_REVENUE_EXPERIMENT_ID : undefined,
        ad_page_type: inferPageType(),
    };

    sendAnalyticsEvent('ad_viewable_custom', eventParams);
    sendClarityEvent('ad_viewable_custom', {
        ad_placement: params.placement,
        ad_format: params.format,
        ad_slot: params.slot,
        ad_variant: params.variant,
        experiment_id: params.variant ? RACE_REVENUE_EXPERIMENT_ID : undefined,
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
    const dataUpcomingAttribution = socialVideoAttribution || articleAttribution
        ? false
        : consumeDataUpcomingAttribution(params.race_id);
    const isYouTubeAttribution = socialVideoAttribution?.source_platform === 'youtube';
    const isNormalSocialPost = socialVideoAttribution?.video_format === 'none';
    const attributedParams = socialVideoAttribution
        ? isYouTubeAttribution
          ? {
            ...params,
            entry_source: 'youtube',
            source_video_key: socialVideoAttribution.source_content_key,
            source_platform: socialVideoAttribution.source_platform,
            source_content_key: socialVideoAttribution.source_content_key,
            video_format: socialVideoAttribution.video_format,
            source_venue: socialVideoAttribution.source_venue,
            post_type: socialVideoAttribution.post_type,
          }
          : {
            ...params,
            entry_source: isNormalSocialPost ? 'social_post' : 'social_video',
            source_platform: socialVideoAttribution.source_platform,
            source_content_key: socialVideoAttribution.source_content_key,
            video_format: socialVideoAttribution.video_format,
            source_venue: socialVideoAttribution.source_venue,
            post_type: socialVideoAttribution.post_type,
        }
        : articleAttribution
          ? {
            ...params,
            entry_source: 'article',
            source_article_slug: articleAttribution.article_slug,
            article_entry_method: articleAttribution.link_placement,
            article_destination_type: articleAttribution.destination_type,
        }
          : dataUpcomingAttribution
            ? {
                ...params,
                entry_source: 'data_upcoming',
                data_entry_method: 'upcoming_race',
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
                : isNormalSocialPost
                    ? 'social_post'
                    : 'social_video'
            : articleAttribution
              ? 'article'
              : dataUpcomingAttribution
                ? 'data_upcoming'
              : 'direct_or_other',
        source_platform: socialVideoAttribution?.source_platform,
        source_content_key: socialVideoAttribution?.source_content_key,
        source_video_key: isYouTubeAttribution
            ? socialVideoAttribution?.source_content_key
            : undefined,
        video_format: socialVideoAttribution?.video_format,
        post_type: socialVideoAttribution?.post_type,
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
    const releaseAttribution = getMonetizationReleaseAttribution();
    sendAnalyticsEvent('affiliate_click', {
        ...params,
        ...releaseAttribution,
        affiliate_page_type: inferPageType(),
    });
    sendClarityEvent('affiliate_click', {
        affiliate_link_id: params.link_id,
        affiliate_provider: params.provider,
        affiliate_context: params.context,
        affiliate_campaign_type: params.campaign_type,
        race_type: params.race_type,
        ...releaseAttribution,
    });
};

export const sendAffiliateImpressionEvent = (params: AffiliateImpressionParams) => {
    const releaseAttribution = getMonetizationReleaseAttribution();
    sendAnalyticsEvent('affiliate_impression', {
        ...params,
        ...releaseAttribution,
        affiliate_page_type: inferPageType(),
    });
    sendClarityEvent('affiliate_impression', {
        affiliate_link_id: params.link_id,
        affiliate_provider: params.provider,
        affiliate_context: params.context,
        affiliate_campaign_type: params.campaign_type,
        race_type: params.race_type,
        ...releaseAttribution,
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
    ad_placement: string;
    page_type?: string;
}) => {
    const releaseAttribution = getMonetizationReleaseAttribution();
    sendAnalyticsEvent('ad_experiment_exposure', {
        ...params,
        ...releaseAttribution,
        page_type: params.page_type || inferPageType(),
    });
    sendClarityEvent('ad_experiment_exposure', {
        experiment_id: params.experiment_id,
        variant: params.variant,
        slot_id: params.slot_id,
        ad_placement: params.ad_placement,
        page_type: params.page_type || inferPageType(),
        ...releaseAttribution,
    });
};

export type DataEntityEventType = 'course' | 'horse' | 'jockey' | 'trainer' | 'grade';

export const sendDataEntityViewEvent = (params: {
    entity_type: DataEntityEventType;
    entity_id: string;
    sample_size: number;
    indexable: boolean;
}) => {
    sendAnalyticsEvent('data_entity_view', params);
    sendClarityEvent('data_entity_view', {
        entity_type: params.entity_type,
        indexable: params.indexable,
    });
};

export const sendDataSearchEvent = (params: {
    query_length: number;
    result_count: number;
    search_surface: 'site_search' | 'data_hub' | 'directory' | 'compare';
}) => {
    sendAnalyticsEvent('data_search', params);
    sendClarityEvent('data_search', {
        result_count: params.result_count,
        search_surface: params.search_surface,
    });
};

export const sendDataFavoriteEvent = (params: {
    action: 'add' | 'remove';
    entity_type: DataEntityEventType;
    entity_id: string;
}) => {
    sendAnalyticsEvent('data_favorite', params);
    sendClarityEvent('data_favorite', {
        action: params.action,
        entity_type: params.entity_type,
    });
};

export const sendHorseCompareEvent = (params: {
    action: 'add' | 'remove' | 'view' | 'clear';
    horse_count: number;
}) => {
    sendAnalyticsEvent('horse_compare', params);
    sendClarityEvent('horse_compare', params);
};

export const sendDataHubActionClickEvent = (params: {
    action: 'today_compare' | 'name_search' | 'course_lookup';
    destination_type: 'race' | 'search' | 'course';
}) => {
    sendAnalyticsEvent('data_hub_action_click', params);
    sendClarityEvent('data_hub_action_click', params);
};

export const sendDataSearchResultClickEvent = (params: {
    entity_type: DataEntityEventType;
    result_position: number;
    result_count: number;
    search_surface: 'site_search' | 'data_hub' | 'directory' | 'compare';
    sample_size_bucket: '0_4' | '5_9' | '10_49' | '50_plus';
}) => {
    sendAnalyticsEvent('data_search_result_click', params);
    sendClarityEvent('data_search_result_click', {
        entity_type: params.entity_type,
        result_position: params.result_position,
        search_surface: params.search_surface,
    });
};

export const sendCompareResultViewEvent = (params: {
    horse_count: number;
    condition_scope: 'venue_surface_distance' | 'venue_surface_distance_ground';
    comparable_count: number;
}) => {
    sendAnalyticsEvent('compare_result_view', params);
    sendClarityEvent('compare_result_view', params);
};

export const sendCompareConditionChangeEvent = (params: {
    changed_field: 'venue' | 'course_type' | 'distance' | 'ground_condition' | 'apply';
    horse_count: number;
    has_ground_condition: boolean;
}) => {
    sendAnalyticsEvent('compare_condition_change', params);
    sendClarityEvent('compare_condition_change', params);
};

export const sendCompareRaceClickEvent = (params: {
    horse_position: number;
    run_position: number;
    destination_type: 'past_race' | 'horse_detail';
}) => {
    sendAnalyticsEvent('compare_race_click', params);
    sendClarityEvent('compare_race_click', params);
};

export const sendUpcomingRaceClickEvent = (params: {
    entity_type: 'horse' | 'jockey' | 'trainer';
    relative_date_bucket: 'today' | 'tomorrow' | 'later';
    link_placement: 'entity_detail';
    target_race_id: string;
}) => {
    storeDataUpcomingAttribution(params.target_race_id);
    const eventParams = {
        entity_type: params.entity_type,
        relative_date_bucket: params.relative_date_bucket,
        link_placement: params.link_placement,
    };
    sendAnalyticsEvent('upcoming_race_click', eventParams);
    sendClarityEvent('upcoming_race_click', eventParams);
};

export const sendSavedUserReturnEvent = (params: {
    saved_type_count: number;
    favorite_count_bucket: '0' | '1' | '2_5' | '6_plus';
    comparison_count: number;
    days_since_last_visit_bucket: '1_2' | '3_6' | '7_13' | '14_plus';
}) => {
    sendAnalyticsEvent('saved_user_return', params);
    sendClarityEvent('saved_user_return', params);
};

export const sendRecentRaceReturnClickEvent = (params: {
    destination_path: string;
    race_date: string;
    venue_name: string;
    race_number: number;
    age_hours: number;
}) => {
    sendAnalyticsEvent('recent_race_return_click', params);
    sendClarityEvent('recent_race_return_click', {
        venue_name: params.venue_name,
        race_number: params.race_number,
        age_hours_bucket: params.age_hours < 6 ? '0_5' : params.age_hours < 24 ? '6_23' : '24_plus',
    });
};

export const sendPwaInstallPromptViewEvent = (params: {
    surface: 'my_data';
    prompt_type: 'native' | 'ios_instruction';
}) => {
    sendAnalyticsEvent('pwa_install_prompt_view', params);
    sendClarityEvent('pwa_install_prompt_view', params);
};

export const sendPwaInstallResultEvent = (params: {
    surface: 'my_data';
    result: 'accepted' | 'dismissed' | 'installed' | 'ios_instruction';
}) => {
    sendAnalyticsEvent('pwa_install_result', params);
    sendClarityEvent('pwa_install_result', params);
};

export const sendArticleBridgeExperimentExposureEvent = (params: {
    variant: 'control' | 'treatment';
    article_slug: string;
    race_id: string;
}) => {
    const releaseAttribution = getMonetizationReleaseAttribution();
    const eventParams = {
        experiment_id: 'ARTICLE-RACE-BRIDGE-2026-08',
        ...releaseAttribution,
        variant: params.variant,
        article_slug: params.article_slug,
        race_id: params.race_id,
    };
    sendAnalyticsEvent('article_bridge_experiment_exposure', eventParams);
    sendClarityEvent('article_bridge_experiment_exposure', eventParams);
};

export const sendArticleAdPlacementExposureEvent = (params: {
    variant: 'control' | 'after_body_before_related';
    article_slug: string;
}) => {
    const releaseAttribution = getMonetizationReleaseAttribution();
    const eventParams = {
        experiment_id: 'ARTICLE-AD-READ-COMPLETE-2026-08',
        ...releaseAttribution,
        variant: params.variant,
        article_slug: params.article_slug,
        ad_placement: 'article_after_body',
    };
    sendAnalyticsEvent('article_ad_placement_exposure', eventParams);
    sendClarityEvent('article_ad_placement_exposure', eventParams);
};

export const sendPricingSurveyResponseEvent = (params: {
    response: 'use_at_390' | 'consider_by_features' | 'free_only' | 'not_needed';
    surface: 'my_data' | 'compare';
}) => {
    sendAnalyticsEvent('pricing_survey_response', params);
    sendClarityEvent('pricing_survey_response', params);
};

export const sendPricingSurveyViewEvent = (params: {
    surface: 'my_data' | 'compare';
}) => {
    sendAnalyticsEvent('pricing_survey_view', params);
    sendClarityEvent('pricing_survey_view', params);
};
