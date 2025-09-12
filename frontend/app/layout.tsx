import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Adsense } from "@/components/Adsense";
import Script from "next/script";
import { AnchorAd } from "@/components/AnchorAd";
import React from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UMA-FREE | 登録不要の無料AI競馬予想 (中央・地方 全レース対応)",
  description:
    "登録不要・完全無料！AIが中央・地方すべての競馬レースを毎日予想＆分析。AI偏差値や独自の対戦データで、あなたの馬券検討を強力にサポートします。",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
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
        {/* ▼▼▼▼▼ 【重要】AdSenseの所有権確認用メタタグをここに追加 ▼▼▼▼▼ */}
        <meta name="google-adsense-account" content="ca-pub-4411270831448240" />
        {/* ▲▲▲▲▲ ここまで追加 ▲▲▲▲▲ */}

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* AdSenseの自動広告用スクリプト（これはこのまま残してください） */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="pb-16">
        <a href="#main-content" className="skip-link">
          コンテンツにスキップ
        </a>

        <div className="flex flex-col min-h-screen">
          <Header />

          <main id="main-content" className="flex-grow">
            <div className="container py-4">
              <div className="adsense-wrapper" role="complementary" aria-label="広告">
                <Adsense
                  client={adClient}
                  slot="xxxxxxxxxx"
                  style={{ width: "100%", height: "90px" }}
                />
              </div>
            </div>
            {children}
          </main>

          <Footer />
        </div>

        <AnchorAd />
      </body>
    </html>
  );
}