// 線のアイコン。ロゴの線に合わせて角を丸め、線幅2（24px基準）で描く。
// デザイン改修ポートフォリオ（.local/design-portfolio/src/lib.mjs の P）から
// .local/design-portfolio/impl/gen_line_icons.mjs で書き出したもの。形を変えるときは元を直して書き出し直す。
import type { ReactElement, SVGProps } from 'react';

const PATHS = {
    home: <><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    race: <><path d="M4 18c2.5-6 6-9 10.5-9.5L18 6l1.5 3.5L17 12c-1 3.5-4 5.5-8 6" /><circle cx="17.2" cy="8.4" r=".6" /></>,
    list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.6" cy="6.5" r="1.1" /><circle cx="4.6" cy="12" r="1.1" /><circle cx="4.6" cy="17.5" r="1.1" /></>,
    chart: <><path d="M4 20h16" /><path d="M7 16.5V11M12 16.5V5.5M17 16.5V8.5" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    chevL: <><path d="M14.5 5.5 8 12l6.5 6.5" /></>,
    chevR: <><path d="M9.5 5.5 16 12l-6.5 6.5" /></>,
    chevD: <><path d="M6.5 9.5 12 15l5.5-5.5" /></>,
    chevU: <><path d="M6.5 14.5 12 9l5.5 5.5" /></>,
    arrowR: <><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
    book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
    database: <><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.4" /><circle cx="12" cy="16.8" r=".5" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".5" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    bookmark: <><path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" /></>,
    compare: <><path d="M8 4v16M16 4v16" /><path d="M4.5 8 8 4l3.5 4M12.5 16l3.5 4 3.5-4" /></>,
    trophy: <><path d="M8 4.5h8v5a4 4 0 0 1-8 0z" /><path d="M8 6.2H5a3 3 0 0 0 3.2 3.8M16 6.2h3a3 3 0 0 1-3.2 3.8M12 13.5V17M8.5 20h7M9.6 17h4.8" /></>,
    flag: <><path d="M5.5 21V4.2" /><path d="M5.5 4.6h11.5l-2.4 3.8 2.4 3.8H5.5" /></>,
    ticket: <><path d="M3.6 7h16.8v3a2 2 0 0 0 0 4v3H3.6v-3a2 2 0 0 0 0-4z" /><path d="M14.2 7.4v9.2" strokeDasharray="1.6 2" /></>,
    gauge: <><path d="M4.5 16a7.5 7.5 0 1 1 15 0" /><path d="m12 16 3.5-4.5" /></>,
    swords: <><path d="m4 4 9 9M20 4l-9 9M6.5 15.5l2 2M17.5 15.5l-2 2M4.5 19.5l3-3M19.5 19.5l-3-3" /></>,
    lanes: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="15" cy="7" r="1.6" /><circle cx="10" cy="12" r="1.6" /><circle cx="6.5" cy="17" r="1.6" /></>,
    bars: <><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="7" rx=".8" /><rect x="10.5" y="7" width="3" height="11" rx=".8" /><rect x="15.5" y="13" width="3" height="5" rx=".8" /></>,
    refresh: <><path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2" /><path d="M19.4 4.6v4h-4" /></>,
    user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.6 20.5c1.4-3.6 4.2-5.4 7.4-5.4s6 1.8 7.4 5.4" /></>,
    pin: <><path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
    mail: <><rect x="3.6" y="5.5" width="16.8" height="13" rx="2.4" /><path d="m4.4 7.2 7.6 5.6 7.6-5.6" /></>,
} satisfies Record<string, ReactElement>;

export type LineIconName = keyof typeof PATHS;

type LineIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
    name: LineIconName;
    size?: number;
};

export function LineIcon({ name, size = 20, strokeWidth = 2, className, ...rest }: LineIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={className ?? 'block shrink-0'}
            {...rest}
        >
            {PATHS[name]}
        </svg>
    );
}
