'use client';
import { HorsePrediction } from "@/lib/types";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

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
    <Tippy content={
        <div className="text-sm">
            <div className="font-bold">{horse.horse_name}</div>
            <div>スコア: {horse.start_1c_indicator?.toFixed(1) || 'N/A'}</div>
        </div>
    } placement="top">
        <div
            className="absolute transition-all duration-500 ease-out flex flex-col items-center cursor-pointer hover:z-50 hover:transform hover:scale-110"
            style={{
                top: `${20 + (horse.horse_number - 1) * 20}px`,
                left: `${position}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10 + horse.horse_number,
            }}
        >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${getWakuColor(horse.waku_number)}`}>
                {horse.horse_number}
            </div>
            <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap mt-px bg-white/80 px-1 rounded" style={{ lineHeight: 1 }}>
                {horse.horse_name.substring(0, 4)}
            </span>
        </div>
    </Tippy>
);

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    if (!predictions || predictions.length === 0 || predictions.every(p => p.start_1c_indicator === null)) {
        return (
            <div className="my-4 p-6 bg-gradient-to-r from-gray-50 to-white border rounded-lg shadow-inner text-center text-gray-500">
                <p className="font-medium">このレースのAIスタート位置取り予測データはありません。</p>
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
        <div className="my-4 p-6 bg-white border rounded-lg shadow-inner">
            <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center">
                <span className="mr-2">🏁</span>
                AIスタート位置取り予測
            </h4>
            <div className="relative w-full bg-gradient-to-r from-blue-50 via-gray-50 to-yellow-50 rounded-lg shadow-sm" 
                 style={{ height: `${Math.max((sortedByNumber.length - 1) * 20 + 50, 120)}px` }}>
                <div className="absolute top-0 bottom-0 left-0 w-[33.3%] bg-blue-100/30 rounded-l-lg"></div>
                <div className="absolute top-0 bottom-0 left-[33.3%] w-[33.3%] bg-gray-100/30"></div>
                <div className="absolute top-0 bottom-0 left-[66.6%] w-[33.3%] bg-yellow-100/30 rounded-r-lg"></div>
                <div className="absolute top-0 bottom-0 left-[33.3%] border-l border-dashed border-gray-300"></div>
                <div className="absolute top-0 bottom-0 left-[66.6%] border-l border-dashed border-gray-300"></div>
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
            <div className="flex justify-between text-xs text-gray-600 mt-3 px-2 font-medium">
                <span className="flex items-center"><span className="mr-1">🐢</span>後方・差し</span>
                <span>中団</span>
                <span className="flex items-center">先行・逃げ<span className="ml-1">🏃</span></span>
            </div>
        </div>
    );
};