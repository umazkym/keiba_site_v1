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
    variant?: 'full' | 'bar' | 'compact';
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

export function RaceAnalysisFeatureVisual({
    type,
    compact = false,
}: {
    type: RaceAnalysisFeatureVisualType;
    compact?: boolean;
}) {
    if (type === 'score') {
        return (
            <div className={`w-full ${compact ? 'space-y-0.5' : 'space-y-1'}`} aria-hidden="true">
                <span className={`block w-[88%] rounded-full bg-brand-600 ${compact ? 'h-0.5' : 'h-1.5'}`} />
                <span className={`block w-[64%] rounded-full bg-ai ${compact ? 'h-0.5' : 'h-1.5'}`} />
                <span className={`block w-[72%] rounded-full bg-slate-300 ${compact ? 'h-0.5' : 'h-1.5'}`} />
            </div>
        );
    }

    if (type === 'matchup') {
        const values = compact ? ['+2', '0', '-1'] : ['+2', '0', '-1', '0', '+1', '0'];
        return (
            <div className={`grid w-full ${compact ? 'grid-cols-3 gap-0.5 text-[8px]' : 'grid-cols-3 sm:grid-cols-6 gap-0.5 text-[9px]'} text-center font-bold`} aria-hidden="true">
                {values.map((value, index) => {
                    const valueClass = value.startsWith('+')
                        ? 'bg-turf-soft text-turf-deep'
                        : value.startsWith('-')
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600';
                    return (
                        <span key={`${value}-${index}`} className={`rounded py-0.5 ${valueClass}`}>
                            {value}
                        </span>
                    );
                })}
            </div>
        );
    }

    const heights = type === 'pace' ? ['54%', '76%', '38%', '64%'] : ['82%', '42%', '66%', '36%'];
    const barClass = type === 'pace' ? 'bg-turf' : 'bg-brand-500';

    return (
        <div className={`flex w-full items-end ${compact ? 'h-4 gap-0.5' : 'h-6 sm:h-7 gap-1'}`} aria-hidden="true">
            {heights.map((height, index) => (
                <span
                    key={`${type}-${index}`}
                    className={`flex-1 rounded-t ${barClass}`}
                    style={{ height }}
                />
            ))}
        </div>
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
                                <RaceAnalysisFeatureVisual type={feature.visual} compact />
                            </div>
                        </li>
                    );
                })}
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
                                <span className="truncate text-[13.5px] font-bold text-slate-900">{feature.title}</span>
                                <span className="flex h-5 w-16 items-center"><RaceAnalysisFeatureVisual type={feature.visual} compact /></span>
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
                    className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left md:px-3.5 md:pb-3 md:pt-3.5"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700" aria-hidden="true">
                            <LineIcon name={feature.lineIcon} size={17} />
                        </span>
                        <span className="truncate text-[13.5px] font-bold text-slate-900 md:text-[14.5px]">{feature.title}</span>
                    </span>
                    <span className="hidden text-[12px] leading-normal text-slate-500 md:block">{feature.description}</span>
                    <span className="flex h-6 w-16 items-center">
                        <RaceAnalysisFeatureVisual type={feature.visual} compact />
                    </span>
                </li>
            ))}
        </ul>
    );
}
