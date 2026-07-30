'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RaceDataFeatures } from '@/lib/types';


function rate(value: number, sample: number): string {
    return sample > 0 ? `${value.toFixed(1)}% (${sample})` : '—';
}

export function RaceConditionComparison({ raceId }: { raceId: string }) {
    const [data, setData] = useState<RaceDataFeatures | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const load = async () => {
        if (loaded || loading) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/data/races/${encodeURIComponent(raceId)}`, {
                cache: 'no-store',
            });
            if (response.ok) {
                setData(await response.json() as RaceDataFeatures);
            }
        } finally {
            setLoaded(true);
            setLoading(false);
        }
    };

    return (
        <details
            className="race-panel mb-1.5 overflow-hidden"
            onToggle={(event) => {
                if (event.currentTarget.open) void load();
            }}
        >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4">
                <span>出走馬・騎手・調教師の同条件成績</span>
                <span className="text-xs font-semibold text-slate-500">過去データ</span>
            </summary>
            <div className="border-t border-slate-200">
                {loading && <p className="px-4 py-5 text-sm font-bold text-slate-600">集計データを読み込んでいます。</p>}
                {loaded && (!data || data.runners.length === 0) && (
                    <p className="px-4 py-5 text-sm leading-7 text-slate-600">
                        このレースで表示できる条件別データはありません。
                    </p>
                )}
                {data && data.runners.length > 0 && (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-xs sm:text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left">馬</th>
                                        <th className="px-3 py-2 text-right">全成績</th>
                                        <th className="px-3 py-2 text-right">同コース</th>
                                        <th className="px-3 py-2 text-left">騎手</th>
                                        <th className="px-3 py-2 text-right">騎手同条件</th>
                                        <th className="px-3 py-2 text-left">調教師</th>
                                        <th className="px-3 py-2 text-right">調教師同条件</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.runners.map((runner) => (
                                        <tr key={runner.horse_id}>
                                            <th className="px-3 py-3 text-left">
                                                <Link prefetch={false} href={`/horses/${encodeURIComponent(runner.horse_id)}`} className="font-bold text-slate-900 hover:text-primary">
                                                    {runner.horse_number ?? '—'}番 {runner.horse_name}
                                                </Link>
                                            </th>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                                                {rate(runner.horse_overall.place_rate, runner.horse_overall.sample_size)}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                {rate(runner.horse_condition.place_rate, runner.horse_condition.sample_size)}
                                            </td>
                                            <td className="px-3 py-3 font-bold text-slate-700">
                                                {runner.jockey_id ? (
                                                    <Link prefetch={false} href={`/jockeys/data/${encodeURIComponent(runner.jockey_id)}`} className="hover:text-primary">
                                                        {runner.jockey_name ?? '—'}
                                                    </Link>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                                                {rate(runner.jockey_condition.place_rate, runner.jockey_condition.sample_size)}
                                            </td>
                                            <td className="px-3 py-3 font-bold text-slate-700">
                                                {runner.trainer_id ? (
                                                    <Link prefetch={false} href={`/trainers/${encodeURIComponent(runner.trainer_id)}`} className="hover:text-primary">
                                                        {runner.trainer_name ?? '—'}
                                                    </Link>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                                                {rate(runner.trainer_condition.place_rate, runner.trainer_condition.sample_size)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-5 text-slate-500">
                            数字は3着以内率、括弧内は対象数です。同条件は競馬場・コース種別・距離が一致した過去結果です。
                        </p>
                    </>
                )}
            </div>
        </details>
    );
}
