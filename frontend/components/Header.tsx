import Link from 'next/link';

// シンプルな馬のアイコン
const HorseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12.378 1.602a.75.75 0 0 0-.756 0L3 7.232l9 5.25 9-5.25-8.622-5.63ZM21.75 7.965l-9 5.25v9l8.628-5.632a.75.75 0 0 0 .372-.648V7.965Z" />
        <path d="M2.25 7.965v8.978c0 .26.137.5.372.648L12 22.25v-9l-9-5.25Z" />
    </svg>
);


export const Header = () => {
    return (
        <header className="bg-primary-dark text-white shadow-lg">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight hover:text-gray-200 transition-colors">
                        <HorseIcon />
                        <span>競馬AI予測</span>
                    </Link>
                </div>
            </div>
        </header>
    );
};