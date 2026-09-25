// frontend/app/not-found.tsx
// 見本（notFound）：案内役の馬・404・見出し・2行の説明・検索欄・主なページ3つ。
// スマホの見直し（2026-09-25）：見える「検索」ボタンをやめて欄を全幅に（例文が切れていた）、
// 下の文字リンク（ホーム・よくある質問など）はすぐ下のフッターと重なるため外した。
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

// 説明は見本どおり短く（404 で API は呼ばないため、見本の「地方4場 · 47レース」の件数は出さない）
const ENTRIES: Array<{ href: string; icon: LineIconName; title: string; description: string }> = [
    { href: '/races/today', icon: 'race', title: '今日のレース分析', description: '全レースのAI偏差値' },
    { href: '/articles', icon: 'book', title: 'データ分析記事', description: '重賞・騎手・コース' },
    { href: '/keiba-data', icon: 'database', title: '競馬データベース', description: '競走馬・騎手・コース' },
];

export default function NotFound() {
    return (
        <div className="mx-auto w-full max-w-[960px] pt-4 sm:px-4 sm:pb-14 sm:pt-12">
            <section className="flex flex-col items-center gap-3 text-center sm:gap-4">
                <GuideHorse size={150} mood="lost" className="block h-[120px] w-[120px] sm:h-[150px] sm:w-[150px]" />
                <p className="font-num text-[15px] font-bold tracking-[0.14em] text-slate-500">404</p>
                <h1 className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-[32px]">ページが見つかりませんでした</h1>
                <p className="max-w-[520px] text-sm leading-7 text-slate-700 sm:text-[15.5px]">
                    移動したか、削除された可能性があります。<br />
                    レース名・競馬場・騎手の名前で探せます。
                </p>
                {/* 送信は Enter・キーボードの「検索」で行う。読み上げ用の送信ボタンは見えない形で残す */}
                <form action="/search" method="get" role="search" className="flex w-full max-w-[520px] items-center">
                    <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-slate-300 bg-white px-4 transition-colors duration-150 focus-within:border-brand-600">
                        <LineIcon name="search" size={20} className="block shrink-0 text-slate-400" />
                        <span className="sr-only">サイト内を検索</span>
                        <input
                            type="search"
                            name="q"
                            enterKeyHint="search"
                            placeholder="例：スプリンターズS、園田、戸崎圭太"
                            className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                        />
                    </label>
                    <button type="submit" className="sr-only">検索</button>
                </form>
            </section>

            <nav aria-label="主なページ" className="mt-3 grid gap-3 sm:mt-10 sm:grid-cols-3">
                {ENTRIES.map((entry) => (
                    <Link
                        key={entry.href}
                        href={entry.href}
                        prefetch={false}
                        className="flex items-center gap-3.5 rounded-[14px] border border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-brand-300"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
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
        </div>
    );
}
