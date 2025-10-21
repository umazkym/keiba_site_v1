import Link from 'next/link';
import { TwitterIcon } from 'lucide-react'; // ★★★ この行を追加 ★★★

export const Footer = () => {
    return (
        <footer className="bg-surface text-center py-6 mt-8 border-t-2 border-border relative z-0 mb-16">
            {/* mb-16（64px）を追加してアンカー広告分のマージンを確保 */}
            <div className="container mx-auto px-4">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-x-4 mb-2 flex-wrap">
                    <Link href="/about" className="text-sm text-muted hover:text-primary hover:underline">
                        このサイトについて
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/advertising" className="text-sm text-muted hover:text-primary hover:underline">
                        広告について
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/contact" className="text-sm text-muted hover:text-primary hover:underline">
                        お問い合わせ
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/privacy" className="text-sm text-muted hover:text-primary hover:underline">
                        プライバシーポリシー
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/terms" className="text-sm text-muted hover:text-primary hover:underline">
                        利用規約
                    </Link>
                    {/* ▼▼▼▼▼ ここから追加 ▼▼▼▼▼ */}
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link
                        href="https://x.com/umafree_ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted hover:text-primary hover:underline flex items-center gap-1"
                        aria-label="公式Xアカウント"
                    >
                        <span>公式X(旧Twitter)</span>
                    </Link>
                    {/* ▲▲▲▲▲ ここまで追加 ▲▲▲▲▲ */}
                </div>
                <p className="text-sm text-muted">
                    &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};