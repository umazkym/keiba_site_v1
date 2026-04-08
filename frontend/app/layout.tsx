import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from "@next/third-parties/google";
import { OrganizationSchema, WebsiteSchema, SoftwareApplicationSchema } from "@/components/StructuredData";
import { CookieConsent } from "@/components/CookieConsent";

import { Suspense } from "react";
import { GlobalAdManager } from "@/components/GlobalAdManager";

const inter = Inter({
    subsets: ["latin"],
    variable: '--font-inter',
    preload: true,
    display: 'swap'
});

const notoSansJP = Noto_Sans_JP({
    subsets: ["latin"],
    variable: '--font-noto-sans-jp',
    preload: true,
    display: 'swap'
});

const robotoMono = Roboto_Mono({
    subsets: ["latin"],
    variable: '--font-roboto-mono',
    preload: true,
    display: 'swap'
});

export const metadata: Metadata = {
    metadataBase: new URL("https://uma-free.com"),
    title: {
        default: "UMA-FREE - AI競馬データ分析・統計情報サイト",
        template: "%s | UMA-FREE",
    },
    description: "競馬レースの統計分析データを完全無料で提供。過去5年以上のデータを機械学習で分析。中央・地方競馬の全レースのAI偏差値・対戦成績・枠順分析をご活用ください。",
    icons: {
        icon: "/new-logo.png",
        shortcut: "/new-logo.png",
        apple: "/new-logo.png",
    },
    other: {
        'google-adsense-account': 'ca-pub-4411270831448240',
    },
    openGraph: {
        title: "UMA-FREE | AI競馬データ分析・統計情報サイト",
        description: "競馬レースの統計分析データを完全無料で提供。過去5年以上のデータを機械学習で分析。中央・地方競馬の全レースのAI偏差値・対戦成績・枠順分析をご活用ください。",
        url: "https://uma-free.com",
        siteName: "UMA-FREE",
        images: [
            {
                url: "/new-logo.png",
                width: 800,
                height: 600,
            },
        ],
        locale: "ja_JP",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "UMA-FREE | AI競馬データ分析・統計情報サイト",
        description: "競馬レースの統計分析データを完全無料で提供。AI偏差値・対戦成績・枠順分析で競馬データをご活用ください。",
    },
    alternates: {
        canonical: "https://uma-free.com",
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5, // Allow zooming for accessibility, but provide a ceiling
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <head>
                {/* Preconnect for External Resources */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

                {/* AdSenseアカウントメタタグ */}
                <meta name="google-adsense-account" content="ca-pub-4411270831448240" />

                {/* PWA: ホーム画面追加対応 */}
                <link rel="manifest" href="/manifest.json" />

                <script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4411270831448240"
                    crossOrigin="anonymous"
                />
                {/* GPT (Google Publisher Tag) for GAM Rewarded Ads
                     ★ パフォーマンス改善: layout.tsxから削除し、useRewardedAd.ts内で動的ロードに変更
                     全ページで約30KB(gzip)のJS読み込みを削減し、Core Web Vitalsを改善
                     Rewarded Adはレースページでのみ使用されるため、他ページでは不要 */}
            </head>
            <body className={`${inter.variable} ${notoSansJP.variable} ${robotoMono.variable} font-sans bg-surface text-text-primary antialiased`}>
                {/* 構造化マークアップ：Organization, Website, SoftwareApplication */}
                <OrganizationSchema />
                <WebsiteSchema />
                <SoftwareApplicationSchema />

                <Header />
                <main className="w-full max-w-5xl mx-auto p-3 sm:p-4 md:p-6 min-h-screen">
                    {/* メインコンテンツエリア */}
                    <div className="w-full">
                        {children}
                    </div>
                    
                    {/* モバイル下部追従等、DOMフローに影響しない広告マネージャー */}
                    <Suspense fallback={null}>
                        <GlobalAdManager />
                    </Suspense>
                </main>
                {/* フッター直前の全ページ共通広告はユーザーの要望により撤去（UIスッキリ化のため） */}
                <Footer />
                <CookieConsent />
                <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ""} />
            </body>
        </html>
    );
}
