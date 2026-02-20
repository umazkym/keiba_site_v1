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
        <header className="glass sticky top-0 z-50 transition-all duration-300">
            <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6">
                <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
                    {/* ロゴ */}
                    <Link href="/" className="flex items-center gap-3 group shrink-0" aria-label="ウマFREE ホーム">
                        <Image
                            src="/new-logo.png"
                            alt="UMA-FREE ロゴ"
                            width={40}
                            height={40}
                            priority
                            className="w-10 h-10 sm:w-12 sm:h-12"
                        />
                        <div className="flex flex-col hidden sm:flex">
                            <span className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                                UMA-FREE
                            </span>
                            <p className="text-[10px] text-text-muted tracking-wider font-medium">
                                完全無料のAI競馬分析
                            </p>
                        </div>
                    </Link>

                    {/* デスクトップナビゲーション */}
                    <nav className="hidden md:flex items-center gap-8 flex-1 ml-10">
                        <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
                            ホーム
                        </Link>
                        <Link href={`/races/${todayStr}`} className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
                            本日の分析
                        </Link>
                        <Link href="/articles" className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
                            記事
                        </Link>
                        <Link href="/faq" className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
                            よくある質問
                        </Link>
                    </nav>

                    {/* 検索ボタンとメニューボタン（右側） */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Link
                            href="/search"
                            className="p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label="サイト内検索"
                            title="検索"
                        >
                            <SearchIcon className="w-5 h-5" />
                        </Link>

                        {/* モバイルメニューボタン */}
                        <button
                            onClick={toggleMenu}
                            className="md:hidden p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    <nav className="md:hidden pb-4 border-t border-slate-100 max-h-[calc(100vh-56px)] sm:max-h-[calc(100vh-64px)] overflow-y-auto bg-white absolute left-0 right-0 shadow-lg">
                        <Link
                            href="/"
                            className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                            onClick={closeMenu}
                        >
                            ホーム
                        </Link>
                        <Link
                            href={`/races/${todayStr}`}
                            className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                            onClick={closeMenu}
                        >
                            本日の分析
                        </Link>
                        <Link
                            href="/articles"
                            className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                            onClick={closeMenu}
                        >
                            記事
                        </Link>
                        <Link
                            href="/faq"
                            className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                            onClick={closeMenu}
                        >
                            よくある質問
                        </Link>
                        <Link
                            href="/search"
                            className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                            onClick={closeMenu}
                        >
                            検索
                        </Link>
                        <div className="px-4 py-4 bg-slate-50/80">
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 font-mono">その他</p>
                            <Link
                                href="/about"
                                className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                このサイトについて
                            </Link>
                            <Link
                                href="/advertising"
                                className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                広告について
                            </Link>
                            <Link
                                href="/contact"
                                className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                                onClick={closeMenu}
                            >
                                お問い合わせ
                            </Link>
                            <Link
                                href="/privacy"
                                className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
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