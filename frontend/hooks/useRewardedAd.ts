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
 *   → isSupported=false → 呼び出し元がモーダルを表示 → 5秒待機 → アンロック
 *
 * 【修正点】
 *
 * ① イベントリスナー累積バグを修正
 *    変更前: retryKey が変わるたびに addEventListener が追加され、
 *            removeEventListener が呼ばれなかった。
 *            → 再試行のたびにリスナーが増え、rewardedSlotGranted が複数回発火。
 *    変更後: 各リスナーを変数に保持し、useEffect のクリーンアップで
 *            googletag.pubads().removeEventListener() を確実に呼ぶ。
 *
 * ② enableServices() を初回1回のみ呼ぶように修正
 *    変更前: retryKey が変わるたびに enableServices() を呼んでいた。
 *    変更後: servicesEnabled フラグ（module スコープ）で初回のみ実行。
 *
 * ③ 再試行の実現方法を変更
 *    変更前: retryKey で useEffect を再実行 → enableServices が複数回呼ばれる。
 *    変更後: reloadSlot() 関数でスロット定義と display() のみを再実行。
 *            リスナーは初回1回だけ登録し、スロット参照 (slotRef) で絞り込む。
 *
 * ④ アンロック粒度をレース単位に変更
 *    変更前: sessionStorage('premium_unlocked') でセッション中全レース無料。
 *    変更後: レースIDごとに sessionStorage('unlocked_race_ids') で管理。
 *            showAd(raceId)、unlock(raceId) でレース単位の制御が可能。
 *            isRaceUnlocked(raceId) でレースごとの判定ができる。
 */

// enableServices() は1ページに1回のみ。モジュールスコープで管理する。
let _gptServicesEnabled = false;

