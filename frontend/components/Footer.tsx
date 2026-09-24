import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLogo';
import { getConfiguredSocialLinks } from '@/lib/social-links';

type FooterProps = {
    todayString: string;
};

type FooterLink = {
    href: string;
    label: string;
    prefetch?: false;
};

export const Footer = ({ todayString }: FooterProps) => {
    const socialLinks = getConfiguredSocialLinks();
    const groups: Array<{ title: string; links: FooterLink[] }> = [
        {
            title: '分析',
            links: [
                { href: `/races/${todayString}`, label: '本日のレース分析', prefetch: false },
                { href: '/results/accuracy', label: 'AI予想の成績', prefetch: false },
                { href: '/about-ai', label: 'AI予測モデルについて' },
                { href: '/faq', label: 'よくある質問' },
            ],
        },
        {
            title: 'データと記事',
            links: [
                { href: '/keiba-data', label: '競馬データベース', prefetch: false },
                { href: '/horses', label: '競走馬データ', prefetch: false },
                { href: '/courses', label: 'コースデータ', prefetch: false },
                { href: '/articles', label: 'データ分析記事', prefetch: false },
                { href: '/my-data', label: 'マイデータ' },
            ],
        },
        {
            title: 'このサイトについて',
            links: [
                { href: '/about', label: '運営者情報' },
                { href: '/advertising', label: '広告について' },
                { href: '/contact', label: 'お問い合わせ' },
                { href: '/privacy', label: 'プライバシーポリシー' },
                { href: '/terms', label: '利用規約' },
                { href: '/sitemap', label: 'サイトマップ' },
            ],
        },
    ];

    return (
        <footer className="relative z-0 mt-6 bg-night pb-12 pt-8 text-night-sub sm:mt-12 sm:pb-16 sm:pt-12">
            <div className="site-shell-wide px-4 sm:px-6">
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] lg:gap-10">
                    <div className="max-w-sm">
                        <BrandLockup size={36} tone="inverse" tagline="完全無料のAI競馬分析" />
                        <p className="mt-4 text-[13px] leading-relaxed text-night-sub sm:text-sm sm:leading-7">
                            過去のレースデータをもとに、中央・地方の全レースのAI偏差値・対戦成績・展開・枠順傾向を毎日公開しています。
                        </p>
                    </div>

                    {groups.map((group) => (
                        <nav key={group.title} aria-label={group.title}>
                            <p className="text-[13px] font-bold tracking-[0.06em] text-white">{group.title}</p>
                            <ul className="mt-2 grid grid-cols-2 gap-x-4 lg:mt-3 lg:grid-cols-1">
                                {group.links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            prefetch={link.prefetch}
                                            className="flex min-h-10 items-center text-sm text-night-sub transition-colors duration-150 hover:text-white lg:min-h-9"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.12] pt-5 text-xs leading-relaxed text-night-faint sm:mt-10 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                    <p className="text-night-faint">本サイトは統計情報の提供を目的としており、投票の推奨ではありません。馬券の購入は20歳になってから。</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {socialLinks.map((socialLink) => (
                            <a
                                key={socialLink.platform}
                                href={socialLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-10 items-center text-night-sub transition-colors duration-150 hover:text-white"
                                aria-label={`${socialLink.label}アカウント`}
                            >
                                {socialLink.label.replace(/^公式/, '')}
                            </a>
                        ))}
                        <span>&copy; {new Date().getFullYear()} UMA-FREE</span>
                    </div>
                </div>
            </div>

            {/* Safari 26色同化防止シールド: ビューポート下端にサイト背景色の物理要素を伸ばし
                Safariがツールバー背景色としてフッターの暗色(bg-night)を自動採用するのを防ぐ */}
            <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom,12px)] translate-y-full"
                style={{ backgroundColor: '#F3F5FA' }}
                aria-hidden="true"
            />
        </footer>
    );
};
