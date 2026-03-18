'use client';

import { useState, useEffect } from 'react';

/**
 * 次の開催日案内 + ホーム画面追加プロンプト
 * 
 * GA4データ: リピーターゼロ（全58ユーザーが新規）問題への直接対策。
 * エンゲージメント1h08mの高品質ユーザーに「次に来る理由」を提供し、
 * Direct流入のリピーター化を促進する。
 */
export const NextRaceReminder = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    // 次の土日を計算
    const getNextRaceDays = (): { nextSunday: Date; nextSaturday: Date } => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const dayOfWeek = now.getDay(); // 0=日, 6=土

        // 次の土曜
        const daysUntilSat = dayOfWeek <= 6 ? (6 - dayOfWeek) || 7 : 6 - dayOfWeek;
        const nextSaturday = new Date(now);
        nextSaturday.setDate(now.getDate() + (dayOfWeek === 6 ? 7 : daysUntilSat));

        // 次の日曜
        const daysUntilSun = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + daysUntilSun);

        return { nextSunday, nextSaturday };
    };

    const formatJapaneseDate = (date: Date): string => {
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        return `${date.getMonth() + 1}月${date.getDate()}日（${dayNames[date.getDay()]}）`;
    };

    const { nextSaturday, nextSunday } = getNextRaceDays();

    // PWA beforeinstallprompt イベントをキャプチャ
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        // すでにインストール済みかチェック
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    return (
        <section className="mt-4 mb-2 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/80 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="20" height="20" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-primary mb-1.5">
                        次の中央競馬開催
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs sm:text-sm font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 shadow-sm">
                            📅 {formatJapaneseDate(nextSaturday)}
                        </span>
                        <span className="text-xs sm:text-sm font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 shadow-sm">
                            📅 {formatJapaneseDate(nextSunday)}
                        </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                        分析データは前日の午前7時頃に更新されます。
                    </p>

                    {/* ホーム画面追加ボタン（PWA対応ブラウザのみ） */}
                    {showInstallPrompt && !isInstalled && (
                        <button
                            onClick={handleInstall}
                            className="mt-3 inline-flex items-center gap-2 bg-primary text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-primary-light transition-all duration-200 active:scale-95"
                        >
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M12 5v14m-7-7l7 7 7-7"/>
                            </svg>
                            ホーム画面に追加
                        </button>
                    )}

                    {isInstalled && (
                        <div className="mt-3 text-[11px] text-green-600 font-bold flex items-center gap-1">
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7"/>
                            </svg>
                            ホーム画面に追加済み
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
