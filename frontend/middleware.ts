import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ミドルウェア: URLの正規化
 *
 * Google Search Consoleで検出された問題を解決:
 * 1. レースページのクエリパラメータの順序を統一
 * 2. 記事ページの日付プレフィックスなしslugを最新の記事にリダイレクト
 *
 * 例:
 * - /races/2024-11-03?venue=東京&race=7 → /races/2024-11-03?race=7&venue=東京
 * - /articles/bloodline-sire-analysis → /articles/2025-10-26-bloodline-sire-analysis
 */
export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // 1. レースページのクエリパラメータ正規化
    if (pathname.startsWith('/races/')) {
        const venue = searchParams.get('venue');
        const race = searchParams.get('race');

        // クエリパラメータが両方存在する場合のみ正規化
        if (venue && race) {
            // 現在のURLの順序を確認
            const url = request.url;
            const queryString = url.split('?')[1] || '';

            // 既に正しい順序（race→venue）になっている場合はそのまま
            const correctOrder = `race=${race}&venue=${encodeURIComponent(venue)}`;

            // 正規化が必要な場合（venue→raceの順序）
            if (queryString !== correctOrder && queryString !== correctOrder.replace(encodeURIComponent(venue), venue)) {
                // 正しい順序でリダイレクト（301 Permanent Redirect）
                const newUrl = new URL(request.url);
                newUrl.search = `?race=${race}&venue=${encodeURIComponent(venue)}`;

                return NextResponse.redirect(newUrl, {
                    status: 301, // 恒久的リダイレクト
                });
            }
        }
    }

    // 2. 記事ページの日付プレフィックスなしslugを処理
    if (pathname.startsWith('/articles/')) {
        const slug = pathname.replace('/articles/', '');

        // 日付プレフィックスがない記事slug（Google Search Consoleで404になっているもの）
        const legacyArticles: { [key: string]: string } = {
            'bloodline-sire-analysis': '2025-10-26-bloodline-sire-analysis',
            'frame-number-analysis': '2025-10-26-frame-number-analysis',
            'ground-condition-impact': '2025-10-26-ground-condition-impact',
            'distance-suitability-data': '2025-10-26-distance-suitability-data',
        };

        // 日付プレフィックスなしのslugが存在する場合、正しいslugにリダイレクト
        if (legacyArticles[slug]) {
            const newUrl = new URL(request.url);
            newUrl.pathname = `/articles/${legacyArticles[slug]}`;

            return NextResponse.redirect(newUrl, {
                status: 301, // 恒久的リダイレクト
            });
        }
    }

    // 3. 検索ページのプレースホルダーURLを処理
    if (pathname === '/search') {
        const q = searchParams.get('q');
        // {search_term_string}のようなプレースホルダーが含まれている場合、トップページにリダイレクト
        if (q && (q.includes('{') || q.includes('}'))) {
            const newUrl = new URL(request.url);
            newUrl.pathname = '/';
            newUrl.search = '';

            return NextResponse.redirect(newUrl, {
                status: 301,
            });
        }
    }

    // 4. タイポURL（/racなど）を正しいURLにリダイレクト
    if (pathname.startsWith('/rac') && !pathname.startsWith('/races/')) {
        // /rac2024-12-05 のようなタイポを /races/2024-12-05 に修正
        const correctedPath = pathname.replace(/^\/rac/, '/races/');
        const newUrl = new URL(request.url);
        newUrl.pathname = correctedPath;

        return NextResponse.redirect(newUrl, {
            status: 301,
        });
    }

    return NextResponse.next();
}

// ミドルウェアの適用範囲を指定
export const config = {
    matcher: ['/races/:path*', '/articles/:path*', '/search', '/rac:path*'],
};
