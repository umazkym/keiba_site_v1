'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { SearchIcon, MenuIcon, XIcon } from '@/components/Icons';

type HeaderProps = {
    todayString: string;
};

export const Header = ({ todayString }: HeaderProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = useCallback(() => {
        setIsMenuOpen(prev => !prev);
    }, []);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    // メニュー展開時にbodyのスクロールをロック
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    return (
        <header className="glass sticky top-0 z-50 transition-all duration-300">
            <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6">
                <div className="flex h-12 items-center justify-between gap-2 sm:h-16 sm:gap-4">
                    {/* ロゴ */}
                    <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0" aria-label="ウマFREE ホーム">
                        <img
                            src="/new-logo.webp"
                            alt="UMA-FREE ロゴ"
                            width="40"
                            height="40"
                            loading="eager"
                            decoding="async"
                            className="h-8 w-8 sm:h-12 sm:w-12"
                        />
                        <div className="flex flex-col hidden sm:flex">
                            <span className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                                UMA-FREE
                            </span>
                            <p className="text-xs text-text-muted tracking-wider font-medium">
                                完全無料のAI競馬分析
                            </p>
                        </div>
                    </Link>

                    {/* デスクトップナビゲーション */}
                    <nav className="hidden md:flex items-center gap-6 flex-1 ml-8">
                        <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
                            ホーム
                        </Link>
                        <Link href={`/races/${todayString}`} className="text-sm font-semibold text-text-secondary hover:text-primary transition-colors duration-200">
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
                            className="p-1.5 sm:p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label="サイト内検索"
                            title="検索"
                        >
                            <SearchIcon className="h-5 w-5" />
                        </Link>

                        {/* モバイルメニューボタン */}
                        <button
                            onClick={toggleMenu}
                            className="md:hidden p-1.5 sm:p-2 text-text-secondary hover:text-primary hover:bg-slate-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                            aria-expanded={isMenuOpen}
                        >
                            {isMenuOpen ? (
                                <XIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            ) : (
                                <MenuIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* モバイルメニューオーバーレイ（タップで閉じる） */}
                <div
                    className={`mobile-menu-overlay ${isMenuOpen ? 'active' : ''}`}
                    onClick={closeMenu}
                    aria-hidden="true"
                />

                {/* モバイルメニューパネル（スライドアニメーション） */}
                <nav
                    className={`mobile-menu-panel ${isMenuOpen ? 'open' : ''}`}
                    aria-label="モバイルナビゲーション"
                >
                    <div className="flex items-center gap-2 px-4 py-4 mb-2 bg-slate-50 border-b border-slate-100">
                        <img src="/new-logo.webp" alt="UMA-FREE" width="24" height="24" className="w-6 h-6" loading="eager" decoding="async" />
                        <span className="text-base font-bold tracking-tight text-primary">UMA-FREE</span>
                    </div>
                    <Link
                        href="/"
                        className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                        onClick={closeMenu}
                    >
                        ホーム
                    </Link>
                    <Link
                        href={`/races/${todayString}`}
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
            </div>
        </header>
    );
};
