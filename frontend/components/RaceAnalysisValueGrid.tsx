import {
    ChartColumn,
    ChartLine,
    Gauge,
    Swords,
    type LucideIcon,
} from 'lucide-react';

export type RaceAnalysisFeatureTone = 'blue' | 'indigo' | 'emerald' | 'amber';
export type RaceAnalysisFeatureVisualType = 'score' | 'matchup' | 'pace' | 'frame';

export type RaceAnalysisFeature = {
    key: 'prediction' | 'matchup' | 'start' | 'frame';
    title: string;
    compactTitle: string;
    description: string;
    icon: LucideIcon;
    tone: RaceAnalysisFeatureTone;
    visual: RaceAnalysisFeatureVisualType;
    targetIds: string[];
};

type RaceAnalysisValueGridProps = {
    className?: string;
    variant?: 'full' | 'compact';
};

export const raceAnalysisFeatures: readonly RaceAnalysisFeature[] = [
    {
        key: 'prediction',
        title: 'AI偏差値',
        compactTitle: 'AI偏差値',
        description: '馬の能力をAIで可視化',
        icon: Gauge,
        tone: 'blue',
        visual: 'score',
        targetIds: ['race-prediction-heading', 'race-prediction-section'],
    },
    {
        key: 'matchup',
        title: '対戦成績',
        compactTitle: '対戦比較',
        description: '過去の直接対決を比較',
        icon: Swords,
        tone: 'indigo',
        visual: 'matchup',
        targetIds: ['race-matchup-heading', 'race-matchup-section'],
    },
    {
        key: 'start',
        title: '展開・脚質',
        compactTitle: '展開・脚質',
        description: '序盤の位置取りを予測',
        icon: ChartLine,
        tone: 'emerald',
        visual: 'pace',
        targetIds: ['race-detail-heading', 'race-detail-data-section'],
    },
    {
        key: 'frame',
        title: '枠順傾向',
        compactTitle: '枠順傾向',
        description: 'コース別の枠順を分析',
        icon: ChartColumn,
        tone: 'amber',
        visual: 'frame',
        targetIds: ['race-frame-heading'],
    },
];

// 主要4視点より下へ進んだ後に、最後の「枠順傾向」を選択中のままにしないための監視用項目。
// 描画するナビ項目は raceAnalysisFeatures の4件だけに限定する。
export const raceAnalysisSectionTrackingItems = [
    ...raceAnalysisFeatures,
    {
        key: 'after-core-analysis',
        targetIds: ['race-analysis-heading', 'race-analysis-section'],
    },
];

const toneClasses: Record<RaceAnalysisFeatureTone, string> = {
    blue: 'bg-blue-50 text-blue-700',
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
            className={`flex shrink-0 items-center justify-center ${toneClasses[feature.tone]} ${isCompact ? 'h-4 w-4 rounded-sm' : 'h-7 w-7 rounded-md'}`}
            aria-hidden="true"
        >
            <Icon className={isCompact ? 'h-2.5 w-2.5' : 'h-4 w-4'} />
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
                <span className={`block w-[88%] rounded-full bg-blue-600 ${compact ? 'h-1' : 'h-1.5'}`} />
                <span className={`block w-[64%] rounded-full bg-amber-400 ${compact ? 'h-1' : 'h-1.5'}`} />
                <span className={`block w-[72%] rounded-full bg-slate-300 ${compact ? 'h-1' : 'h-1.5'}`} />
            </div>
        );
    }

    if (type === 'matchup') {
        const values = compact ? ['+2', '0', '-1'] : ['+2', '0', '-1', '0', '+1', '0'];
        return (
            <div className={`grid w-full grid-cols-3 text-center font-bold ${compact ? 'gap-0.5 text-[9px]' : 'gap-1 text-[10px]'}`} aria-hidden="true">
                {values.map((value, index) => {
                    const valueClass = value.startsWith('+')
                        ? 'bg-emerald-50 text-emerald-700'
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
    const barClass = type === 'pace' ? 'bg-emerald-500' : 'bg-blue-500';

    return (
        <div className={`flex w-full items-end ${compact ? 'h-5 gap-0.5' : 'h-7 gap-1'}`} aria-hidden="true">
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
                            <div className="flex h-6 w-full items-center justify-center rounded bg-white px-1">
                                <RaceAnalysisFeatureVisual type={feature.visual} compact />
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <ul
            className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 ${className}`}
            aria-label="UMA-FREEで確認できる4つの分析"
        >
            {raceAnalysisFeatures.map((feature) => {
                return (
                    <li
                        key={feature.title}
                        className="flex min-w-0 flex-col justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-left"
                    >
                        <div className="mb-2 flex min-w-0 items-center gap-2">
                            <RaceAnalysisFeatureIcon feature={feature} variant="full" />
                            <span className="min-w-0">
                                <span className="block truncate text-xs font-black leading-tight text-slate-950">
                                    {feature.title}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-slate-600">
                                    {feature.description}
                                </span>
                            </span>
                        </div>
                        <div className="flex h-11 w-full items-center justify-center rounded-md bg-slate-50 p-2">
                            <RaceAnalysisFeatureVisual type={feature.visual} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
