'use client';

// 切り替えのボタン（淡い面の中で、選んでいるものだけ白く浮く）。高さ32px。
// 出走表の並べ替え・注目馬の種類・開催日の中央／地方で同じ形を使う（2026-09-26 利用者の指定「切り替えボタン的なUI」）。
import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
    value: T;
    label: ReactNode;
    disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    // full：親の幅いっぱいに均等に並べる
    full?: boolean;
    className?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, full = false, className = '' }: SegmentedControlProps<T>) {
    return (
        <div role="group" aria-label={ariaLabel} className={`${full ? 'flex w-full' : 'inline-flex'} rounded-[10px] bg-slate-100 p-0.5 ${className}`}>
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                        className={`inline-flex h-7 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] text-[12.5px] font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-default disabled:opacity-50 ${full ? 'flex-1 px-1.5' : 'px-3'} ${active ? 'bg-white text-navy shadow-[0_1px_2px_rgba(20,26,61,0.16)]' : 'text-slate-500 hover:text-navy'}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
