'use client';

import { useEffect, useState, type RefObject } from 'react';

// 追従する帯が画面の上に止まっているか。帯の直前に置いた目印が、固定ヘッダーの下端より上へ出たら止まっている。
// レース選択の帯は、止まったときだけレース名の要約の行を出す（止まる前は、すぐ上のレースの見出しと同じ内容のため。2026-09-26）。
export function useStickyStuck(sentinelRef: RefObject<HTMLElement | null>) {
    const [stuck, setStuck] = useState(false);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const sentinel = sentinelRef.current;
            if (!sentinel) return;
            const header = document.querySelector<HTMLElement>('[data-site-header]');
            const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
            setStuck(sentinel.getBoundingClientRect().top <= headerBottom + 0.5);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [sentinelRef]);

    return stuck;
}
