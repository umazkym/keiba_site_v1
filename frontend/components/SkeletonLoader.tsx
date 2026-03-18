import React from 'react';

// 個々のスケルトン要素
export const SkeletonBox = ({ className }: { className?: string }) => (
    <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
);

// レースセレクターのスケルトン
const RaceSelectorSkeleton = () => (
    <div className="flex flex-wrap gap-2 p-2 bg-white rounded-t-lg border-b">
        {[...Array(12)].map((_, i) => (
            <SkeletonBox key={i} className="w-12 h-8 rounded-full" />
        ))}
    </div>
);

// 予測テーブルのスケルトン
const PredictionTableSkeleton = () => (
    <div>
        <SkeletonBox className="h-10 w-48 mb-3 px-2" />
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="bg-gray-200 p-3 border-b border-gray-200">
                <SkeletonBox className="h-7 w-3/4 mb-2" />
                <SkeletonBox className="h-5 w-1/4" />
            </div>
            <div className="p-4 space-y-3">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                        <SkeletonBox className="w-8 h-8" />
                        <SkeletonBox className="w-10 h-8" />
                        <div className="flex-1 space-y-2">
                            <SkeletonBox className="h-4 w-3/4" />
                        </div>
                        <SkeletonBox className="w-16 h-8" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// 詳細情報（アコーディオン）のスケルトン
const DetailsSkeleton = ({ titleWidth = "w-64" }: { titleWidth?: string }) => (
    <div className="rounded-lg bg-gray-50 p-3">
        <div className="flex items-center">
            <SkeletonBox className={`h-8 ${titleWidth}`} />
            <div className="ml-auto">
                <SkeletonBox className="h-5 w-5" />
            </div>
        </div>
    </div>
);

// 会場別パネルのスケルトン
const VenuePanelSkeleton = () => (
    <div>
        <RaceSelectorSkeleton />
        <div className="mt-6 space-y-6">
            <PredictionTableSkeleton />
            <DetailsSkeleton titleWidth="w-1/2" />
            <DetailsSkeleton titleWidth="w-2/3" />
            <DetailsSkeleton titleWidth="w-3/4" />
        </div>
    </div>
);


// レースタブ全体のスケルトン (これをエクスポートする)
export const RaceTabsSkeleton = () => (
     <div className="mt-8">
        {/* JRA/NARのタブ */}
        <div className="flex border-b-2 border-gray-200 bg-gray-100 rounded-t-lg">
            <div className="flex-1 px-4 py-3 bg-white border-gray-200 border-b-white">
                <SkeletonBox className="h-6 w-24" />
            </div>
            <div className="flex-1 px-4 py-3">
                 <SkeletonBox className="h-6 w-24" />
            </div>
        </div>
        {/* 会場タブとコンテンツ */}
        <div className="p-4 md:p-6 bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-md">
            <div className="flex flex-wrap border-b border-gray-200 mb-6">
                {[...Array(4)].map((_, i) => (
                     <SkeletonBox key={i} className="h-10 w-20 mr-2 mb-2" />
                ))}
            </div>
            <VenuePanelSkeleton />
        </div>
    </div>
);