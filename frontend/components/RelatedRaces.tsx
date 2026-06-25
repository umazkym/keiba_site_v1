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
        // 現在見ているレースの日付（UTCではなくローカル日付として扱う）
        const [year, month, day] = currentDate.split('-').map(Number);

        // 初期HTMLとブラウザ側で同じ結果になるよう、現在時刻には依存させない。
        // 閲覧中の日付を基準に前後のアーカイブ導線を生成する。
        const maxDate = new Date(year, month - 1, day);
        maxDate.setDate(maxDate.getDate() + 1);
        const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;

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
        <div className="mt-2 sm:mt-8 p-2.5 sm:p-6 bg-blue-50/50 rounded-xl border border-blue-100">
            <h3 className="text-sm sm:text-lg font-bold text-gray-800 mb-2 sm:mb-4 flex items-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                他の日付の分析もチェック
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {relatedDates.map(date => {
                    const [y, m, d] = date.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    // const isPast = dateObj < current;
                    // const isFuture = dateObj > current;

                    return (
                        <Link
                            key={date}
                            href={`/races/${date}`}
                            prefetch={false}
                            className="group relative bg-white p-2 sm:p-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300"
                        >
                            <div className="font-bold text-sm sm:text-base text-gray-800 group-hover:text-blue-600">
                                {m}月{d}日 ({['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})
                            </div>
                            <div className="absolute top-2 right-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                →
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div className="mt-2.5 sm:mt-5 text-center">
                <Link
                    href="/"
                    className="inline-flex items-center justify-center bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 font-bold py-2 sm:py-2.5 px-6 rounded-lg shadow-sm w-full sm:w-auto transition-colors text-xs sm:text-base"
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
