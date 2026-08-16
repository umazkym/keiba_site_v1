const PRODUCTION_API_BASE_URL = 'https://keiba-site-v1-761440273070.us-west1.run.app';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * ブラウザへ公開してよいAPIのベースURL。
 *
 * 対戦成績（/api/v1/predictions/matchups/）はクライアントから直接叩いており、
 * バックエンドのリクエストの約2割がブラウザ由来。ここを内部URLにしてはいけない。
 */
export function getPublicApiBaseUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configuredUrl) {
        return configuredUrl.replace(/\/+$/, '');
    }

    if (process.env.NODE_ENV === 'development') {
        return LOCAL_API_BASE_URL;
    }

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return LOCAL_API_BASE_URL;
        }
    }

    return PRODUCTION_API_BASE_URL;
}

/**
 * SSR・ルートハンドラから叩くAPIのベースURL。
 *
 * INTERNAL_API_BASE_URL を設定すると、サーバー側の取得だけがその経路を使う。
 * 未設定なら公開URLにフォールバックするため、設定するまで挙動は一切変わらない。
 *
 * NEXT_PUBLIC_ を付けないことで、この値はクライアントバンドルへ含まれない。
 */
export function getApiBaseUrl(): string {
    if (typeof window === 'undefined') {
        const internalUrl = process.env.INTERNAL_API_BASE_URL?.trim();
        if (internalUrl) {
            return internalUrl.replace(/\/+$/, '');
        }
    }

    return getPublicApiBaseUrl();
}
