'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type AccessibleInfoProps = {
    label: string;
    children: ReactNode;
    buttonClassName?: string;
};

/** 小さな説明をホバー専用にせず、タップ・キーボードでも開ける共有UI。 */
export function AccessibleInfo({ label, children, buttonClassName = '' }: AccessibleInfoProps) {
    const [isOpen, setIsOpen] = useState(false);
    const tooltipId = useId();
    const rootRef = useRef<HTMLSpanElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            buttonRef.current?.focus();
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <span ref={rootRef} className="relative inline-flex">
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-expanded={isOpen}
                aria-describedby={isOpen ? tooltipId : undefined}
                onClick={() => setIsOpen((current) => !current)}
                className={`inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${buttonClassName}`}
            >
                <span aria-hidden="true">?</span>
            </button>
            {isOpen && (
                <span
                    id={tooltipId}
                    role="tooltip"
                    className="absolute right-0 top-full z-40 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-700 shadow-lg"
                >
                    {children}
                </span>
            )}
        </span>
    );
}
