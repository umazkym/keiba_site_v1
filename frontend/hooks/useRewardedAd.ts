'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// googletag の型定義
declare global {
    interface Window {
        googletag?: any;
    }
}

const AD_UNIT_PATH = '/23345285369/uma-free-rewarded-premium';

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
                return;
            }
        }

        const googletag = window.googletag || { cmd: [] };
        window.googletag = googletag;

        googletag.cmd.push(() => {
            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            // ページやデバイスがリワード広告をサポートしていない場合 null が返る
            if (!slot) {
                setIsSupported(false);
                setIsLoading(false);
                // サポートされない環境ではフォールバックとしてアンロック
                setIsUnlocked(true);
                return;
            }

            slotRef.current = slot;
            slot.addService(googletag.pubads());

            // 広告準備完了 → ボタンの有効化
            googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
                setIsReady(true);
                setIsLoading(false);
                makeVisibleRef.current = () => event.makeRewardedVisible();
            });

            // リワード付与（広告視聴完了）
            googletag.pubads().addEventListener('rewardedSlotGranted', () => {
                setIsUnlocked(true);
                // セッションストレージに保存（同一セッション中は再度広告不要）
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('premium_unlocked', 'true');
                }
            });

            // 広告クローズ（リワード未付与でもクローズ可能）
            googletag.pubads().addEventListener('rewardedSlotClosed', () => {
                // スロットを破棄して再利用に備える
                if (slotRef.current) {
                    googletag.destroySlots([slotRef.current]);
                    slotRef.current = null;
                }
            });

            // 広告なし（在庫切れなど）
            googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
                if (event.slot === slotRef.current && event.isEmpty) {
                    setIsLoading(false);
                    // 広告在庫がない場合はフォールバックとしてアンロック
                    setIsUnlocked(true);
                }
            });

            googletag.enableServices();
            googletag.display(slot);
        });

        return () => {
            // クリーンアップ
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
