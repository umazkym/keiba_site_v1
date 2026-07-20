'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SearchIcon, MenuIcon, XIcon } from '@/components/Icons';
import { sendAffiliateClickEvent, sendAffiliateImpressionEvent } from '@/lib/analytics';

type HeaderProps = {
    todayString: string;
};

const RAKUTEN_KEIBA_AFFILIATE_URL = 'https://ad2.trafficgate.net/t/r/14/1958/318200_397641';

const HEADER_AFFILIATE_EVENT = {
    campaign_id: 'rakuten-keiba-header',
    link_id: 'rakuten-keiba-header-main',
    provider: 'rakuten_keiba',
    context: 'site_header',
    campaign_type: 'voting',
} as const;

const HeaderAffiliateLink = () => {
    useEffect(() => {
        sendAffiliateImpressionEvent({
            campaign_id: HEADER_AFFILIATE_EVENT.campaign_id,
            providers: HEADER_AFFILIATE_EVENT.provider,
            context: HEADER_AFFILIATE_EVENT.context,
            campaign_type: HEADER_AFFILIATE_EVENT.campaign_type,
            link_count: 1,
        });
    }, []);

    const handleClick = useCallback(() => {
        sendAffiliateClickEvent(HEADER_AFFILIATE_EVENT);
    }, []);

    return (
        <a
            href={RAKUTEN_KEIBA_AFFILIATE_URL}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={handleClick}
            data-affiliate-context={HEADER_AFFILIATE_EVENT.context}
            data-affiliate-campaign={HEADER_AFFILIATE_EVENT.campaign_id}
            className="inline-flex h-11 items-center gap-1 rounded-lg border border-rose-100 bg-rose-50/70 px-1.5 text-[10px] font-semibold text-rose-700 transition-colors duration-150 hover:border-rose-200 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 sm:gap-1.5 sm:px-3 sm:text-xs"
            aria-label="PR 楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です"
            title="PR 楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です。"
        >
            <span className="rounded bg-rose-600 px-1 py-0.5 text-[10px] leading-none text-white">PR</span>
            <span className="hidden sm:inline">地方競馬の投票は楽天競馬で</span>
            <span className="sm:hidden">地方競馬は楽天競馬</span>
            <span aria-hidden="true" className="text-[13px] leading-none">→</span>
        </a>
    );
};

export const Header = ({ todayString }: HeaderProps) => {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLElement>(null);

    const navItems = [
        { href: '/', label: 'ホーム', prefetch: undefined, isActive: pathname === '/' },
        { href: `/races/${todayString}`, label: '本日の分析', prefetch: false, isActive: pathname.startsWith('/races') },
        { href: '/articles', label: '記事', prefetch: false, isActive: pathname.startsWith('/articles') },
        { href: '/faq', label: 'よくある質問', prefetch: undefined, isActive: pathname === '/faq' },
    ] as const;

    const toggleMenu = useCallback(() => {
        setIsMenuOpen(prev => !prev);
    }, []);

    const closeMenu = useCallback((restoreFocus = false) => {
        setIsMenuOpen(false);
        if (restoreFocus) {
            window.requestAnimationFrame(() => menuButtonRef.current?.focus());
        }
    }, []);

    // メニュー展開時にbodyのスクロールをロック
    useEffect(() => {
        let focusTimer: number | undefined;
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
            focusTimer = window.setTimeout(() => {
                menuPanelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
            }, 0);
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            if (focusTimer !== undefined) {
                window.clearTimeout(focusTimer);
            }
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isMenuOpen) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeMenu, isMenuOpen]);

    return (
        <header className="glass sticky top-0 z-50">
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
                    <nav className="hidden md:flex items-center gap-1 flex-1 ml-8" aria-label="主要ナビゲーション">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={item.prefetch}
                                aria-current={item.isActive ? 'page' : undefined}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${item.isActive
                                    ? 'bg-slate-100 text-primary'
                                    : 'text-text-secondary hover:bg-slate-50 hover:text-primary'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* 検索ボタンとメニューボタン（右側） */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <HeaderAffiliateLink />

                        <Link
                            href="/search"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-slate-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label="サイト内検索"
                            title="検索"
                        >
                            <SearchIcon className="h-5 w-5" />
                        </Link>

                        {/* モバイルメニューボタン */}
                        <button
                            ref={menuButtonRef}
                            onClick={toggleMenu}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-slate-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:hidden"
                            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                            aria-expanded={isMenuOpen}
                            aria-controls="mobile-navigation"
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
                    onClick={() => closeMenu(true)}
                    aria-hidden="true"
                />

                {/* モバイルメニューパネル（スライドアニメーション） */}
                <nav
                    ref={menuPanelRef}
                    id="mobile-navigation"
                    className={`mobile-menu-panel ${isMenuOpen ? 'open' : ''}`}
                    aria-label="モバイルナビゲーション"
                    aria-hidden={!isMenuOpen}
                >
                    <div className="flex items-center gap-2 px-4 py-4 mb-2 bg-slate-50 border-b border-slate-100">
                        <img src="/new-logo.webp" alt="UMA-FREE" width="24" height="24" className="w-6 h-6" loading="eager" decoding="async" />
                        <span className="text-base font-bold tracking-tight text-primary">UMA-FREE</span>
                    </div>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            prefetch={item.prefetch}
                            href={item.href}
                            tabIndex={isMenuOpen ? 0 : -1}
                            aria-current={item.isActive ? 'page' : undefined}
                            className={`block border-b border-slate-100 px-4 py-3 text-sm font-medium transition-colors duration-150 ${item.isActive
                                ? 'bg-slate-100 text-primary'
                                : 'text-text-primary hover:bg-slate-50 hover:text-primary'
                                }`}
                            onClick={() => closeMenu()}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <Link
                        href="/search"
                        tabIndex={isMenuOpen ? 0 : -1}
                        className="block px-4 py-3 text-sm font-medium text-text-primary hover:text-primary hover:bg-slate-50 transition-colors duration-200 border-b border-slate-50"
                        onClick={() => closeMenu()}
                    >
                        検索
                    </Link>
                    <div className="px-4 py-4 bg-slate-50/80">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 font-mono">その他</p>
                        <Link
                            href="/about"
                            tabIndex={isMenuOpen ? 0 : -1}
                            className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                            onClick={() => closeMenu()}
                        >
                            このサイトについて
                        </Link>
                        <Link
                            href="/advertising"
                            tabIndex={isMenuOpen ? 0 : -1}
                            className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                            onClick={() => closeMenu()}
                        >
                            広告について
                        </Link>
                        <Link
                            href="/contact"
                            tabIndex={isMenuOpen ? 0 : -1}
                            className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                            onClick={() => closeMenu()}
                        >
                            お問い合わせ
                        </Link>
                        <Link
                            href="/privacy"
                            tabIndex={isMenuOpen ? 0 : -1}
                            className="block py-2 text-sm text-text-secondary hover:text-primary transition-colors duration-200"
                            onClick={() => closeMenu()}
                        >
                            プライバシーポリシー
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    );
};
