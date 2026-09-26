'use client';

import Link from 'next/link';
import { DataPageHead } from '@/components/DataPageHead';
import { useRouter } from 'next/navigation';
import {
    Bell,
    Bookmark,
    CircleDot,
    Clock3,
    GitCompareArrows,
    MapPinned,
    Search,
    Settings,
    Trash2,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DataHubNav } from '@/components/DataHubNav';
import { linkableDataHref } from '@/lib/closed-data-pages';
import { PricingInterestSurvey } from '@/components/PricingInterestSurvey';
import { PwaInstallButton } from '@/components/PwaInstallButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
    sendHorseCompareEvent,
    sendSavedUserReturnEvent,
} from '@/lib/analytics';
import {
    clearHorseComparison,
    DATA_FAVORITES_KEY,
    DATA_HISTORY_KEY,
    MY_DATA_UPDATED_EVENT,
    readDataHistory,
    readFavorites,
    readHorseComparison,
    toggleHorseComparison,
    type SavedDataEntity,
    type SavedHorseComparison,
} from '@/lib/my-data';


/** エンティティタイプ別のアイコンと色 */
const ENTITY_ICON_MAP: Record<string, {
    Icon: typeof CircleDot;
    className: string;
    label: string;
}> = {
    horse: { Icon: CircleDot, className: 'text-emerald-600', label: '馬' },
    jockey: { Icon: UserRound, className: 'text-brand-600', label: '騎手' },
    trainer: { Icon: UsersRound, className: 'text-violet-600', label: '調教師' },
    course: { Icon: MapPinned, className: 'text-amber-700', label: 'コース' },
};

const MY_DATA_LAST_VISIT_KEY = 'uma_my_data_last_visit_v1';
const MY_DATA_RETURN_SESSION_KEY = 'uma_my_data_return_tracked_v1';

function favoriteCountBucket(count: number): '0' | '1' | '2_5' | '6_plus' {
    if (count === 0) return '0';
    if (count === 1) return '1';
    if (count <= 5) return '2_5';
    return '6_plus';
}

function returnDaysBucket(days: number): '1_2' | '3_6' | '7_13' | '14_plus' {
    if (days < 3) return '1_2';
    if (days < 7) return '3_6';
    if (days < 14) return '7_13';
    return '14_plus';
}

type SavedFilter = 'all' | 'horse' | 'people' | 'course';

// 種類の絞り込み。選んだときの色を種類ごとに変えず、ほかの画面と同じ切り替えボタンの形にする（2026-09-26）
const SAVED_FILTER_OPTIONS: { value: SavedFilter; label: string }[] = [
    { value: 'all', label: 'すべて' },
    { value: 'horse', label: '馬' },
    { value: 'people', label: '人' },
    { value: 'course', label: 'コース' },
];

