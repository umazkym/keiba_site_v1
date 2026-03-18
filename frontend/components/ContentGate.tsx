'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';
const UNLOCK_DURATION = 15;
const STORAGE_KEY = 'uma_content_unlocked';

/**
 * ContentGate — 広告視聴でコンテンツ解放
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
    // ★ 修正: refreshKeyをオーバーレイ起動時に1回だけ生成し、カウントダウン中は固定
    const [adRefreshKey, setAdRefreshKey] = useState('');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        // ★ 修正: ここで1回だけrefreshKeyを生成（以降カウントダウン中は変化しない）
        setAdRefreshKey(`gate-${gateId}-${Date.now()}`);
        setShowAdOverlay(true);
        setCountdown(UNLOCK_DURATION);
        setCanClose(false);
        document.body.style.overflow = 'hidden';
    }, [gateId]);

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

    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <>
            {/* ロックカード */}
            <div className="mb-2 border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    {icon && <span className="shrink-0">{icon}</span>}
                    <h4 className="flex-1 text-sm font-bold text-primary">{title}</h4>
                    <span className="text-[10px] font-medium text-slate-400">🔒</span>
                </div>
                <div className="flex flex-col items-center py-6 px-4">
                    <p className="text-xs text-slate-500 mb-3">{description}</p>
                    <button
                        onClick={handleStartAd}
                        className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity active:scale-95"
                    >
                        ▶ 無料で見る（{UNLOCK_DURATION}秒）
                    </button>
                </div>
            </div>

            {/* 広告オーバーレイ */}
            {showAdOverlay && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
                    style={{ WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
                >
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                        {/* 上部バー */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                            {canClose ? (
                                <>
                                    <span className="text-xs text-green-600 font-medium">✓ 完了</span>
                                    <button
                                        onClick={handleUnlock}
                                        className="text-xs font-bold text-primary hover:underline"
                                    >
                                        閉じる ✕
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-[11px] text-slate-400">広告</span>
                                    <span className="text-[11px] text-slate-400 font-mono">{countdown}秒</span>
                                </>
                            )}
                        </div>

                        {/* 広告エリア — refreshKeyは固定値を使用 */}
                        <div className="min-h-[260px] flex items-center justify-center">
                            <Adsense
                                client={AD_CLIENT}
                                slot={adSlot}
                                refreshKey={adRefreshKey}
                                style={{ display: 'inline-block', width: '100%', height: '250px' }}
                                isResponsive={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
