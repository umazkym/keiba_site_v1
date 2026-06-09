const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

type RakutenAffiliateResolveResponse = {
    affiliateUrl?: string;
    sourceUrl?: string;
    itemCode?: string;
    itemName?: string;
    itemPrice?: number | string;
    imageUrl?: string;
    resolved?: boolean;
    reason?: string | null;
};

export type ResolvedAffiliateLink = {
    affiliateUrl: string;
    itemName?: string;
    itemPrice?: number;
    imageUrl?: string;
};

const MEMORY_CACHE = new Map<string, ResolvedAffiliateLink>();
const STORAGE_PREFIX = 'uma-free:rakuten-affiliate-url:v1:';
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashString = (value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
};

const getStorageKey = (url: string) => `${STORAGE_PREFIX}${hashString(url)}`;

const normalizePayload = (
    sourceUrl: string,
    payload: RakutenAffiliateResolveResponse
): ResolvedAffiliateLink | null => {
    const affiliateUrl = typeof payload.affiliateUrl === 'string'
        ? payload.affiliateUrl.trim()
        : '';
    if (!affiliateUrl || affiliateUrl === sourceUrl) return null;

    const itemPrice = typeof payload.itemPrice === 'number'
        ? payload.itemPrice
        : Number(payload.itemPrice);

    return {
        affiliateUrl,
        itemName: typeof payload.itemName === 'string' ? payload.itemName : undefined,
        itemPrice: Number.isFinite(itemPrice) ? itemPrice : undefined,
        imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined,
    };
};

const readStoredUrl = (sourceUrl: string) => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(getStorageKey(sourceUrl));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ResolvedAffiliateLink & { expiresAt?: number };
        if (!parsed.affiliateUrl || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
            window.localStorage.removeItem(getStorageKey(sourceUrl));
            return null;
        }
        return {
            affiliateUrl: parsed.affiliateUrl,
            itemName: parsed.itemName,
            itemPrice: parsed.itemPrice,
            imageUrl: parsed.imageUrl,
        };
    } catch {
        return null;
    }
};

const writeStoredUrl = (sourceUrl: string, resolvedLink: ResolvedAffiliateLink) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(
            getStorageKey(sourceUrl),
            JSON.stringify({
                ...resolvedLink,
                expiresAt: Date.now() + STORAGE_TTL_MS,
            })
        );
    } catch {
        // localStorageが使えない環境ではメモリキャッシュだけで十分。
    }
};

export const resolveRakutenAffiliateLink = async (sourceUrl: string) => {
    const normalizedUrl = sourceUrl.trim();
    if (!normalizedUrl) return null;

    const cached = MEMORY_CACHE.get(normalizedUrl) || readStoredUrl(normalizedUrl);
    if (cached) return cached;

    try {
        const endpoint = `${API_BASE_URL}/api/v1/affiliate/rakuten/resolve?url=${encodeURIComponent(normalizedUrl)}`;
        const response = await fetch(endpoint);
        if (!response.ok) return null;

        const payload = await response.json() as RakutenAffiliateResolveResponse;
        const resolvedLink = normalizePayload(normalizedUrl, payload);
        if (!resolvedLink) return null;

        MEMORY_CACHE.set(normalizedUrl, resolvedLink);
        writeStoredUrl(normalizedUrl, resolvedLink);
        return resolvedLink;
    } catch {
        return null;
    }
};
