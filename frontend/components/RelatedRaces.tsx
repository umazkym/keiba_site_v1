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

    return (
        <section className="race-related-dates-panel race-panel mt-2 bg-blue-50/40 p-0 sm:mt-3 sm:p-4">
            <h3 className="race-section-heading mb-2">他の日付の分析もチェック</h3>

            <div className="grid grid-cols-3 gap-1.5 px-2 pb-2 sm:gap-3 sm:p-0">
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
                            className="group flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-center transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50"
                        >
                            <span className="whitespace-nowrap text-[11px] font-black text-slate-700 group-hover:text-blue-700 sm:text-sm">
                                {m}/{d}（{['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]}）
                            </span>
                        </Link>
                    );
                })}
            </div>

        </section>
    );
};
