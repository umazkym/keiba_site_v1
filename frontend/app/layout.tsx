import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GlobalAdManager } from "@/components/GlobalAdManager";
import { OrganizationSchema, WebsiteSchema, SoftwareApplicationSchema } from "@/components/StructuredData";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    metadataBase: new URL("https://uma-free.com"),
    title: {
        default: "uma-free - 全レース無料AI競馬予想",
        template: "%s | uma-free",
    },
    description: "全レース無料のAI競馬予想サイト。中央・地方競馬の全レースのAI予想を完全無料で公開しています。最新のAI技術を駆使した予想で、あなたの競馬ライフをサポートします。",
    icons: {
        icon: "/new-logo.png",
        shortcut: "/new-logo.png",
        apple: "/new-logo.png",
    },
    // ★★★ ここを変更：otherプロパティを使用 ★★★
    other: {
        'google-adsense-account': 'ca-pub-4411270831448240',
    },
    // ★★★ 変更ここまで ★★★
    openGraph: {
        title: "uma-free - 全レース無料AI競馬予想",
        description: "全レース無料のAI競馬予想サイト。中央・地方競馬の全レースのAI予想を完全無料で公開しています。",
        url: "https://uma-free.com",
        siteName: "uma-free",
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
        title: "uma-free - 全レース無料AI競馬予想",
        description: "全レース無料のAI競馬予想サイト。中央・地方競馬の全レースのAI予想を完全無料で公開しています。",
    },
    alternates: {
        canonical: "https://uma-free.com",
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <head>
                {/* ★★★ 手動でメタタグを追加（最優先） ★★★ */}
                <meta name="google-adsense-account" content="ca-pub-4411270831448240" />

                {/* Google AdSense スクリプト（Next.js Script コンポーネント使用） */}
                <Script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                    crossOrigin="anonymous"
                    strategy="afterInteractive"
                />
                <Script
                    id="google-adsense-init"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `(adsbygoogle = window.adsbygoogle || []).push({
                            google_ad_client: "ca-pub-4411270831448240",
                            enable_page_level_ads: true
                        });`
                    }}
                />
            </head>
            <body className={`${inter.className} bg-gray-50`}>
                {/* 構造化マークアップ：Organization, Website, SoftwareApplication */}
                <OrganizationSchema />
                <WebsiteSchema />
                <SoftwareApplicationSchema />

                {/* グローバル広告マネージャー（Suspense でラップして Hydration エラーを防止） */}
                <Suspense fallback={null}>
                    <GlobalAdManager />
                </Suspense>

                <Header />
                <main className="container mx-auto p-4 min-h-screen">
                    {children}
                </main>
                <Footer />
                <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ""} />
            </body>
        </html>
    );
}
