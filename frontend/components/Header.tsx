'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SearchIcon, MenuIcon, XIcon } from '@/components/Icons';
import { sendAffiliateClickEvent, sendAffiliateImpressionEvent } from '@/lib/analytics';
import {
    getRakutenKeibaAffiliateUrl,
    shouldShowRakutenKeibaHeader,
} from '@/lib/affiliate-campaigns';
import { acquirePageScrollLock } from '@/lib/page-scroll-lock';

type HeaderProps = {
    todayString: string;
};

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
            link_id: HEADER_AFFILIATE_EVENT.link_id,
            provider: HEADER_AFFILIATE_EVENT.provider,
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
            href={getRakutenKeibaAffiliateUrl('site_header')}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={handleClick}
            data-affiliate-context={HEADER_AFFILIATE_EVENT.context}
            data-affiliate-campaign={HEADER_AFFILIATE_EVENT.campaign_id}
            className="inline-flex h-11 items-center gap-1 rounded-lg border border-rose-100 bg-rose-50/70 px-1.5 text-[11px] font-semibold text-rose-700 transition-colors duration-150 hover:border-rose-200 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 sm:gap-1.5 sm:px-3 sm:text-xs"
            aria-label="PR 楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です"
            title="PR 楽天ポイントがお得に貯まる！地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です。"
        >
            <span className="rounded bg-rose-600 px-1 py-0.5 text-[11px] leading-none text-white">PR</span>
            <span className="hidden sm:inline">地方競馬の投票は楽天競馬で</span>
            <span className="sm:hidden">楽天競馬</span>
            <span aria-hidden="true" className="text-[13px] leading-none">→</span>
        </a>
    );
};

