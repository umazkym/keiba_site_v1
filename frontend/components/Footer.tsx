import Link from 'next/link';
import { TwitterIcon } from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="bg-primary text-slate-300 py-8 sm:py-16 relative z-0 mb-16">
            {/* mb-16（64px）を追加してアンカー広告分のマージンを確保 */}
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
                {/* メインフッターコンテンツ（3カラム） */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 mb-8 sm:mb-12">
                    {/* サイト情報 */}
                    <div>
                        <h3 className="font-bold text-white text-lg sm:text-xl mb-3 sm:mb-4 tracking-tight">UMA-FREE</h3>
                        <p className="text-xs sm:text-sm text-slate-400 leading-[1.8] max-w-sm">
                            過去5年以上のレースデータをAIで分析し、中央・地方競馬の全レースの偏差値・対戦成績・枠順傾向を完全無料で提供する競馬データ分析サイトです。
                        </p>
                    </div>

                    {/* コンテンツリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm sm:text-base mb-3 sm:mb-4">コンテンツ</h3>
                        <ul className="space-y-2.5 sm:space-y-3">
                            <li>
                                <Link href="/articles" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1 block sm:inline">
                                    分析記事一覧
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
                            <li>
                                <Link
                                    href="https://x.com/umafree_ai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 py-1"
                                    aria-label="公式Xアカウント"
                                >
                                    <TwitterIcon className="w-3.5 h-3.5" />
                                    公式X (Twitter)
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* ポリシーリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm sm:text-base mb-3 sm:mb-4">サイトポリシー</h3>
                        <ul className="space-y-2.5 sm:space-y-3">
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
                <div className="border-t border-slate-800 pt-8 mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500">
                            &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                        </p>
                        <p className="text-xs text-slate-500 max-w-md text-center sm:text-right leading-relaxed">
                            本サイトは統計情報の提供を目的としており、投票の推奨ではありません。
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};