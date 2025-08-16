import Link from 'next/link';

// 競馬のシルエットアイコン
const HorseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M7.618 16.89a.75.75 0 10-1.236-.88l-1.5 2.1a.75.75 0 101.236.88l1.5-2.1zM6.382 16.01a4.485 4.485 0 01-2.023 2.115.75.75 0 00.88 1.236 6 6 0 002.7-2.822.75.75 0 00-.88-1.236A4.493 4.493 0 016.382 16.01zM11.25 10.5A1.5 1.5 0 019.75 12c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5z" />
        <path fillRule="evenodd" d="M12.75 2.25a.75.75 0 00-1.5 0V3.52l-2.016.907a.75.75 0 00-.53 1.133 13.5 13.5 0 01-3.125 7.421 1.5 1.5 0 00-.337 2.052.75.75 0 001.373.185 1.495 1.495 0 002.38-1.127 12.01 12.01 0 002.56-5.872.75.75 0 00-.472-.82L10.5 6.368V4.532a.75.75 0 01.622-.742l.539-.162a.75.75 0 01.878.878l-.162.539a.75.75 0 01-.742.622H11.25v1.768a.75.75 0 00.39.673l2.213 1.248a12.023 12.023 0 004.832 1.34.75.75 0 00.673-.39 12.023 12.023 0 001.34-4.832l1.248-2.213a.75.75 0 00-.157-1.025l-2.032-1.27a.75.75 0 00-.736.014L15 4.97V3a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" />
    </svg>
);

export const Header = () => {
    return (
        <header className="bg-primary-dark text-white shadow-lg">
            <div className="container">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-3 group">
                        <HorseIcon />
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold tracking-tight group-hover:text-gray-200 transition-colors">ウマFREE</span>
                            <span className="text-xs text-blue-200 group-hover:text-white transition-colors">無料のAI競馬予想</span>
                        </div>
                    </Link>
                </div>
            </div>
        </header>
    );
};