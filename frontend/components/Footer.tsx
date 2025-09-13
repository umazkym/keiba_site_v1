import Link from 'next/link';

export const Footer = () => {
    return (
        <footer className="bg-surface text-center py-4 mt-8 border-t border-border">
            <div className="container mx-auto px-4">
                {/* ▼▼▼▼▼ ここから修正 ▼▼▼▼▼ */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-x-4 mb-2">
                    <Link href="/about" className="text-sm text-muted hover:text-primary hover:underline">
                        運営者情報
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/contact" className="text-sm text-muted hover:text-primary hover:underline">
                        お問い合わせ
                    </Link>
                    <span className="hidden sm:block text-gray-400">|</span>
                    <Link href="/privacy" className="text-sm text-muted hover:text-primary hover:underline">
                        プライバシーポリシー
                    </Link>
                </div>
                {/* ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲ */}
                <p className="text-sm text-muted">
                    &copy; {new Date().getFullYear()} UMA-FREE. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};