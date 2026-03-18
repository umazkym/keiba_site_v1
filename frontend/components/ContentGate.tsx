'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';
const UNLOCK_DURATION = 15; // 広告表示秒数
const STORAGE_KEY = 'uma_content_unlocked';

/**
 * ContentGate — 広告視聴でコンテンツ解放
 *
 * 仕組み:
 * 1. ゲート対象コンテンツはblur + オーバーレイで隠される
 * 2. ユーザーが「データを見る」ボタンを押すと広告オーバーレイが表示
 * 3. カウントダウン（15秒）完了で「閉じる」ボタンが出現
 * 4. 閉じるとコンテンツが解放され、sessionStorageに記録
 * 5. 同一セッション内では再度視聴不要
 *
 * 効果:
 * - 広告視認時間が保証される → Active View 100%
 * - ユーザーが能動的に広告を見る → eCPM大幅向上
 * - コンテンツの価値を感じさせる心理効果
 */
export const ContentGate = ({
    children,
    gateId,
    title = 'プレミアムデータ',
    description = '広告を表示してデータを閲覧',
    adSlot = '9407670747',
}: {
    children: React.ReactNode;
    gateId: string;
    title?: string;
    description?: string;
    adSlot?: string;
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
        // bodyスクロールをロック
        document.body.style.overflow = 'hidden';
    }, []);

    const handleUnlock = useCallback(() => {
        setIsUnlocked(true);
        setShowAdOverlay(false);
        document.body.style.overflow = '';
        // sessionStorageに保存
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

    // すでに解放済み → そのまま表示
    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <>
            {/* ゲート済みコンテンツ: blur + オーバーレイ */}
            <div className="relative rounded-xl overflow-hidden">
                {/* blurされたコンテンツプレビュー */}
                <div className="filter blur-[6px] pointer-events-none select-none" aria-hidden="true">
                    {children}
                </div>

                {/* 解放プロンプトオーバーレイ */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/60 via-white/80 to-white/95 backdrop-blur-[1px] z-10">
                    <div className="text-center px-4 max-w-xs">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg width="24" height="24" fill="none" stroke="var(--color-primary)" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-primary mb-1">{title}</h4>
                        <p className="text-[11px] sm:text-xs text-slate-500 mb-3 leading-relaxed">{description}</p>
                        <button
                            onClick={handleStartAd}
                            className="inline-flex items-center gap-2 bg-primary text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md hover:bg-primary-light transition-all duration-200 active:scale-95"
                        >
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            無料で見る（{UNLOCK_DURATION}秒）
                        </button>
                    </div>
                </div>
            </div>

            {/* 広告表示オーバーレイ（フルスクリーン） */}
            {showAdOverlay && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">
                                {canClose ? '✓ 閲覧可能になりました' : `あと ${countdown}秒...`}
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
                                    {/* プログレスバー */}
                                    <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
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
