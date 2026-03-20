'use client';

import { useState, useEffect, useCallback } from 'react';
import { Adsense } from './Adsense';

const AD_CLIENT = 'ca-pub-4411270831448240';
const GATE_COUNTDOWN_SECONDS = 5;

/**
 * PC用広告ゲートモーダル
 *
 * AdSenseディスプレイ広告を表示しながら、カウントダウン後にアンロックボタンを有効化する。
 *
 * 【AdSense規約準拠】
 * - 広告は「スポンサーリンク」ラベルで明示
 * - アンロックは広告クリックではなく、別の「データを表示」ボタンで行う
 * - 広告クリックのインセンティブ付与はしない
 * - モーダルは×ボタンでいつでも閉じられる（閉じてもアンロックはされない）
 */
export const AdGateModal = ({
    isOpen,
    onUnlock,
    onClose,
}: {
    isOpen: boolean;
    onUnlock: () => void;
    onClose: () => void;
}) => {
    const [countdown, setCountdown] = useState(GATE_COUNTDOWN_SECONDS);
    const [canUnlock, setCanUnlock] = useState(false);

    // カウントダウンロジック
    useEffect(() => {
        if (!isOpen) {
            setCountdown(GATE_COUNTDOWN_SECONDS);
            setCanUnlock(false);
            return;
        }

        if (countdown <= 0) {
            setCanUnlock(true);
            return;
        }

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setCanUnlock(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, countdown]);

    const handleUnlock = useCallback(() => {
        onUnlock();
    }, [onUnlock]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* オーバーレイ */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* モーダル本体 */}
            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">詳細データの閲覧</span>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                        aria-label="閉じる"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 広告エリア */}
                <div className="px-4 pt-3 pb-2">
                    <div className="text-[10px] text-slate-400 text-center mb-1.5 tracking-wider select-none">
                        スポンサーリンク
                    </div>
                    <div className="flex justify-center bg-slate-50 rounded-lg p-2 min-h-[260px]">
                        <Adsense
                            client={AD_CLIENT}
                            slot="1489598374"
                            style={{ display: 'inline-block', width: '336px', height: '280px' }}
                            isResponsive={false}
                        />
                    </div>
                </div>

                {/* アクションエリア */}
                <div className="px-4 pb-4 pt-2">
                    {canUnlock ? (
                        <button
                            onClick={handleUnlock}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors outline-none"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            データを表示
                        </button>
                    ) : (
                        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 text-sm font-bold rounded-lg">
                            <span>あと {countdown}秒...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
