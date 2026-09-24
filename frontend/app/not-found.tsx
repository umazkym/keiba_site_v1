// frontend/app/not-found.tsx
import Link from "next/link";
import type { Metadata } from 'next';
import { GuideHorse } from "@/components/BrandLogo";
import { LineIcon, type LineIconName } from "@/components/LineIcon";

// 404ページはインデックスさせない
export const metadata: Metadata = {
    robots: {
        index: false,
        follow: true,
    },
};

const ENTRIES: Array<{ href: string; icon: LineIconName; title: string; description: string }> = [
    { href: '/races/today', icon: 'race', title: '今日のレース分析', description: 'AI偏差値・対戦成績・展開・枠順傾向' },
    { href: '/articles', icon: 'book', title: 'データ分析記事', description: '重賞・騎手・コースの傾向' },
    { href: '/keiba-data', icon: 'database', title: '競馬データベース', description: '競走馬・騎手・コースの成績' },
];

const SUB_LINKS = [
    { href: '/', label: 'ホーム' },
    { href: '/faq', label: 'よくある質問' },
    { href: '/contact', label: 'お問い合わせ' },
    { href: '/sitemap', label: 'サイトマップ' },
];

export default function NotFound() {
    return (
        <div className="mx-auto w-full max-w-[960px] px-1 pb-10 pt-6 sm:px-4 sm:pb-14 sm:pt-12">
            <section className="flex flex-col items-center gap-3 text-center sm:gap-4">
                <GuideHorse size={150} mood="lost" className="block h-[120px] w-[120px] sm:h-[150px] sm:w-[150px]" />
                <p className="font-num text-[15px] font-bold tracking-[0.14em] text-slate-500">404</p>
                <h1 className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-[32px]">ページが見つかりませんでした</h1>
                <p className="max-w-[520px] text-sm leading-7 text-slate-700 sm:text-[15.5px]">
                    移動したか、削除された可能性があります。<br />
                    レース名・競馬場・騎手の名前で探せます。
                </p>
                <form action="/search" method="get" role="search" className="mt-1 flex w-full max-w-[520px] items-center gap-2">
                    <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-slate-300 bg-white px-4 transition-colors duration-150 focus-within:border-brand-600">
                        <LineIcon name="search" size={20} className="block shrink-0 text-slate-400" />
                        <span className="sr-only">サイト内を検索</span>
                        <input
                            type="search"
                            name="q"
                            placeholder="例：スプリンターズS、園田、戸崎圭太"
                            className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                        />
                    </label>
                    <button type="submit" className="ui-btn ui-btn--primary ui-btn--l shrink-0">検索</button>
                </form>
            </section>

            <nav aria-label="主なページ" className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3">
                {ENTRIES.map((entry) => (
                    <Link
                        key={entry.href}
                        href={entry.href}
                        prefetch={false}
                        className="flex items-center gap-3.5 rounded-[14px] border border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-brand-300"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                            <LineIcon name={entry.icon} size={22} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[15px] font-bold text-slate-900">{entry.title}</span>
                            <span className="text-[13px] text-slate-500">{entry.description}</span>
                        </span>
                        <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-400" />
                    </Link>
                ))}
            </nav>

            <div className="mt-5 flex flex-wrap justify-center gap-x-5">
                {SUB_LINKS.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex min-h-11 items-center text-sm text-slate-600 transition-colors duration-150 hover:text-brand-700"
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}
