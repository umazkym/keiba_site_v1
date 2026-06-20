import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from "@next/third-parties/google";
import { OrganizationSchema, WebsiteSchema, SoftwareApplicationSchema } from "@/components/StructuredData";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
// CookieConsent削除: AdSense/GoogleのGDPR同意メッセージと重複して2種類のポップアップが表示されるUX問題を解消
// 日本向けサイトではGDPR準拠Cookie同意バナーは法的に不要。Google側の同意管理に一元化

import { Suspense } from "react";
import { GlobalAdManager } from "@/components/GlobalAdManager";
import { shouldLoadAdsensePageLevelScript } from "@/lib/ad-config";
import { getJstTodayString } from "@/lib/race-url";
import { AdSensePageLevelScript } from "@/components/AdSensePageLevelScript";
import { ClarityPageContext } from "@/components/ClarityPageContext";

export const metadata: Metadata = {
    metadataBase: new URL("https://uma-free.com"),
    title: {
        default: "UMA-FREE - AI競馬データ分析・統計情報サイト",
        template: "%s | UMA-FREE",
    },
    description: "競馬データ分析サイト。中央・地方の全レースをAIが無料分析。馬場状態の勝率影響、騎手の得意コース、枠順・距離適性、馬体重増減と成績の関係をデータで解説。登録不要で今すぐ使えます。",
    icons: {
        icon: "/new-logo.webp",
        shortcut: "/new-logo.webp",
        apple: "/new-logo.png",
    },
    other: {
        'google-adsense-account': 'ca-pub-4411270831448240',
    },
    openGraph: {
        title: "UMA-FREE | AI競馬データ分析・統計情報サイト",
        description: "競馬データ分析サイト。中央・地方の全レースをAIが無料分析。馬場状態の勝率影響、騎手の得意コース、枠順・距離適性、馬体重増減と成績の関係をデータで解説。登録不要で今すぐ使えます。",
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
    maximumScale: 5,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const todayString = getJstTodayString();

    return (
        <html lang="ja">
            <head>
                {/* Preconnect for External Resources */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

                {/* ★ パフォーマンス改善: AdSense/GAへのdns-prefetch + preconnect
                    広告のロード開始を早め、Viewable判定の機会を増やす */}
                <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
                <link rel="dns-prefetch" href="https://tpc.googlesyndication.com" />
                <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
                <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />

                {/* AdSenseアカウントメタタグ */}
                <meta name="google-adsense-account" content="ca-pub-4411270831448240" />

                {/* Bing Webmaster Tools 認証メタタグ
                    Bingからの流入が294セッション（Google 350の84%）あるため登録必須。
                    登録手順: https://www.bing.com/webmasters/ でサイト追加 →
                    Search Console連携またはメタタグ認証を選択 → 認証コードをcontentに設定 */}
                {/* <meta name="msvalidate.01" content="YOUR_BING_VERIFICATION_CODE" /> */}

                {/* PWA: ホーム画面追加対応 */}
                <link rel="manifest" href="/manifest.json" />

                <MicrosoftClarity />

                {/* ★ Consent Mode v2: デフォルトgranted設定
                    日本のユーザーにはGDPR同意は法的に不要。
                    これにより Google Funding Choices（AdSenseの自動GDPR同意ポップアップ）が表示されなくなる。
                    adsbygoogle.js よりも先に実行される必要がある。 */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('consent', 'default', {
                                'ad_storage': 'granted',
                                'ad_user_data': 'granted',
                                'ad_personalization': 'granted',
                                'analytics_storage': 'granted'
                            });
                        `,
                    }}
                />

                {/* GPT (Google Publisher Tag) for GAM Rewarded Ads
                     ★ パフォーマンス改善: layout.tsxから削除し、useRewardedAd.ts内で動的ロードに変更
                     全ページで約30KB(gzip)のJS読み込みを削減し、Core Web Vitalsを改善
                     Rewarded Adはレースページでのみ使用されるため、他ページでは不要 */}
            </head>
            <body className="font-sans bg-surface text-text-primary antialiased">
                <ClarityPageContext />
                {/* 構造化マークアップ：Organization, Website, SoftwareApplication */}
                <OrganizationSchema />
                <WebsiteSchema />
                <SoftwareApplicationSchema />

                <Header todayString={todayString} />
                <main className="mobile-compact-scope w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6 min-h-[calc(100dvh-48px)] sm:min-h-[calc(100dvh-64px)]">
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
                {/* CookieConsent削除済み: Google側のGDPR同意メッセージに一元化 */}
                <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ""} />
                <AdSensePageLevelScript enabled={shouldLoadAdsensePageLevelScript} />
            </body>
        </html>
    );
}
