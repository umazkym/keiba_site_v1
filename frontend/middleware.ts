import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    getJstTodayString,
    getRaceDetailPath,
    isRetiredRaceDate,
    isValidRaceDate,
    parseRaceNumberParam,
} from './lib/race-url';
import { getRaceCachePolicy } from './lib/race-cache-policy';


// 検索エンジンのクローラー。コスト保護中でも503を返してはいけない。
// 503が続くとインデックスから削除され、検索流入という資産そのものを失う。
const SEARCH_ENGINE_CRAWLER_PATTERN = /(?:googlebot|google-inspectiontool|bingbot|duckduckbot|baiduspider|yandexbot|slurp|applebot)/i;

// robots.txt で既に拒否を宣言している大量巡回クローラー。
// コスト保護中はここだけを絞る。新しい拒否ポリシーは足さず、
// 宣言済みの内容を無視してくる相手にだけ効かせる。
//
// facebookexternalhit は含めない。SNSシェア時のリンクプレビュー生成に使われ、
// 遮断するとFacebook・Instagramの共有カードが壊れる。
// chatgpt-user / oai-searchbot も含めない。前者は利用者の操作起点、
// 後者はChatGPT検索の露出に関わり、いずれもrobots.txtで拒否していない。
const BULK_CRAWLER_PATTERN = /(?:meta-webindexer|meta-externalagent|gptbot|claudebot|ccbot|amazonbot|bytespider|petalbot|ahrefsbot|semrushbot|mj12bot|dotbot|dataforseobot)/i;

function isBulkCrawler(userAgent: string): boolean {
    if (SEARCH_ENGINE_CRAWLER_PATTERN.test(userAgent)) return false;
    return BULK_CRAWLER_PATTERN.test(userAgent);
}

function isPublicHtmlNavigation(request: NextRequest): boolean {
    if (request.method !== 'GET' && request.method !== 'HEAD') return false;
    return (
        request.headers.get('rsc') !== '1'
        && request.headers.get('next-router-prefetch') !== '1'
        && request.headers.get('next-action') == null
    );
}

function isDataDetailPath(pathname: string): boolean {
    return (
        /^\/horses\/[^/]+$/.test(pathname)
        || /^\/jockeys\/data\/[^/]+$/.test(pathname)
        || /^\/trainers\/[^/]+$/.test(pathname)
        || /^\/courses\/[^/]+\/[^/]+$/.test(pathname)
    );
}

/**
 * ミドルウェア: URLの正規化
 *
 * Google Search Consoleで検出された問題を解決:
 * 1. 旧レース詳細クエリURLを安定パスへ統一
 * 2. 記事ページの日付プレフィックスなしslugを最新の記事にリダイレクト
 *
 * 例:
 * - /races/2024-11-03?venue=東京&race=7 → /races/2024-11-03/tokyo/7
 * - /articles/bloodline-sire-analysis → /articles/2025-10-26-bloodline-sire-analysis
 */
