'use client';

import Link from 'next/link';
import { GitCompareArrows, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    sendDataSearchEvent,
    sendHorseCompareEvent,
} from '@/lib/analytics';
import {
    clearHorseComparison,
    MY_DATA_UPDATED_EVENT,
    readHorseComparison,
    toggleHorseComparison,
    type SavedHorseComparison,
} from '@/lib/my-data';
import type { DataEntityDetail, DataSearchResponse } from '@/lib/types';


function displayRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

export default function HorseCompareClient() {
    const [saved, setSaved] = useState<SavedHorseComparison[]>([]);
    const [details, setDetails] = useState<DataEntityDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DataSearchResponse['items']>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');

    const refreshSaved = useCallback(() => {
        setSaved(readHorseComparison());
    }, []);

    useEffect(() => {
        refreshSaved();
        const handleUpdate = () => refreshSaved();
        window.addEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
        return () => window.removeEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
    }, [refreshSaved]);

    useEffect(() => {
        let cancelled = false;
        const fetchDetails = async () => {
            setLoading(true);
            setError('');
            if (saved.length === 0) {
                setDetails([]);
                setLoading(false);
                return;
            }
            try {
                const responses = await Promise.all(
                    saved.map(async (horse) => {
                        const response = await fetch(
                            `/api/data/entities/horse/${encodeURIComponent(horse.id)}`,
                            { cache: 'no-store' },
                        );
                        return response.ok ? response.json() as Promise<DataEntityDetail> : null;
                    }),
                );
                if (!cancelled) {
                    const next = responses.filter((item): item is DataEntityDetail => item !== null);
                    setDetails(next);
                    sendHorseCompareEvent({ action: 'view', horse_count: next.length });
                }
            } catch {
                if (!cancelled) setError('比較データを取得できませんでした。');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void fetchDetails();
        return () => {
            cancelled = true;
        };
    }, [saved]);

    const runSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = query.trim();
        if (!normalized) return;
        setSearching(true);
        setError('');
        try {
            const response = await fetch(`/api/data/search?q=${encodeURIComponent(normalized)}`, {
                cache: 'no-store',
            });
            if (!response.ok) throw new Error('search failed');
            const data = await response.json() as DataSearchResponse;
            const horses = data.items.filter((item) => item.entity_type === 'horse').slice(0, 8);
            setSearchResults(horses);
            sendDataSearchEvent({
                query_length: normalized.length,
                result_count: horses.length,
                search_surface: 'compare',
            });
        } catch {
            setError('検索データを取得できませんでした。');
        } finally {
            setSearching(false);
        }
    };

    const removeHorse = (horse: SavedHorseComparison) => {
        const result = toggleHorseComparison(horse);
        sendHorseCompareEvent({ action: 'remove', horse_count: result.items.length });
        refreshSaved();
    };

    const addHorse = (id: string, name: string, url: string) => {
        const result = toggleHorseComparison({ id, name, url });
        if (result.full) {
            setError('比較できる馬は5頭までです。');
            return;
        }
        setError('');
        sendHorseCompareEvent({ action: 'add', horse_count: result.items.length });
        setSearchResults([]);
        setQuery('');
        refreshSaved();
    };

    const courseRows = useMemo(() => {
        const keys = new Set<string>();
        details.forEach((detail) => {
            (detail.segments.courses ?? []).slice(0, 5).forEach((item) => keys.add(item.key));
        });
        return [...keys].slice(0, 10);
    }, [details]);

    return (
        <main className="mx-auto max-w-7xl px-3 pb-14 pt-4 sm:px-4">
            <header className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">HORSE COMPARISON</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">競走馬を横並びで比較</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    最大5頭まで、過去成績、条件別成績、近走、AI偏差値履歴を同じ基準で確認できます。
                </p>
            </header>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="horse-compare-search" className="sr-only">比較する馬を検索</label>
                    <input
                        id="horse-compare-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="馬名を入力"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                        type="submit"
                        disabled={searching}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary disabled:cursor-wait disabled:bg-slate-500"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {searching ? '検索中' : '馬を検索'}
                    </button>
                </form>
                {searchResults.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {searchResults.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => addHorse(item.id, item.name, item.url)}
                                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50"
                            >
                                <span>
                                    <span className="block font-bold text-slate-900">{item.name}</span>
                                    <span className="block text-xs text-slate-500">{item.description}</span>
                                </span>
                                <span className="text-xs font-bold text-primary">比較へ追加</span>
                            </button>
                        ))}
                    </div>
                )}
                {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
            </section>

            <section className="mt-4 flex flex-wrap items-center gap-2">
                {saved.map((horse) => (
                    <span key={horse.id} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 pr-1 text-sm font-bold text-slate-800">
                        <Link prefetch={false} href={horse.url} className="hover:text-primary">{horse.name}</Link>
                        <button
                            type="button"
                            onClick={() => removeHorse(horse)}
                            aria-label={`${horse.name}を比較から外す`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-red-700"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </span>
                ))}
                {saved.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            clearHorseComparison();
                            sendHorseCompareEvent({ action: 'clear', horse_count: 0 });
                            refreshSaved();
                        }}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm font-bold text-slate-600 hover:text-red-700"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        すべて外す
                    </button>
                )}
            </section>

            {loading ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600">
                    比較データを読み込んでいます。
                </div>
            ) : details.length < 2 ? (
                <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <GitCompareArrows className="h-6 w-6 text-slate-500" aria-hidden="true" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">2頭以上を追加してください</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                        上の検索、または競走馬ページと予想表から比較へ追加できます。
                    </p>
                </section>
            ) : (
                <div className="mt-6 space-y-6">
                    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 z-10 w-40 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left">比較項目</th>
                                    {details.map((detail) => (
                                        <th key={detail.entity.id} className="min-w-44 px-4 py-3 text-left">
                                            <Link prefetch={false} href={detail.entity.url} className="font-black text-slate-950 hover:text-primary">
                                                {detail.entity.name}
                                            </Link>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    ['対象', (detail: DataEntityDetail) => `${detail.overall.sample_size}走`],
                                    ['勝率', (detail: DataEntityDetail) => displayRate(detail.overall.win_rate)],
                                    ['3着以内率', (detail: DataEntityDetail) => displayRate(detail.overall.place_rate)],
                                    ['平均人気', (detail: DataEntityDetail) => detail.overall.average_popularity == null ? '—' : `${detail.overall.average_popularity.toFixed(1)}番`],
                                    ['最終出走', (detail: DataEntityDetail) => detail.entity.last_race_date ?? '—'],
                                    ['直近AI偏差値', (detail: DataEntityDetail) => {
                                        const score = detail.prediction_history[0]?.deviation_score;
                                        return score == null ? '—' : score.toFixed(1);
                                    }],
                                    ['直近着順', (detail: DataEntityDetail) => {
                                        const rank = detail.recent_runs[0]?.rank;
                                        return rank == null ? '—' : `${rank}着`;
                                    }],
                                ].map(([label, getter]) => (
                                    <tr key={String(label)}>
                                        <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left font-bold text-slate-600">
                                            {String(label)}
                                        </th>
                                        {details.map((detail) => (
                                            <td key={detail.entity.id} className="px-4 py-3 font-mono font-bold tabular-nums text-slate-800">
                                                {(getter as (value: DataEntityDetail) => string)(detail)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    {courseRows.length > 0 && (
                        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-4 py-3">
                                <h2 className="font-black text-slate-950">主なコース別3着以内率</h2>
                            </div>
                            <table className="w-full min-w-[720px] text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-600">
                                    <tr>
                                        <th className="sticky left-0 z-10 w-52 border-r border-slate-200 bg-slate-50 px-4 py-2 text-left">コース</th>
                                        {details.map((detail) => (
                                            <th key={detail.entity.id} className="min-w-40 px-4 py-2 text-right">{detail.entity.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {courseRows.map((courseKey) => {
                                        const label = details
                                            .flatMap((detail) => detail.segments.courses ?? [])
                                            .find((item) => item.key === courseKey)?.label ?? courseKey;
                                        return (
                                            <tr key={courseKey}>
                                                <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left font-bold text-slate-700">{label}</th>
                                                {details.map((detail) => {
                                                    const stat = (detail.segments.courses ?? []).find((item) => item.key === courseKey);
                                                    return (
                                                        <td key={detail.entity.id} className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                                                            {stat ? `${displayRate(stat.place_rate)} (${stat.sample_size})` : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </section>
                    )}
                </div>
            )}
        </main>
    );
}
