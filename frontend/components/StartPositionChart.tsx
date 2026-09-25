'use client';

import { HorsePrediction } from '@/lib/types';
import { getWakuClasses } from '@/lib/waku';
import { getPositionLabels, resolveWaku, type PositionLabel } from '@/lib/race-display';

// 展開予測：先行・中団・後方の3段に、その段の馬を馬番の小さい順に左から並べ、段ごとに横の中央へそろえる。
// AI偏差値の上位3頭に琥珀の輪。2026-09-26 利用者の指定（「各段を横方向中央寄せ」「左から小さい数字」。向きを示す文字は出さない）。
// 以前は段の中の横の位置を位置取りの指標で決めていたが、近い馬が重なり、段を増やして縦に伸びていた。YouTube の動画も同じ並べ方にする。

const LANES: PositionLabel[] = ['先行', '中団', '後方'];

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
    const positions = getPositionLabels(validPredictions);
    const lanes = LANES.map((lane) => ({
        lane,
        horses: validPredictions
            .filter((horse) => positions.get(horse.horse_number) === lane)
            .sort((a, b) => a.horse_number - b.horse_number),
    }));
    const summary = lanes.map(({ lane, horses }) => `${lane}：${horses.length > 0 ? horses.map((horse) => `${horse.horse_number}番${horse.horse_name}`).join('、') : 'なし'}`);

    return (
        <div role="img" aria-label={`序盤（1コーナー）の位置取りの予測。${summary.join('。')}`} className="overflow-hidden rounded-xl bg-turf-soft">
            {lanes.map(({ lane, horses }) => (
                <div key={lane} className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center border-b border-turf/20 py-2 last:border-b-0 md:grid-cols-[64px_minmax(0,1fr)_64px]">
                    <span className="pl-2.5 text-[12.5px] font-bold text-turf-deep md:text-[13.5px]">{lane}</span>
                    <span className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2" aria-hidden="true">
                        {horses.length === 0 && <span className="text-[12px] text-turf-deep/60">—</span>}
                        {horses.map((horse) => (
                            <span
                                key={horse.horse_number}
                                className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] font-num text-[12.5px] font-bold leading-none md:h-[26px] md:w-[26px] md:text-[13.5px] ${aiTopNumbers.has(horse.horse_number) ? 'ring-[2.5px] ring-ai ring-offset-1 ring-offset-turf-soft' : ''} ${getWakuClasses(resolveWaku(horse, runnerCount))}`}
                                title={horse.horse_name}
                            >
                                {horse.horse_number}
                            </span>
                        ))}
                    </span>
                    <span aria-hidden="true" />
                </div>
            ))}
        </div>
    );
};
