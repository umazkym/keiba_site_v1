import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GlobalAdManager } from "@/components/GlobalAdManager";
import Script from "next/script";

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
    // ★★★ ここを追加 ★★★
    verification: {
        google: "ca-pub-4411270831448240",
    },
    // ★★★ ここまで追加 ★★★
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
                {/* Google AdSense審査用コード */}
                <Script
                    async
                    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4411270831448240"
                    crossOrigin="anonymous"
                    strategy="afterInteractive"
                />
                <GlobalAdManager />
            </head>
            <body className={`${inter.className} bg-gray-50`}>
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
