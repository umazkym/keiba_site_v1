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
            // URLSearchParamsで全パラメータを取得
            const params = new URLSearchParams(searchParams.toString());
            const paramsArray = Array.from(params.keys());

            // 最初のパラメータが'venue'の場合、または順序が不正な場合にリダイレクト
            if (paramsArray[0] === 'venue' || paramsArray.indexOf('race') > paramsArray.indexOf('venue')) {
                // 正しい順序でリダイレクト（301 Permanent Redirect）
                const newUrl = new URL(request.url);
                // 新しいURLSearchParamsを作成し、正しい順序で追加
                const newParams = new URLSearchParams();
                newParams.set('race', race);
                newParams.set('venue', venue);
                newUrl.search = newParams.toString();

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

    // 5. /guides パスのリダイレクト（旧ページ構造の名残。app/guidesは削除済み）
    // Google Search Consoleで5xxエラーとなっているURLを適切にリダイレクト
    if (pathname.startsWith('/guides/')) {
        const slug = pathname.replace('/guides/', '');

        // 既知のガイドスラッグを対応する記事にマッピング
        const guideToArticleMap: { [key: string]: string } = {
            'horseracing-basics': '/articles/2025-10-26-beginners-complete-guide',
        };

        const newUrl = new URL(request.url);
        if (guideToArticleMap[slug]) {
            newUrl.pathname = guideToArticleMap[slug];
        } else {
            // マッピングにないガイドは記事一覧にリダイレクト
            newUrl.pathname = '/articles';
        }
        newUrl.search = '';

        return NextResponse.redirect(newUrl, {
            status: 301,
        });
    }

    return NextResponse.next();
}

// ミドルウェアの適用範囲を指定
export const config = {
    matcher: ['/races/:path*', '/articles/:path*', '/search', '/rac:path*', '/guides/:path*'],
};
