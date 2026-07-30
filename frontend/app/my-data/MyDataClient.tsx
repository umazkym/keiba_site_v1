'use client';

import Link from 'next/link';
import { Bell, Bookmark, Clock3, GitCompareArrows, Search, Trash2 } from 'lucide-react';
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


function SavedEntityList({
    title,
    items,
    emptyMessage,
}: {
    title: string;
    items: SavedDataEntity[];
    emptyMessage: string;
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-black text-slate-950">{title}</h2>
            </div>
            {items.length === 0 ? (
                <p className="px-4 py-5 text-sm leading-7 text-slate-600">{emptyMessage}</p>
            ) : (
                <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                        <Link
                            key={`${item.entity_type}-${item.id}`}
                            prefetch={false}
                            href={item.url}
                            className="block min-h-14 px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
                        >
                            <span className="block font-bold text-slate-900">{item.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
                        </Link>
                    ))}
                </div>
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
                <p className="text-xs font-bold text-slate-500">LOCAL MY DATA</p>
                <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">マイデータ</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                    会員登録なしで、この端末に保存した馬・騎手・調教師・コースと閲覧履歴を確認できます。
                    データはブラウザ内に保存され、別端末とは同期されません。
                </p>
            </header>

            <section className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <Bookmark className="h-5 w-5 text-primary" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">保存</p>
                    <p className="font-mono text-2xl font-black tabular-nums text-slate-950">{favorites.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <Clock3 className="h-5 w-5 text-slate-600" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">閲覧履歴</p>
                    <p className="font-mono text-2xl font-black tabular-nums text-slate-950">{history.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <GitCompareArrows className="h-5 w-5 text-amber-700" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold text-slate-600">比較中の馬</p>
                    <p className="font-mono text-2xl font-black tabular-nums text-slate-950">{comparison.length}</p>
                </div>
            </section>

            <section className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-black text-slate-950">ホーム画面から開く</h2>
                    <p className="mt-1 text-xs leading-6 text-slate-600">
                        対応端末ではUMA-FREEをホーム画面へ追加し、マイデータへすぐ戻れます。
                    </p>
                </div>
                <PwaInstallButton />
            </section>

            <section className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" aria-hidden="true" />
                    <div>
                        <h2 className="font-black text-slate-950">ブラウザ通知</h2>
                        <p className="mt-1 text-xs leading-6 text-slate-600">
                            通知許可は任意です。許可後も、端末やブラウザの設定でいつでも停止できます。
                        </p>
                    </div>
                </div>
                {notificationState === 'unsupported' ? (
                    <span className="text-sm font-bold text-slate-500">このブラウザでは利用できません</span>
                ) : (
                    <button
                        type="button"
                        onClick={requestNotifications}
                        disabled={notificationState === 'granted'}
                        className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-800"
                    >
                        {notificationState === 'granted' ? '通知を許可済み' : notificationState === 'denied' ? 'ブラウザ設定で許可する' : '通知を許可する'}
                    </button>
                )}
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <SavedEntityList
                    title="保存したデータ"
                    items={favorites}
                    emptyMessage="馬・騎手・調教師・コースページの「マイデータに保存」から追加できます。"
                />
                <SavedEntityList
                    title="最近見たデータ"
                    items={history}
                    emptyMessage="データ詳細ページを開くと、最近見た順に表示されます。"
                />
            </div>

            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="font-black text-slate-950">比較中の馬</h2>
                    {comparison.length > 0 && (
                        <button
                            type="button"
                            onClick={clearComparison}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm font-bold text-slate-600 transition-colors duration-150 hover:text-red-700"
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
                            {comparison.map((horse) => (
                                <Link key={horse.id} prefetch={false} href={horse.url} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:text-primary">
                                    {horse.name}
                                </Link>
                            ))}
                        </div>
                        <Link
                            href="/compare"
                            prefetch={false}
                            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-primary"
                        >
                            {comparison.length}頭を横並びで比較
                        </Link>
                    </div>
                )}
            </section>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-primary">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    データを探す
                </Link>
                {favorites.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_FAVORITES_KEY)}
                        className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-700"
                    >
                        保存をすべて削除
                    </button>
                )}
                {history.length > 0 && (
                    <button
                        type="button"
                        onClick={() => clearStoredList(DATA_HISTORY_KEY)}
                        className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-700"
                    >
                        履歴を削除
                    </button>
                )}
            </div>
        </main>
    );
}
