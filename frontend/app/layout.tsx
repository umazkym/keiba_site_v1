import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Script from "next/script";
import React from "react";
import { GlobalAdManager } from "@/components/GlobalAdManager"; // 新規インポート

const inter = Inter({ subsets: ["latin"], display: 'swap' });

const siteTitleDefault = "UMA-FREE | 登録不要の無料AI競馬予想 (中央・地方 全レース対応)";
const siteDescription = "登録不要・完全無料！AIが中央・地方すべての競馬レースを毎日予想＆分析。AI偏差値や独自の対戦データで、あなたの馬券検討を強力にサポートします。";
const siteUrl = "https://www.uma-free.com"; // www付きに正規化

// ▼▼▼▼▼ metadataオブジェクト全体を修正 ▼▼▼▼▼
export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: siteTitleDefault,
        template: '%s | UMA-FREE',
    },
    description: siteDescription,
    openGraph: {
        title: siteTitleDefault,
        description: siteDescription,
        url: siteUrl,
        siteName: 'UMA-FREE',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
            },
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: siteTitleDefault,
        description: siteDescription,
        images: [`${siteUrl}/og-image.png`],
    },
};

export const viewport: Viewport = {
    themeColor: "#4f46e5",
};
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const adClient = "ca-pub-4411270831448240";

    return (
        <html lang="ja" className={inter.className}>
            <head>
                <meta name="google-adsense-account" content={adClient} />
                <Script
                    async
                    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
                    crossOrigin="anonymous"
                    strategy="afterInteractive"
                />
            </head>
            <body>
                <a href="#main-content" className="skip-link">
                    コンテンツにスキップ
                </a>

                <div className="flex flex-col min-h-screen">
                    <Header />

                    {/* アンカー広告の高さ(50px) + 余白を確保 */}
                    <main id="main-content" className="flex-grow pb-16">
                        <GlobalAdManager />
                        {children}
                    </main>

                    <Footer />
                </div>
            </body>
        </html>
    );
}