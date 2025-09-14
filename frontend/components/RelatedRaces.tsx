// frontend/components/RelatedRaces.tsx
'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { RacePrediction } from '@/lib/types';

interface RelatedRacesProps {
    currentRace: RacePrediction;
    currentDate: string;
}

export const RelatedRaces = ({ currentRace, currentDate }: RelatedRacesProps) => {
    const relatedDates = useMemo(() => {
        // 現在の日付（JST）を取得
        const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        today.setHours(0, 0, 0, 0);
        
        // 現在見ているレースの日付（UTCではなくローカル日付として扱う）
        const [year, month, day] = currentDate.split('-').map(Number);
        
        // データ取得可能な最大日付（明日まで）
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 1);
        const maxDateStr = maxDate.toISOString().split('T')[0];
        
        const dates: string[] = [];
        
        // 現在の日付より前の2日分
        for (let i = -2; i <= -1; i++) {
            const date = new Date(year, month - 1, day);
            date.setDate(date.getDate() + i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            // 2024年以降のデータのみ表示
            if (date.getFullYear() >= 2024) {
                dates.push(dateStr);
            }
        }
        
        // 現在の日付より後の日付（最大で明日まで）
        for (let i = 1; i <= 2; i++) {
            const date = new Date(year, month - 1, day);
            date.setDate(date.getDate() + i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            // データが存在する可能性のある日付のみ追加
            if (dateStr <= maxDateStr) {
                dates.push(dateStr);
            }
        }
        
        // 日付が3つになるように調整
        if (dates.length < 3) {
            let additionalDaysBack = 3;
            while (dates.length < 3 && additionalDaysBack <= 7) {
                const date = new Date(year, month - 1, day);
                date.setDate(date.getDate() - additionalDaysBack);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (date.getFullYear() >= 2024 && !dates.includes(dateStr)) {
                    dates.unshift(dateStr);
                }
                additionalDaysBack++;
            }
        }
        
        // 日付順にソート
        dates.sort();
        
        // 最大3つまでに制限
        return dates.slice(0, 3);
    }, [currentDate]);

    if (relatedDates.length === 0) {
        return null;
    }

    const [year, month, day] = currentDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);

    return (
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                他の日付の予測もチェック
            </h3>
            
            {/* ▼▼▼▼▼ ここを修正 ▼▼▼▼▼ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲ */}
                {relatedDates.map(date => {
                    const [y, m, d] = date.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const isPast = dateObj < current;
                    const isFuture = dateObj > current;
                    
                    return (
                        <Link
                            key={date}
                            href={`/races/${date}`}
                            className="group relative bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300"
                        >
                            <div className="text-xs text-gray-500 mb-1">
                                {isPast ? '過去のレース' : isFuture ? '今後のレース' : 'レース'}
                            </div>
                            <div className="font-bold text-gray-800 group-hover:text-blue-600">
                                {m}月{d}日 ({['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})
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
                    トップページに戻る
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
};