export function useRewardedAd() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(true);

    // レース単位のアンロック管理
    const [unlockedRaceIds, setUnlockedRaceIds] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set<string>();
        try {
            const stored = sessionStorage.getItem('unlocked_race_ids');
            return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
        } catch {
            return new Set<string>();
        }
    });

    const makeVisibleRef = useRef<(() => void) | null>(null);
    const slotRef = useRef<any>(null);
    const resolvedRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initializedRef = useRef(false);
    // showAd() 呼び出し時にどのレースの広告かを記憶する
    const pendingRaceIdRef = useRef<string | undefined>(undefined);

    // ★ スロットのみ再定義する関数（リスナーは再登録しない）
    const reloadSlot = useCallback(() => {
        const googletag = window.googletag;
        if (!googletag) return;

        googletag.cmd.push(() => {
            // 前回スロットを破棄
            if (slotRef.current) {
                try { googletag.destroySlots([slotRef.current]); } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
            makeVisibleRef.current = null;
            resolvedRef.current = false;
            setIsReady(false);
            setIsLoading(true);

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (!resolvedRef.current) {
                    resolvedRef.current = true;
                    setIsSupported(false);
                    setIsReady(true);
                    setIsLoading(false);
                }
            }, LOADING_TIMEOUT_MS);

            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            if (!slot) {
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                return;
            }

            slotRef.current = slot;
            slot.addService(googletag.pubads());
            googletag.display(slot);
        });
    }, []);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        // セッション中にグローバルアンロック済みなら即解放
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

        // ★ パフォーマンス改善: GPTスクリプトをlayout.tsxから移動し、ここで動的ロード
        // レースページでのみ使用されるRewarded Adのために、全ページでスクリプトを読む必要はない
        // 既にスクリプトが読み込まれていなければ動的に挿入する
        if (!document.querySelector('script[src*="securepubads.g.doubleclick.net"]')) {
            const gptScript = document.createElement('script');
            gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            gptScript.async = true;
            gptScript.crossOrigin = 'anonymous';
            document.head.appendChild(gptScript);
        }

        // ★ 修正②: リスナーを変数に保持して cleanup で確実に削除する
        // 各リスナーは slotRef.current と照合して該当スロットの場合のみ処理する
        const onReady = (event: any) => {
            if (event.slot !== slotRef.current) return;
            resolvedRef.current = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsReady(true);
            setIsLoading(false);
            makeVisibleRef.current = () => event.makeRewardedVisible();
        };

        // ★ 修正④: レース単位のアンロック
        const onGranted = (event: any) => {
            if (event.slot !== slotRef.current) return;
            const raceId = pendingRaceIdRef.current;
            if (raceId) {
                // レース単位でアンロック
                setUnlockedRaceIds(prev => {
                    const next = new Set<string>(prev);
                    next.add(raceId);
                    try {
                        sessionStorage.setItem('unlocked_race_ids', JSON.stringify([...next]));
                    } catch { /* ignore */ }
                    return next;
                });
            } else {
                // raceId なし（旧来の呼び出し）は全体アンロック
                setIsUnlocked(true);
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('premium_unlocked', 'true');
                }
            }
            pendingRaceIdRef.current = undefined;
        };

        const onClosed = (event: any) => {
            if (event.slot !== slotRef.current) return;
            // 対象レースがまだアンロックされていなければ再試行可能にする
            const raceId = pendingRaceIdRef.current;
            const isThisRaceUnlocked = raceId
                ? (sessionStorage.getItem('unlocked_race_ids') ?? '').includes(raceId)
                : sessionStorage.getItem('premium_unlocked') === 'true';
            pendingRaceIdRef.current = undefined;
            if (!isThisRaceUnlocked) {
                if (slotRef.current) {
                    try { googletag.destroySlots([slotRef.current]); } catch (e) { /* ignore */ }
                    slotRef.current = null;
                }
                // ★ reloadSlot() でスロットのみ再定義（リスナーは再登録しない）
                reloadSlot();
            }
        };

        const onRenderEnded = (event: any) => {
            if (event.slot !== slotRef.current) return;
            if (event.isEmpty) {
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
            }
        };

        googletag.cmd.push(() => {
            // ★ 修正②: enableServices() を初回1回のみ
            if (!_gptServicesEnabled) {
                try {
                    googletag.enableServices();
                    _gptServicesEnabled = true;
                } catch (e) {
                    console.warn('[useRewardedAd] enableServices error:', e);
                }
            }

            // ★ 修正①: リスナーを変数で管理し、cleanup で removeEventListener できるようにする
            googletag.pubads().addEventListener('rewardedSlotReady', onReady);
            googletag.pubads().addEventListener('rewardedSlotGranted', onGranted);
            googletag.pubads().addEventListener('rewardedSlotClosed', onClosed);
            googletag.pubads().addEventListener('slotRenderEnded', onRenderEnded);

            // タイムアウト
            timeoutRef.current = setTimeout(() => {
                if (!resolvedRef.current) {
                    resolvedRef.current = true;
                    setIsSupported(false);
                    setIsReady(true);
                    setIsLoading(false);
                }
            }, LOADING_TIMEOUT_MS);

            // スロット初期定義
            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

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
            googletag.display(slot);
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            // ★ 修正①: cleanup でリスナーを確実に削除
            if (window.googletag?.pubads) {
                try {
                    window.googletag.pubads().removeEventListener('rewardedSlotReady', onReady);
                    window.googletag.pubads().removeEventListener('rewardedSlotGranted', onGranted);
                    window.googletag.pubads().removeEventListener('rewardedSlotClosed', onClosed);
                    window.googletag.pubads().removeEventListener('slotRenderEnded', onRenderEnded);
                } catch (e) { /* ignore */ }
            }

            if (slotRef.current && window.googletag) {
                try { window.googletag.destroySlots([slotRef.current]); } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ★ 修正④: raceId を受け取る
    const showAd = useCallback((raceId?: string) => {
        pendingRaceIdRef.current = raceId;
        if (makeVisibleRef.current) {
            makeVisibleRef.current();
        }
    }, []);

    // ★ 修正④: raceId 単位でもアンロック可能に
    const unlock = useCallback((raceId?: string) => {
        if (raceId) {
            setUnlockedRaceIds(prev => {
                const next = new Set<string>(prev);
                next.add(raceId);
                try {
                    sessionStorage.setItem('unlocked_race_ids', JSON.stringify([...next]));
                } catch { /* ignore */ }
                return next;
            });
        } else {
            setIsUnlocked(true);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('premium_unlocked', 'true');
            }
        }
    }, []);

    // ★ 修正④: レースIDごとのアンロック判定
    const isRaceUnlocked = useCallback((raceId: string): boolean => {
        return isUnlocked || unlockedRaceIds.has(raceId);
    }, [isUnlocked, unlockedRaceIds]);

    return { isUnlocked, isRaceUnlocked, isReady, isLoading, isSupported, showAd, unlock };
}