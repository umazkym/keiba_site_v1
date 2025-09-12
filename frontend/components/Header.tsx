import Link from 'next/link';
import Image from 'next/image';

export const Header = () => {
    return (
        <header className="bg-surface text-text shadow-md sticky top-0 z-50 border-b border-border">
            <div className="container">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-3 group" aria-label="ウマFREE ホーム">
                        <Image
                            src="/logo.svg"
                            alt="UMA-FREE Logo"
                            width={40}
                            height={40}
                            priority
                        />
                        <div className="flex flex-col">
                            <span className="text-2xl font-extrabold tracking-tight text-primary group-hover:text-primary-dark transition-colors">
                                UMA-FREE
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
        </header>
    );
};