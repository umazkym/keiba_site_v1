import {
    ChartColumn,
    ChartLine,
    Gauge,
    Swords,
    type LucideIcon,
} from 'lucide-react';
import { LineIcon, type LineIconName } from '@/components/LineIcon';

export type RaceAnalysisFeatureTone = 'blue' | 'indigo' | 'emerald' | 'amber';
export type RaceAnalysisFeatureVisualType = 'score' | 'matchup' | 'pace' | 'frame';

export type RaceAnalysisFeature = {
    key: 'prediction' | 'matchup' | 'start' | 'frame';
    title: string;
    compactTitle: string;
    description: string;
    icon: LucideIcon;
    // レース内のナビで使う線アイコン（ポートフォリオと同じ形）
    lineIcon: LineIconName;
    tone: RaceAnalysisFeatureTone;
    visual: RaceAnalysisFeatureVisualType;
    targetIds: string[];
};

type RaceAnalysisValueGridProps = {
    className?: string;
    // full：明るいカード（スマホ2列・PC4列）／bar：PCのヒーロー下の帯／compact：記事冒頭の4列
    // strip：スマホ〜タブレットのヒーロー下の1行（小図と名前だけ。2026-09-26 縦の高さの見直し）
    variant?: 'full' | 'bar' | 'compact' | 'strip';
};

export const raceAnalysisFeatures: readonly RaceAnalysisFeature[] = [
    {
        key: 'prediction',
        title: 'AI偏差値',
        compactTitle: 'AI偏差値',
        description: '馬の能力をAIで可視化',
        icon: Gauge,
        lineIcon: 'gauge',
        tone: 'blue',
        visual: 'score',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
    },
    {
        key: 'matchup',
        title: '対戦成績',
        // ナビ・記事の案内・レース画面の見出しで同じ名前にする（以前は「対戦比較」「馬番傾向」と見出しと違っていた）
        compactTitle: '対戦成績',
        description: '過去の直接対決を比較',
        icon: Swords,
        lineIcon: 'swords',
        tone: 'indigo',
        visual: 'matchup',
        targetIds: ['race-matchup-heading', 'race-matchup-section'],
    },
    {
        key: 'start',
        title: '展開予測',
        compactTitle: '展開予測',
        description: '序盤の位置取りを予測',
        icon: ChartLine,
        lineIcon: 'lanes',
        tone: 'emerald',
        visual: 'pace',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
    },
    {
        key: 'frame',
        // 中身は馬番ごとの過去データなので「馬番」と書く
        title: '馬番の傾向',
        compactTitle: '馬番の傾向',
        description: 'コース別の馬番の有利・不利',
        icon: ChartColumn,
        lineIcon: 'bars',
        tone: 'amber',
        visual: 'frame',
        targetIds: ['race-frame-heading'],
    },
];

// 主要4視点より下へ進んだ後に、最後の「馬番の傾向」を選択中のままにしないための監視用項目。
// 描画するナビ項目は raceAnalysisFeatures の4件だけに限定する。
export const raceAnalysisSectionTrackingItems = [
    ...raceAnalysisFeatures,
    {
        key: 'after-core-analysis',
        targetIds: ['race-analysis-heading', 'race-analysis-section'],
    },
];

const toneClasses: Record<RaceAnalysisFeatureTone, string> = {
    blue: 'bg-brand-50 text-brand-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
};

export function RaceAnalysisFeatureIcon({
    feature,
    variant = 'compact',
}: {
    feature: RaceAnalysisFeature;
    variant?: 'compact' | 'full';
}) {
    const Icon = feature.icon;
    const isCompact = variant === 'compact';

    return (
        <span
            className={`flex shrink-0 items-center justify-center ${toneClasses[feature.tone]} ${isCompact ? 'h-4 w-4 rounded-sm' : 'h-6 w-6 rounded-md'}`}
            aria-hidden="true"
        >
            <Icon className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
        </span>
    );
}

// 4つの視点の小さな図。ポートフォリオの miniGraphic（lib.mjs、64×26）と同じ形。
// 大きさは置き場所の枠（高さ）で決め、横は比率のまま（ホームのカード・PCの帯・記事の案内で共通。2026-09-25 スマホの見直し）
const WAKU_BARS = [14, 20, 17, 11, 9, 13, 7, 5];

