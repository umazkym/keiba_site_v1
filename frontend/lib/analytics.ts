import { sendGAEvent } from '@next/third-parties/google';

/**
 * GA4 カスタムイベント送信用ヘルパー関数群
 * (注: App RouterではClinet Component内から呼び出すことを想定しています)
 */

export type ContentCategory = 'race_prediction' | 'data_analysis' | 'news' | 'other';
export type PredictAccuracy = 'hit' | 'miss' | 'none';

/**
 * 記事の最下部など、特定の位置まで熟読された際に送信するイベント
 * @param category - コンテンツのカテゴリ (例: race_prediction)
 * @param pagePath - 現在のページパス
 */
export const sendReadCompleteEvent = (category: string, pagePath: string) => {
    sendGAEvent('event', 'read_complete', {
        content_category: category,
        page_path: pagePath,
    });
};

/**
 * 特定の配置の広告が画面内にインプレッション（表示）された際に送信するイベント
 * @param placement - 広告の配置位置 (例: 'in_article_1', 'sticky_bottom')
 */
export const sendAdImpressionEvent = (placement: string) => {
    sendGAEvent('event', 'ad_impression_custom', {
        ad_placement: placement,
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
}) => {
    sendGAEvent('event', 'race_view_custom', params);
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
