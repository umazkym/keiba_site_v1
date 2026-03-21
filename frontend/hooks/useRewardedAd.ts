'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

declare global {
    interface Window {
        googletag?: any;
    }
}

const AD_UNIT_PATH = '/23345285369/uma-free-rewarded-premium';
const LOADING_TIMEOUT_MS = 10_000;

/**
 * GAM リワード広告のライフサイクルを管理するカスタムフック。
 *
 * 【モバイル】GAM Rewarded Ad
 *   → ボタンクリック → 動画広告 → rewardedSlotGranted → アンロック
 *
 * 【PC / 在庫なし / タイムアウト】
 *   → defineOutOfPageSlot() が null / slotRenderEnded(isEmpty) / タイムアウト
 *   → isSupported=false → 呼び出し元がモーダルを表示 → 5秒待機 → アンロック
 *
 * 【修正点】
 * - 広告を途中で閉じた後に再試行できなかった問題を修正
 *   rewardedSlotClosed 後にスロットを再初期化し isReady=false→true を経由させる
 * - ボタンの disabled 条件が逆だった問題を修正
 *   isLoading=true のときはボタンを disabled にする
 */
export function useRewardedAd() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(true);
    // ★ 再試行トリガー: closeされるたびにインクリメントして再初期化を走らせる
    const [retryKey, setRetryKey] = useState(0);

    const makeVisibleRef = useRef<(() => void) | null>(null);
    const slotRef = useRef<any>(null);
    const resolvedRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // セッション中にアンロック済みなら即解放（再初期化不要）
        if (typeof window !== 'undefined') {
            const unlocked = sessionStorage.getItem('premium_unlocked');
            if (unlocked === 'true') {
                setIsUnlocked(true);
                setIsLoading(false);
                return;
            }
        }

        // 再試行時は状態をリセット
        resolvedRef.current = false;
        makeVisibleRef.current = null;
        setIsReady(false);
        setIsLoading(true);

        // タイムアウトフォールバック
        timeoutRef.current = setTimeout(() => {
            if (!resolvedRef.current) {
                console.warn('[useRewardedAd] Timeout: no GPT event received. Falling back.');
                resolvedRef.current = true;
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
            }
        }, LOADING_TIMEOUT_MS);

        const googletag = window.googletag || { cmd: [] };
        window.googletag = googletag;

        googletag.cmd.push(() => {
            // 前回スロットが残っていれば破棄
            if (slotRef.current) {
                try {
                    googletag.destroySlots([slotRef.current]);
                } catch (e) { /* ignore */ }
                slotRef.current = null;
            }

            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            // PC / 非対応環境 → モーダルゲートへ
            if (!slot) {
                console.log('[useRewardedAd] Rewarded ads not supported. Using modal gate.');
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                return;
            }

            slotRef.current = slot;
            slot.addService(googletag.pubads());

            // 広告準備完了
            googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
                console.log('[useRewardedAd] Rewarded slot is ready.');
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsReady(true);
                setIsLoading(false);
                makeVisibleRef.current = () => event.makeRewardedVisible();
            });

            // リワード付与
            googletag.pubads().addEventListener('rewardedSlotGranted', () => {
                console.log('[useRewardedAd] Reward granted!');
                setIsUnlocked(true);
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('premium_unlocked', 'true');
                }
            });

            // ★ 修正: 広告クローズ後にスロットを破棄し、再初期化をトリガー
            // 変更前: 破棄のみ → makeVisibleRef は有効な参照のまま残り showAd() が壊れた状態で動作
            // 変更後: retryKey をインクリメント → useEffect が再実行 → スロットを再定義
            googletag.pubads().addEventListener('rewardedSlotClosed', () => {
                console.log('[useRewardedAd] Rewarded slot closed. Preparing for retry.');
                if (slotRef.current) {
                    try {
                        googletag.destroySlots([slotRef.current]);
                    } catch (e) { /* ignore */ }
                    slotRef.current = null;
                }
                makeVisibleRef.current = null;
                // アンロックされていなければ再初期化（ユーザーが再試行できるように）
                setRetryKey(prev => prev + 1);
            });

            // 広告なし（在庫切れ）→ モーダルゲートへフォールバック
            googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                if (event.slot === slotRef.current && event.isEmpty) {
                    console.log('[useRewardedAd] No ad returned. Using modal gate.');
                    resolvedRef.current = true;
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (slotRef.current && window.googletag) {
                try {
                    window.googletag.destroySlots([slotRef.current]);
                } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
        };
        // retryKey が変わるたびに再初期化する（closeされた後の再試行）
        // isUnlocked が true の場合は再初期化不要（上部の早期リターンで処理）
    }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // モバイル: GAM Rewarded広告を表示
    const showAd = useCallback(() => {
        if (makeVisibleRef.current) {
            makeVisibleRef.current();
        }
    }, []);

    // PC / フォールバック: 外部からアンロックを実行
    const unlock = useCallback(() => {
        setIsUnlocked(true);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('premium_unlocked', 'true');
        }
    }, []);

    return { isUnlocked, isReady, isLoading, isSupported, showAd, unlock };
}