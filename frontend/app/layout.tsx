import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OrganizationSchema, WebsiteSchema, SoftwareApplicationSchema } from "@/components/StructuredData";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";
// CookieConsent削除: AdSense/GoogleのGDPR同意メッセージと重複して2種類のポップアップが表示されるUX問題を解消
// 日本向けサイトではGDPR準拠Cookie同意バナーは法的に不要。Google側の同意管理に一元化

import { shouldLoadAdsensePageLevelScript } from "@/lib/ad-config";
import { getJstTodayString } from "@/lib/race-url";
import { AdSensePageLevelScript } from "@/components/AdSensePageLevelScript";
import { ClarityPageContext } from "@/components/ClarityPageContext";
import { GoogleAnalyticsBootstrap } from "@/components/GoogleAnalyticsBootstrap";
import { TrafficAttributionCapture } from "@/components/TrafficAttributionCapture";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { PwaRegistration } from "@/components/PwaRegistration";
import { SafariViewportShim } from "@/components/SafariViewportShim";

// 書体：ロゴ文字とホームの大見出しだけ、ロゴの丸みに合わせた M PLUS Rounded 1c（--font-brand）。
// ほかの見出しは本文と同じゴシックの太字（2026-09-26 利用者の選択「ゴシックでそろえる」。丸ゴシックの極太が並ぶと重かった）。
// 数字（AI偏差値・オッズ・距離）は幅の狭い Barlow Semi Condensed。
// 本文は端末の日本語書体（globals.css の --font-body）。Noto Sans JP を配信すると
// 文字範囲ごとの @font-face だけで描画を止めるCSSが gzip 約31KB増え、本文の字形で
// 1ページ数百KBの追加転送になるため読み込まない。
// 見出し書体も同じ理由で 800 の1ウェイトだけにする（700 を足すとCSSが約31KB増える）。
const displayFont = M_PLUS_Rounded_1c({
    weight: "800",
    subsets: ["latin"],
    display: "swap",
    preload: false,
    variable: "--font-brand",
});
const numFont = Barlow_Semi_Condensed({
    weight: ["500", "600", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-num",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://uma-free.com"),
    title: {
        default: "UMA-FREE - AI競馬データ分析・統計情報サイト",
        template: "%s | UMA-FREE",
    },
    description: "競馬データ分析サイト。中央・地方の全レースをAIが無料分析。馬場状態の勝率影響、騎手の得意コース、枠順・距離適性、馬体重増減と成績の関係をデータで解説。登録不要で今すぐ使えます。",
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/brand/uma-free-mark-small.svg", type: "image/svg+xml" },
        ],
        apple: "/brand/apple-touch-icon.png",
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
                url: "/brand/og-default.png",
                width: 1200,
                height: 630,
                alt: "UMA-FREE 中央・地方の全レースをAIが毎日無料で分析",
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
    viewportFit: 'cover',
    // 注: Safari 26以降では themeColor メタタグは無視されCSS実背景色が採用されますが、
    // 旧Safari(15~18)および他ブラウザ(Android Chrome等)互換のため設定を維持します。
    // ダークモードは作らないため、どちらの設定でもサイトの背景色にそろえる。
    themeColor: '#F3F5FA',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const todayString = getJstTodayString();
    const gaId = process.env.NEXT_PUBLIC_GA_ID || "";

    return (
        <html lang="ja" className={`${displayFont.variable} ${numFont.variable}`}>
            <head>
                {/* ★ パフォーマンス改善: AdSense/GAへのdns-prefetch + preconnect
                    広告のロード開始を早め、Viewable判定の機会を増やす */}
                <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
                <link rel="dns-prefetch" href="https://tpc.googlesyndication.com" />
                <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
                <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />

                {/* AdSenseアカウントメタタグ */}
                <meta name="google-adsense-account" content="ca-pub-4411270831448240" />

                {/* ★ Google Discover 大画像プレビュー許可
                    1,200px以上のアイキャッチを持つ記事・重賞ページがDiscoverで
                    大画像サムネイルとして表示されるための必須設定。
                    CTRが数倍変わるケースがあるため、必ず設定しておく。 */}
                <meta name="robots" content="max-image-preview:large" />

                {/* Bing Webmaster Tools 認証メタタグ
                    Bingからの流入が294セッション（Google 350の84%）あるため登録必須。
                    登録手順: https://www.bing.com/webmasters/ でサイト追加 →
                    Search Console連携またはメタタグ認証を選択 → 認証コードをcontentに設定 */}
                {/* <meta name="msvalidate.01" content="YOUR_BING_VERIFICATION_CODE" /> */}

                {/* PWA: ホーム画面追加対応 */}
                <link rel="manifest" href="/manifest.json" />

                <GoogleAnalyticsBootstrap gaId={gaId} />
                <MicrosoftClarity />

                {/* GPT (Google Publisher Tag) for GAM Rewarded Ads
                     ★ パフォーマンス改善: layout.tsxから削除し、useRewardedAd.ts内で動的ロードに変更
                     全ページで約30KB(gzip)のJS読み込みを削減し、Core Web Vitalsを改善
                     Rewarded Adはレースページでのみ使用されるため、他ページでは不要 */}
            </head>
            <body className="font-sans bg-surface text-text-primary antialiased">
                <SafariViewportShim />
                <TrafficAttributionCapture />
                <a href="#main-content" className="skip-link">
                    本文へ移動
                </a>
                <ClarityPageContext />
                <WebVitalsReporter />
                <PwaRegistration />
                {/* 構造化マークアップ：Organization, Website, SoftwareApplication */}
                <OrganizationSchema />
                <WebsiteSchema />
                <SoftwareApplicationSchema />

                <Header todayString={todayString} />
                <main id="main-content" tabIndex={-1} className="w-full max-w-7xl mx-auto mb-2 px-4 sm:px-5 md:px-6 min-h-[calc(100dvh-48px)] sm:min-h-[calc(100dvh-64px)]">
                    {/* メインコンテンツエリア */}
                    <div className="w-full">
                        {children}
                    </div>
                </main>
                {/* フッター直前の全ページ共通広告はユーザーの要望により撤去（UIスッキリ化のため） */}
                <Footer todayString={todayString} />
                {/* CookieConsent削除済み: Google側のGDPR同意メッセージに一元化 */}
                <AdSensePageLevelScript enabled={shouldLoadAdsensePageLevelScript} />
            </body>
        </html>
    );
}