export function RaceAnalysisFeatureVisual({ type }: { type: RaceAnalysisFeatureVisualType }) {
    return (
        <svg
            viewBox="0 0 64 26"
            preserveAspectRatio="xMinYMid meet"
            className="block h-full w-auto max-w-full"
            aria-hidden="true"
            focusable="false"
        >
            {type === 'score' && (
                <>
                    <rect x="0" y="3" width="56" height="5" rx="2.5" className="fill-ai" />
                    <rect x="0" y="11" width="44" height="5" rx="2.5" className="fill-brand-600" />
                    <rect x="0" y="19" width="30" height="5" rx="2.5" className="fill-slate-300" />
                </>
            )}
            {type === 'matchup' && (
                <>
                    <rect x="0" y="4" width="19" height="18" rx="4" className="fill-turf-soft" />
                    <rect x="22" y="4" width="19" height="18" rx="4" className="fill-slate-100" />
                    <rect x="44" y="4" width="19" height="18" rx="4" className="fill-rose-100" />
                    <text x="9.5" y="17" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-turf-deep font-num">+2</text>
                    <text x="31.5" y="17" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-slate-500 font-num">0</text>
                    <text x="53.5" y="17" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-rose-700 font-num">-1</text>
                </>
            )}
            {type === 'pace' && (
                <>
                    <path d="M2 5h60M2 13h60M2 21h60" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-slate-200" />
                    <circle cx="50" cy="5" r="3.6" className="fill-brand-600" />
                    <circle cx="40" cy="5" r="3.6" className="fill-navy" />
                    <circle cx="30" cy="13" r="3.6" className="fill-navy" />
                    <circle cx="14" cy="21" r="3.6" className="fill-navy" />
                </>
            )}
            {type === 'frame' && WAKU_BARS.map((value, index) => (
                <rect
                    key={index}
                    x={index * 8}
                    y={24 - value}
                    width="6"
                    height={value}
                    rx="1.5"
                    className={index < 3 ? 'fill-brand-600' : 'fill-slate-300'}
                />
            ))}
        </svg>
    );
}

export function RaceAnalysisValueGrid({ className = '', variant = 'full' }: RaceAnalysisValueGridProps) {
    if (variant === 'compact') {
        return (
            <ul
                className={`grid w-full grid-cols-4 divide-x divide-slate-200 ${className}`}
                aria-label="UMA-FREEで確認できる4つの分析"
            >
                {raceAnalysisFeatures.map((feature) => {
                    return (
                        <li key={feature.title} className="flex min-w-0 flex-col px-1.5 first:pl-0 last:pr-0">
                            <div className="mb-1 flex min-w-0 flex-col items-center justify-center gap-0.5">
                                <RaceAnalysisFeatureIcon feature={feature} />
                                <span className="max-w-full whitespace-nowrap text-[10px] font-black leading-none tracking-[-0.02em] text-slate-900">
                                    {feature.compactTitle}
                                </span>
                            </div>
                            <div className="flex h-5 w-full items-center justify-center rounded bg-white px-1">
                                <RaceAnalysisFeatureVisual type={feature.visual} />
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    }

    if (variant === 'strip') {
        return (
            <ul className={`grid w-full grid-cols-4 gap-1 ${className}`} aria-label="UMA-FREEで確認できる4つの分析">
                {raceAnalysisFeatures.map((feature) => (
                    <li key={feature.title} className="flex min-w-0 flex-col items-center gap-1.5">
                        <span className="flex h-[22px] w-14 items-center justify-center"><RaceAnalysisFeatureVisual type={feature.visual} /></span>
                        <span className="max-w-full whitespace-nowrap text-[12px] font-bold leading-none text-slate-900">{feature.title}</span>
                    </li>
                ))}
            </ul>
        );
    }

    if (variant === 'bar') {
        return (
            <div className={`flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-elevated ${className}`}>
                <p className="whitespace-nowrap text-[13px] font-bold leading-snug text-slate-500">4つの視点で<br />全レースを分析</p>
                <ul className="grid min-w-0 flex-1 grid-cols-4 gap-2.5" aria-label="UMA-FREEで確認できる4つの分析">
                    {raceAnalysisFeatures.map((feature) => (
                        <li key={feature.title} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2">
                            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700" aria-hidden="true">
                                <LineIcon name={feature.lineIcon} size={17} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="min-w-0 break-words text-[13.5px] font-bold text-slate-900">{feature.title}</span>
                                <span className="flex h-[22px] w-16 items-center"><RaceAnalysisFeatureVisual type={feature.visual} /></span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <ul
            className={`grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 ${className}`}
            aria-label="UMA-FREEで確認できる4つの分析"
        >
            {raceAnalysisFeatures.map((feature) => (
                <li
                    key={feature.title}
                    className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left max-[359px]:p-2.5 md:px-3.5 md:pb-3 md:pt-3.5"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700" aria-hidden="true">
                            <LineIcon name={feature.lineIcon} size={17} />
                        </span>
                        <span className="min-w-0 break-words text-[13.5px] font-bold text-slate-900 md:text-[14.5px]">{feature.title}</span>
                    </span>
                    <span className="hidden text-[12px] leading-normal text-slate-500 md:block">{feature.description}</span>
                    <span className="flex h-[26px] w-16 items-center">
                        <RaceAnalysisFeatureVisual type={feature.visual} />
                    </span>
                </li>
            ))}
        </ul>
    );
}
