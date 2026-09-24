// JRAの枠の色（1〜8枠）。出走表・対戦表・展開図・R番号で同じ色を使う。
// ブランドの色（インディゴ・紺）とは意味が違うため、tailwind の waku-* だけで塗る。
const WAKU_CLASSES: Record<number, string> = {
    1: 'border-waku-1-border bg-waku-1 text-waku-1-fg',
    2: 'border-waku-2 bg-waku-2 text-white',
    3: 'border-waku-3 bg-waku-3 text-white',
    4: 'border-waku-4 bg-waku-4 text-white',
    5: 'border-waku-5-border bg-waku-5 text-waku-5-fg',
    6: 'border-waku-6 bg-waku-6 text-white',
    7: 'border-waku-7 bg-waku-7 text-white',
    8: 'border-waku-8 bg-waku-8 text-white',
};
const WAKU_UNKNOWN = 'border-slate-300 bg-slate-200 text-slate-900';

export const getWakuClasses = (waku: number | null | undefined): string => (
    waku && WAKU_CLASSES[waku] ? WAKU_CLASSES[waku] : WAKU_UNKNOWN
);
