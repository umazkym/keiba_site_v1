import Link from 'next/link';
import { getConfiguredSocialLinks } from '@/lib/social-links';

export const Footer = () => {
    const socialLinks = getConfiguredSocialLinks();

    return (
        <footer className="bg-primary text-slate-300 py-5 sm:py-16 relative z-0">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
                {/* メインフッターコンテンツ（3カラム） */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-12 mb-5 sm:mb-12">
                    {/* サイト情報 */}
                    <div>
                        <h3 className="font-bold text-white text-base sm:text-xl mb-2 sm:mb-4 tracking-tight">UMA-FREE</h3>
                        <p className="text-[11px] sm:text-sm text-slate-400 leading-[1.7] sm:leading-[1.8] max-w-sm">
                            豊富な過去レースデータをAIで分析。中央・地方競馬の全レースの偏差値・対戦成績・枠順傾向を登録不要・完全無料で提供する競馬データ分析サイトです。
                        </p>
                    </div>

                    {/* コンテンツリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm sm:text-base mb-2 sm:mb-4">コンテンツ</h3>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:block sm:space-y-3">
                            <li>
                                <Link prefetch={false} href="/keiba-data" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    競馬データベース
                                </Link>
                            </li>
                            <li>
                                <Link prefetch={false} href="/horses" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    競走馬データ
                                </Link>
                            </li>
                            <li>
                                <Link prefetch={false} href="/courses" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    コースデータ
                                </Link>
                            </li>
                            <li>
                                <Link href="/my-data" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    マイデータ
                                </Link>
                            </li>
                            <li>
                                <Link prefetch={false} href="/articles" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    データ分析記事
                                </Link>
                            </li>
                            <li>
                                <Link href="/faq" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    よくある質問
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    このサイトについて
                                </Link>
                            </li>
                            <li>
                                <Link href="/about-ai" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    AI予測モデルについて
                                </Link>
                            </li>
                            {socialLinks.map((socialLink) => (
                                <li key={socialLink.platform}>
                                    <Link
                                        href={socialLink.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 py-1"
                                        aria-label={`${socialLink.label}アカウント`}
                                    >
                                        {socialLink.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ポリシーリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm sm:text-base mb-2 sm:mb-4">サイトポリシー</h3>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:block sm:space-y-3">
                            <li>
                                <Link href="/advertising" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    広告について
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    お問い合わせ
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    プライバシーポリシー
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    利用規約
                                </Link>
                            </li>
                            <li>
                                <Link href="/sitemap" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    サイトマップ
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 区切り線 */}
                <div className="border-t border-slate-800 pt-4 sm:pt-8 mt-3 sm:mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                        <p className="text-xs sm:text-sm text-slate-500">
                            &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 max-w-md text-center sm:text-right leading-relaxed">
                            本サイトは統計情報の提供を目的としており、投票の推奨ではありません。
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};
