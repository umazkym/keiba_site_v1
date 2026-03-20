'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// googletag の型定義
declare global {
    interface Window {
        googletag?: any;
    }
}

const AD_UNIT_PATH = '/23345285369/uma-free-rewarded-premium';

// GPTからのイベントが一切発火しない場合のタイムアウト（モバイルのみ使用）
const LOADING_TIMEOUT_MS = 10_000;

/**
 * GAM リワード広告のライフサイクルを管理するカスタムフック。
 * デバイスに応じて2つのモードで動作する:
 *
 * 【モバイル】GAM Rewarded Ad
 *   → ボタンクリック → 動画広告 → rewardedSlotGranted → アンロック
 *
 * 【PC】AdSense表示広告 + カウントダウンモーダル（フックの外で制御）
 *   → defineOutOfPageSlot() が null → isSupported=false
 *   → 呼び出し元がモーダルを表示 → 5秒待機 → アンロック
 *
 * 返り値:
 * - isUnlocked: コンテンツアンロック済か
 * - isReady: モバイル: 広告準備完了 / PC: 常にtrue
 * - isLoading: 初期読み込み中
 * - isSupported: GAM Rewardedがサポートされているか（false=PC）
 * - showAd: モバイル: 広告表示 / PC: 何もしない（モーダルは呼び出し元が制御）
 * - unlock: 外部からアンロックを実行する関数（PC用モーダルから呼ばれる）
 */
export function useRewardedAd() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(true);
    const makeVisibleRef = useRef<(() => void) | null>(null);
    const slotRef = useRef<any>(null);
    const initializedRef = useRef(false);
    const resolvedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        // セッション中に以前アンロック済みなら即解放
        if (typeof window !== 'undefined') {
            const unlocked = sessionStorage.getItem('premium_unlocked');
            if (unlocked === 'true') {
                setIsUnlocked(true);
                setIsLoading(false);
                resolvedRef.current = true;
                return;
            }
        }

        // タイムアウトフォールバック（モバイルで広告在庫がない場合のセーフティネット）
        const timeoutId = setTimeout(() => {
            if (!resolvedRef.current) {
                console.warn('[useRewardedAd] Timeout: no GPT event received. Falling back.');
                resolvedRef.current = true;
                // タイムアウト時はPC同様にモーダルゲートへフォールバック
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
            }
        }, LOADING_TIMEOUT_MS);

        const googletag = window.googletag || { cmd: [] };
        window.googletag = googletag;

        googletag.cmd.push(() => {
            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            // PCブラウザ / 非対応環境 → モーダルゲートモードへ
            if (!slot) {
                console.log('[useRewardedAd] Rewarded ads not supported. Using modal gate.');
                resolvedRef.current = true;
                clearTimeout(timeoutId);
                setIsSupported(false);
                setIsReady(true);  // PC: モーダル表示可能
                setIsLoading(false);
                return;
            }

            slotRef.current = slot;
            slot.addService(googletag.pubads());

            // モバイル: 広告準備完了
            googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
                console.log('[useRewardedAd] Rewarded slot is ready.');
                resolvedRef.current = true;
                clearTimeout(timeoutId);
                setIsReady(true);
                setIsLoading(false);
                makeVisibleRef.current = () => event.makeRewardedVisible();
            });

            // モバイル: リワード付与
            googletag.pubads().addEventListener('rewardedSlotGranted', () => {
                console.log('[useRewardedAd] Reward granted!');
                setIsUnlocked(true);
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('premium_unlocked', 'true');
                }
            });

            // モバイル: 広告クローズ
            googletag.pubads().addEventListener('rewardedSlotClosed', () => {
                console.log('[useRewardedAd] Rewarded slot closed.');
                if (slotRef.current) {
                    googletag.destroySlots([slotRef.current]);
                    slotRef.current = null;
                }
            });

            // モバイル: 広告なし（在庫切れ）→ モーダルゲートへフォールバック
            googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                if (event.slot === slotRef.current && event.isEmpty) {
                    console.log('[useRewardedAd] No ad returned. Using modal gate.');
                    resolvedRef.current = true;
                    clearTimeout(timeoutId);
                    setIsSupported(false);
                    setIsReady(true);
                    setIsLoading(false);
                }
            });

            try {
                googletag.enableServices();
            } catch (e) {
                console.warn('[useRewardedAd] enableServices error:', e);
            }

            googletag.display(slot);
        });

        return () => {
            clearTimeout(timeoutId);
            if (slotRef.current && window.googletag) {
                try {
                    window.googletag.destroySlots([slotRef.current]);
                } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
        };
    }, []);

    // モバイル: GAM Rewarded広告を表示
    const showAd = useCallback(() => {
        if (makeVisibleRef.current) {
            makeVisibleRef.current();
        }
    }, []);

    // PC / フォールバック: 外部からアンロックを実行（AdGateModalから呼ばれる）
    const unlock = useCallback(() => {
        setIsUnlocked(true);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('premium_unlocked', 'true');
        }
    }, []);

    return { isUnlocked, isReady, isLoading, isSupported, showAd, unlock };
}
