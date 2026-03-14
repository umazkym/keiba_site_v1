import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: 'サイトマップ',
    description: 'UMA-FREEのサイトマップです。AI競馬データ分析、分析記事、初心者向けガイド、よくある質問など、サイト内の全コンテンツへアクセスできます。',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'UMA-FREE サイトマップ',
        description: 'UMA-FREE内の全ページをご案内するサイトマップです。過去のデータ分析から運営者情報まで、すべてのコンテンツをご確認いただけます。',
    },
    alternates: {
        canonical: '/sitemap',
    },
};

export default function SitemapPage() {
    // --- スタイル定義 ---
    const sectionClass = "flex flex-col gap-3 sm:gap-4 mb-8";
    const sectionTitleClass = "text-xl sm:text-2xl font-bold text-gray-800 border-b border-primary pb-2 sm:pb-3";
    const listClass = "flex flex-col gap-2.5 sm:gap-3 pl-2 sm:pl-4";
    const linkClass = "text-base text-gray-700 hover:text-primary transition-colors flex items-center gap-2 group font-medium";
    const iconClass = "w-4 h-4 text-gray-400 group-hover:text-primary transition-colors";

    const LinkIcon = () => (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    );

    const getTodayString = () => {
        const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        );
        return today.toISOString().split("T")[0];
    };

    const todayStr = getTodayString();

    return (
        <>
            <Breadcrumb />
            <div className="py-4 sm:py-8">
                <div className="mx-auto">
                    <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-6 sm:mb-8 border-b-2 border-primary pb-3 sm:pb-4">
                        サイトマップ
                    </h1>
                    
                    <p className="text-gray-600 mb-8 sm:mb-10 text-base leading-relaxed">
                        UMA-FREEのサイトマップです。お探しのページが見つからない場合は、<Link href="/search" className="text-primary hover:underline">サイト内検索</Link>もご利用ください。
                    </p>

                    <div className="grid md:grid-cols-2 gap-x-12 gap-y-4">
                        {/* メインコンテンツ */}
                        <div>
                            <section className={sectionClass}>
                                <h2 className={sectionTitleClass}>AI競馬予測・データ分析</h2>
                                <ul className={listClass}>
                                    <li>
                                        <Link href="/" className={linkClass}>
                                            <LinkIcon /> トップページ
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href={`/races/${todayStr}`} className={linkClass}>
                                            <LinkIcon /> 今日のレース分析
                                        </Link>
                                    </li>
                                </ul>
                            </section>

                            <section className={sectionClass}>
                                <h2 className={sectionTitleClass}>記事一覧</h2>
                                <ul className={listClass}>
                                    <li>
                                        <Link href="/articles" className={linkClass}>
                                            <LinkIcon /> すべての分析記事
                                        </Link>
                                        <p className="text-sm text-gray-500 ml-6 mt-1">過去の重賞展望やデータ分析記事一覧</p>
                                    </li>
                                </ul>
                            </section>

                            <section className={sectionClass}>
                                <h2 className={sectionTitleClass}>サポート情報</h2>
                                <ul className={listClass}>
                                    <li>
                                        <Link href="/faq" className={linkClass}>
                                            <LinkIcon /> よくある質問 (FAQ)
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/contact" className={linkClass}>
                                            <LinkIcon /> お問い合わせ
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/search" className={linkClass}>
                                            <LinkIcon /> サイト内検索
                                        </Link>
                                    </li>
                                </ul>
                            </section>
                        </div>

                        {/* サイト情報・ポリシー等 */}
                        <div>
                            <section className={sectionClass}>
                                <h2 className={sectionTitleClass}>運営情報</h2>
                                <ul className={listClass}>
                                    <li>
                                        <Link href="/about" className={linkClass}>
                                            <LinkIcon /> このサイトについて (運営者情報)
                                        </Link>
                                    </li>
                                </ul>
                            </section>

                            <section className={sectionClass}>
                                <h2 className={sectionTitleClass}>サイトポリシー等</h2>
                                <ul className={listClass}>
                                    <li>
                                        <Link href="/privacy" className={linkClass}>
                                            <LinkIcon /> プライバシーポリシー
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/terms" className={linkClass}>
                                            <LinkIcon /> 利用規約
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/advertising" className={linkClass}>
                                            <LinkIcon /> 広告について
                                        </Link>
                                    </li>
                                </ul>
                            </section>
                            
                            {/* クローラー用XMLサイトマップへの控えめなリンク */}
                            <div className="mt-12 text-sm text-gray-400 flex items-center gap-1">
                                Search Engine Bot? <Link href="/sitemap.xml" className="hover:text-gray-600 underline">XML Sitemap</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