export const Header = ({ todayString }: HeaderProps) => {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const headerRef = useRef<HTMLElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);

    const navItems = [
        { href: '/', label: 'ホーム', prefetch: undefined, isActive: pathname === '/' },
        { href: `/races/${todayString}`, label: '本日の分析', prefetch: false, isActive: pathname.startsWith('/races') },
        { href: '/keiba-data', label: 'データベース', prefetch: false, isActive: pathname.startsWith('/keiba-data') || pathname.startsWith('/horses') || pathname.startsWith('/jockeys') || pathname.startsWith('/trainers') || pathname.startsWith('/courses') || pathname.startsWith('/compare') || pathname.startsWith('/my-data') },
        { href: '/articles', label: '記事', prefetch: false, isActive: pathname.startsWith('/articles') },
        { href: '/faq', label: 'よくある質問', prefetch: undefined, isActive: pathname === '/faq' },
    ] as const;

    const toggleMenu = useCallback(() => {
        setIsMenuOpen(prev => {
            if (!prev) setIsHeaderVisible(true);
            return !prev;
        });
    }, []);

    const closeMenu = useCallback((restoreFocus = false) => {
        setIsMenuOpen(false);
        if (restoreFocus) {
            window.requestAnimationFrame(() => menuButtonRef.current?.focus());
        }
    }, []);

    // メニュー展開時に背景スクロールを止め、最初の主要リンクへフォーカスを移す。
    useEffect(() => {
        if (!isMenuOpen) return undefined;

        let focusFrame: number | undefined;
        let visibleFrame: number | undefined;
        const releaseScrollLock = acquirePageScrollLock();
        // visibilityの反映後にフォーカスする。1フレームだけではSafariで
        // 直前のメニューボタンへ残ることがあるため、描画を2回待つ。
        visibleFrame = window.requestAnimationFrame(() => {
            focusFrame = window.requestAnimationFrame(() => {
                menuPanelRef.current
                    ?.querySelector<HTMLAnchorElement>('[data-menu-initial-focus="true"]')
                    ?.focus({ preventScroll: true });
            });
        });
        return () => {
            if (visibleFrame !== undefined) {
                window.cancelAnimationFrame(visibleFrame);
            }
            if (focusFrame !== undefined) {
                window.cancelAnimationFrame(focusFrame);
            }
            releaseScrollLock();
        };
    }, [isMenuOpen]);

    useEffect(() => {
        if (!isMenuOpen) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu(true);
                return;
            }

            if (event.key !== 'Tab') return;

            const focusableElements = menuPanelRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeMenu, isMenuOpen]);

    useEffect(() => {
        setIsMenuOpen(false);
        setIsHeaderVisible(true);
    }, [pathname]);

    // 本文の途中では方向にかかわらず退避し、ページ最上部へ戻った時だけ復帰する。
    useEffect(() => {
        if (isMenuOpen) {
            setIsHeaderVisible(true);
            return undefined;
        }

        let frameId = 0;
        const updateVisibility = () => {
            frameId = 0;
            const nextScrollY = Math.max(0, window.scrollY);
            setIsHeaderVisible(nextScrollY <= 8);
        };

        const requestUpdate = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(updateVisibility);
        };

        window.addEventListener('scroll', requestUpdate, { passive: true });
        requestUpdate();
        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            window.removeEventListener('scroll', requestUpdate);
        };
    }, [isMenuOpen]);

    // sticky要素がヘッダーの実高と表示状態を共通参照できるようにする。
    useEffect(() => {
        const root = document.documentElement;
        const header = headerRef.current;
        if (!header) return undefined;

        let frameId = 0;
        let previousHeight = -1;
        let previousOffset = '';
        const updateHeaderMetrics = () => {
            frameId = 0;
            const height = header.offsetHeight || (window.innerWidth >= 640 ? 64 : 48);
            const heightValue = `${height}px`;
            const offsetValue = isHeaderVisible ? heightValue : '0px';
            if (height === previousHeight && offsetValue === previousOffset) return;

            previousHeight = height;
            previousOffset = offsetValue;
            root.style.setProperty('--site-header-height', heightValue);
            root.style.setProperty('--site-header-offset', offsetValue);
            window.dispatchEvent(new Event('uma:header-metrics-change'));
        };
        const requestHeaderMetrics = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(updateHeaderMetrics);
        };

        requestHeaderMetrics();
        const resizeObserver = new ResizeObserver(requestHeaderMetrics);
        resizeObserver.observe(header);
        window.addEventListener('resize', requestHeaderMetrics);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', requestHeaderMetrics);
        };
    }, [isHeaderVisible]);

    return (
        <>
            <header
                ref={headerRef}
                data-site-header
                data-site-header-visible={isHeaderVisible ? 'true' : 'false'}
                className={`glass site-header sticky top-0 z-50 ${isHeaderVisible ? 'site-header-visible' : 'site-header-hidden'}`}
            >
                <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 md:px-6">
                    <div className="flex h-10 items-center justify-between gap-1.5 sm:h-16 sm:gap-4">
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
                    <nav className="hidden lg:flex items-center gap-1 flex-1 ml-8" aria-label="主要ナビゲーション">
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
                        {shouldShowRakutenKeibaHeader() && <HeaderAffiliateLink />}

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
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-slate-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 lg:hidden"
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
                </div>
            </header>

            {/* backdrop-filterを持つヘッダー外へ置き、fixedの基準をビューポートへ固定する。 */}
            <div
                className={`mobile-menu-overlay ${isMenuOpen ? 'active' : ''}`}
                onClick={() => closeMenu(true)}
                aria-hidden="true"
            />

            <div
                ref={menuPanelRef}
                id="mobile-navigation"
                role="dialog"
                aria-modal="true"
                aria-label="モバイルナビゲーション"
                aria-hidden={!isMenuOpen}
                className={`mobile-menu-panel ${isMenuOpen ? 'open' : ''}`}
            >
                <nav aria-label="モバイル主要ナビゲーション">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            prefetch={item.prefetch}
                            href={item.href}
                            tabIndex={isMenuOpen ? 0 : -1}
                            data-menu-initial-focus={item.href === '/' ? 'true' : undefined}
                            aria-current={item.isActive ? 'page' : undefined}
                            className={`flex min-h-11 items-center border-b border-slate-100 px-4 py-2 text-sm font-medium transition-colors duration-150 ${item.isActive
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
                        className="flex min-h-11 items-center border-b border-slate-100 px-4 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-slate-50 hover:text-primary"
                        onClick={() => closeMenu()}
                    >
                        検索
                    </Link>
                </nav>
                <div className="bg-slate-50 px-4 py-3">
                    <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-text-muted">その他</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {[
                            { href: '/about', label: 'このサイトについて' },
                            { href: '/advertising', label: '広告について' },
                            { href: '/contact', label: 'お問い合わせ' },
                            { href: '/privacy', label: 'プライバシーポリシー' },
                        ].map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                tabIndex={isMenuOpen ? 0 : -1}
                                className="flex min-h-11 items-center text-sm text-text-secondary transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                onClick={() => closeMenu()}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
