'use client';

import Link from 'next/link';
import {
    Bookmark,
    GitCompareArrows,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataHubNav } from '@/components/DataHubNav';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import {
    sendCompareConditionChangeEvent,
    sendCompareRaceClickEvent,
    sendCompareResultViewEvent,
    sendDataSearchEvent,
    sendDataSearchResultClickEvent,
    sendHorseCompareEvent,
} from '@/lib/analytics';
import {
    CENTRAL_VENUE_ORDER,
    LOCAL_VENUE_ORDER,
} from '@/lib/data-directory';
import {
    clearHorseComparison,
    MY_DATA_UPDATED_EVENT,
    readFavorites,
    readHorseComparison,
    toggleFavorite,
    toggleHorseComparison,
    type SavedHorseComparison,
} from '@/lib/my-data';
import { venueSlugToName } from '@/lib/race-url';
import type {
    DataSearchResponse,
    HorseComparisonRequest,
    HorseComparisonResponse,
    HorseComparisonSampleQuality,
} from '@/lib/types';


type ComparisonCondition = Omit<HorseComparisonRequest, 'horse_ids'>;
type ComparisonView = 'overall' | 'matched' | 'recent';

const VENUE_OPTIONS = [...CENTRAL_VENUE_ORDER, ...LOCAL_VENUE_ORDER]
    .map((slug) => venueSlugToName(slug))
    .filter((name): name is string => Boolean(name));

const DEFAULT_CONDITION: ComparisonCondition = {
    venue_name: '東京',
    course_type: '芝',
    distance: 1600,
    ground_condition: null,
};

