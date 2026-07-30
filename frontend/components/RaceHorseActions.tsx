'use client';

import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import type { HorsePrediction } from '@/lib/types';
import { DataFavoriteButton } from '@/components/DataFavoriteButton';
import { HorseCompareButton } from '@/components/HorseCompareButton';


export function RaceHorseActions({ predictions }: { predictions: HorsePrediction[] }) {
    if (predictions.length === 0) return null;
    return (
        <details className="border-t border-slate-200 bg-slate-50">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30">
                <span className="inline-flex items-center gap-2">
                    <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                    出走馬を保存・比較
                </span>
                <span className="text-xs text-slate-500">最大5頭</span>
            </summary>
            <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
                {predictions.map((horse) => (
                    <div key={horse.horse_id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                            prefetch={false}
                            href={`/horses/${encodeURIComponent(horse.horse_id)}`}
                            className="font-bold text-slate-900 transition-colors duration-150 hover:text-primary"
                        >
                            {horse.horse_number}番 {horse.horse_name}
                        </Link>
                        <div className="flex flex-wrap gap-2">
                            <DataFavoriteButton
                                entityType="horse"
                                entityId={horse.horse_id}
                                name={horse.horse_name}
                                subtitle="出走馬データ"
                                url={`/horses/${encodeURIComponent(horse.horse_id)}`}
                                compact
                            />
                            <HorseCompareButton
                                horseId={horse.horse_id}
                                horseName={horse.horse_name}
                                url={`/horses/${encodeURIComponent(horse.horse_id)}`}
                                compact
                            />
                        </div>
                    </div>
                ))}
            </div>
        </details>
    );
}