function SavedEntityList({
    title,
    items,
    emptyMessage,
    emptyAction,
}: {
    title: string;
    items: SavedDataEntity[];
    emptyMessage: string;
    emptyAction?: { label: string; href: string };
}) {
    const [filter, setFilter] = useState<SavedFilter>('all');
    const [showAll, setShowAll] = useState(false);

    const filteredItems = items.filter((item) => {
        if (filter === 'all') return true;
        if (filter === 'horse') return item.entity_type === 'horse';
        if (filter === 'people') return item.entity_type === 'jockey' || item.entity_type === 'trainer';
        if (filter === 'course') return item.entity_type === 'course';
        return true;
    });

    const displayItems = showAll ? filteredItems : filteredItems.slice(0, 10);
    const hasMore = filteredItems.length > 10;

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-950">{title}</h2>
                    {items.length > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-600">
                            {items.length}件
                        </span>
                    )}
                </div>
                {items.length > 0 && (
                    <SegmentedControl
                        ariaLabel={`${title}の種類`}
                        value={filter}
                        onChange={setFilter}
                        options={SAVED_FILTER_OPTIONS}
                        className="self-start sm:self-auto"
                    />
                )}
            </div>
            {filteredItems.length === 0 ? (
                <div className="px-4 py-6">
                    <p className="text-sm leading-6 text-slate-600">{emptyMessage}</p>
                    {emptyAction && (
                        <Link
                            prefetch={false}
                            href={emptyAction.href}
                            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                        >
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                            {emptyAction.label}
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className="divide-y divide-slate-100">
                        {displayItems.map((item, index) => {
                            const entityStyle = ENTITY_ICON_MAP[item.entity_type];
                            const EntityIcon = entityStyle?.Icon ?? CircleDot;
                            const rowClassName = `grid min-h-14 grid-cols-[20px_1fr] items-center gap-3 px-4 py-3 ${index % 2 === 1 ? 'bg-slate-50/40' : ''}`;
                            const rowBody = (
                                <>
                                    <EntityIcon className={`h-4 w-4 ${entityStyle?.className ?? 'text-slate-400'}`} aria-hidden="true" />
                                    <span className="min-w-0">
                                        <span className="block truncate font-bold text-slate-900">{item.name}</span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
                                    </span>
                                </>
                            );
                            // 保存済みの競走馬・調教師は、ページの提供を終了した（2026-09-26）のでリンクにしない
                            const href = linkableDataHref(item.url);
                            if (!href) {
                                return <div key={`${item.entity_type}-${item.id}`} className={rowClassName}>{rowBody}</div>;
                            }
                            return (
                                <Link
                                    key={`${item.entity_type}-${item.id}`}
                                    prefetch={false}
                                    href={href}
                                    className={`${rowClassName} transition-colors duration-150 hover:bg-brand-50/50`}
                                >
                                    {rowBody}
                                </Link>
                            );
                        })}
                    </div>
                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setShowAll(!showAll)}
                            className="w-full cursor-pointer border-t border-slate-100 px-4 py-2.5 text-center text-xs font-bold text-brand-600 hover:bg-brand-50"
                        >
                            {showAll ? '折りたたむ' : `残り${filteredItems.length - 10}件を表示`}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}

export default function MyDataClient() {
    const router = useRouter();
    const [favorites, setFavorites] = useState<SavedDataEntity[]>([]);
    const [history, setHistory] = useState<SavedDataEntity[]>([]);
    const [comparison, setComparison] = useState<SavedHorseComparison[]>([]);
    const [pwaEligible, setPwaEligible] = useState(false);
    const [notificationState, setNotificationState] = useState<'unsupported' | NotificationPermission>('default');

    const refresh = useCallback(() => {
        const storedFavorites = readFavorites();
        const storedComparison = readHorseComparison();
        setFavorites(storedFavorites);
        setHistory(readDataHistory());
        setComparison(storedComparison);
        setPwaEligible((current) => current || storedFavorites.length > 0 || storedComparison.length > 0);
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationState(Notification.permission);
        } else {
            setNotificationState('unsupported');
        }
    }, []);

    useEffect(() => {
        refresh();
        const handleUpdate = () => refresh();
        window.addEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(MY_DATA_UPDATED_EVENT, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [refresh]);

    useEffect(() => {
        const now = Date.now();
        const previous = Number(window.localStorage.getItem(MY_DATA_LAST_VISIT_KEY) || 0);
        const storedFavorites = readFavorites();
        const storedComparison = readHorseComparison();
        const hasSavedData = storedFavorites.length > 0 || storedComparison.length > 0;
        const elapsedDays = previous > 0 ? Math.floor((now - previous) / 86_400_000) : 0;
        setPwaEligible(hasSavedData || elapsedDays >= 1);
        const alreadyTracked = window.sessionStorage.getItem(MY_DATA_RETURN_SESSION_KEY) === '1';

        if (hasSavedData && elapsedDays >= 1 && !alreadyTracked) {
            window.sessionStorage.setItem(MY_DATA_RETURN_SESSION_KEY, '1');
            sendSavedUserReturnEvent({
                saved_type_count: new Set(storedFavorites.map((item) => item.entity_type)).size,
                favorite_count_bucket: favoriteCountBucket(storedFavorites.length),
                comparison_count: storedComparison.length,
                days_since_last_visit_bucket: returnDaysBucket(elapsedDays),
            });
        }
        window.localStorage.setItem(MY_DATA_LAST_VISIT_KEY, String(now));
    }, []);

    const clearStoredList = (key: string) => {
        window.localStorage.removeItem(key);
        window.dispatchEvent(new CustomEvent(MY_DATA_UPDATED_EVENT));
        refresh();
    };

    const clearComparison = () => {
        clearHorseComparison();
        sendHorseCompareEvent({ action: 'clear', horse_count: 0 });
        refresh();
    };

    const handleCompareAllFavorites = () => {
        const horseFavs = favorites.filter((f) => f.entity_type === 'horse').slice(0, 5);
        if (horseFavs.length === 0) return;
        clearHorseComparison();
        horseFavs.forEach((horse) => {
            toggleHorseComparison({ id: horse.id, name: horse.name, url: horse.url });
        });
        router.push('/compare');
    };

    const requestNotifications = async () => {
        if (!('Notification' in window)) {
            setNotificationState('unsupported');
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationState(permission);
        if (permission === 'granted') {
            new Notification('UMA-FREE', {
                body: '通知が利用可能になりました。保存データはマイデータから確認できます。',
                icon: '/icon.png',
            });
        }
    };

    const horseFavoritesCount = favorites.filter((f) => f.entity_type === 'horse').length;

    return (
        <main className="mx-auto max-w-6xl px-3.5 pb-14 pt-3 sm:px-5">
            <DataHubNav currentPath="/my-data" />

            <DataPageHead
                icon="bookmark"
                title="マイデータ"
                description="確認した競走馬・騎手・コースをこの端末に保存できます。"
            />

            {/* 統計＆クイックアクションカード */}
            <section className="mt-3.5 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                        <Bookmark className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-bold text-slate-400">お気に入り</span>
                    </div>
                    {/* 数字の下の補足の文はやめた（2026-09-26） */}
                    <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{favorites.length}</p>
                    {horseFavoritesCount >= 2 && (
                        <button
                            type="button"
                            onClick={handleCompareAllFavorites}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                        >
                            <GitCompareArrows className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            保存馬を一括比較 ({Math.min(horseFavoritesCount, 5)}頭)
                        </button>
                    )}
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                        <GitCompareArrows className="h-5 w-5 text-amber-600" aria-hidden="true" />
                        <span className="text-xs font-bold text-slate-400">比較中の馬</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{comparison.length}</p>
                    {comparison.length > 0 && (
                        <Link
                            prefetch={false}
                            href="/compare"
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 border border-amber-200 hover:bg-amber-100"
                        >
                            <GitCompareArrows className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                            比較表を開く
                        </Link>
                    )}
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                        <Clock3 className="h-5 w-5 text-brand-600" aria-hidden="true" />
                        <span className="text-xs font-bold text-slate-400">閲覧履歴</span>
                    </div>
                    <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-950">{history.length}</p>
                </div>
            </section>

            {/* 設定セクション */}
            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* 見出しの灰色の帯と線はやめ、文字だけ残す（2026-09-26） */}
                <div className="flex items-center gap-2 px-4 pt-3">
                    <Settings className="h-[18px] w-[18px] text-navy" aria-hidden="true" />
                    <h2 className="text-xs font-bold text-slate-800">アプリ設定 & ショートカット</h2>
                </div>
                <div className="divide-y divide-slate-100">
                    {pwaEligible && (
                    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-sm font-bold text-slate-900">ホーム画面に追加</h3>
                        <PwaInstallButton />
                    </div>
                    )}
                    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
                            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">レース開催通知</h3>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                    お気に入り馬の出走日や重賞の通知を受け取れます。
                                </p>
                            </div>
                        </div>
                        {notificationState === 'unsupported' ? (
                            <span className="text-xs font-bold text-slate-400">非対応ブラウザ</span>
                        ) : (
                            <button
                                type="button"
                                onClick={requestNotifications}
                                disabled={notificationState === 'granted'}
                                className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-brand-400 hover:text-brand-700 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-800"
                            >
                                {notificationState === 'granted' ? '許可済み' : notificationState === 'denied' ? '設定で許可' : '通知を許可'}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* 保存・履歴リスト */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <SavedEntityList
                    title="保存したお気に入り"
                    items={favorites}
                    emptyMessage="馬・騎手・調教師・コースページの「お気に入り保存」ボタンから追加できます。"
                    emptyAction={{ label: 'データを探す', href: '/keiba-data' }}
                />
                <SavedEntityList
                    title="閲覧履歴"
                    items={history}
                    emptyMessage="データ詳細ページを閲覧すると、履歴としてここに残ります。"
                    emptyAction={{ label: 'データベースを開く', href: '/keiba-data' }}
                />
            </div>

            {/* 比較中の馬 */}
            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="font-bold text-slate-950">比較中の競走馬</h2>
                    {comparison.length > 0 && (
                        <button
                            type="button"
                            onClick={clearComparison}
                            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-2 text-xs font-bold text-slate-500 transition-colors hover:text-red-600"
                        >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            解除
                        </button>
                    )}
                </div>
                {/* 「2頭以上の馬を選択すると…」の説明文はやめ、まだ無いときは比較の画面へのリンクだけ置く（2026-09-26） */}
                {comparison.length === 0 ? (
                    <div className="px-4 py-3.5">
                        <Link prefetch={false} href="/compare" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-600">
                            <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                            比較する馬を選ぶ
                        </Link>
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="flex flex-wrap gap-2">
                            {comparison.map((horse, index) => (
                                // 競走馬のページは提供を終了した（2026-09-26）。比べる馬は名前だけを並べる
                                <span key={horse.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800">
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 font-num text-[11.5px] font-bold text-slate-700">
                                        {index + 1}
                                    </span>
                                    {horse.name}
                                </span>
                            ))}
                        </div>
                        {comparison.length >= 2 && (
                            <Link
                                href="/compare"
                                prefetch={false}
                                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700"
                            >
                                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                                {comparison.length}頭を今すぐ比較
                            </Link>
                        )}
                    </div>
                )}
            </section>

            <PricingInterestSurvey
                surface="my_data"
                eligible={favorites.length > 0 || comparison.length >= 2}
            />

            {/* 下部データ操作 */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
                <Link prefetch={false} href="/keiba-data" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    データを探す
                </Link>
                {favorites.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_FAVORITES_KEY)}
                        className="min-h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                        保存全削除
                    </button>
                )}
                {history.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_HISTORY_KEY)}
                        className="min-h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                        履歴クリア
                    </button>
                )}
            </div>
        </main>
    );
}
