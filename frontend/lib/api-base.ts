const PRODUCTION_API_BASE_URL = 'https://keiba-site-v1-761440273070.us-west1.run.app';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

export function getApiBaseUrl(): string {
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
