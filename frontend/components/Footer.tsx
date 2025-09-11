import Link from 'next/link';

export const Footer = () => {
    return (
        // ▼▼▼▼▼ 背景色と文字色をデザイントークンに準拠させる ▼▼▼▼▼
        <footer className="bg-surface text-center py-4 mt-8 border-t border-border">
            <div className="container mx-auto px-4">
                <div className="flex justify-center items-center gap-x-4 mb-2">
                    <Link href="/about" className="text-sm text-muted hover:text-primary hover:underline">
                        運営者情報
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/contact" className="text-sm text-muted hover:text-primary hover:underline">
                        お問い合わせ
                    </Link>
                    <span className="text-gray-400">|</span>
                    <Link href="/privacy" className="text-sm text-muted hover:text-primary hover:underline">
                        プライバシーポリシー
                    </Link>
                </div>
                <p className="text-sm text-muted">
                    &copy; {new Date().getFullYear()} ウマFREE. All Rights Reserved.
                </p>
            </div>
        </footer>
    );
};