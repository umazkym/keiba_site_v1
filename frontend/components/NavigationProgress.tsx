'use client';

// サイト内のリンクを押してからページが切り替わるまで、画面の上端に細い進行バーを出す（2026-10-02）。
// リンクは prefetch しないので、移る先が返るまで画面に反応が無く、「押したのに何も起きない」と数えられていた。
// 押してから 120ms たっても切り替わらないときだけ出し、切り替わったら右端まで伸ばして消す。
// 出していない間は何も描かない（レイアウトを動かさない）。外部リンク・別タブ・同じページ内の移動では出さない。
// useSearchParams を使うので、置く側（app/layout.tsx）で Suspense に包む。
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// idle：出していない／start：幅0で置いた直後／running：伸びている／static：動きを減らす設定で、伸ばさずに出している／done：右端まで伸ばして消えていく
type Phase = 'idle' | 'start' | 'running' | 'static' | 'done';

const SHOW_DELAY_MS = 120;
const GIVE_UP_MS = 8000;
const FILL_MS = 150;
const FADE_MS = 200;

// 最初は速く、あとは遅く。約70%で止まって待つ
const RUNNING_TRANSITION = 'transform 6000ms cubic-bezier(0.08, 0.8, 0.2, 1)';
const DONE_TRANSITION = `transform ${FILL_MS}ms ease-out, opacity ${FADE_MS}ms ease-out ${FILL_MS}ms`;

const prefersReducedMotion = () => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

// 押された物が「このサイトの別のページへ、同じタブで移るリンク」かどうか
const isInternalNavigationClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (!(event.target instanceof Element)) return false;

    const anchor = event.target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    if (anchor.hasAttribute('download')) return false;

    const target = anchor.getAttribute('target');
    if (target && target !== '_self') return false;

    const rawHref = anchor.getAttribute('href') ?? '';
    if (rawHref.startsWith('#') || /^(?:mailto|tel):/i.test(rawHref)) return false;

    let url: URL;
    try {
        url = new URL(anchor.href, window.location.href);
    } catch {
        return false;
    }
    // 外部（楽天競馬など）は別のサイトへ出るので対象にしない
    if (url.origin !== window.location.origin) return false;
    // 同じ URL・# だけの違いはページが切り替わらない
    return url.pathname !== window.location.pathname || url.search !== window.location.search;
};

export function NavigationProgress() {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const [phase, setPhase] = useState<Phase>('idle');
    // リスナーとタイマーからは、描画を待たずに今の段を読む
    const phaseRef = useRef<Phase>('idle');
    const pendingRef = useRef(false);
    const showTimer = useRef<number | null>(null);
    const giveUpTimer = useRef<number | null>(null);
    const hideTimer = useRef<number | null>(null);
    const frame = useRef<number | null>(null);

    const move = useCallback((next: Phase) => {
        if (phaseRef.current === next) return;
        phaseRef.current = next;
        setPhase(next);
    }, []);

    const clearPending = useCallback(() => {
        pendingRef.current = false;
        if (showTimer.current !== null) window.clearTimeout(showTimer.current);
        if (giveUpTimer.current !== null) window.clearTimeout(giveUpTimer.current);
        if (frame.current !== null) window.cancelAnimationFrame(frame.current);
        showTimer.current = null;
        giveUpTimer.current = null;
        frame.current = null;
    }, []);

    const clearHide = useCallback(() => {
        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
    }, []);

    // すぐ消す（8秒たっても切り替わらない・戻る／進むで前の画面が復元された）
    const stop = useCallback(() => {
        clearPending();
        clearHide();
        move('idle');
    }, [clearHide, clearPending, move]);

    // ページが切り替わった。出していれば右端まで伸ばしてから消す
    const finish = useCallback(() => {
        if (!pendingRef.current) return;
        clearPending();
        const current = phaseRef.current;
        if (current === 'idle') return;
        if (current === 'static') {
            move('idle');
            return;
        }
        move('done');
        hideTimer.current = window.setTimeout(() => {
            hideTimer.current = null;
            move('idle');
        }, FILL_MS + FADE_MS + 30);
    }, [clearPending, move]);

    const begin = useCallback(() => {
        // 続けて押したときは、打ち切りの時間だけ延ばす
        if (giveUpTimer.current !== null) window.clearTimeout(giveUpTimer.current);
        giveUpTimer.current = window.setTimeout(stop, GIVE_UP_MS);
        if (pendingRef.current) return;

        pendingRef.current = true;
        // 前のバーが消えていく途中なら、片付けてからやり直す
        clearHide();
        move('idle');
        // 速く切り替わるときは出さない（ちらつかせない）
        showTimer.current = window.setTimeout(() => {
            showTimer.current = null;
            if (!pendingRef.current) return;
            if (prefersReducedMotion()) {
                move('static');
                return;
            }
            move('start');
            // 幅0を一度描かせてから伸ばす（同じ描画の中で変えると、伸びる動きが出ない）
            frame.current = window.requestAnimationFrame(() => {
                frame.current = window.requestAnimationFrame(() => {
                    frame.current = null;
                    if (pendingRef.current) move('running');
                });
            });
        }, SHOW_DELAY_MS);
    }, [clearHide, move, stop]);

    // URL（パスか ? 以降）が変わったら終える
    useEffect(() => {
        finish();
    }, [pathname, search, finish]);

    useEffect(() => {
        // capture で受ける：Link の中の処理より先に、押された物を見る
        const onClick = (event: MouseEvent) => {
            if (isInternalNavigationClick(event)) begin();
        };
        const onPageShow = () => stop();
        document.addEventListener('click', onClick, true);
        window.addEventListener('pageshow', onPageShow);
        return () => {
            document.removeEventListener('click', onClick, true);
            window.removeEventListener('pageshow', onPageShow);
            clearPending();
            clearHide();
        };
    }, [begin, clearHide, clearPending, stop]);

    if (phase === 'idle') return null;

    const barStyle =
        phase === 'start'
            ? { transform: 'scaleX(0)', opacity: 1 }
            : phase === 'running'
                ? { transform: 'scaleX(0.7)', opacity: 1, transition: RUNNING_TRANSITION }
                : phase === 'static'
                    ? { transform: 'scaleX(1)', opacity: 1 }
                    : { transform: 'scaleX(1)', opacity: 0, transition: DONE_TRANSITION };

    return (
        // fixed にしない（自動広告が画面端の fixed 要素を見つけると、アンカー広告を出さない。ヘッダーと同じ理由）。
        // 高さ0の sticky の中に置くので、出ている間も下の物を動かさない
        <div aria-hidden="true" className="pointer-events-none sticky top-0 z-[2147483000] h-0 w-full">
            <div className="absolute left-0 top-0 h-[3px] w-full origin-left bg-brand-600" style={barStyle} />
        </div>
    );
}