export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // 1. レースページURL正規化（301リダイレクト）
    // クエリ付き詳細URLは /races/YYYY-MM-DD/venue-slug/R へ統一する。
    // venueのみ・raceのみ・余分なクエリは日付ページへ集約して重複URLを増やさない。
    if (pathname === '/races' || pathname === '/races/') {
        const newUrl = new URL(request.url);
        newUrl.pathname = `/races/${getJstTodayString()}`;
        newUrl.search = '';

        return NextResponse.redirect(newUrl, {
            status: 307,
        });
    }

    if (pathname.startsWith('/races/')) {
        const todayPath = `/races/${getJstTodayString()}`;
        // /races/today はビルド時の日付ではなく、アクセス時点のJST日付へ転送する。
        if (pathname === '/races/today') {
            const newUrl = new URL(request.url);
            newUrl.pathname = `/races/${getJstTodayString()}`;
            newUrl.search = '';
            const redirectResponse = NextResponse.redirect(newUrl, {
                status: 307,
            });
            redirectResponse.headers.set('Cache-Control', 'private, no-store');
            return redirectResponse;
        }

        const dateOnlyMatch = pathname.match(/^\/races\/([^/]+)$/);
        const venueOnlyMatch = pathname.match(/^\/races\/([^/]+)\/([^/]+)$/);
        const detailMatch = pathname.match(/^\/races\/([^/]+)\/([^/]+)\/([^/]+)$/);

        // RACE_PAGE_MIN_DATE より前の開催日はページとして提供しない。
        // 404ではなく410を返し、検索エンジンに恒久削除を伝えてインデックスから外す。
        // リダイレクト判定より先に置き、日付ページへ吸収されないようにする。
        const requestedRaceDate =
            dateOnlyMatch?.[1] ?? venueOnlyMatch?.[1] ?? detailMatch?.[1];
        if (requestedRaceDate && isRetiredRaceDate(requestedRaceDate)) {
            return new NextResponse(
                'このレースページは提供を終了しました。',
                {
                    status: 410,
                    headers: {
                        'Cache-Control': 'public, max-age=86400',
                        'X-Robots-Tag': 'noindex',
                    },
                },
            );
        }

        if (venueOnlyMatch) {
            const [, date] = venueOnlyMatch;
            const newUrl = new URL(request.url);
            newUrl.pathname = isValidRaceDate(date) ? `/races/${date}` : todayPath;
            newUrl.search = '';

            return NextResponse.redirect(newUrl, {
                status: 301,
            });
        }

        if (detailMatch) {
            const [, date, venueSlug, raceParam] = detailMatch;
            const raceNumber = parseRaceNumberParam(raceParam);

            if (!isValidRaceDate(date) || !raceNumber) {
                const newUrl = new URL(request.url);
                newUrl.pathname = isValidRaceDate(date) ? `/races/${date}` : todayPath;
                newUrl.search = '';

                return NextResponse.redirect(newUrl, {
                    status: 301,
                });
            }

            const expectedPath = `/races/${date}/${venueSlug.toLowerCase()}/${raceNumber}`;
            if (pathname !== expectedPath || searchParams.size > 0) {
                const newUrl = new URL(request.url);
                newUrl.pathname = expectedPath;
                newUrl.search = '';

                return NextResponse.redirect(newUrl, {
                    status: 301,
                });
            }
        }

        if (dateOnlyMatch && !isValidRaceDate(dateOnlyMatch[1]) && dateOnlyMatch[1] !== 'today') {
            const newUrl = new URL(request.url);
            newUrl.pathname = todayPath;
            newUrl.search = '';

            return NextResponse.redirect(newUrl, {
                status: 301,
            });
        }

        const venue = searchParams.get('venue');
        const race = searchParams.get('race');

        if (dateOnlyMatch && dateOnlyMatch[1] !== 'today' && searchParams.size > 0) {
            const date = dateOnlyMatch[1];
            const raceNumber = parseRaceNumberParam(race);
            const newUrl = new URL(request.url);

            if (venue && raceNumber) {
                newUrl.pathname = getRaceDetailPath(date, venue, raceNumber);
            } else {
                newUrl.pathname = `/races/${date}`;
            }
            newUrl.search = '';

            return NextResponse.redirect(newUrl, {
                status: 301,
            });
        }
    }

    // 2. 記事ページの日付プレフィックスなしslugを処理
    if (pathname.startsWith('/articles/')) {
        const slug = pathname.replace('/articles/', '');

        // 日付プレフィックスがない記事slug（Google Search Consoleで404になっているもの）
        const legacyArticles: { [key: string]: string } = {
            'bloodline-sire-analysis': '2025-11-09-bloodline-data-analysis',
            'frame-number-analysis': '2025-10-26-frame-number-analysis',
            'ground-condition-impact': '2025-10-26-ground-condition-impact',
            'distance-suitability-data': '2025-10-26-distance-suitability-data',
            'track-condition': '2025-10-26-ground-condition-impact',
            'horse-weight': '2025-11-11-weight-change-impact-analysis',
            '2026-03-24-kyotodirt1200m-waku-data': '2026-03-26-kyotodirt1200m-waku-data',
            '2026-03-25-kyotodirt1200m-waku-data': '2026-03-26-kyotodirt1200m-waku-data',
            'nakayama-gate-data-hub': '2025-10-04-nakayama-dirt-1200m-data-analysis',
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

    // 2.1. 旧カテゴリURLを現行カテゴリへ集約する。
    // Search Consoleでソフト404扱いになった旧カテゴリ名だけを対象にし、
    // 記事一覧そのものや現行カテゴリのURL構造は変えない。
    if (pathname === '/articles') {
        const selectedCategory = searchParams.get('category');
        const categoryRedirects: { [key: string]: string } = {
            'course-data': 'コース分析',
            '騎手データ分析': '騎手分析',
            '血統・馬券コラム': '馬券・統計',
        };

        if (selectedCategory && categoryRedirects[selectedCategory]) {
            const newUrl = new URL(request.url);
            const tag = searchParams.get('tag');
            newUrl.pathname = '/articles';
            newUrl.search = '';
            newUrl.searchParams.set('category', categoryRedirects[selectedCategory]);
            if (tag) {
                newUrl.searchParams.set('tag', tag);
            }

            return NextResponse.redirect(newUrl, {
                status: 301,
            });
        }
    }

    // 2.5. 旧ハブURL・単数形URLを現行ページへ集約
    const legacyPathRedirects: { [key: string]: string } = {
        '/data': '/keiba-data',
        '/data/track-condition': '/keiba-data/track-condition',
        '/data/horse-weight': '/keiba-data/horse-weight',
        '/keiba-data/ground-condition': '/keiba-data/track-condition',
        '/jockey': '/jockeys',
        '/jockey/yutaka-take': '/jockeys/yutaka-take',
        '/jockey/christophe-lemaire': '/jockeys/christophe-lemaire',
        '/jockey/yuga-kawada': '/jockeys/yuga-kawada',
        '/course': '/courses',
        '/course/nakayama/dirt-1200m': '/courses/nakayama/dirt-1200m',
        '/course/tokyo/turf-2400m': '/courses/tokyo/turf-2400m',
        '/accuracy': '/results/accuracy',
        '/results': '/results/accuracy',
        '/grade-races/2026-nihon-derby': '/grade-races/nihon-derby',
        '/grade-races/2026-yasuda-kinen': '/grade-races/yasuda-kinen',
        '/grade-races/2026-takarazuka-kinen': '/grade-races/takarazuka-kinen',
        '/grade-races/2026-sprinters-stakes': '/grade-races/sprinters-stakes',
        '/grade-races/2026-tenno-sho-autumn': '/grade-races/tenno-sho-autumn',
        '/grade-races/2026-japan-cup': '/grade-races/japan-cup',
        '/grade-races/2026-mile-championship': '/grade-races/mile-championship',
        '/grade-races/2026-arima-kinen': '/grade-races/arima-kinen',
        '/grade-races/derby': '/grade-races/nihon-derby',
        '/grade-races/yasuda': '/grade-races/yasuda-kinen',
        '/grade-races/takarazuka': '/grade-races/takarazuka-kinen',
        '/grade-races/sprinters-s': '/grade-races/sprinters-stakes',
        '/grade-races/tenno-sho': '/grade-races/tenno-sho-autumn',
        '/grade-races/mile-cs': '/grade-races/mile-championship',
        '/articles/courses/hakodate/turf-1200m': '/courses/hakodate/turf-1200m',
        '/articles/jockeys/yuji-tannai': '/jockeys/yuji-tannai',
        '/courses/nakayama': '/courses',
        '/guides': '/articles',
    };

    if (legacyPathRedirects[pathname]) {
        const newUrl = new URL(request.url);
        newUrl.pathname = legacyPathRedirects[pathname];
        newUrl.search = '';

        return NextResponse.redirect(newUrl, {
            status: 301,
        });
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
    if (/^\/rac(?=\d{4}-\d{2}-\d{2}(?:\/|$))/.test(pathname)) {
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

    const response = NextResponse.next();
    const archiveGuardEnabled = process.env.ARCHIVE_COST_GUARD_MODE === 'stale-only';
    const bulkCrawler = isBulkCrawler(request.headers.get('user-agent') ?? '');
    if (
        archiveGuardEnabled
        && bulkCrawler
        && isPublicHtmlNavigation(request)
        && isDataDetailPath(pathname)
    ) {
        return new NextResponse('データ詳細ページは一時的にキャッシュから配信しています。', {
            status: 503,
            headers: {
                'Cache-Control': 'private, no-store',
                'Retry-After': '86400',
                'X-Archive-Cost-Guard': 'stale-only',
            },
        });
    }

    const racePageMatch = pathname.match(/^\/races\/(\d{4}-\d{2}-\d{2})(?:\/|$)/);
    if (racePageMatch && isPublicHtmlNavigation(request)) {
        const raceDate = racePageMatch[1];
        const cachePolicy = getRaceCachePolicy(raceDate);

        if (
            archiveGuardEnabled
            && cachePolicy.tier === 'archive'
            && bulkCrawler
        ) {
            return new NextResponse('過去レースページは一時的にキャッシュから配信しています。', {
                status: 503,
                headers: {
                    'Cache-Control': 'private, no-store',
                    'Retry-After': '86400',
                    'X-Archive-Cost-Guard': 'stale-only',
                },
            });
        }

        response.headers.set('Cache-Control', cachePolicy.cacheControl);
        response.headers.set('X-Race-Cache-Tier', cachePolicy.tier);
    }
    return response;
}

// ミドルウェアの適用範囲を指定
export const config = {
    matcher: [
        '/races/:path*',
        '/articles/:path*',
        '/search',
        '/rac:path*',
        '/guides/:path*',
        '/data/:path*',
        '/horses/:path*',
        '/jockey/:path*',
        '/jockeys/data/:path*',
        '/trainers/:path*',
        '/course/:path*',
        '/courses/:path*',
        '/accuracy',
        '/results',
        '/grade-races/:path*',
    ],
};
