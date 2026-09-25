'use client';

// データ詳細の「条件別の成績」など、表が縦に何枚も並ぶところを、スマホだけ1枚のカードにまとめてタブで切り替える（2026-09-25 スマホの見直し）。
// 表はタブを切り替えても全部 HTML に残し（検索のため）、スマホでは選んでいない表を hidden で隠すだけにする。
// PC（640px以上）はタブを出さず、今までどおり表ごとのカードを格子に並べる。
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { SectionHeader } from '@/components/SectionHeader';

export type DataSegmentTab = {
    key: string;
    label: string;
    panel: ReactNode;
};

export function DataSegmentTabs({
    title,
    tabs,
    note,
    className = '',
    gridClassName = 'lg:grid-cols-2',
}: {
    title: string;
    tabs: DataSegmentTab[];
    note?: ReactNode;
    className?: string;
    gridClassName?: string;
}) {
    const baseId = useId();
    const [active, setActive] = useState(0);
    if (tabs.length === 0) return null;
    const current = Math.min(active, tabs.length - 1);

    const focusTab = (index: number) => {
        const next = (index + tabs.length) % tabs.length;
        setActive(next);
        document.getElementById(`${baseId}-tab-${next}`)?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusTab(index + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusTab(index - 1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusTab(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            focusTab(tabs.length - 1);
        }
    };

    return (
        <section className={`overflow-hidden rounded-[14px] border border-slate-200 bg-white sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent ${className}`.trim()}>
            <div className="px-4 pb-2.5 pt-3.5 sm:hidden">
                <SectionHeader title={title} />
                {/* 390pxでは1行に収まる。320pxなど狭い画面では2行に折り返す（丸の中の文字を切らない） */}
                <div role="tablist" aria-label={title} className="mt-2.5 flex flex-wrap gap-1">
                    {tabs.map((tab, index) => {
                        const selected = index === current;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                id={`${baseId}-tab-${index}`}
                                aria-selected={selected}
                                aria-controls={`${baseId}-panel-${index}`}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => setActive(index)}
                                onKeyDown={(event) => handleKeyDown(event, index)}
                                className={`inline-flex h-8 flex-auto items-center justify-center whitespace-nowrap rounded-full px-2 text-[13.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                                    selected
                                        ? 'bg-navy text-white'
                                        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className={`sm:grid sm:gap-5 ${gridClassName}`}>
                {tabs.map((tab, index) => (
                    <div
                        key={tab.key}
                        role="tabpanel"
                        id={`${baseId}-panel-${index}`}
                        aria-labelledby={`${baseId}-tab-${index}`}
                        className={index === current ? 'min-w-0' : 'hidden min-w-0 sm:block'}
                    >
                        {tab.panel}
                    </div>
                ))}
            </div>
            {note && (
                <p className="border-t border-slate-200 px-4 py-2.5 text-[12.5px] leading-5 text-slate-500 sm:mt-3 sm:border-0 sm:px-0 sm:py-0">
                    {note}
                </p>
            )}
        </section>
    );
}
