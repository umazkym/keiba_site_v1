import Link from 'next/link';
import { TwitterIcon } from 'lucide-react'; // ★★★ この行を追加 ★★★

export const Footer = () => {
    return (
        <footer className="bg-gradient-to-br from-gray-50 to-blue-50 text-center py-8 border-t border-gray-200 relative z-0 mb-16 shadow-inner">
            {/* mb-16（64px）を追加してアンカー広告分のマージンを確保 */}
            <div className="container mx-auto px-4">
                {/* デスクトップレイアウト */}
                <div className="hidden sm:flex justify-center items-center gap-x-4 mb-4 flex-wrap">
                    <Link href="/about" className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors">
                        このサイトについて
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/advertising" className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors">
                        広告について
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/contact" className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors">
                        お問い合わせ
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/privacy" className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors">
                        プライバシーポリシー
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/terms" className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors">
                        利用規約
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link
                        href="https://x.com/umafree_ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted hover:text-primary hover:underline active:text-primary-dark transition-colors"
                        aria-label="公式Xアカウント"
                    >
                        公式X(旧Twitter)
                    </Link>
                </div>

                {/* モバイルレイアウト */}
                <div className="sm:hidden flex flex-col gap-3 mb-4">
                    <div className="flex flex-wrap justify-center gap-2 gap-y-2">
                        <Link href="/about" className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200">
                            このサイトについて
                        </Link>
                        <Link href="/advertising" className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200">
                            広告について
                        </Link>
                        <Link href="/contact" className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200">
                            お問い合わせ
                        </Link>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Link href="/privacy" className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200">
                            プライバシーポリシー
                        </Link>
                        <Link href="/terms" className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200">
                            利用規約
                        </Link>
                        <Link
                            href="https://x.com/umafree_ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted hover:text-primary active:text-primary-dark transition-colors px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200"
                            aria-label="公式Xアカウント"
                        >
                            公式X
                        </Link>
                    </div>
                </div>

                <p className="text-xs sm:text-sm text-muted">
                    &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};