import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Adsense } from "@/components/Adsense";
import Script from "next/script";
import { AnchorAd } from "@/components/AnchorAd";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ウマFREE | 登録不要の無料AI競馬予想 (中央・地方 全レース対応)",
  description: "登録不要・完全無料！AIが中央・地方すべての競馬レースを毎日予想＆分析。AI偏差値や独自の対戦データで、あなたの馬券検討を強力にサポートします。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adClient = "ca-pub-xxxxxxxxxxxxxxxx"; // ご自身のAdSenseクライアントIDに置き換えてください

  return (
    <html lang="ja">
      <head>
        {/* 通常のAdSenseタグ */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {/* ★★★ ここに自動広告用のコードを追加 ★★★ */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.className} bg-gray-100 text-gray-800`}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow">
            <div className="container py-2">
              <Adsense
                client={adClient}
                slot="xxxxxxxxxx" // ヘッダー下の広告ユニットID
                style={{ height: '100px' }}
              />
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