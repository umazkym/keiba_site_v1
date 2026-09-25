'use client';

import Link from 'next/link';
import { BrandMark } from '@/components/BrandLogo';
import { LineIcon, type LineIconName } from '@/components/LineIcon';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { sendAffiliateClickEvent, sendAffiliateImpressionEvent } from '@/lib/analytics';
import {
    getRakutenKeibaAffiliateUrl,
    shouldShowRakutenKeibaHeader,
} from '@/lib/affiliate-campaigns';
import { acquirePageScrollLock } from '@/lib/page-scroll-lock';
import { getGoogleAdOverlaySnapshot, GOOGLE_AD_OVERLAY_EVENT } from '@/lib/google-ad-overlay';

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

const DESKTOP_HEADER_TOP_GAP = 32;

type NavItem = {
    href: string;
    label: string;
    menuLabel: string;
    icon: LineIconName;
    isActive: boolean;
};

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
            className="group inline-flex h-11 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
            aria-label="PR 地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です"
            title="PR 地方競馬の投票は楽天競馬で。馬券の購入は20歳以上の方のみ対象です。"
        >
            {/* 押せる範囲は44pxのまま、見える枠はヘッダー（スマホ44px）の中に収める。
                以前は枠そのものが44pxで、ヘッダーの上下からはみ出して見えていた */}
            <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-700 transition-colors duration-150 group-hover:border-rose-200 sm:h-10 sm:gap-1.5 sm:px-3 sm:text-xs">
                <span className="rounded bg-rose-600 px-1 py-0.5 text-[11px] leading-none text-white">PR</span>
                <span className="hidden sm:inline">地方競馬の投票は楽天競馬で</span>
                <span className="sm:hidden">楽天競馬</span>
                <span aria-hidden="true" className="text-[13px] leading-none">→</span>
            </span>
        </a>
    );
};

