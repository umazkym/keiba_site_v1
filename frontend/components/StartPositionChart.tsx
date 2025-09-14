'use client';

import { HorsePrediction } from "@/lib/types";

const getWakuColor = (waku: number | null): string => {
    switch (waku) {
        case 1: return 'border-gray-400 bg-white text-black';
        case 2: return 'border-gray-800 bg-black text-white';
        case 3: return 'border-red-600 bg-red-500 text-white';
        case 4: return 'border-blue-700 bg-blue-600 text-white';
        case 5: return 'border-yellow-500 bg-yellow-400 text-black';
        case 6: return 'border-green-600 bg-green-500 text-white';
        case 7: return 'border-orange-500 bg-orange-400 text-white';
        case 8: return 'border-pink-500 bg-pink-400 text-white';
        default: return 'border-gray-400 bg-gray-300 text-black';
    }
};

const HorseMarker = ({ horse, position }: { horse: HorsePrediction, position: number }) => (
    <div
        className="absolute transition-all duration-500 ease-out flex flex-col items-center"
        style={{
            // ▼▼▼▼▼ ここを修正 ▼▼▼▼▼
            top: `${20 + (horse.horse_number - 1) * 15}px`,
            // ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲
            left: `${position}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10 + horse.horse_number,
        }}
    >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${getWakuColor(horse.waku_number)}`}>
            {horse.horse_number}
        </div>
        <span className="text-[10px] font-bold text-gray-600 whitespace-nowrap mt-px" style={{ lineHeight: 1 }}>
            {horse.horse_name.substring(0, 3)}
        </span>
    </div>
);

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    if (!predictions || predictions.length === 0 || predictions.every(p => p.start_1c_indicator === null)) {
        return (
             <div className="my-4 p-4 bg-white border rounded-lg shadow-inner text-center text-gray-500">
                <p>このレースのAIスタート位置取り予測データはありません。</p>
            </div>
        );
    }

    const validPredictions = predictions.filter(p => p.start_1c_indicator !== null);
    const scores = validPredictions.map(p => p.start_1c_indicator!);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;

    const sortedByNumber = [...predictions].sort((a, b) => a.horse_number - b.horse_number);

    return (
        <div className="my-2 p-4 bg-white border rounded-lg shadow-inner">
            {/* ▼▼▼▼▼ ここを修正 ▼▼▼▼▼ */}
            <div className="relative w-full bg-green-100 rounded" style={{ height: `${(sortedByNumber.length - 1) * 15 + 40}px` }}>
            {/* ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲ */}
                <div className="absolute top-0 bottom-0 left-0 w-[33.3%] bg-yellow-100/50 rounded-l"></div>
                <div className="absolute top-0 bottom-0 left-[33.3%] w-[33.3%] bg-blue-100/50"></div>
                <div className="absolute top-0 bottom-0 left-[66.6%] w-[33.3%] bg-red-100/50 rounded-r"></div>

                <div className="absolute top-0 bottom-0 left-[33.3%] border-l border-dashed border-gray-400/50"></div>
                <div className="absolute top-0 bottom-0 left-[66.6%] border-l border-dashed border-gray-400/50"></div>

                {sortedByNumber.map(horse => {
                    let position = 50;
                    if (horse.start_1c_indicator !== null && scoreRange > 0.01) {
                        position = 5 + ((horse.start_1c_indicator - minScore) / scoreRange) * 90;
                    }
                    return (
                        <HorseMarker
                            key={horse.horse_number}
                            horse={horse}
                            position={position}
                        />
                    );
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>後方・差し</span>
                <span>中団</span>
                <span>先行・逃げ</span>
            </div>
        </div>
    );
};