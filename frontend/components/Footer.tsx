import Link from 'next/link';
import { TwitterIcon } from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="bg-white text-center py-8 border-t border-gray-200 relative z-0 mb-16">
            {/* mb-16（64px）を追加してアンカー広告分のマージンを確保 */}
            <div className="container mx-auto px-4">
                {/* デスクトップレイアウト */}
                <div className="hidden sm:flex justify-center items-center gap-6 mb-6 flex-wrap">
                    <Link href="/about" className="text-sm text-gray-500 hover:text-primary transition-colors">
                        このサイトについて
                    </Link>
                    <Link href="/advertising" className="text-sm text-gray-500 hover:text-primary transition-colors">
                        広告について
                    </Link>
                    <Link href="/contact" className="text-sm text-gray-500 hover:text-primary transition-colors">
                        お問い合わせ
                    </Link>
                    <Link href="/privacy" className="text-sm text-gray-500 hover:text-primary transition-colors">
                        プライバシーポリシー
                    </Link>
                    <Link href="/terms" className="text-sm text-gray-500 hover:text-primary transition-colors">
                        利用規約
                    </Link>
                    <Link
                        href="https://x.com/umafree_ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                        aria-label="公式Xアカウント"
                    >
                        <TwitterIcon className="w-4 h-4" />
                        公式X
                    </Link>
                </div>

                {/* モバイルレイアウト */}
                <div className="sm:hidden flex flex-col gap-4 mb-6">
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        <Link href="/about" className="text-xs text-gray-500 hover:text-primary transition-colors">
                            このサイトについて
                        </Link>
                        <Link href="/advertising" className="text-xs text-gray-500 hover:text-primary transition-colors">
                            広告について
                        </Link>
                        <Link href="/contact" className="text-xs text-gray-500 hover:text-primary transition-colors">
                            お問い合わせ
                        </Link>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        <Link href="/privacy" className="text-xs text-gray-500 hover:text-primary transition-colors">
                            プライバシーポリシー
                        </Link>
                        <Link href="/terms" className="text-xs text-gray-500 hover:text-primary transition-colors">
                            利用規約
                        </Link>
                        <Link
                            href="https://x.com/umafree_ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                            aria-label="公式Xアカウント"
                        >
                            <TwitterIcon className="w-3 h-3" />
                            公式X
                        </Link>
                    </div>
                </div>

                <p className="text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};