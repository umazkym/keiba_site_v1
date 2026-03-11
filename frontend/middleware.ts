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

    // 1. レースページのクエリパラメータ正規化（301リダイレクト）
    // ?venue=X&race=N → ?race=N&venue=X に正規化。
    // 全日付が対象。古い日付でデータがなくてもリダイレクト先で404を返すのは正常動作。
    if (pathname.startsWith('/races/')) {
        const venue = searchParams.get('venue');
        const race = searchParams.get('race');

        if (venue && race) {
            const dateMatch = pathname.match(/^\/races\/(\d{4}-\d{2}-\d{2})$/);

            if (dateMatch) {
                // パラメータの順序チェック: 最初のキーが 'race' でなければ
                const firstKey = Array.from(searchParams.keys())[0];

                if (firstKey !== 'race') {
                    // Vercel Edge環境では301リダイレクトのLocationヘッダーのパラメータ順序が
                    // 内部的に変更されるため、リダイレクトでは解決できない。
                    // 代わりにrewrite（内部転送）で正しいパラメータ順序のページを表示し、
                    // canonicalタグ（page.tsx側で設定済み）でGoogleに正規URLを通知する。
                    const rewriteUrl = new URL(request.url);
                    rewriteUrl.search = '';
                    rewriteUrl.searchParams.set('race', race);
                    rewriteUrl.searchParams.set('venue', venue);
                    return NextResponse.rewrite(rewriteUrl);
                }
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
            'odds-reading-guide': '/articles/2025-11-13-odds-reading-guide',
            'jockey-guide': '/articles/2025-10-26-beginners-complete-guide',
            'prediction-glossary': '/articles/2025-10-26-horseracing-terms-500',
            'course-guide': '/articles/2025-10-26-racecourse-access-guide',
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
