'use client';

// 開催日ボードの日付送り（見本：前日｜その日｜翌日の札と前後の矢印。2026-09-25 スマホの見直し）。
// 以前は日付の入力欄「2026-09-24」と「今日」のボタンだった。PC（1280px以上）は前後2日ずつの5枚。
// 日付を選ぶ入力は、スマホでは右端のカレンダーのボタン、PC では「日付を選ぶ」のボタンの中に重ねる。
// 幅が足りない端末：360〜389pxはカレンダーのボタンを隠し（札と矢印を優先）、360px未満は前後の札を隠す（矢印で移動できる）。
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

    const iconLink = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors duration-150 hover:border-brand-300 hover:text-navy';
    const offsets = [-2, -1, 0, 1, 2];
    const todayOffset = today ? dayDiff(date, today) : null;
    // 「今日」のボタンは PC だけ。今日の札が並んでいないときに出す（1280px以上は前後2日、それ未満は前後1日が並ぶ）
    const todayButtonClass = todayOffset === null || Math.abs(todayOffset) <= 1
        ? null
        : Math.abs(todayOffset) === 2
            ? 'hidden md:inline-flex xl:hidden'
            : 'hidden md:inline-flex';

    return (
        <nav className="flex items-center gap-1 min-[390px]:gap-1.5 lg:gap-2" aria-label="日付の移動">
            <Link href={`/races/${shiftDate(date, -1)}`} prefetch={false} className={iconLink} aria-label="前日のレース">
                <LineIcon name="chevL" size={20} />
            </Link>
            <div className="flex items-center gap-1 min-[390px]:gap-1.5 lg:gap-2">
                {offsets.map((offset) => {
                    const day = shiftDate(date, offset);
                    const { md, wd } = describeDay(day);
                    const isCurrent = offset === 0;
                    const isToday = today === day;
                    const visibility = Math.abs(offset) === 2 ? 'hidden xl:flex' : offset === 0 ? 'flex' : 'hidden min-[360px]:flex';
                    const className = `${visibility} h-[50px] min-w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 transition-colors duration-150 lg:h-14 lg:min-w-[84px] ${isCurrent
                        ? 'border-navy bg-navy text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-navy'
                    }`;
                    const inner = (
                        <>
                            <span className="whitespace-nowrap font-num text-[16px] font-bold leading-none lg:text-[18px]">
                                {md}
                                <span className="ml-0.5 font-sans text-[11px] font-bold lg:text-[12px]">({wd})</span>
                            </span>
                            {isToday && (
                                <span className={`text-[11px] font-bold leading-none lg:text-[11.5px] ${isCurrent ? 'opacity-85' : 'opacity-70'}`}>今日</span>
                            )}
                        </>
                    );
                    return isCurrent ? (
                        <span key={day} className={className} aria-current="date">{inner}</span>
                    ) : (
                        <Link key={day} href={`/races/${day}`} prefetch={false} className={className} aria-label={`${md}(${wd})${isToday ? '・今日' : ''}のレース`}>
                            {inner}
                        </Link>
                    );
                })}
            </div>
            <Link href={`/races/${shiftDate(date, 1)}`} prefetch={false} className={iconLink} aria-label="翌日のレース">
                <LineIcon name="chevR" size={20} />
            </Link>
            {todayButtonClass && today && (
                <Link href={`/races/${today}`} prefetch={false} className={`ui-btn ui-btn--secondary shrink-0 px-3.5 ${todayButtonClass}`}>
                    今日
                </Link>
            )}
            {/* 見えない日付の入力をボタンに重ねる。押すと端末の日付の選択が開く */}
            <label className="relative ml-auto inline-flex h-11 w-11 min-[360px]:max-[389px]:hidden shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors duration-150 hover:border-brand-300 hover:text-navy lg:ml-1 lg:w-auto lg:px-3.5">
                <LineIcon name="calendar" size={18} className="block shrink-0" />
                <span className="sr-only text-[13.5px] font-bold lg:not-sr-only">日付を選ぶ</span>
                <input
                    ref={inputRef}
                    type="date"
                    value={date}
                    aria-label="日付を選ぶ"
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
        </nav>
    );
}
