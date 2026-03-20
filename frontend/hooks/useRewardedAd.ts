'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// googletag の型定義
declare global {
    interface Window {
        googletag?: any;
    }
}

const AD_UNIT_PATH = '/23345285369/uma-free-rewarded-premium';

// ▼▼▼▼▼【タイムアウト設定】▼▼▼▼▼
// GPTからのイベントが一切発火しない場合（GAM設定ミス、在庫なし、ネットワーク障害等）、
// この秒数を過ぎたらフォールバックとして自動アンロックする
const LOADING_TIMEOUT_MS = 10_000; // 10秒
// ▲▲▲▲▲【タイムアウト設定ここまで】▲▲▲▲▲

/**
 * GAM リワード広告のライフサイクルを管理するカスタムフック。
 *
 * - isUnlocked: 広告視聴完了後にtrueになる（UIアンロック判定）
 * - isReady: 広告が読み込まれ表示可能な状態
 * - isLoading: 広告の初期読み込み中
 * - showAd: ボタンクリック時に呼び出すコールバック
 * - isSupported: このデバイス/ページでリワード広告がサポートされているか
 */
export function useRewardedAd() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(true);
    const makeVisibleRef = useRef<(() => void) | null>(null);
    const slotRef = useRef<any>(null);
    const initializedRef = useRef(false);
    const resolvedRef = useRef(false); // イベント受信済みフラグ

    useEffect(() => {
        // 二重初期化防止
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

        // ▼▼▼▼▼【タイムアウトフォールバック】▼▼▼▼▼
        // GPTイベントが一切発火しない場合のセーフティネット
        const timeoutId = setTimeout(() => {
            if (!resolvedRef.current) {
                console.warn('[useRewardedAd] Timeout: no GPT event received within', LOADING_TIMEOUT_MS, 'ms. Auto-unlocking.');
                resolvedRef.current = true;
                setIsLoading(false);
                setIsUnlocked(true);
            }
        }, LOADING_TIMEOUT_MS);
        // ▲▲▲▲▲【タイムアウトフォールバックここまで】▲▲▲▲▲

        const googletag = window.googletag || { cmd: [] };
        window.googletag = googletag;

        googletag.cmd.push(() => {
            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            // ページやデバイスがリワード広告をサポートしていない場合 null が返る
            // （PCブラウザ、viewport未設定等）
            if (!slot) {
                console.log('[useRewardedAd] Rewarded ads not supported on this page/device. Auto-unlocking.');
                resolvedRef.current = true;
                clearTimeout(timeoutId);
                setIsSupported(false);
                setIsLoading(false);
                setIsUnlocked(true);
                return;
            }

            slotRef.current = slot;
            slot.addService(googletag.pubads());

            // 広告準備完了 → ボタンの有効化
            googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
                console.log('[useRewardedAd] Rewarded slot is ready.');
                resolvedRef.current = true;
                clearTimeout(timeoutId);
                setIsReady(true);
                setIsLoading(false);
                makeVisibleRef.current = () => event.makeRewardedVisible();
            });

            // リワード付与（広告視聴完了）
            googletag.pubads().addEventListener('rewardedSlotGranted', () => {
                console.log('[useRewardedAd] Reward granted!');
                setIsUnlocked(true);
                // セッションストレージに保存（同一セッション中は再度広告不要）
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('premium_unlocked', 'true');
                }
            });

            // 広告クローズ（リワード未付与でもクローズ可能）
            googletag.pubads().addEventListener('rewardedSlotClosed', () => {
                console.log('[useRewardedAd] Rewarded slot closed.');
                if (slotRef.current) {
                    googletag.destroySlots([slotRef.current]);
                    slotRef.current = null;
                }
            });

            // 広告なし（在庫切れなど）
            googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                if (event.slot === slotRef.current && event.isEmpty) {
                    console.log('[useRewardedAd] No ad returned (empty slot). Auto-unlocking.');
                    resolvedRef.current = true;
                    clearTimeout(timeoutId);
                    setIsLoading(false);
                    setIsUnlocked(true);
                }
            });

            // ▼▼▼▼▼【enableServices 重複呼び出し防止】▼▼▼▼▼
            // layout.tsx の AdSense (adsbygoogle) が先に enableServices を呼んでいる可能性あり
            // GPTの enableServices は冪等だが念のためtry-catch
            try {
                googletag.enableServices();
            } catch (e) {
                console.warn('[useRewardedAd] enableServices error (possibly already called):', e);
            }
            // ▲▲▲▲▲【enableServices 重複呼び出し防止ここまで】▲▲▲▲▲

            googletag.display(slot);
        });

        return () => {
            clearTimeout(timeoutId);
            if (slotRef.current && window.googletag) {
                try {
                    window.googletag.destroySlots([slotRef.current]);
                } catch (e) {
                    // ignore
                }
                slotRef.current = null;
            }
        };
    }, []);

    const showAd = useCallback(() => {
        if (makeVisibleRef.current) {
            makeVisibleRef.current();
        }
    }, []);

    return { isUnlocked, isReady, isLoading, isSupported, showAd };
}
