// frontend/components/RelatedRaces.tsx
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { RacePrediction } from '@/lib/types';

interface RelatedRacesProps {
    currentRace: RacePrediction;
    currentDate: string;
}

export const RelatedRaces = ({ currentRace, currentDate }: RelatedRacesProps) => {
    const [relatedDates, setRelatedDates] = useState<string[]>([]);

    useEffect(() => {
        // 前後3日分の日付を生成
        const dates: string[] = [];
        const current = new Date(currentDate + 'T00:00:00');
        
        for (let i = -3; i <= 3; i++) {
            if (i === 0) continue; // 現在の日付は除外
            const date = new Date(current);
            date.setDate(current.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        setRelatedDates(dates);
    }, [currentDate]);

    return (
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                他の日付の予測もチェック
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {relatedDates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const isPast = d < new Date(currentDate + 'T00:00:00');
                    
                    return (
                        <Link
                            key={date}
                            href={`/races/${date}`}
                            className="group relative bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300"
                        >
                            <div className="text-xs text-gray-500 mb-1">
                                {isPast ? '過去のレース' : '今後のレース'}
                            </div>
                            <div className="font-bold text-gray-800 group-hover:text-blue-600">
                                {(d.getMonth() + 1)}月{d.getDate()}日
                            </div>
                            <div className="text-xs text-gray-600">
                                ({['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})
                            </div>
                            <div className="absolute top-2 right-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                →
                            </div>
                        </Link>
                    );
                })}
            </div>
            
            <div className="mt-4 text-center">
                <Link
                    href="/"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                    トップページで今日の注目馬を見る
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
};