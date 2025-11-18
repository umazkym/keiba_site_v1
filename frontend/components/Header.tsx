'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { SearchIcon, MenuIcon, XIcon } from '@/components/Icons';

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = useCallback(() => {
        setIsMenuOpen(prev => !prev);
    }, []);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    const getTodayString = () => {
        const today = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        );
        return today.toISOString().split("T")[0];
    };

    const todayStr = getTodayString();

    return (
        <header className="bg-white text-text shadow-lg sticky top-0 z-50 border-b-2 border-primary/10">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16 gap-4">
                    {/* ロゴ */}
                    <Link href="/" className="flex items-center gap-3 group shrink-0" aria-label="ウマFREE ホーム">
                        <Image
                            src="/new-logo.png"
                            alt="UMA-FREE ロゴ"
                            width={48}
                            height={48}
                            priority
                        />
                        <div className="flex flex-col hidden sm:flex">
                            <span className="text-2xl font-extrabold tracking-tight text-primary">
                                UMA-FREE
                            </span>
                            <span className="text-xs text-gray-500 -mt-1">
                                完全無料のAI競馬分析
                            </span>
                        </div>
                    </Link>

                    {/* デスクトップナビゲーション */}
                    <nav className="hidden md:flex items-center gap-6 flex-1 ml-8">
                        <Link href="/" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200 relative group">
                            ホーム
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                        </Link>
                        <Link href={`/races/${todayStr}`} className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200 relative group">
                            本日の予測
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                        </Link>
                        <Link href="/articles" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200 relative group">
                            記事
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                        </Link>
                        <Link href="/faq" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200 relative group">
                            よくある質問
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                        </Link>
                    </nav>

                    {/* 検索ボタンとメニューボタン（右側） */}
                    <div className="flex items-center gap-1 shrink-0">
                        <Link
                            href="/search"
                            className="p-3 md:p-2 text-gray-600 hover:text-primary transition-colors duration-200 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-light active:bg-gray-200 md:active:bg-gray-100"
                            aria-label="サイト内検索"
                            title="検索"
                        >
                            <SearchIcon className="w-5 h-5 md:w-5 md:h-5" />
                        </Link>

                        {/* モバイルメニューボタン */}
                        <button
                            onClick={toggleMenu}
                            className="md:hidden p-3 text-gray-600 hover:text-primary transition-colors duration-200 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-light active:bg-gray-200"
                            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? (
                                <XIcon className="w-6 h-6" />
                            ) : (
                                <MenuIcon className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* モバイルメニュー */}
                {isMenuOpen && (
                    <nav className="md:hidden pb-4 border-t border-gray-200 max-h-[calc(100vh-64px)] overflow-y-auto">
                        <Link
                            href="/"
                            className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200"
                            onClick={closeMenu}
                        >
                            ホーム
                        </Link>
                        <Link
                            href={`/races/${todayStr}`}
                            className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200"
                            onClick={closeMenu}
                        >
                            本日の予測
                        </Link>
                        <Link
                            href="/articles"
                            className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200"
                            onClick={closeMenu}
                        >
                            記事
                        </Link>
                        <Link
                            href="/faq"
                            className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200"
                            onClick={closeMenu}
                        >
                            よくある質問
                        </Link>
                        <Link
                            href="/search"
                            className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200"
                            onClick={closeMenu}
                        >
                            検索
                        </Link>
                        <div className="px-4 py-3 border-t border-gray-200 mt-2">
                            <Link
                                href="/about"
                                className="block py-2 text-sm text-gray-600 hover:text-primary active:text-primary-dark transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                このサイトについて
                            </Link>
                            <Link
                                href="/advertising"
                                className="block py-2 text-sm text-gray-600 hover:text-primary active:text-primary-dark transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                広告について
                            </Link>
                            <Link
                                href="/contact"
                                className="block py-2 text-sm text-gray-600 hover:text-primary active:text-primary-dark transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                お問い合わせ
                            </Link>
                            <Link
                                href="/privacy"
                                className="block py-2 text-sm text-gray-600 hover:text-primary active:text-primary-dark transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                プライバシーポリシー
                            </Link>
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
};