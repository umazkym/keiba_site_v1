'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { sendRewardGateEvent, type RewardGateEventParams } from '@/lib/analytics';

declare global {
    interface Window {
        googletag?: any;
    }
}

const AD_UNIT_PATH = '/23345285369/uma-free-rewarded-premium';
const LOADING_TIMEOUT_MS = 5_000;
const UNAVAILABLE_CACHE_KEY = 'rewarded_ad_unavailable_until';
const UNAVAILABLE_CACHE_TTL_MS = 15 * 60 * 1000;

export type RewardedAdContext = RewardGateEventParams;
export type RewardedAdUnavailableReason =
    | 'rewarded_timeout'
    | 'slot_not_supported'
    | 'slot_empty'
    | 'make_rewarded_visible_failed'
    | 'make_rewarded_visible_missing'
    | 'rewarded_recently_unavailable'
    | null;

/**
 * GAM リワード広告のライフサイクルを管理するカスタムフック。
 *
 * 【モバイル】GAM Rewarded Ad
 *   → ボタンクリック → 動画広告 → rewardedSlotGranted → アンロック
 *
 * 【PC / 在庫なし / タイムアウト】
 *   → isSupported=false → 呼び出し元が通常の「データを表示」ボタンに切り替える
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

const rememberRewardedUnavailable = () => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(UNAVAILABLE_CACHE_KEY, String(Date.now() + UNAVAILABLE_CACHE_TTL_MS));
    } catch {
        // sessionStorageが使えない環境では待機抑制のみスキップする。
    }
};

const clearRewardedUnavailableCache = () => {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem(UNAVAILABLE_CACHE_KEY);
    } catch {
        // ignore
    }
};

const isRewardedRecentlyUnavailable = () => {
    if (typeof window === 'undefined') return false;
    try {
        const until = Number(sessionStorage.getItem(UNAVAILABLE_CACHE_KEY) || '0');
        return Number.isFinite(until) && until > Date.now();
    } catch {
        return false;
    }
};

export function useRewardedAd() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(true);
    const [unavailableReason, setUnavailableReason] = useState<RewardedAdUnavailableReason>(null);

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

    const makeVisibleRef = useRef<(() => boolean | void) | null>(null);
    const slotRef = useRef<any>(null);
    const resolvedRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initializedRef = useRef(false);
    // showAd() 呼び出し時にどのレースの広告かを記憶する
    const pendingRaceIdRef = useRef<string | undefined>(undefined);
    const pendingContextRef = useRef<RewardedAdContext | null>(null);
    const rewardGrantedRef = useRef(false);

    const buildEventParams = useCallback((extra: RewardGateEventParams = {}): RewardGateEventParams => {
        return {
            ...pendingContextRef.current,
            race_id: pendingRaceIdRef.current ?? pendingContextRef.current?.race_id,
            ad_unit_path: AD_UNIT_PATH,
            ...extra,
        };
    }, []);

    // ★ スロットのみ再定義する関数（リスナーは再登録しない）
    const reloadSlot = useCallback(() => {
        const googletag = window.googletag;
        if (!googletag || !googletag.cmd) return;

        googletag.cmd.push(() => {
            // 前回スロットを破棄
            if (slotRef.current) {
                try { googletag.destroySlots([slotRef.current]); } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
            makeVisibleRef.current = null;
            resolvedRef.current = false;
            rewardGrantedRef.current = false;
            setIsReady(false);
            setIsLoading(true);
            setUnavailableReason(null);

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (!resolvedRef.current) {
                    resolvedRef.current = true;
                    setIsSupported(false);
                    setIsReady(true);
                    setIsLoading(false);
                    setUnavailableReason('rewarded_timeout');
                    makeVisibleRef.current = null;
                    rememberRewardedUnavailable();
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
                setUnavailableReason('slot_not_supported');
                makeVisibleRef.current = null;
                rememberRewardedUnavailable();
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

            if (isRewardedRecentlyUnavailable()) {
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                setUnavailableReason('rewarded_recently_unavailable');
                return;
            }
        }

        const googletag = window.googletag || {};
        googletag.cmd = googletag.cmd || [];
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

        timeoutRef.current = setTimeout(() => {
            if (!resolvedRef.current) {
                resolvedRef.current = true;
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                setUnavailableReason('rewarded_timeout');
                makeVisibleRef.current = null;
                rememberRewardedUnavailable();
            }
        }, LOADING_TIMEOUT_MS);

        // ★ 修正②: リスナーを変数に保持して cleanup で確実に削除する
        // 各リスナーは slotRef.current と照合して該当スロットの場合のみ処理する
        const onReady = (event: any) => {
            if (event.slot !== slotRef.current) return;
            resolvedRef.current = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsReady(true);
            setIsLoading(false);
            setIsSupported(true);
            setUnavailableReason(null);
            clearRewardedUnavailableCache();
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
            rewardGrantedRef.current = true;
            sendRewardGateEvent('reward_ad_granted', buildEventParams({ result: 'granted' }));
        };

        const onClosed = (event: any) => {
            if (event.slot !== slotRef.current) return;
            const result = rewardGrantedRef.current ? 'closed_after_reward' : 'closed_without_reward';
            sendRewardGateEvent('reward_ad_closed', buildEventParams({ result }));
            pendingRaceIdRef.current = undefined;
            pendingContextRef.current = null;
            rewardGrantedRef.current = false;
            if (slotRef.current) {
                try { googletag.destroySlots([slotRef.current]); } catch (e) { /* ignore */ }
                slotRef.current = null;
            }
            // 次のレースで再度押せるよう、閉じたタイミングで次のRewarded Adを準備する。
            reloadSlot();
        };

        const onRenderEnded = (event: any) => {
            if (event.slot !== slotRef.current) return;
            if (event.isEmpty) {
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                setUnavailableReason('slot_empty');
                makeVisibleRef.current = null;
                rememberRewardedUnavailable();
                sendRewardGateEvent('reward_ad_unavailable', buildEventParams({ reason: 'slot_empty' }));
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

            // スロット初期定義
            const slot = googletag.defineOutOfPageSlot(
                AD_UNIT_PATH,
                googletag.enums.OutOfPageFormat.REWARDED
            );

            if (!slot) {
                console.log('[useRewardedAd] Rewarded ads not supported. Using direct content fallback.');
                resolvedRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsSupported(false);
                setIsReady(true);
                setIsLoading(false);
                setUnavailableReason('slot_not_supported');
                makeVisibleRef.current = null;
                rememberRewardedUnavailable();
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
    const showAd = useCallback((context?: RewardedAdContext | string): boolean => {
        const normalizedContext: RewardedAdContext | undefined = typeof context === 'string'
            ? { race_id: context }
            : context;

        pendingRaceIdRef.current = normalizedContext?.race_id;
        pendingContextRef.current = normalizedContext ?? null;
        rewardGrantedRef.current = false;
        sendRewardGateEvent('reward_ad_requested', {
            ...normalizedContext,
            ad_unit_path: AD_UNIT_PATH,
        });

        if (makeVisibleRef.current) {
            const visible = makeVisibleRef.current();
            if (visible === false) {
                setUnavailableReason('make_rewarded_visible_failed');
                sendRewardGateEvent('reward_ad_unavailable', {
                    ...normalizedContext,
                    ad_unit_path: AD_UNIT_PATH,
                    reason: 'make_rewarded_visible_failed',
                });
                return false;
            }
            sendRewardGateEvent('reward_ad_started', {
                ...normalizedContext,
                ad_unit_path: AD_UNIT_PATH,
                result: 'started',
            });
            return true;
        }
        sendRewardGateEvent('reward_ad_unavailable', {
            ...normalizedContext,
            ad_unit_path: AD_UNIT_PATH,
            reason: 'make_rewarded_visible_missing',
        });
        setUnavailableReason('make_rewarded_visible_missing');
        return false;
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

    return { isUnlocked, isRaceUnlocked, isReady, isLoading, isSupported, unavailableReason, showAd, unlock };
}
