import { MetadataRoute } from 'next'

// ▼▼▼▼▼【新規追加】robots.ts を作成▼▼▼▼▼
// このファイルが存在しない場合、クローラーはデフォルトで全URLを無制限に巡回する。
// crawlDelay を指定することで、Googlebotや各種SEOツールのアクセス頻度を
// 抑制し、Vercel Origin Transfer の消費を根本から削減する。
//
// 重要: Googlebot は crawlDelay を尊重しないが、
//   他の多くのボット（Bingbot, Ahrefsbot等）は尊重するため効果はある。
//   Googlebotの制御はGoogle Search Console の「クロール頻度」設定で別途行うこと。
// ▲▲▲▲▲【新規追加ここまで】▲▲▲▲▲

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                // 主要クローラー: 分析ガイド・記事・安定パス化したレースページをクロール対象にする。
                // 検索結果やAPIは重複・低品質URLになりやすいため除外。
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',        // APIエンドポイントは非公開
                    '/search?*',    // 検索結果ページは重複コンテンツ回避のためクロール除外
                ],
            },
            {
                // SEO監査ツール（Ahrefs, Semrush等）: クロール間隔をさらに長く制限
                // これらのツールが高頻度で全URLをパトロールするのが帯域消費の一因。
                userAgent: ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot'],
                disallow: '/races/',  // レースページ群へのアクセスを完全にブロック
                crawlDelay: 30,
            },
        ],
        sitemap: [
            'https://uma-free.com/sitemap.xml',
            'https://uma-free.com/sitemap-articles.xml',
            'https://uma-free.com/sitemap-images.xml',
        ],
    }
}
