'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';
const UNLOCK_DURATION = 15;
const STORAGE_KEY = 'uma_content_unlocked';

/**
 * ContentGate — 広告視聴でコンテンツ解放
 *
 * 仕組み:
 * 1. ゲートされたコンテンツは非表示（プレビューなし）
 * 2. ロック状態のカードUIで「無料で見る」ボタンを大きく表示
 * 3. ボタンタップ → 広告オーバーレイ（15秒カウントダウン）
 * 4. カウントダウン完了 → コンテンツ解放 → sessionStorage記録
 * 5. 同一セッション内は再視聴不要
 */
export const ContentGate = ({
    children,
    gateId,
    title = 'プレミアムデータ',
    description = '広告を表示してデータを閲覧',
    adSlot = '9407670747',
    icon,
}: {
    children: React.ReactNode;
    gateId: string;
    title?: string;
    description?: string;
    adSlot?: string;
    icon?: React.ReactNode;
}) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [showAdOverlay, setShowAdOverlay] = useState(false);
    const [countdown, setCountdown] = useState(UNLOCK_DURATION);
    const [canClose, setCanClose] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // セッション内の解放状態を復元
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const unlocked: string[] = JSON.parse(stored);
                if (unlocked.includes(gateId)) {
                    setIsUnlocked(true);
                }
            }
        } catch {
            // sessionStorage unavailable
        }
    }, [gateId]);

    // カウントダウン処理
    useEffect(() => {
        if (showAdOverlay && countdown > 0) {
            timerRef.current = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        } else if (showAdOverlay && countdown === 0) {
            setCanClose(true);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [showAdOverlay, countdown]);

    const handleStartAd = useCallback(() => {
        setShowAdOverlay(true);
        setCountdown(UNLOCK_DURATION);
        setCanClose(false);
        document.body.style.overflow = 'hidden';
    }, []);

    const handleUnlock = useCallback(() => {
        setIsUnlocked(true);
        setShowAdOverlay(false);
        document.body.style.overflow = '';
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            const unlocked: string[] = stored ? JSON.parse(stored) : [];
            if (!unlocked.includes(gateId)) {
                unlocked.push(gateId);
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
            }
        } catch {
            // ignore
        }
    }, [gateId]);

    // 解放済み → コンテンツ表示
    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <>
            {/* ロック状態カード — 必ず十分な高さがあり、ボタンがクリック可能 */}
            <div className="mb-2 border border-slate-200 rounded-xl bg-gradient-to-b from-slate-50 to-white overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
                    {icon && <span className="shrink-0">{icon}</span>}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-base font-bold text-primary leading-tight">{title}</h4>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{description}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        🔒 ロック中
                    </span>
                </div>

                {/* 解放ボタンエリア */}
                <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center mb-4">
                        <svg width="28" height="28" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <button
                        onClick={handleStartAd}
                        className="inline-flex items-center gap-2 bg-primary text-white text-sm sm:text-base font-bold px-6 py-3 rounded-xl shadow-md hover:bg-primary-light transition-all duration-200 active:scale-95"
                    >
                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        無料で見る（{UNLOCK_DURATION}秒）
                    </button>
                    <p className="text-[10px] text-slate-400 mt-2.5">広告表示後にデータが閲覧可能になります</p>
                </div>
            </div>

            {/* 広告表示オーバーレイ（フルスクリーン） */}
            {showAdOverlay && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">
                                {canClose ? '✓ 閲覧可能になりました' : `データ解放まで ${countdown}秒`}
                            </span>
                            {canClose ? (
                                <button
                                    onClick={handleUnlock}
                                    className="text-xs font-bold bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary-light transition-colors active:scale-95"
                                >
                                    データを見る →
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                                            style={{ width: `${((UNLOCK_DURATION - countdown) / UNLOCK_DURATION) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono w-5 text-right">{countdown}</span>
                                </div>
                            )}
                        </div>

                        {/* 広告エリア */}
                        <div className="p-4 min-h-[300px] flex items-center justify-center">
                            <Adsense
                                client={AD_CLIENT}
                                slot={adSlot}
                                refreshKey={`gate-${gateId}-${Date.now()}`}
                                style={{ display: 'inline-block', width: '100%', height: '280px' }}
                                isResponsive={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
