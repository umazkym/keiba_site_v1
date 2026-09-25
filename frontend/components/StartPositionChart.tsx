'use client';

import { HorsePrediction } from '@/lib/types';
import { getWakuClasses } from '@/lib/waku';
import { getPositionLabels, resolveWaku, type PositionLabel } from '@/lib/race-display';

// 展開予測：先行・中団・後方の3段に馬番を置き、段の中は序盤の位置取りの指標で左（後ろ）から右（前）へ並べる。
// 見本（ポートフォリオの lanesCard）と同じ形。以前は8段に「馬番の順の余り」で割り当てていたため、
// 同じ段で位置の近い馬が重なっていた（園田1Rで10番が2番を隠す。2026-09-25 スマホの見直し）。
// 重なりは、段の中に小さな段を足して避ける。幅は画面ごとに変わるため、狭い幅（スマホは320px、PCは2列の片側）で
// 重ならない配置を先に決め、横の位置は割合で置く（広い画面では間が広がるだけで重ならない）。

const LANES: PositionLabel[] = ['先行', '中団', '後方'];

type LaneLayout = {
    lane: PositionLabel;
    rows: number;
    horses: Array<{ horse: HorsePrediction; ratio: number; row: number }>;
};

type TrackSpec = {
    // 配置を決めるときの、馬番を置ける横幅（px）。この幅で重ならなければ、それより広い画面でも重ならない
    usableWidth: number;
    marker: number;
    gap: number;
};

const MOBILE: TrackSpec = { usableWidth: 186, marker: 24, gap: 6 };
const DESKTOP: TrackSpec = { usableWidth: 302, marker: 26, gap: 6 };

const buildLaneLayouts = (predictions: HorsePrediction[], spec: TrackSpec): LaneLayout[] => {
    const valid = predictions.filter((p) => p.start_1c_indicator != null);
    const scores = valid.map((p) => p.start_1c_indicator as number);
    const min = Math.min(...scores);
    const range = Math.max(...scores) - min;
    const positions = getPositionLabels(valid);
    const step = spec.marker + spec.gap;

    return LANES.map((lane) => {
        const inLane = valid
            .filter((p) => positions.get(p.horse_number) === lane)
            .map((horse) => ({ horse, x: (range > 0.01 ? ((horse.start_1c_indicator as number) - min) / range : 0.5) * spec.usableWidth }))
            .sort((a, b) => a.x - b.x);
        // rowEnds[k]：小さな段 k に最後に置いた馬の位置
        const rowEnds: number[] = [];
        const placed = inLane.map(({ horse, x }) => {
            let row = rowEnds.findIndex((end) => end + step <= x);
            let placedX = x;
            if (row < 0) {
                const nearest = rowEnds.length > 0 ? rowEnds.indexOf(Math.min(...rowEnds)) : -1;
                const pushed = nearest >= 0 ? rowEnds[nearest] + step : x;
                if (rowEnds.length < 3 || pushed > spec.usableWidth) {
                    row = rowEnds.length;
                    rowEnds.push(-Infinity);
                } else {
                    row = nearest;
                    placedX = Math.max(x, pushed);
                }
            }
            rowEnds[row] = placedX;
            return { horse, ratio: Math.min(1, placedX / spec.usableWidth), row };
        });
        return { lane, rows: Math.max(1, rowEnds.length), horses: placed };
    });
};

const LaneTrack = ({
    layouts,
    marker,
    labelWidth,
    runnerCount,
    aiTopNumbers,
    className,
}: {
    layouts: LaneLayout[];
    marker: number;
    labelWidth: number;
    runnerCount: number;
    aiTopNumbers: Set<number>;
    className: string;
}) => {
    // 小さな段の高さ。琥珀の輪（外側に約3.5px）が上下の馬番に触れないよう、馬番の大きさ＋6px にする
    const rowHeight = marker + 6;
    return (
        <div className={className}>
            <div className="overflow-hidden rounded-xl bg-turf-soft">
                {layouts.map(({ lane, rows, horses }) => (
                    <div
                        key={lane}
                        className="relative border-b border-turf/20"
                        style={{ height: rows * rowHeight + 8 }}
                    >
                        <span className="absolute inset-y-0 left-2.5 flex items-center text-[12.5px] font-bold text-turf-deep md:text-[13.5px]">
                            {lane}
                        </span>
                        {horses.map(({ horse, ratio, row }) => {
                            const scoreLabel = horse.start_1c_indicator?.toFixed(1) ?? '算出なし';
                            return (
                                <span
                                    key={horse.horse_number}
                                    className={`absolute flex items-center justify-center rounded-full border-[1.5px] font-num font-bold leading-none ${aiTopNumbers.has(horse.horse_number) ? 'ring-[2.5px] ring-ai ring-offset-1 ring-offset-turf-soft' : ''} ${getWakuClasses(resolveWaku(horse, runnerCount))}`}
                                    style={{
                                        width: marker,
                                        height: marker,
                                        fontSize: Math.round(marker * 0.52),
                                        top: 4 + row * rowHeight + 3,
                                        left: `calc(${labelWidth}px + (100% - ${labelWidth + marker + 8}px) * ${ratio.toFixed(4)})`,
                                    }}
                                    title={`${horse.horse_name} / 位置取りの指標 ${scoreLabel}`}
                                    aria-hidden="true"
                                >
                                    {horse.horse_number}
                                </span>
                            );
                        })}
                    </div>
                ))}
                <p className="flex items-center justify-end gap-1 px-2.5 py-1 text-[12px] font-bold text-turf-deep md:text-[13px]" aria-hidden="true">
                    進行方向<span>→</span>
                </p>
            </div>
        </div>
    );
};

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    const validPredictions = predictions?.filter((prediction) => prediction.start_1c_indicator != null) ?? [];
    if (validPredictions.length === 0) {
        return (
            <div className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">
                このレースの展開/脚質予測はありません。
            </div>
        );
    }

    // AI偏差値の上位3頭に琥珀の輪を付ける
    const aiTopNumbers = new Set(
        [...predictions]
            .filter((prediction) => prediction.deviation_score != null)
            .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))
            .slice(0, 3)
            .map((prediction) => prediction.horse_number),
    );
    const runnerCount = predictions.length;
    const mobileLayouts = buildLaneLayouts(validPredictions, MOBILE);
    const desktopLayouts = buildLaneLayouts(validPredictions, DESKTOP);
    const summary = LANES.map((lane) => {
        const numbers = mobileLayouts.find((layout) => layout.lane === lane)?.horses
            .map(({ horse }) => `${horse.horse_number}番${horse.horse_name}`) ?? [];
        return `${lane}：${numbers.length > 0 ? numbers.join('、') : 'なし'}`;
    });

    return (
        <div role="img" aria-label={`序盤（1コーナー）の位置取りの予測。${summary.join('。')}`}>
            <LaneTrack
                layouts={mobileLayouts}
                marker={MOBILE.marker}
                labelWidth={40}
                runnerCount={runnerCount}
                aiTopNumbers={aiTopNumbers}
                className="md:hidden"
            />
            <LaneTrack
                layouts={desktopLayouts}
                marker={DESKTOP.marker}
                labelWidth={64}
                runnerCount={runnerCount}
                aiTopNumbers={aiTopNumbers}
                className="hidden md:block"
            />
        </div>
    );
};
