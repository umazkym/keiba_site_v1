'use client';

// 開催日ボードの日付送り：前日・日付を選ぶ・翌日・今日。
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LineIcon } from '@/components/LineIcon';

const shiftDate = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const getJstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function RaceDateNav({ date }: { date: string }) {
    const router = useRouter();
    const today = getJstToday();
    const iconLink = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors duration-150 hover:border-brand-300 hover:text-navy';

    return (
        <nav className="flex items-center gap-1.5" aria-label="日付の移動">
            <Link href={`/races/${shiftDate(date, -1)}`} prefetch={false} className={iconLink} aria-label="前日のレース">
                <LineIcon name="chevL" size={20} />
            </Link>
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 md:flex-none">
                <LineIcon name="calendar" size={18} className="block shrink-0 text-slate-500" />
                <span className="sr-only">日付を選ぶ</span>
                <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                        const next = event.target.value;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next !== date) router.push(`/races/${next}`);
                    }}
                    className="h-full min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 font-num text-[15px] font-semibold text-slate-900 focus:outline-none focus:ring-0"
                />
            </label>
            <Link href={`/races/${shiftDate(date, 1)}`} prefetch={false} className={iconLink} aria-label="翌日のレース">
                <LineIcon name="chevR" size={20} />
            </Link>
            {date !== today && (
                <Link href={`/races/${today}`} prefetch={false} className="ui-btn ui-btn--secondary shrink-0 px-3.5">
                    今日
                </Link>
            )}
        </nav>
    );
}
