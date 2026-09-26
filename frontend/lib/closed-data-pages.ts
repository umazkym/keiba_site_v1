/**
 * 提供を終了したデータページ（競走馬・調教師）。2026-09-26 に閉じた。
 *
 * 閉じた理由（2026-09-13 までの実測）:
 * - 閲覧は全体の 0.5〜7%、検索クリックは 6/1〜9/13 で馬3件・調教師0件。
 * - 候補が約1万8千件あるひな形ページで、ロボットの巡回と DB 読み取りの負荷の元だった。
 *
 * ミドルウェアはこのパスに 410 を返す。画面では、API がこのパスの url を返してもリンクにしない
 * （バックエンドは手動で反映するため、古い API のままでも閉じた状態を保つ）。
 * 騎手（/jockeys/data/）・コース（/courses/）・馬比較（/compare）は残す。
 */
export const CLOSED_DATA_PAGE_PREFIXES = ['/horses', '/trainers'] as const;

/** 閉じたデータページの種類。検索結果や保存データの絞り込みに使う。 */
export const CLOSED_DATA_ENTITY_TYPES: ReadonlySet<string> = new Set(['horse', 'trainer']);

/** 絶対URL・相対パスのどちらでも、閉じたデータページを指していれば true。 */
export function isClosedDataPath(url: string | null | undefined): boolean {
    if (!url) return false;
    const pathname = url.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    return CLOSED_DATA_PAGE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

/** リンクにしてよい url だけを返す。閉じたページや空の url は null。 */
export function linkableDataHref(url: string | null | undefined): string | null {
    if (!url || isClosedDataPath(url)) return null;
    return url;
}
