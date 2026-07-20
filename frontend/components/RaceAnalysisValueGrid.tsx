import {
    ChartColumn,
    ChartLine,
    Gauge,
    Swords,
    type LucideIcon,
} from 'lucide-react';

type FeatureTone = 'blue' | 'indigo' | 'emerald' | 'amber';
type FeatureVisual = 'score' | 'matchup' | 'pace' | 'frame';

type AnalysisFeature = {
    title: string;
    description: string;
    icon: LucideIcon;
    tone: FeatureTone;
    visual: FeatureVisual;
};

type RaceAnalysisValueGridProps = {
    className?: string;
};

const features: AnalysisFeature[] = [
    {
        title: 'AI偏差値',
        description: '出走馬の能力をスコア化',
        icon: Gauge,
        tone: 'blue',
        visual: 'score',
    },
    {
        title: '対戦成績',
        description: '過去の直接対決を比較',
        icon: Swords,
        tone: 'indigo',
        visual: 'matchup',
    },
    {
        title: '展開・脚質',
        description: '序盤の位置取りを予測',
        icon: ChartLine,
        tone: 'emerald',
        visual: 'pace',
    },
    {
        title: '枠順傾向',
        description: 'コース別の枠順を分析',
        icon: ChartColumn,
        tone: 'amber',
        visual: 'frame',
    },
];

const toneClasses: Record<FeatureTone, string> = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
};

function FeatureVisual({ type }: { type: FeatureVisual }) {
    if (type === 'score') {
        return (
            <div className="w-full space-y-1" aria-hidden="true">
                <span className="block h-1.5 w-[88%] rounded-full bg-blue-600" />
                <span className="block h-1.5 w-[64%] rounded-full bg-amber-400" />
                <span className="block h-1.5 w-[72%] rounded-full bg-slate-300" />
            </div>
        );
    }

    if (type === 'matchup') {
        return (
            <div className="grid w-full grid-cols-3 gap-1 text-center text-[10px] font-bold" aria-hidden="true">
                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+2</span>
                <span className="rounded bg-slate-100 py-0.5 text-slate-600">0</span>
                <span className="rounded bg-rose-50 py-0.5 text-rose-700">-1</span>
                <span className="rounded bg-slate-100 py-0.5 text-slate-600">0</span>
                <span className="rounded bg-emerald-50 py-0.5 text-emerald-700">+1</span>
                <span className="rounded bg-slate-100 py-0.5 text-slate-600">0</span>
            </div>
        );
    }

    const heights = type === 'pace' ? ['54%', '76%', '38%', '64%'] : ['82%', '42%', '66%', '36%'];
    const barClass = type === 'pace' ? 'bg-emerald-500' : 'bg-blue-500';

    return (
        <div className="flex h-7 w-full items-end gap-1" aria-hidden="true">
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

export function RaceAnalysisValueGrid({ className = '' }: RaceAnalysisValueGridProps) {
    return (
        <ul
            className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 ${className}`}
            aria-label="UMA-FREEで確認できる4つの分析"
        >
            {features.map((feature) => {
                const Icon = feature.icon;
                return (
                    <li
                        key={feature.title}
                        className="flex min-w-0 flex-col justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-left"
                    >
                        <div className="mb-2 flex min-w-0 items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${toneClasses[feature.tone]}`}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
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
                            <FeatureVisual type={feature.visual} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
