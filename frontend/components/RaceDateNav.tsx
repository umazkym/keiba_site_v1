'use client';

// 開催日ボード・開催のない日の日付送り。前後の矢印と日付を1本の帯にまとめ、画面の中央に置く（2026-09-26 利用者の指定「洗練させて中央に」）。
// 選んでいる日付（紺）を押すと端末の日付の選択が開く（以前は右端の別のカレンダーのボタン）。
// 並べる日付はスマホ3つ（360px未満は選んでいる日だけ）、1280px以上は5つ。今日が並んでいないPCは、帯の右に「今日」。
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineIcon } from '@/components/LineIcon';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const shiftDate = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const getJstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const dayDiff = (from: string, to: string) => {
    const toUtc = (value: string) => {
        const [y, m, d] = value.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return Math.round((toUtc(to) - toUtc(from)) / 86400000);
};

const describeDay = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return { md: `${m}/${d}`, wd: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
};

export function RaceDateNav({ date }: { date: string }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    // 「今日」は表示した後に決める（キャッシュしたHTMLの日付とずれて、表示の食い違いが起きないように）
    const [today, setToday] = useState<string | null>(null);
    useEffect(() => {
        setToday(getJstToday());
    }, []);

    const arrow = 'inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-navy';
    const offsets = [-2, -1, 0, 1, 2];
    const todayOffset = today ? dayDiff(date, today) : null;
    // 「今日」は PC だけ。今日の日付が並んでいないときに出す（1280px以上は前後2日、それ未満は前後1日が並ぶ）
    const todayButtonClass = todayOffset === null || Math.abs(todayOffset) <= 1
        ? null
        : Math.abs(todayOffset) === 2
            ? 'hidden md:inline-flex xl:hidden'
            : 'hidden md:inline-flex';

    return (
        <nav
            className="mx-auto flex w-full max-w-[420px] items-center gap-0.5 rounded-2xl border border-slate-200 bg-white p-1 lg:w-auto lg:max-w-none"
            aria-label="日付の移動"
        >
            <Link href={`/races/${shiftDate(date, -1)}`} prefetch={false} className={arrow} aria-label="前日のレース">
                <LineIcon name="chevL" size={20} />
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 lg:gap-1">
                {offsets.map((offset) => {
                    const day = shiftDate(date, offset);
                    const { md, wd } = describeDay(day);
                    const isToday = today === day;
                    const label = (
                        <span className="whitespace-nowrap font-num text-[15px] font-semibold leading-none">
                            {md}
                            <span className="ml-0.5 font-sans text-[11px] font-bold">({wd})</span>
                        </span>
                    );
                    const todayMark = isToday ? <span className="text-[10px] font-bold leading-none opacity-80">今日</span> : null;
                    if (offset === 0) {
                        return (
                            // 選んでいる日付。見えない日付の入力を重ね、押すと端末の日付の選択が開く
                            <label
                                key={day}
                                className="relative flex h-10 min-w-[100px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl bg-navy px-3 text-white"
                                aria-current="date"
                            >
                                <span className="flex items-center gap-1">
                                    {label}
                                    <LineIcon name="calendar" size={14} className="block shrink-0 opacity-80" />
                                </span>
                                {todayMark}
                                <input
                                    ref={inputRef}
                                    type="date"
                                    value={date}
                                    aria-label={`日付を選ぶ（表示中：${md}(${wd})）`}
                                    onClick={() => {
                                        try {
                                            inputRef.current?.showPicker?.();
                                        } catch {
                                            // showPicker が使えない端末は、入力欄を押したときの既定の動きに任せる
                                        }
                                    }}
                                    onChange={(event) => {
                                        const next = event.target.value;
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next !== date) router.push(`/races/${next}`);
                                    }}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                            </label>
                        );
                    }
                    const visibility = Math.abs(offset) === 2 ? 'hidden xl:flex' : 'hidden min-[360px]:flex';
                    return (
                        <Link
                            key={day}
                            href={`/races/${day}`}
                            prefetch={false}
                            className={`${visibility} h-10 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-navy lg:min-w-[84px] lg:flex-none`}
                            aria-label={`${md}(${wd})${isToday ? '・今日' : ''}のレース`}
                        >
                            {label}
                            {todayMark}
                        </Link>
                    );
                })}
            </div>
            <Link href={`/races/${shiftDate(date, 1)}`} prefetch={false} className={arrow} aria-label="翌日のレース">
                <LineIcon name="chevR" size={20} />
            </Link>
            {todayButtonClass && today && (
                <Link href={`/races/${today}`} prefetch={false} className={`h-10 shrink-0 items-center rounded-xl px-3 text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50 ${todayButtonClass}`}>
                    今日
                </Link>
            )}
        </nav>
    );
}
