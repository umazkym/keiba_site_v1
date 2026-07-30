'use client';

import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sendHorseCompareEvent } from '@/lib/analytics';
import { readHorseComparison, toggleHorseComparison } from '@/lib/my-data';


export function HorseCompareButton({
    horseId,
    horseName,
    url,
    compact = false,
}: {
    horseId: string;
    horseName: string;
    url: string;
    compact?: boolean;
}) {
    const [selected, setSelected] = useState(false);
    const [count, setCount] = useState(0);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const items = readHorseComparison();
        setSelected(items.some((item) => item.id === horseId));
        setCount(items.length);
    }, [horseId]);

    const handleClick = () => {
        const result = toggleHorseComparison({ id: horseId, name: horseName, url });
        if (result.full) {
            setMessage('比較できる馬は5頭までです。');
            return;
        }
        setMessage('');
        setSelected(result.added);
        setCount(result.items.length);
        sendHorseCompareEvent({
            action: result.added ? 'add' : 'remove',
            horse_count: result.items.length,
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={handleClick}
                aria-pressed={selected}
                className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    selected
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'
                }`}
            >
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                {compact ? (selected ? '比較中' : '比較') : (selected ? '比較から外す' : '比較に追加')}
            </button>
            {count >= 2 && (
                <Link
                    href="/compare"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                    {count}頭を比較
                </Link>
            )}
            {message && <p className="w-full text-xs font-semibold text-red-700">{message}</p>}
        </div>
    );
}
