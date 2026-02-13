import Link from 'next/link';
import { TwitterIcon } from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="bg-gray-900 text-gray-300 py-10 relative z-0 mb-16">
            {/* mb-16（64px）を追加してアンカー広告分のマージンを確保 */}
            <div className="container mx-auto px-4">
                {/* メインフッターコンテンツ（3カラム） */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
                    {/* サイト情報 */}
                    <div>
                        <h3 className="font-bold text-white text-lg mb-3">UMA-FREE</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            過去5年以上のレースデータをAIで分析し、中央・地方競馬の全レースの偏差値・対戦成績・枠順傾向を完全無料で提供する競馬データ分析サイトです。
                        </p>
                    </div>

                    {/* コンテンツリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm mb-3">コンテンツ</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/articles" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    分析記事一覧
                                </Link>
                            </li>
                            <li>
                                <Link href="/faq" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    よくある質問
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    このサイトについて
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="https://x.com/umafree_ai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-gray-400 hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                                    aria-label="公式Xアカウント"
                                >
                                    <TwitterIcon className="w-3 h-3" />
                                    公式X (Twitter)
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* ポリシーリンク */}
                    <div>
                        <h3 className="font-bold text-white text-sm mb-3">サイトポリシー</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/advertising" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    広告について
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    お問い合わせ
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    プライバシーポリシー
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-xs text-gray-400 hover:text-blue-400 transition-colors">
                                    利用規約
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 区切り線 */}
                <div className="border-t border-gray-700 pt-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                            &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                        </p>
                        <p className="text-xs text-gray-500">
                            本サイトは統計情報の提供を目的としており、投票の推奨ではありません。
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};