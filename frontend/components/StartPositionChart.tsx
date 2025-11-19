'use client';
import { HorsePrediction } from "@/lib/types";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const getWakuColor = (waku: number | null): string => {
    switch (waku) {
        case 1: return 'border-gray-300 bg-white text-gray-800';
        case 2: return 'border-gray-800 bg-gray-800 text-white';
        case 3: return 'border-red-500 bg-red-500 text-white';
        case 4: return 'border-blue-600 bg-blue-600 text-white';
        case 5: return 'border-yellow-400 bg-yellow-400 text-black';
        case 6: return 'border-green-500 bg-green-500 text-white';
        case 7: return 'border-orange-400 bg-orange-400 text-white';
        case 8: return 'border-pink-400 bg-pink-400 text-white';
        default: return 'border-gray-300 bg-gray-100 text-gray-800';
    }
};

const HorseMarker = ({ horse, position, isMobile, markerSpacing }: { horse: HorsePrediction, position: number, isMobile: boolean, markerSpacing: number }) => (
    <Tippy content={
        <div className="text-sm">
            <div className="font-bold">{horse.horse_name}</div>
            <div>スコア: {horse.start_1c_indicator?.toFixed(1) || 'N/A'}</div>
        </div>
    } placement="top">
        <div
            className="absolute transition-all duration-500 ease-out flex flex-col items-center cursor-pointer hover:z-50 hover:transform hover:scale-110"
            style={{
                top: `${20 + (horse.horse_number - 1) * markerSpacing}px`,
                left: `${position}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10 + horse.horse_number,
            }}
        >
            <div className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center font-bold ${isMobile ? 'text-[10px]' : 'text-xs'} shadow-sm border ${getWakuColor(horse.waku_number)}`}>
                {horse.horse_number}
            </div>
            <span className={`font-bold text-gray-700 whitespace-nowrap ${isMobile ? 'text-[9px] mt-0.5 px-0.5 py-0.5 rounded' : 'text-[11px] mt-px px-1 rounded'}`} style={{ lineHeight: 1 }}>
                {horse.horse_name.substring(0, 3)}
            </span>
        </div>
    </Tippy>
);

export const StartPositionChart = ({ predictions }: { predictions: HorsePrediction[] }) => {
    if (!predictions || predictions.length === 0 || predictions.every(p => p.start_1c_indicator === null)) {
        return (
            <div className="my-4 p-4 md:p-6 bg-gray-50 border rounded-lg shadow-inner text-center text-gray-500">
                <p className="font-medium text-sm">このレースの脚質パターン予測はありません。</p>
            </div>
        );
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const validPredictions = predictions.filter(p => p.start_1c_indicator !== null);
    const scores = validPredictions.map(p => p.start_1c_indicator!);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    const sortedByNumber = [...predictions].sort((a, b) => a.horse_number - b.horse_number);

    const markerSpacing = isMobile ? 14 : 20;
    const containerHeight = Math.max((sortedByNumber.length - 1) * markerSpacing + 60, isMobile ? 140 : 150);

    return (
        <div className="p-3 md:p-4 bg-white">
            <h4 className="text-xs md:text-sm font-bold text-gray-600 mb-2 md:mb-3 flex items-center">
            </h4>
            <div className="relative w-full bg-gray-50 rounded-lg shadow-sm overflow-hidden"
                style={{ height: `${containerHeight}px` }}>
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
                            isMobile={isMobile}
                            markerSpacing={markerSpacing}
                        />
                    );
                })}
            </div>
            <div className="flex justify-between text-xs md:text-sm text-gray-600 mt-2 md:mt-3 px-2 font-medium">
                <span className="flex items-center"><span className="mr-1"></span><span className="hidden md:inline">後方・差し</span><span className="md:hidden">後</span></span>
                <span className="hidden md:inline">中団</span><span className="md:hidden">中</span>
                <span className="flex items-center"><span className="hidden md:inline">先行・逃げ</span><span className="md:hidden">先</span><span className="ml-1"></span></span>
            </div>
        </div>
    );
};