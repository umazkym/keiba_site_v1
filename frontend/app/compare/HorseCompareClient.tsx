'use client';

import Link from 'next/link';
import { Bookmark, CalendarDays, GitCompareArrows, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataHubNav } from '@/components/DataHubNav';
import {
    sendDataSearchEvent,
    sendHorseCompareEvent,
} from '@/lib/analytics';
import {
    clearHorseComparison,
    MY_DATA_UPDATED_EVENT,
    readFavorites,
    readHorseComparison,
    toggleFavorite,
    toggleHorseComparison,
    type SavedHorseComparison,
} from '@/lib/my-data';
import type { DataEntityDetail, DataSearchResponse } from '@/lib/types';


function displayRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

/** 着順に応じた色・バッジを返す */
function getRankColor(rank: number | null | undefined) {
    if (rank == null) return <span className="text-slate-400">—</span>;
    if (rank === 1) return <span className="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-black text-amber-950">1着</span>;
    if (rank === 2) return <span className="rounded-md border border-slate-300 bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-black text-slate-900">2着</span>;
    if (rank === 3) return <span className="rounded-md border border-orange-200 bg-orange-100 px-1.5 py-0.5 font-mono text-xs font-bold text-orange-950">3着</span>;
    return <span className="font-mono text-xs font-semibold text-slate-600">{rank}着</span>;
}

/** AI偏差値に応じた色を返す */
function getDeviationColor(score: number | null | undefined): string {
    if (score == null) return 'text-slate-400';
    if (score >= 60) return 'text-amber-700 font-black';
    if (score >= 50) return 'text-slate-800 font-bold';
    return 'text-slate-500';
}

/** 勝率/3着率の棒グラフの幅を計算 */
function getRateBarWidth(rate: number): string {
    const clamped = Math.min(Math.max(rate, 0), 100);
    return `${clamped}%`;
}

