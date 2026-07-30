'use client';

import Link from 'next/link';
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
import { PwaInstallButton } from '@/components/PwaInstallButton';
import { sendHorseCompareEvent } from '@/lib/analytics';
import {
    clearHorseComparison,
    DATA_FAVORITES_KEY,
    DATA_HISTORY_KEY,
    MY_DATA_UPDATED_EVENT,
    readDataHistory,
    readFavorites,
    readHorseComparison,
    type SavedDataEntity,
    type SavedHorseComparison,
} from '@/lib/my-data';


/** エンティティタイプ別のアイコンと色 */
const ENTITY_ICON_MAP: Record<string, {
    Icon: typeof CircleDot;
    className: string;
}> = {
    horse: { Icon: CircleDot, className: 'text-emerald-600' },
    jockey: { Icon: UserRound, className: 'text-blue-600' },
    trainer: { Icon: UsersRound, className: 'text-violet-600' },
    course: { Icon: MapPinned, className: 'text-amber-700' },
};

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
    const [showAll, setShowAll] = useState(false);
    const displayItems = showAll ? items : items.slice(0, 10);
    const hasMore = items.length > 10;

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="font-black text-slate-950">{title}</h2>
                {items.length > 0 && (
                    <span className="text-xs font-bold tabular-nums text-slate-400">{items.length}件</span>
                )}
            </div>
            {items.length === 0 ? (
                <div className="px-4 py-5">
                    <p className="text-sm leading-7 text-slate-600">{emptyMessage}</p>
                    {emptyAction && (
                        <Link
                            href={emptyAction.href}
                            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
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
                            return (
                                <Link
                                    key={`${item.entity_type}-${item.id}`}
                                    prefetch={false}
                                    href={item.url}
                                    className={`grid min-h-14 grid-cols-[20px_1fr] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-blue-50/50 ${index % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                                >
                                    <EntityIcon className={`h-4 w-4 ${entityStyle?.className ?? 'text-slate-400'}`} aria-hidden="true" />
                                    <span className="min-w-0">
                                        <span className="block truncate font-bold text-slate-900">{item.name}</span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setShowAll(!showAll)}
                            className="w-full cursor-pointer border-t border-slate-100 px-4 py-2.5 text-center text-xs font-bold text-blue-600 hover:bg-blue-50"
                        >
                            {showAll ? '折りたたむ' : `残り${items.length - 10}件を表示`}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}

export default function MyDataClient() {
    const [favorites, setFavorites] = useState<SavedDataEntity[]>([]);
    const [history, setHistory] = useState<SavedDataEntity[]>([]);
    const [comparison, setComparison] = useState<SavedHorseComparison[]>([]);
    const [notificationState, setNotificationState] = useState<'unsupported' | NotificationPermission>('default');

    const refresh = useCallback(() => {
        setFavorites(readFavorites());
        setHistory(readDataHistory());
        setComparison(readHorseComparison());
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

    return (
        <main className="mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-4">
            <header className="border-b border-slate-200 pb-5">
                <p className="text-xs font-bold text-slate-500">競馬データベース</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">マイデータ</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    会員登録なしで、この端末に保存した馬・騎手・調教師・コースと閲覧履歴を確認できます。
                    データはブラウザ内に保存され、別端末とは同期されません。
                </p>
            </header>

            {/* 統計カード */}
            <section className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="h-0.5 -mx-4 -mt-4 mb-3 rounded-t-xl bg-blue-500" />
                    <Bookmark className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">保存</p>
                    <p className={`font-mono text-2xl font-black tabular-nums ${favorites.length === 0 ? 'text-slate-300' : 'text-slate-950'}`}>
                        {favorites.length}
                    </p>
                    {favorites.length === 0 && <p className="mt-0.5 text-[10px] font-bold text-slate-400">未登録</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="h-0.5 -mx-4 -mt-4 mb-3 rounded-t-xl bg-slate-400" />
                    <Clock3 className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">閲覧履歴</p>
                    <p className={`font-mono text-2xl font-black tabular-nums ${history.length === 0 ? 'text-slate-300' : 'text-slate-950'}`}>
                        {history.length}
                    </p>
                    {history.length === 0 && <p className="mt-0.5 text-[10px] font-bold text-slate-400">未記録</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="h-0.5 -mx-4 -mt-4 mb-3 rounded-t-xl bg-amber-500" />
                    <GitCompareArrows className="h-5 w-5 text-amber-700" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">比較中の馬</p>
                    <p className={`font-mono text-2xl font-black tabular-nums ${comparison.length === 0 ? 'text-slate-300' : 'text-slate-950'}`}>
                        {comparison.length}
                    </p>
                    {comparison.length === 0 && <p className="mt-0.5 text-[10px] font-bold text-slate-400">未選択</p>}
                </div>
            </section>

            {/* 設定セクション：PWAとブラウザ通知を統合 */}
            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <Settings className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    <h2 className="text-sm font-black text-slate-800">設定</h2>
                </div>
                <div className="divide-y divide-slate-100">
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-900">ホーム画面に追加</h3>
                            <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                対応端末ではUMA-FREEをホーム画面へ追加し、マイデータへすぐ戻れます。
                            </p>
                        </div>
                        <PwaInstallButton />
                    </div>
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
                            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                            <div>
                                <h3 className="text-sm font-black text-slate-900">ブラウザ通知</h3>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                    通知許可は任意です。端末やブラウザの設定でいつでも停止できます。
                                </p>
                            </div>
                        </div>
                        {notificationState === 'unsupported' ? (
                            <span className="text-xs font-bold text-slate-400">このブラウザでは利用できません</span>
                        ) : (
                            <button
                                type="button"
                                onClick={requestNotifications}
                                disabled={notificationState === 'granted'}
                                className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 transition-colors duration-150 hover:border-blue-400 hover:text-blue-700 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-800"
                            >
                                {notificationState === 'granted' ? '許可済み' : notificationState === 'denied' ? 'ブラウザ設定で許可' : '通知を許可する'}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* 保存・履歴リスト */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <SavedEntityList
                    title="保存したデータ"
                    items={favorites}
                    emptyMessage="馬・騎手・調教師・コースページの「マイデータに保存」から追加できます。"
                    emptyAction={{ label: 'データを探す', href: '/keiba-data' }}
                />
                <SavedEntityList
                    title="最近見たデータ"
                    items={history}
                    emptyMessage="馬・騎手・調教師・コースの詳細ページを開くと、最近見た順に自動で記録されます。"
                    emptyAction={{ label: 'データベースを開く', href: '/keiba-data' }}
                />
            </div>

            {/* 比較中の馬 */}
            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="font-black text-slate-950">比較中の馬</h2>
                    {comparison.length > 0 && (
                        <button
                            type="button"
                            onClick={clearComparison}
                            className="inline-flex min-h-10 cursor-pointer items-center gap-2 px-2 text-sm font-bold text-slate-500 transition-colors duration-150 hover:text-red-600"
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            すべて外す
                        </button>
                    )}
                </div>
                {comparison.length < 2 ? (
                    <p className="px-4 py-5 text-sm leading-7 text-slate-600">
                        馬ページまたは予想表から2頭以上を比較へ追加してください。
                    </p>
                ) : (
                    <div className="p-4">
                        <div className="flex flex-wrap gap-2">
                            {comparison.map((horse, index) => (
                                <Link key={horse.id} prefetch={false} href={horse.url} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:bg-blue-50 hover:text-blue-700">
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[10px] font-black tabular-nums text-slate-500">
                                        {index + 1}
                                    </span>
                                    {horse.name}
                                </Link>
                            ))}
                        </div>
                        <Link
                            href="/compare"
                            prefetch={false}
                            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-700"
                        >
                            {comparison.length}頭を横並びで比較
                        </Link>
                    </div>
                )}
            </section>

            {/* 下部アクション */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                <Link href="/keiba-data" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    データを探す
                </Link>
                {favorites.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_FAVORITES_KEY)}
                        className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-600"
                    >
                        保存をすべて削除
                    </button>
                )}
                {history.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_HISTORY_KEY)}
                        className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-600"
                    >
                        履歴を削除
                    </button>
                )}
            </div>
        </main>
    );
}