const SAMPLE_LABELS: Record<HorseComparisonSampleQuality, {
    label: string;
    className: string;
}> = {
    insufficient: {
        label: '少数データ',
        className: 'border-red-200 bg-red-50 text-red-800',
    },
    reference: {
        label: '参考値',
        className: 'border-amber-300 bg-amber-50 text-amber-900',
    },
    comparable: {
        label: '比較対象',
        className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
};

function displayRate(value: number): string {
    return `${value.toFixed(1)}%`;
}

function displayRank(rank: number | null | undefined): string {
    return rank == null ? '—' : `${rank}着`;
}

function sampleSizeBucket(sampleSize: number): '0_4' | '5_9' | '10_49' | '50_plus' {
    if (sampleSize < 5) return '0_4';
    if (sampleSize < 10) return '5_9';
    if (sampleSize < 50) return '10_49';
    return '50_plus';
}

function conditionLabel(condition: HorseComparisonResponse['conditions']): string {
    return [
        condition.venue_name,
        `${condition.course_type}${condition.distance}m`,
        condition.ground_condition ? `馬場 ${condition.ground_condition}` : null,
    ].filter(Boolean).join('・');
}

export default function HorseCompareClient() {
    const [saved, setSaved] = useState<SavedHorseComparison[]>([]);
    const [favorites, setFavorites] = useState<ReturnType<typeof readFavorites>>([]);
    const [comparison, setComparison] = useState<HorseComparisonResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DataSearchResponse['items']>([]);
    const [searching, setSearching] = useState(false);
    const [searchAttempted, setSearchAttempted] = useState(false);
    const [error, setError] = useState('');
    const [comparisonError, setComparisonError] = useState('');
    const [comparisonView, setComparisonView] = useState<ComparisonView>('overall');
    const [draftCondition, setDraftCondition] = useState<ComparisonCondition>(DEFAULT_CONDITION);
    const [appliedCondition, setAppliedCondition] = useState<ComparisonCondition>(DEFAULT_CONDITION);

    const refreshSaved = useCallback(() => {
        setSaved(readHorseComparison());
        setFavorites(readFavorites());
    }, []);

    useEffect(() => {
        refreshSaved();
        const handleUpdate = () => refreshSaved();
        window.addEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [refreshSaved]);

    const savedKey = useMemo(
        () => saved.map((horse) => horse.id).join(','),
        [saved],
    );

    useEffect(() => {
        let cancelled = false;
        const fetchComparison = async () => {
            if (saved.length < 2) {
                setComparison(null);
                setLoading(false);
                setComparisonError('');
                return;
            }
            setLoading(true);
            setComparisonError('');
            try {
                const response = await fetch('/api/data/compare/horses', {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        horse_ids: saved.map((horse) => horse.id),
                        ...appliedCondition,
                    }),
                });
                if (!response.ok) throw new Error('compare failed');
                const next = await response.json() as HorseComparisonResponse;
                if (cancelled) return;
                setComparison(next);
                const comparableCount = next.horses.filter(
                    (horse) => horse.sample_quality === 'comparable',
                ).length;
                sendHorseCompareEvent({ action: 'view', horse_count: next.horses.length });
                sendCompareResultViewEvent({
                    horse_count: next.horses.length,
                    condition_scope: next.conditions.ground_condition
                        ? 'venue_surface_distance_ground'
                        : 'venue_surface_distance',
                    comparable_count: comparableCount,
                });
            } catch {
                if (!cancelled) {
                    setComparison(null);
                    setComparisonError('比較データを取得できませんでした。条件を確認して再度お試しください。');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void fetchComparison();
        return () => {
            cancelled = true;
        };
    }, [
        appliedCondition.course_type,
        appliedCondition.distance,
        appliedCondition.ground_condition,
        appliedCondition.venue_name,
        savedKey,
    ]);

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
            setSearchAttempted(true);
            sendDataSearchEvent({
                query_length: normalized.length,
                result_count: horses.length,
                search_surface: 'compare',
            });
        } catch {
            setSearchAttempted(false);
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

    const addHorse = (
        item: DataSearchResponse['items'][number],
        resultPosition: number,
    ) => {
        sendDataSearchResultClickEvent({
            entity_type: 'horse',
            result_position: resultPosition,
            result_count: searchResults.length,
            search_surface: 'compare',
            sample_size_bucket: sampleSizeBucket(item.sample_size),
        });
        const result = toggleHorseComparison({
            id: item.id,
            name: item.name,
            url: item.url,
        });
        if (result.full) {
            setError('比較できる馬は5頭までです。');
            return;
        }
        setError('');
        sendHorseCompareEvent({ action: 'add', horse_count: result.items.length });
        setSearchResults([]);
        setSearchAttempted(false);
        setQuery('');
        refreshSaved();
    };

    const handleToggleFavorite = (horse: HorseComparisonResponse['horses'][number]) => {
        toggleFavorite({
            entity_type: 'horse',
            id: horse.horse_id,
            name: horse.horse_name,
            subtitle: `集計対象${horse.overall.sample_size}走`,
            url: horse.url,
        });
        refreshSaved();
    };

    const applyCondition = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!Number.isInteger(draftCondition.distance) || draftCondition.distance < 200) {
            setComparisonError('距離は200m以上の整数で指定してください。');
            return;
        }
        setComparisonError('');
        setAppliedCondition({ ...draftCondition });
        sendCompareConditionChangeEvent({
            changed_field: 'apply',
            horse_count: saved.length,
            has_ground_condition: Boolean(draftCondition.ground_condition),
        });
    };

    const comparableHorses = comparison?.horses.filter(
        (horse) => horse.sample_quality === 'comparable' && horse.wilson_lower_bound != null,
    ) ?? [];
    const topWilson = comparableHorses.length >= 2
        ? Math.max(...comparableHorses.map((horse) => horse.wilson_lower_bound ?? 0))
        : null;

    return (
        <main className="site-shell-data px-3.5 pb-14 pt-3 sm:px-5">
            <DataHubNav currentPath="/compare" />

            <header className="mt-2 rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-white sm:p-5">
                <p className="text-[10px] font-bold text-blue-300">競馬データベース</p>
                <h1 className="mt-0.5 text-[15px] font-black leading-tight !text-white sm:text-3xl">競走馬の成績比較</h1>
                <p className="mt-1 max-w-3xl text-[11px] leading-relaxed !text-slate-200 sm:text-sm sm:leading-6">
                    通算成績や各コースごとに成績を確認出来ます。
                </p>
            </header>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="horse-compare-search" className="sr-only">比較する馬を検索</label>
                    <input
                        id="horse-compare-search"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setSearchAttempted(false);
                        }}
                        placeholder="比較する馬名を入力"
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="submit"
                        disabled={searching}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {searching ? '検索中' : '馬を検索'}
                    </button>
                </form>
                {searchResults.length > 0 && (
                    <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                        {searchResults.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => addHorse(item, index + 1)}
                                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-blue-50"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-bold text-slate-900">{item.name}</span>
                                    <span className="block truncate text-xs text-slate-500">{item.description}</span>
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                    追加
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {searchAttempted && !searching && searchResults.length === 0 && (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600">
                        該当する競走馬が見つかりませんでした。馬名の一部を短くしてお試しください。
                    </p>
                )}
                {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
            </section>

            {saved.length > 0 && (
            <section className="compare-selected-summary sticky mt-3 flex flex-wrap items-center gap-1.5 border-y border-slate-200 bg-slate-50/95 py-2 md:static md:border-0 md:bg-transparent md:py-0" aria-label="比較中の競走馬">
                <span className="mr-1 text-[11px] font-black text-slate-500 md:hidden">比較中 {saved.length}/5</span>
                {saved.map((horse, index) => (
                    <span key={horse.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white pl-1.5 pr-0.5 text-xs font-bold text-slate-800 md:min-h-10 md:gap-1.5 md:pl-2 md:pr-1 md:text-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 font-mono text-[11px] font-black text-slate-600">
                            {index + 1}
                        </span>
                        <Link prefetch={false} href={horse.url} className="max-w-[84px] truncate px-1 hover:text-blue-600 sm:max-w-[120px] md:max-w-[150px]" title={horse.name}>
                            {horse.name}
                        </Link>
                        <button
                            type="button"
                            onClick={() => removeHorse(horse)}
                            aria-label={`${horse.name}を比較から外す`}
                            className="flex h-8 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 md:w-8"
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
                        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 text-xs font-bold text-slate-500 transition-colors duration-150 hover:text-red-600"
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        すべて外す
                    </button>
                )}
            </section>
            )}

            {saved.length < 2 ? (
                <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start gap-3">
                        <GitCompareArrows className="mt-0.5 h-5 w-5 text-blue-600" aria-hidden="true" />
                        <div>
                            <h2 className="text-lg font-black text-slate-950">2頭以上の馬を選択してください</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                最大5頭まで追加出来ます。
                            </p>
                        </div>
                    </div>
                </section>
            ) : (
                <>
                    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4" aria-labelledby="condition-heading">
                        <div>
                            <h2 id="condition-heading" className="text-lg font-black text-slate-950">同条件比較の条件</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                馬場状態を指定しない場合は、良・稍重・重・不良をまとめて集計します。
                            </p>
                        </div>
                        <form onSubmit={applyCondition} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end">
                            <label className="text-xs font-bold text-slate-700">
                                競馬場
                                <select
                                    value={draftCondition.venue_name}
                                    onChange={(event) => setDraftCondition((current) => ({
                                        ...current,
                                        venue_name: event.target.value,
                                    }))}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    {VENUE_OPTIONS.map((venue) => (
                                        <option key={venue} value={venue}>{venue}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-xs font-bold text-slate-700">
                                コース
                                <select
                                    value={draftCondition.course_type}
                                    onChange={(event) => setDraftCondition((current) => ({
                                        ...current,
                                        course_type: event.target.value as ComparisonCondition['course_type'],
                                    }))}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="芝">芝</option>
                                    <option value="ダート">ダート</option>
                                    <option value="障害">障害</option>
                                </select>
                            </label>
                            <label className="text-xs font-bold text-slate-700">
                                距離
                                <span className="mt-1 flex min-h-11 items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                                    <input
                                        type="number"
                                        min={200}
                                        max={5000}
                                        step={10}
                                        value={draftCondition.distance}
                                        onChange={(event) => setDraftCondition((current) => ({
                                            ...current,
                                            distance: Number(event.target.value),
                                        }))}
                                        className="min-h-10 min-w-0 flex-1 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none"
                                    />
                                    <span className="pr-3 text-xs text-slate-500">m</span>
                                </span>
                            </label>
                            <label className="text-xs font-bold text-slate-700">
                                馬場状態
                                <select
                                    value={draftCondition.ground_condition ?? ''}
                                    onChange={(event) => setDraftCondition((current) => ({
                                        ...current,
                                        ground_condition: event.target.value || null,
                                    }))}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">指定なし</option>
                                    <option value="良">良</option>
                                    <option value="稍重">稍重</option>
                                    <option value="重">重</option>
                                    <option value="不良">不良</option>
                                </select>
                            </label>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-400"
                            >
                                {loading ? '集計中' : 'この条件で比較'}
                            </button>
                        </form>
                    </section>

                    {loading && !comparison && (
                        <p className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-600">
                            比較データを読み込んでいます。
                        </p>
                    )}

                    {!loading && comparisonError && (
                        <section className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                            <h2 className="text-sm font-black text-red-900">比較結果を表示できませんでした</h2>
                            <p className="mt-1 text-sm leading-6 text-red-800">{comparisonError}</p>
                        </section>
                    )}

                    {comparison && (
                        <div className="mt-5 space-y-5">
                            <div className="comparison-view-switcher grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1 md:hidden" role="group" aria-label="比較結果の表示切替">
                                {([
                                    ['overall', '通算'],
                                    ['matched', '同条件'],
                                    ['recent', '直近5走'],
                                ] as const).map(([view, label]) => (
                                    <button
                                        key={view}
                                        type="button"
                                        onClick={() => setComparisonView(view)}
                                        aria-pressed={comparisonView === view}
                                        aria-controls={`${view}-comparison-panel`}
                                        className={`min-h-10 rounded-md px-2 text-xs font-black transition-colors duration-150 ${
                                            comparisonView === view
                                                ? 'bg-slate-950 text-white'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <section
                                id="overall-comparison-panel"
                                className={`${comparisonView === 'overall' ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white md:block`}
                                aria-labelledby="overall-comparison-heading"
                            >
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <h2 id="overall-comparison-heading" className="text-lg font-black text-slate-950">1. 通算成績</h2>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                        条件が異なるため順位付けは行いません。出走数と率を合わせて確認してください。
                                    </p>
                                </div>
                                <ResponsiveDataTable label="通算成績の比較表">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead className="bg-slate-50 text-xs text-slate-600">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left">競走馬</th>
                                                <th className="px-3 py-2.5 text-right">出走数</th>
                                                <th className="px-3 py-2.5 text-right">勝率</th>
                                                <th className="px-3 py-2.5 text-right">3着以内率</th>
                                                <th className="px-4 py-2.5 text-right">平均人気</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {comparison.horses.map((horse, index) => {
                                                const isFavorite = favorites.some((item) => item.id === horse.horse_id);
                                                return (
                                                    <tr key={horse.horse_id} className={index % 2 === 1 ? 'bg-slate-50/40' : undefined}>
                                                        <th className="px-4 py-3 text-left">
                                                            <span className="flex items-center gap-2">
                                                                <Link prefetch={false} href={horse.url} className="font-black text-slate-950 hover:text-blue-700">
                                                                    {horse.horse_name}
                                                                </Link>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleFavorite(horse)}
                                                                    aria-label={isFavorite ? `${horse.horse_name}をお気に入りから外す` : `${horse.horse_name}をお気に入りへ保存`}
                                                                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150 ${
                                                                        isFavorite
                                                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                                                            : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-700'
                                                                    }`}
                                                                >
                                                                    <Bookmark className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                                                                </button>
                                                            </span>
                                                        </th>
                                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">{horse.overall.sample_size}走</td>
                                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                            {displayRate(horse.overall.win_rate)} <span className="text-xs font-normal text-slate-500">({horse.overall.sample_size})</span>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                            {displayRate(horse.overall.place_rate)} <span className="text-xs font-normal text-slate-500">({horse.overall.sample_size})</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                                                            {horse.overall.average_popularity == null ? '—' : `${horse.overall.average_popularity.toFixed(1)}人気`}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </ResponsiveDataTable>
                            </section>

                            <section
                                id="matched-comparison-panel"
                                className={`${comparisonView === 'matched' ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white md:block`}
                                aria-labelledby="matched-comparison-heading"
                            >
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <h2 id="matched-comparison-heading" className="text-lg font-black text-slate-950">2. 同条件成績</h2>
                                    <p className="mt-1 text-sm font-bold text-blue-800">{conditionLabel(comparison.conditions)}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                        10走以上の馬だけを比較対象とし、3着以内率の95% Wilson下限値で比較上位を判定します。
                                    </p>
                                </div>
                                <ResponsiveDataTable label="同条件成績の比較表">
                                    <table className="w-full min-w-[820px] text-sm">
                                        <thead className="bg-slate-50 text-xs text-slate-600">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left">競走馬</th>
                                                <th className="px-3 py-2.5 text-left">母数区分</th>
                                                <th className="px-3 py-2.5 text-right">勝率</th>
                                                <th className="px-3 py-2.5 text-right">3着以内率</th>
                                                <th className="px-4 py-2.5 text-right">Wilson下限</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {comparison.horses.map((horse, index) => {
                                                const sample = SAMPLE_LABELS[horse.sample_quality];
                                                const isComparisonLeader = (
                                                    topWilson != null
                                                    && horse.wilson_lower_bound === topWilson
                                                );
                                                return (
                                                    <tr key={horse.horse_id} className={index % 2 === 1 ? 'bg-slate-50/40' : undefined}>
                                                        <th className="px-4 py-3 text-left font-black text-slate-950">
                                                            {horse.horse_name}
                                                            {isComparisonLeader && (
                                                                <span className="ml-2 inline-flex rounded-md border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[11px] font-black text-blue-800">
                                                                    比較上位
                                                                </span>
                                                            )}
                                                        </th>
                                                        <td className="px-3 py-3">
                                                            <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${sample.className}`}>
                                                                {sample.label}・{horse.matched_condition.sample_size}走
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                            {displayRate(horse.matched_condition.win_rate)} <span className="text-xs font-normal text-slate-500">({horse.matched_condition.sample_size})</span>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                            {displayRate(horse.matched_condition.place_rate)} <span className="text-xs font-normal text-slate-500">({horse.matched_condition.sample_size})</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-800">
                                                            {horse.wilson_lower_bound == null ? '—' : `${horse.wilson_lower_bound.toFixed(2)}%`}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </ResponsiveDataTable>
                                <div className="border-t border-slate-100 px-4 py-2 text-[11px] leading-5 text-slate-500">
                                    <p>5走未満は「少数データ」で順位付けなし、5〜9走は「参考値」、10走以上を「比較対象」とします。</p>
                                    <p>
                                        集計期間: {comparison.analysis_start_date ?? '—'}〜{comparison.analysis_end_date ?? '—'}
                                    </p>
                                    <p>データ基準日: {comparison.data_as_of_date ?? '—'}</p>
                                </div>
                            </section>

                            <section
                                id="recent-comparison-panel"
                                className={`${comparisonView === 'recent' ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white md:block`}
                                aria-labelledby="recent-runs-heading"
                            >
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <h2 id="recent-runs-heading" className="text-lg font-black text-slate-950">直近5走</h2>
                                </div>
                                <ResponsiveDataTable label="直近5走の比較表">
                                    <table className="w-full min-w-[760px] text-sm">
                                        <thead className="bg-slate-50 text-xs text-slate-600">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left">競走馬</th>
                                                <th className="px-3 py-2.5 text-left">日付・レース</th>
                                                <th className="px-3 py-2.5 text-left">コース</th>
                                                <th className="px-3 py-2.5 text-right">人気</th>
                                                <th className="px-4 py-2.5 text-right">着順</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {comparison.horses.flatMap((horse, horseIndex) => (
                                                horse.recent_runs.length > 0
                                                    ? horse.recent_runs.map((run, runIndex) => (
                                                        <tr key={`${horse.horse_id}-${run.race_id}`}>
                                                            <th className="px-4 py-3 text-left font-bold text-slate-900">
                                                                {runIndex === 0 ? horse.horse_name : ''}
                                                            </th>
                                                            <td className="px-3 py-3">
                                                                <Link
                                                                    prefetch={false}
                                                                    href={run.url}
                                                                    onClick={() => {
                                                                        sendCompareRaceClickEvent({
                                                                            horse_position: horseIndex + 1,
                                                                            run_position: runIndex + 1,
                                                                            destination_type: 'past_race',
                                                                        });
                                                                    }}
                                                                    className="font-bold text-slate-900 hover:text-blue-700"
                                                                >
                                                                    <span className="block text-xs font-semibold text-slate-500">
                                                                        {run.race_date} {run.venue_name}{run.race_number}R
                                                                    </span>
                                                                    <span className="block max-w-[260px] truncate" title={run.race_name}>{run.race_name}</span>
                                                                </Link>
                                                            </td>
                                                            <td className="px-3 py-3 text-xs font-bold text-slate-700">{run.course_label}</td>
                                                            <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                                                                {run.popularity == null ? '—' : `${run.popularity}人気`}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-800">{displayRank(run.rank)}</td>
                                                        </tr>
                                                    ))
                                                    : [(
                                                        <tr key={`${horse.horse_id}-empty`}>
                                                            <th className="px-4 py-3 text-left font-bold text-slate-900">{horse.horse_name}</th>
                                                            <td colSpan={4} className="px-3 py-3 text-slate-500">直近走データはありません。</td>
                                                        </tr>
                                                    )]
                                            ))}
                                        </tbody>
                                    </table>
                                </ResponsiveDataTable>
                            </section>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}
