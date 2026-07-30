'use client';

import Link from 'next/link';
import { GitCompareArrows, Plus, Search, Trash2, X } from 'lucide-react';
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

/** 着順に応じた色を返す */
function getRankColor(rank: number | null | undefined): string {
    if (rank == null) return 'text-slate-400';
    if (rank === 1) return 'text-amber-600 font-black';
    if (rank === 2) return 'text-slate-500 font-black';
    if (rank === 3) return 'text-amber-800/70 font-bold';
    return 'text-slate-600';
}

/** AI偏差値に応じた色を返す */
function getDeviationColor(score: number | null | undefined): string {
    if (score == null) return 'text-slate-400';
    if (score >= 60) return 'text-amber-700 font-black';
    if (score >= 50) return 'text-slate-800 font-bold';
    return 'text-slate-500';
}

/** 勝率/3着率の棒グラフの幅を計算（最大100%に対する割合） */
function getRateBarWidth(rate: number): string {
    const clamped = Math.min(Math.max(rate, 0), 100);
    return `${clamped}%`;
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
                <p className="text-xs font-bold text-slate-500">競馬データベース</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">競走馬を横並びで比較</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    最大5頭まで、過去成績、条件別成績、近走、AI偏差値履歴を同じ基準で確認できます。
                </p>
            </header>

            {/* 検索セクション */}
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="horse-compare-search" className="sr-only">比較する馬を検索</label>
                    <input
                        id="horse-compare-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="馬名を入力して検索"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="submit"
                        disabled={searching}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400"
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
                                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-blue-50"
                            >
                                <span>
                                    <span className="block font-bold text-slate-900">{item.name}</span>
                                    <span className="block text-xs text-slate-500">{item.description}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    追加
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
            </section>

            {/* 選択中の馬 */}
            <section className="mt-4 flex flex-wrap items-center gap-2">
                {saved.map((horse, index) => (
                    <span key={horse.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white pl-1 pr-1 text-sm font-bold text-slate-800">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black tabular-nums text-slate-500">
                            {index + 1}
                        </span>
                        <Link prefetch={false} href={horse.url} className="px-1 hover:text-blue-600">{horse.name}</Link>
                        <button
                            type="button"
                            onClick={() => removeHorse(horse)}
                            aria-label={`${horse.name}を比較から外す`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
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
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm font-bold text-slate-500 hover:text-red-600"
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
                /* 空状態：使い方ガイド */
                <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
                    <GitCompareArrows className="h-7 w-7 text-slate-400" aria-hidden="true" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">2頭以上を追加してください</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                        上の検索、または競走馬ページと予想表から比較へ追加できます。
                    </p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">1</span>
                            <p className="mt-2 text-sm font-bold text-slate-800">馬名で検索</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">上の検索ボックスから馬名を入力します。</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">2</span>
                            <p className="mt-2 text-sm font-bold text-slate-800">比較へ追加</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">検索結果から「追加」を押して最大5頭まで選べます。</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">3</span>
                            <p className="mt-2 text-sm font-bold text-slate-800">結果を比較</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">成績、得意条件、AI偏差値を横並びで確認できます。</p>
                        </div>
                    </div>
                </section>
            ) : (
                <div className="mt-6 space-y-6">
                    {/* メイン比較テーブル */}
                    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <div className="h-0.5 bg-gradient-to-r from-slate-800 via-blue-600 to-slate-400" />
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 z-10 w-40 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500">比較項目</th>
                                    {details.map((detail) => (
                                        <th key={detail.entity.id} className="min-w-44 px-4 py-3 text-left">
                                            <Link prefetch={false} href={detail.entity.url} className="font-black text-slate-950 hover:text-blue-600">
                                                {detail.entity.name}
                                            </Link>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* 対象走数 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500">対象</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="px-4 py-3 font-mono font-bold tabular-nums text-slate-800">
                                            {detail.overall.sample_size}走
                                        </td>
                                    ))}
                                </tr>
                                {/* 勝率 with bar */}
                                <tr className="bg-slate-50/50">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50/50 px-4 py-3 text-left text-xs font-bold text-slate-500">勝率</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="px-4 py-3">
                                            <span className="block font-mono font-bold tabular-nums text-slate-800">{displayRate(detail.overall.win_rate)}</span>
                                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: getRateBarWidth(detail.overall.win_rate) }} />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                                {/* 3着以内率 with bar */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500">3着以内率</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="px-4 py-3">
                                            <span className="block font-mono font-bold tabular-nums text-slate-800">{displayRate(detail.overall.place_rate)}</span>
                                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: getRateBarWidth(detail.overall.place_rate) }} />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                                {/* 平均人気 */}
                                <tr className="bg-slate-50/50">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50/50 px-4 py-3 text-left text-xs font-bold text-slate-500">平均人気</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="px-4 py-3 font-mono font-bold tabular-nums text-slate-800">
                                            {detail.overall.average_popularity == null ? '—' : `${detail.overall.average_popularity.toFixed(1)}番`}
                                        </td>
                                    ))}
                                </tr>
                                {/* 最終出走 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500">最終出走</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-700">
                                            {detail.entity.last_race_date ?? '—'}
                                        </td>
                                    ))}
                                </tr>
                                {/* 直近AI偏差値 */}
                                <tr className="bg-slate-50/50">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50/50 px-4 py-3 text-left text-xs font-bold text-slate-500">直近AI偏差値</th>
                                    {details.map((detail) => {
                                        const score = detail.prediction_history[0]?.deviation_score;
                                        return (
                                            <td key={detail.entity.id} className={`px-4 py-3 font-mono tabular-nums ${getDeviationColor(score)}`}>
                                                {score == null ? '—' : score.toFixed(1)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* 直近着順 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500">直近着順</th>
                                    {details.map((detail) => {
                                        const rank = detail.recent_runs[0]?.rank;
                                        return (
                                            <td key={detail.entity.id} className={`px-4 py-3 font-mono tabular-nums ${getRankColor(rank)}`}>
                                                {rank == null ? '—' : `${rank}着`}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    {/* コース別3着以内率 */}
                    {courseRows.length > 0 && (
                        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
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
                                    {courseRows.map((courseKey, rowIndex) => {
                                        const label = details
                                            .flatMap((detail) => detail.segments.courses ?? [])
                                            .find((item) => item.key === courseKey)?.label ?? courseKey;
                                        return (
                                            <tr key={courseKey} className={rowIndex % 2 === 1 ? 'bg-slate-50/50' : ''}>
                                                <th className={`sticky left-0 z-10 border-r border-slate-200 px-4 py-3 text-left text-xs font-bold text-slate-700 ${rowIndex % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>{label}</th>
                                                {details.map((detail) => {
                                                    const stat = (detail.segments.courses ?? []).find((item) => item.key === courseKey);
                                                    return (
                                                        <td key={detail.entity.id} className="px-4 py-3 text-right">
                                                            {stat ? (
                                                                <span className="inline-flex flex-col items-end">
                                                                    <span className="font-mono font-bold tabular-nums text-slate-800">{displayRate(stat.place_rate)}</span>
                                                                    <span className="text-[10px] tabular-nums text-slate-400">({stat.sample_size}走)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
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
