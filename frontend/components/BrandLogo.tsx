import { BRAND_COLORS, LOGO_DOTS, LOGO_OUTER, LOGO_STROKES, LOGO_STROKE_WIDTH, LOGO_VIEWBOX } from '@/lib/brand';

type BrandMarkProps = {
    size: number;
    // 32px以下は内側の線を省き、輪郭を太くした小さい版を使う
    variant?: 'auto' | 'full' | 'small';
    className?: string;
};

export function BrandMark({ size, variant = 'auto', className }: BrandMarkProps) {
    const small = variant === 'small' || (variant === 'auto' && size <= 32);
    const strokeWidth = small ? 54 : LOGO_STROKE_WIDTH;
    return (
        <svg
            width={size}
            height={size}
            viewBox={LOGO_VIEWBOX}
            aria-hidden="true"
            focusable="false"
            // 表示の切り替え（hidden sm:block など）は className で行うため、display は指定しない
            className={className ?? 'block'}
            style={{ flexShrink: 0 }}
        >
            <circle cx="512" cy="512" r="405" fill={BRAND_COLORS.brand} />
            <path d={LOGO_OUTER} fill="#FFFFFF" stroke={BRAND_COLORS.navy} strokeWidth={strokeWidth} strokeLinejoin="round" />
            {!small && LOGO_STROKES.map((d) => (
                <path key={d.slice(0, 16)} d={d} fill="none" stroke={BRAND_COLORS.navy} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {LOGO_DOTS.map((dot) => (
                <ellipse key={dot.cx} cx={dot.cx} cy={dot.cy} rx={dot.rx} ry={dot.ry} fill={BRAND_COLORS.navy} />
            ))}
        </svg>
    );
}

type BrandLockupProps = {
    size?: number;
    tagline?: string;
    tone?: 'default' | 'inverse';
    className?: string;
};

// マーク＋「UMA-FREE」。文字の大きさはマークの0.56倍、タグラインは0.26倍を基準にする
export function BrandLockup({ size = 40, tagline, tone = 'default', className = '' }: BrandLockupProps) {
    const inverse = tone === 'inverse';
    return (
        <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.28) }}>
            <BrandMark size={size} />
            <span className="flex flex-col leading-none" style={{ gap: Math.round(size * 0.12) }}>
                <span
                    className={`font-brand font-extrabold whitespace-nowrap ${inverse ? 'text-white' : 'text-navy'}`}
                    style={{ fontSize: Math.round(size * 0.56), letterSpacing: '0.01em' }}
                >
                    UMA-FREE
                </span>
                {tagline ? (
                    <span
                        className={`font-medium whitespace-nowrap ${inverse ? 'text-night-sub' : 'text-slate-500'}`}
                        style={{ fontSize: Math.max(11, Math.round(size * 0.27)) }}
                    >
                        {tagline}
                    </span>
                ) : null}
            </span>
        </span>
    );
}

type GuideHorseMood = 'normal' | 'sleep' | 'look' | 'lost';

type GuideHorseProps = {
    size: number;
    // normal: 案内 / sleep: 開催なし / look: 探している・読み込み / lost: 404・エラー
    mood?: GuideHorseMood;
    className?: string;
};

// 案内役の馬。ロゴの馬を淡いインディゴの円に置き、目と小物で表情を変える。
// 空の状態・404・エラー・ガイドだけに使い、分析画面には出さない（DESIGN.md）。
export function GuideHorse({ size, mood = 'normal', className }: GuideHorseProps) {
    const [eye, nostril] = LOGO_DOTS;
    const width = LOGO_STROKE_WIDTH;
    const navy = BRAND_COLORS.navy;
    return (
        <svg
            width={size}
            height={size}
            viewBox={LOGO_VIEWBOX}
            aria-hidden="true"
            focusable="false"
            className={className ?? 'block'}
            style={{ flexShrink: 0, overflow: 'visible' }}
        >
            <circle cx="512" cy="512" r="405" fill={BRAND_COLORS.brandTint} />
            <path d={LOGO_OUTER} fill="#FFFFFF" stroke={navy} strokeWidth={width} strokeLinejoin="round" />
            {LOGO_STROKES.map((d) => (
                <path key={d.slice(0, 16)} d={d} fill="none" stroke={navy} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {mood === 'sleep' && (
                <path
                    d={`M${eye.cx - 30} ${eye.cy - 2}C${eye.cx - 14} ${eye.cy + 18} ${eye.cx + 14} ${eye.cy + 18} ${eye.cx + 30} ${eye.cy - 2}`}
                    fill="none"
                    stroke={navy}
                    strokeWidth={width * 0.8}
                    strokeLinecap="round"
                />
            )}
            {mood === 'look' && <ellipse cx={eye.cx + 6} cy={eye.cy - 14} rx={eye.rx} ry={eye.ry} fill={navy} />}
            {mood === 'lost' && (
                <>
                    <ellipse cx={eye.cx} cy={eye.cy} rx={eye.rx + 10} ry={eye.ry + 10} fill="#FFFFFF" stroke={navy} strokeWidth={width * 0.6} />
                    <ellipse cx={eye.cx + 4} cy={eye.cy + 2} rx={eye.rx * 0.55} ry={eye.ry * 0.55} fill={navy} />
                </>
            )}
            {mood === 'normal' && <ellipse cx={eye.cx} cy={eye.cy} rx={eye.rx} ry={eye.ry} fill={navy} />}
            <ellipse cx={nostril.cx} cy={nostril.cy} rx={nostril.rx} ry={nostril.ry} fill={navy} />
            {mood === 'look' && (
                <>
                    <circle cx="760" cy="250" r="18" fill={BRAND_COLORS.brandSoft} />
                    <circle cx="815" cy="200" r="26" fill={BRAND_COLORS.brandSoft} />
                    <circle cx="880" cy="140" r="36" fill={BRAND_COLORS.brandSoft} />
                </>
            )}
            {mood === 'sleep' && (
                <>
                    <path d="M770 175h62l-62 75h62" fill="none" stroke={BRAND_COLORS.brand} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M850 110h40l-40 48h40" fill="none" stroke={BRAND_COLORS.brand} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
                </>
            )}
            {mood === 'lost' && (
                <>
                    <path d="M790 230c0-40 60-40 60 0 0 30-30 30-30 60" fill="none" stroke={BRAND_COLORS.brand} strokeWidth="26" strokeLinecap="round" />
                    <circle cx="820" cy="350" r="15" fill={BRAND_COLORS.brand} />
                </>
            )}
        </svg>
    );
}
