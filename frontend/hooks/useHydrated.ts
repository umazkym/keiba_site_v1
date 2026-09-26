'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// サーバーで作ったHTMLでは false、ブラウザで画面が動き出したら true。
// 楽天競馬（TrafficGate）のリンク先は true になってから入れる。HTMLのリンクを巡回ロボットがたどり、
// TrafficGate のクリックの約8割が FacebookBot などだった（2026-06〜09。人の操作は GA4 の affiliate_click で数える。2026-09-26）。
export function useHydrated() {
    return useSyncExternalStore(subscribe, () => true, () => false);
}