export const Header = ({ todayString }: HeaderProps) => {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [topAnchorControlHeight, setTopAnchorControlHeight] = useState<number>(() => getGoogleAdOverlaySnapshot().topAnchorControlHeight);
    const headerRef = useRef<HTMLElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);

    const navItems: NavItem[] = [
        { href: '/', label: 'ホーム', menuLabel: 'ホーム', icon: 'home', isActive: pathname === '/' },
        { href: `/races/${todayString}`, label: '本日の分析', menuLabel: '本日の分析', icon: 'race', isActive: pathname.startsWith('/races') },
        { href: '/keiba-data', label: 'データベース', menuLabel: 'データベース', icon: 'database', isActive: pathname.startsWith('/keiba-data') || pathname.startsWith('/horses') || pathname.startsWith('/jockeys') || pathname.startsWith('/trainers') || pathname.startsWith('/courses') || pathname.startsWith('/compare') || pathname.startsWith('/my-data') },
        { href: '/articles', label: '記事', menuLabel: 'データ分析記事', icon: 'book', isActive: pathname.startsWith('/articles') },
        { href: '/faq', label: 'よくある質問', menuLabel: 'よくある質問', icon: 'help', isActive: pathname === '/faq' },
    ];
    // モバイルメニューだけに出す項目（PCの横並びは5項目のまま）。見本の順で「よくある質問」の前に入れる。
    // サイト内検索はヘッダーの虫めがねと同じ行き先なので、メニューには置かない（2026-09-25）
    const menuOnlyItems: NavItem[] = [
        { href: '/results/accuracy', label: 'AI予想の成績', menuLabel: 'AI予想の成績', icon: 'trophy', isActive: pathname.startsWith('/results') },
    ];
    const menuItems: NavItem[] = [...navItems.slice(0, -1), ...menuOnlyItems, ...navItems.slice(-1)];

    const toggleMenu = useCallback(() => {
        setIsMenuOpen(prev => !prev);
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
    }, [pathname]);

    // 全画面幅で固定位置を維持し、広告全高ではなく最大32pxの操作部高だけを反映する。
    useEffect(() => {
        let anchorDebounceTimer = 0;
        let pendingAnchorControlHeight = -1;

        const applyAnchorControlHeight = (newControlHeight: number) => {
            // 広告の展開/折りたたみアニメーション中の中間値でガタつかないようデバウンスする。
            // ただし 0 への復帰（広告消失）は即座に適用する。
            if (newControlHeight === 0) {
                window.clearTimeout(anchorDebounceTimer);
                pendingAnchorControlHeight = -1;
                setTopAnchorControlHeight(0);
                return;
            }
            if (newControlHeight === pendingAnchorControlHeight) return;
            pendingAnchorControlHeight = newControlHeight;
            window.clearTimeout(anchorDebounceTimer);
            anchorDebounceTimer = window.setTimeout(() => {
                setTopAnchorControlHeight(pendingAnchorControlHeight);
                pendingAnchorControlHeight = -1;
            }, 300);
        };

        const updateAnchorControlHeight = () => {
            const overlay = getGoogleAdOverlaySnapshot();
            applyAnchorControlHeight(overlay.topAnchorControlHeight);
        };

        const handleOverlayChange = () => updateAnchorControlHeight();
        window.addEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange as EventListener);
        window.addEventListener('resize', updateAnchorControlHeight, { passive: true });

        updateAnchorControlHeight();

        return () => {
            window.clearTimeout(anchorDebounceTimer);
            window.removeEventListener(GOOGLE_AD_OVERLAY_EVENT, handleOverlayChange as EventListener);
            window.removeEventListener('resize', updateAnchorControlHeight);
        };
    }, []);

    // sticky要素がヘッダーの実高、固定用上余白、表示状態を共通参照できるようにする。
    useEffect(() => {
        const root = document.documentElement;
        const header = headerRef.current;
        if (!header) return undefined;

        let frameId = 0;
        let previousHeight = -1;
        let previousOffset = '';
        let previousTopGap = '';
        const updateHeaderMetrics = () => {
            frameId = 0;
            const height = header.offsetHeight || (window.innerWidth >= 640 ? 64 : 48);
            const heightValue = `${height}px`;
            // PCは広告DOMの遅延生成でも動かないよう、操作部相当の32pxを初期表示から固定予約する。
            // 1024px未満は既存どおり、実際に検出した操作部高（最大32px）を使用する。
            const usesDesktopStableGap = window.matchMedia('(min-width: 1024px)').matches;
            const topGap = usesDesktopStableGap ? DESKTOP_HEADER_TOP_GAP : topAnchorControlHeight;
            const offsetValue = `${height + topGap}px`;
            const topGapValue = `${topGap}px`;
            if (
                height === previousHeight
                && offsetValue === previousOffset
                && topGapValue === previousTopGap
            ) return;

            previousHeight = height;
            previousOffset = offsetValue;
            previousTopGap = topGapValue;
            root.style.setProperty('--site-header-height', heightValue);
            root.style.setProperty('--site-header-offset', offsetValue);
            root.style.setProperty('--site-header-top-gap', topGapValue);
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
    }, [topAnchorControlHeight]);

    return (
        <>
            <header
                ref={headerRef}
                data-site-header
                data-site-header-visible="true"
                className="glass site-header site-header-visible z-50 pt-[env(safe-area-inset-top,0px)]"
            >
                <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-4 md:px-6">
                    <div className="flex h-11 items-center justify-between gap-1.5 sm:h-16 sm:gap-4">
                    {/* ロゴ */}
                    {/* ヘッダーのリンクは先読みしない（全ページで画面に入るため、先読みがキャッシュを通らず Cloud Run へ届く。
                        閉じたモバイルメニューも画面の外に置かれているだけなので先読みされていた。2026-09-25） */}
                    <Link href="/" prefetch={false} className="flex min-h-[44px] items-center gap-2 sm:gap-3 shrink-0" aria-label="UMA-FREE ホーム">
                        {/* スマホも正式なロゴと同じ線のあるマークを使う（以前は線を省いた小さい版で、ロゴが違って見えた。2026-09-26） */}
                        <BrandMark size={30} variant="full" className="sm:hidden" />
                        <BrandMark size={44} variant="full" className="hidden sm:block" />
                        {/* 幅360px未満（iPhone SE 初代など）は、PR と検索・メニューを収めるため文字のロゴを省きマークだけにする */}
                        <span className="flex flex-col leading-none max-[359px]:hidden">
                            <span className="font-brand text-[17px] font-extrabold tracking-[0.01em] text-navy sm:text-[23px]">
                                UMA-FREE
                            </span>
                            <span className="mt-1 hidden text-xs font-medium text-slate-500 sm:block">
                                完全無料のAI競馬分析
                            </span>
                        </span>
                    </Link>

                    {/* デスクトップナビゲーション */}
                    <nav className="hidden lg:flex items-center self-stretch gap-0.5 flex-1 ml-6" aria-label="主要ナビゲーション">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={false}
                                aria-current={item.isActive ? 'page' : undefined}
                                className={`relative flex h-full items-center whitespace-nowrap px-3.5 text-[15px] transition-colors duration-150 ${item.isActive
                                    ? 'font-bold text-navy after:absolute after:inset-x-3.5 after:bottom-0 after:h-[3px] after:rounded-t-[3px] after:bg-brand-600'
                                    : 'font-medium text-slate-700 hover:text-navy'
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
                            prefetch={false}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                            aria-label="サイト内検索"
                            title="検索"
                        >
                            <LineIcon name="search" size={22} />
                        </Link>

                        {/* モバイルメニューボタン */}
                        <button
                            ref={menuButtonRef}
                            onClick={toggleMenu}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 lg:hidden"
                            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                            aria-expanded={isMenuOpen}
                            aria-controls="mobile-navigation"
                        >
                            <LineIcon name={isMenuOpen ? 'close' : 'menu'} size={22} />
                        </button>
                    </div>
                    </div>
                </div>
            </header>

            <div className="site-header-spacer" aria-hidden="true" />

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
                <nav aria-label="モバイル主要ナビゲーション" className="px-4 pt-1">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            prefetch={false}
                            href={item.href}
                            tabIndex={isMenuOpen ? 0 : -1}
                            data-menu-initial-focus={item.href === '/' ? 'true' : undefined}
                            aria-current={item.isActive ? 'page' : undefined}
                            className={`flex min-h-11 items-center gap-3.5 border-b border-slate-200 px-1.5 text-base font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/40 ${item.isActive
                                ? 'text-brand-700'
                                : 'text-slate-900 hover:text-brand-700'
                                }`}
                            onClick={() => closeMenu()}
                        >
                            <LineIcon name={item.icon} size={22} className={`block shrink-0 ${item.isActive ? 'text-brand-600' : 'text-navy'}`} />
                            <span className="flex-1">{item.menuLabel}</span>
                            <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
                        </Link>
                    ))}
                </nav>
                <div className="flex flex-wrap gap-x-4 px-4 pt-3">
                    {[
                        { href: '/about', label: '運営者情報' },
                        { href: '/about-ai', label: 'AI偏差値について' },
                        { href: '/advertising', label: '広告について' },
                        { href: '/contact', label: 'お問い合わせ' },
                        { href: '/privacy', label: 'プライバシーポリシー' },
                    ].map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            tabIndex={isMenuOpen ? 0 : -1}
                            className="flex min-h-11 items-center text-sm text-slate-700 transition-colors duration-150 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                            onClick={() => closeMenu()}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <p className="mx-4 mb-6 mt-auto rounded-xl bg-slate-100 px-3.5 py-3 text-right text-xs leading-relaxed text-slate-600">
                    {/* 文の切れ目で2行にする（1行に詰めると「ありませ／ん。」と折れる） */}
                    <span className="block">AI分析は参考情報です。</span>
                    <span className="block">投票の推奨ではありません。</span>
                </p>
            </div>
        </>
    );
};
