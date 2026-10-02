'use client';

// 過去の日付のページに着いたスマホの人へ、日付送りのすぐ下に「今日のレース分析へ」を1つ出す（2026-10-02）。
// スマホの日付送りは前日・選んでいる日・翌日の3つで「今日」が無く、2日以上前のページからは何度も押す必要があった。PC は日付送りに「今日」がある。
// 日付ページの HTML は長く使い回されるので、「過去の日か」はサーバーでは決めず、画面の側で決める（RaceDateNav の「今日」と同じ理由）。
// 行は最初から hidden 属性つきで HTML に出し、すぐ後ろの小さなスクリプトが最初の描画の前に hidden を外す
// （表示のあとに行を差し込むと、下の一覧が丸ごと下へ動くため）。
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { LineIcon } from '@/components/LineIcon';

const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const getJstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// YYYY-MM-DD は文字のまま比べられる。形が違う値は「過去ではない」として出さない
const isPastDate = (date: string) => DATE_PATTERN.test(date) && date < getJstToday();

// HTML の解析中にその場で動くスクリプト。中身は ASCII だけにする（日本語や全角の記号を入れると、構文エラーになることがある）。
// 日付は直前の行の data-date から読む（値を文字列に差し込まない）。判定は上の isPastDate と同じ。失敗したら何もしない。
const REVEAL_SCRIPT = '(function(){try{var s=document.currentScript,el=s&&s.previousElementSibling;if(!el)return;var d=el.getAttribute("data-date")||"";if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d))return;var t=new Date(Date.now()+32400000).toISOString().slice(0,10);if(d<t)el.removeAttribute("hidden")}catch(e){}})();';

// サーバーでは useLayoutEffect が使えないため、サーバーでは useEffect にする
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RaceDateTodayLink({ date }: { date: string }) {
    const rowRef = useRef<HTMLDivElement>(null);

    // 画面内の移動（別の日付ページから来たとき）は上のスクリプトが動かないので、ここでも同じ判定をする。
    // hidden は React の状態にせず、要素を直接動かす（スクリプトが外した hidden を、React が元に戻さないように）
    useIsomorphicLayoutEffect(() => {
        const row = rowRef.current;
        if (row) row.hidden = !isPastDate(date);
    }, [date]);

    return (
        <>
            {/* 包む要素ごと hidden にする（リンクの flex が hidden 属性に勝ってしまうため）。hidden の間は見出しの gap も出ない */}
            <div ref={rowRef} data-date={date} hidden suppressHydrationWarning className="md:hidden">
                <Link
                    href="/races/today"
                    prefetch={false}
                    className="mx-auto flex h-9 w-full max-w-[420px] items-center justify-center gap-1 rounded-xl border border-brand-200 bg-brand-50 text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-100"
                >
                    今日のレース分析へ
                    <LineIcon name="chevR" size={16} />
                </Link>
            </div>
            <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
        </>
    );
}
