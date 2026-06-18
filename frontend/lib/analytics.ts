import { sendGAEvent } from '@next/third-parties/google';

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
    providers: string;
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

const compactParams = (params: Record<string, unknown>) => {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
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
    sendGAEvent('event', 'prediction_table_view', {
        page_path: params.pagePath,
        race_id: params.raceId,
        race_number: params.raceNumber,
    });
};

/**
 * 特定の配置の広告が画面内にインプレッション（表示）された際に送信するイベント
 * @param params - 広告の配置位置、形式、スロットなど
 */
export const sendAdImpressionEvent = (params: string | AdImpressionParams) => {
    const normalized =
        typeof params === 'string'
            ? { placement: params, format: 'display_inline' as const }
            : params;

    sendGAEvent('event', 'ad_impression_custom', {
        ad_placement: normalized.placement,
        ad_format: normalized.format,
        ad_slot: normalized.slot,
        ad_variant: normalized.variant,
        ad_page_type: inferPageType(),
    });
};

/**
 * レースページ内でユーザーが実際に見たレースを計測する。
 * 日付ページ全体のPVだけでは、リピーターが何レース分確認しているかが見えないため、
 * 収益改善の判断軸として競馬場・レース番号単位のイベントを送る。
 */
export const sendRaceViewEvent = (params: {
    race_date: string;
    venue_name: string;
    race_number: number;
    race_name: string;
    race_type: 'jra' | 'nar';
}) => {
    sendGAEvent('event', 'race_view_custom', params);
};

/**
 * 中央・地方タブの切り替えを計測する。
 * 仮想PVにはせず、実ページ表示と画面内操作を明確に分ける。
 */
export const sendRaceGroupSelectEvent = (params: {
    race_date: string;
    race_type: 'jra' | 'nar';
}) => {
    sendGAEvent('event', 'race_group_select', params);
};

/**
 * 同一日ページ内の競馬場タブ切り替えを計測する。
 */
export const sendRaceVenueSelectEvent = (params: {
    race_date: string;
    race_type: 'jra' | 'nar';
    venue_name: string;
}) => {
    sendGAEvent('event', 'race_venue_select', params);
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
    sendGAEvent('event', 'race_navigation', params);
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
    sendGAEvent('event', 'article_read_complete', params);
};

/**
 * 記事からレースページへ進んだクリックを計測する。
 */
export const sendArticleRaceClickEvent = (params: {
    article_slug: string;
    article_category: string;
    link_path: string;
    link_placement: string;
}) => {
    sendGAEvent('event', 'article_race_click', params);
};

/**
 * AI予想などの結果を確認・閲覧した際に送信するイベント
 * リワード広告視聴後の遷移や、有料枠のアンロック時に活用する
 * @param accuracy - 予想が的中したかどうかのフラグ
 */
export const sendPredictionViewEvent = (accuracy: PredictAccuracy) => {
    sendGAEvent('event', 'prediction_view', {
        predict_accuracy: accuracy,
    });
};

/**
 * リワード広告ゲートの表示、押下、広告開始、報酬付与、解放後閲覧までを計測する。
 * GA4でファネルを組めるよう、イベント名を細かく分けて送る。
 */
export const sendRewardGateEvent = (eventName: RewardGateEventName, params: RewardGateEventParams = {}) => {
    sendGAEvent('event', eventName, compactParams(params));
};

export const sendAffiliateClickEvent = (params: AffiliateClickParams) => {
    sendGAEvent('event', 'affiliate_click', compactParams({
        ...params,
        affiliate_page_type: inferPageType(),
    }));
};

export const sendAffiliateImpressionEvent = (params: AffiliateImpressionParams) => {
    sendGAEvent('event', 'affiliate_impression', compactParams({
        ...params,
        affiliate_page_type: inferPageType(),
    }));
};
