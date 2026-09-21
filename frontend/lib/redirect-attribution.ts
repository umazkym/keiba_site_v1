/**
 * URL正規化で残す計測用クエリ。構造用クエリや未知の値は正規URLへ持ち込まない。
 * canonicalは各ページのmetadataで常にクエリなしのパスを指す。
 */
const ATTRIBUTION_QUERY_KEYS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_id',
    'utm_content',
    'utm_term',
    'utm_source_platform',
    'utm_creative_format',
    'utm_marketing_tactic',
    'gclid',
    'dclid',
    'gbraid',
    'wbraid',
    'msclkid',
    'fbclid',
]);

export function isAttributionQueryKey(key: string): boolean {
    return ATTRIBUTION_QUERY_KEYS.has(key.toLowerCase());
}

export function hasNonAttributionQuery(searchParams: URLSearchParams): boolean {
    return Array.from(searchParams.keys()).some((key) => !isAttributionQueryKey(key));
}

/**
 * redirect先の検索文字列を計測allowlistだけで置き換える。
 * URLSearchParamsを通すことで既存のエンコードを一度だけ正規化し、二重エンコードを避ける。
 */
export function preserveAttributionQuery(
    source: URLSearchParams,
    target: URL,
): void {
    target.search = '';
    const copiedKeys = new Set<string>();
    for (const [rawKey, value] of source.entries()) {
        const key = rawKey.toLowerCase();
        if (!isAttributionQueryKey(key) || copiedKeys.has(key)) continue;
        copiedKeys.add(key);
        target.searchParams.append(key, value);
    }
}