export default function HorseCompareClient() {
    const [saved, setSaved] = useState<SavedHorseComparison[]>([]);
    const [favorites, setFavorites] = useState<ReturnType<typeof readFavorites>>([]);
    const [details, setDetails] = useState<DataEntityDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DataSearchResponse['items']>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');

    const refreshSaved = useCallback(() => {
        setSaved(readHorseComparison());
        setFavorites(readFavorites());
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

    const handleToggleFavorite = (detail: DataEntityDetail) => {
        toggleFavorite({
            entity_type: 'horse',
            id: detail.entity.id,
            name: detail.entity.name,
            subtitle: detail.entity.subtitle,
            url: detail.entity.url,
        });
        refreshSaved();
    };


    const courseRows = useMemo(() => {
        const keys = new Set<string>();
        details.forEach((detail) => {
            (detail.segments.courses ?? []).slice(0, 5).forEach((item) => keys.add(item.key));
        });
        return [...keys].slice(0, 10);
    }, [details]);

    // 指標トップ馬の特定
    const maxWinRate = useMemo(() => Math.max(...details.map((d) => d.overall.win_rate), 0), [details]);
    const maxPlaceRate = useMemo(() => Math.max(...details.map((d) => d.overall.place_rate), 0), [details]);

    return (
        <main className="mx-auto max-w-7xl px-3 pb-14 pt-3 sm:px-4">
            <DataHubNav currentPath="/compare" />

            <header className="mt-5 border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">競馬データベース</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-4xl">競走馬の成績比較</h1>

                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600 sm:text-sm sm:leading-7">
                    最大5頭まで、過去成績、勝率、3着以内率、得意コース、AI偏差値履歴を同じ基準で確認できます。
                </p>
            </header>

            {/* 検索セクション */}
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="horse-compare-search" className="sr-only">比較する馬を検索</label>
                    <input
                        id="horse-compare-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="馬名を入力して検索（例: ドゥデュース、キセキ）"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="submit"
                        disabled={searching}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-amber-700 disabled:cursor-wait disabled:bg-slate-400"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {searching ? '検索中' : '馬を検索'}
                    </button>
                </form>
                {searchResults.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                        {searchResults.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => addHorse(item.id, item.name, item.url)}
                                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-blue-50"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-bold text-slate-900">{item.name}</span>
                                    <span className="block truncate text-xs text-slate-500">{item.description}</span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    追加
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
            </section>

            {/* 選択中の馬タグ */}
            <section className="mt-4 flex flex-wrap items-center gap-2">
                {saved.map((horse, index) => (
                    <span key={horse.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white pl-2 pr-1 text-sm font-bold text-slate-800 shadow-2xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 font-mono text-[11px] font-black text-slate-600">
                            {index + 1}
                        </span>
                        <Link prefetch={false} href={horse.url} className="px-1 max-w-[140px] truncate hover:text-blue-600" title={horse.name}>
                            {horse.name}
                        </Link>
                        <button
                            type="button"
                            onClick={() => removeHorse(horse)}
                            aria-label={`${horse.name}を比較から外す`}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
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
                        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 text-xs font-bold text-slate-500 transition-colors hover:text-red-600"
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        すべて外す
                    </button>
                )}
            </section>

            {loading ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-600">
                    比較データを読み込んでいます...
                </div>
            ) : details.length < 2 ? (
                /* 空状態ガイド */
                <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                            <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="text-lg font-black text-slate-950">2頭以上の競走馬を選択してください</h2>
                            <p className="text-xs leading-5 text-slate-600">上の検索窓、または各馬の詳細ページから追加できます。</p>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 font-mono text-xs font-black text-white">1</span>
                            <p className="mt-2 text-sm font-black text-slate-900">馬名で検索</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">上の入力欄にお探しの馬名を入力して検索します。</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 font-mono text-xs font-black text-white">2</span>
                            <p className="mt-2 text-sm font-black text-slate-900">比較へ追加</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">検索結果や馬データ詳細画面から最大5頭まで登録。</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 font-mono text-xs font-black text-white">3</span>
                            <p className="mt-2 text-sm font-black text-slate-900">同じ基準で成績比較</p>

                            <p className="mt-1 text-xs leading-relaxed text-slate-500">過去成績、勝率、得意コース、AI偏差値を一目で判定。</p>
                        </div>
                    </div>
                </section>
            ) : (
                <div className="mt-6 space-y-6">
                    {/* メイン比較テーブル */}
                    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                        <div className="h-1 bg-gradient-to-r from-amber-500 via-blue-600 to-emerald-600" />
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 z-20 w-36 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-black text-slate-600 shadow-xs">
                                        比較項目
                                    </th>
                                    {details.map((detail) => {
                                        const isFav = favorites.some((f) => f.id === detail.entity.id);
                                        const hasUpcoming = detail.upcoming_races.length > 0;
                                        return (
                                            <th key={detail.entity.id} className="min-w-[180px] border-b border-r border-slate-200 px-4 py-3 text-left last:border-r-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <Link prefetch={false} href={detail.entity.url} className="block truncate text-base font-black text-slate-950 hover:text-blue-600" title={detail.entity.name}>
                                                        {detail.entity.name}
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleFavorite(detail)}
                                                        title={isFav ? 'お気に入りから外す' : 'お気に入り保存'}
                                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                                            isFav
                                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                                                                : 'border-slate-200 bg-white text-slate-400 hover:text-emerald-600'
                                                        }`}
                                                    >
                                                        <Bookmark className="h-3.5 w-3.5" fill={isFav ? 'currentColor' : 'none'} aria-hidden="true" />
                                                    </button>
                                                </div>
                                                {hasUpcoming && (
                                                    <Link
                                                        href={detail.upcoming_races[0].url}
                                                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200 hover:bg-blue-100"
                                                    >
                                                        <CalendarDays className="h-3 w-3" aria-hidden="true" />
                                                        本日出走予定あり
                                                    </Link>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* 対象走数 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">対象</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="border-r border-slate-100 px-4 py-3 font-mono font-bold tabular-nums text-slate-800 last:border-r-0">
                                            {detail.overall.sample_size}走
                                        </td>
                                    ))}
                                </tr>
                                {/* 勝率 with bar */}
                                <tr className="bg-slate-50/40">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">勝率</th>
                                    {details.map((detail) => {
                                        const isTop = maxWinRate > 0 && detail.overall.win_rate === maxWinRate;
                                        return (
                                            <td key={detail.entity.id} className={`border-r border-slate-100 px-4 py-3 last:border-r-0 ${isTop ? 'bg-amber-50/50' : ''}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-mono font-bold tabular-nums ${isTop ? 'text-amber-800 font-black' : 'text-slate-800'}`}>
                                                        {displayRate(detail.overall.win_rate)}
                                                    </span>
                                                    {isTop && <span className="rounded-md bg-amber-500 px-1.5 py-0.2 text-[9px] font-black text-white">👑 BEST</span>}
                                                </div>
                                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                    <div className={`h-full rounded-full transition-all duration-300 ${isTop ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: getRateBarWidth(detail.overall.win_rate) }} />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* 3着以内率 with bar */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">3着以内率</th>
                                    {details.map((detail) => {
                                        const isTop = maxPlaceRate > 0 && detail.overall.place_rate === maxPlaceRate;
                                        return (
                                            <td key={detail.entity.id} className={`border-r border-slate-100 px-4 py-3 last:border-r-0 ${isTop ? 'bg-emerald-50/40' : ''}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-mono font-bold tabular-nums ${isTop ? 'text-emerald-800 font-black' : 'text-slate-800'}`}>
                                                        {displayRate(detail.overall.place_rate)}
                                                    </span>
                                                    {isTop && <span className="rounded-md bg-emerald-600 px-1.5 py-0.2 text-[9px] font-black text-white">👑 BEST</span>}
                                                </div>
                                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: getRateBarWidth(detail.overall.place_rate) }} />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* 平均人気 */}
                                <tr className="bg-slate-50/40">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">平均人気</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="border-r border-slate-100 px-4 py-3 font-mono font-bold tabular-nums text-slate-800 last:border-r-0">
                                            {detail.overall.average_popularity == null ? '—' : `${detail.overall.average_popularity.toFixed(1)}人気`}
                                        </td>
                                    ))}
                                </tr>
                                {/* 最終出走 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">最終出走</th>
                                    {details.map((detail) => (
                                        <td key={detail.entity.id} className="border-r border-slate-100 px-4 py-3 text-xs font-semibold tabular-nums text-slate-700 last:border-r-0">
                                            {detail.entity.last_race_date ?? '—'}
                                        </td>
                                    ))}
                                </tr>
                                {/* 直近AI偏差値 */}
                                <tr className="bg-slate-50/40">
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">直近AI偏差値</th>
                                    {details.map((detail) => {
                                        const score = detail.prediction_history[0]?.deviation_score;
                                        return (
                                            <td key={detail.entity.id} className={`border-r border-slate-100 px-4 py-3 font-mono tabular-nums last:border-r-0 ${getDeviationColor(score)}`}>
                                                {score == null ? '—' : score.toFixed(1)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* 直近着順 */}
                                <tr>
                                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-500 shadow-xs">直近着順</th>
                                    {details.map((detail) => {
                                        const rank = detail.recent_runs[0]?.rank;
                                        return (
                                            <td key={detail.entity.id} className="border-r border-slate-100 px-4 py-3 last:border-r-0">
                                                {getRankColor(rank)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    {/* コース別3着以内率 */}
                    {courseRows.length > 0 && (
                        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                <h2 className="font-black text-slate-950">主なコース別3着以内率の比較</h2>
                            </div>
                            <table className="w-full min-w-[720px] border-collapse text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-600">
                                    <tr>
                                        <th className="sticky left-0 z-20 w-44 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-left font-black">コース</th>
                                        {details.map((detail) => (
                                            <th key={detail.entity.id} className="min-w-[160px] border-b border-r border-slate-200 px-4 py-2.5 text-right font-black max-w-[160px] truncate last:border-r-0">
                                                {detail.entity.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {courseRows.map((courseKey, rowIndex) => {
                                        const label = details
                                            .flatMap((detail) => detail.segments.courses ?? [])
                                            .find((item) => item.key === courseKey)?.label ?? courseKey;
                                        return (
                                            <tr key={courseKey} className={rowIndex % 2 === 1 ? 'bg-slate-50/40' : ''}>
                                                <th className={`sticky left-0 z-10 border-r border-slate-200 px-4 py-3 text-left text-xs font-bold text-slate-800 shadow-xs ${rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                                                    {label}
                                                </th>
                                                {details.map((detail) => {
                                                    const stat = (detail.segments.courses ?? []).find((item) => item.key === courseKey);
                                                    return (
                                                        <td key={detail.entity.id} className="border-r border-slate-100 px-4 py-3 text-right last:border-r-0">
                                                            {stat ? (
                                                                <span className="inline-flex flex-col items-end">
                                                                    <span className="font-mono font-bold tabular-nums text-slate-900">{displayRate(stat.place_rate)}</span>
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

