'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { HorseNumberAdvantage } from '@/lib/types';

type Props = {
    advantages: HorseNumberAdvantage[];
    courseType: string | null;
    distance: number | null;
};

export const HorseNumberAdvantageChart: React.FC<Props> = ({ advantages, courseType, distance }) => {
    if (!advantages || advantages.length === 0) {
        return (
            <div className="my-4 p-4 bg-white border rounded-lg shadow-inner text-center text-gray-500">
                <p className="font-semibold">コース別・馬番有利不利</p>
                <p className="mt-2 text-sm">このレース条件での馬番有利不利データはありません。</p>
            </div>
        );
    }

    const sortedData = [...advantages].sort((a, b) => a.horse_number - b.horse_number);
    const scores = sortedData.map(d => d.advantage_score);
    const maxAbsScore = Math.max(...scores.map(s => Math.abs(s)), 0.5);

    const getBarColor = (score: number) => {
        const alpha = Math.min(1, 0.2 + (Math.abs(score) / maxAbsScore) * 0.8);
        if (score > 0) {
            return `rgba(52, 211, 153, ${alpha})`; // 有利 (エメラルドグリーン系)
        } else if (score < 0) {
            return `rgba(239, 68, 68, ${alpha})`; // 不利 (赤系)
        }
        return `rgba(161, 161, 170, ${alpha})`; // 中間 (グレー系)
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg text-sm">
                    <p className="font-bold text-gray-800">{`馬番: ${label}`}</p>
                    <p className={`font-semibold ${data.advantage_score > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {`有利不利指数: ${data.advantage_score.toFixed(3)}`}
                    </p>
                </div>
            );
        }
        return null;
    };

    const chartTitle = `コース別・馬番有利不利 (${courseType || ''}${distance || ''}m)`;
    const yAxisDomain = [
        Math.floor((Math.min(...scores) - 0.1) * 10) / 10,
        Math.ceil((Math.max(...scores) + 0.1) * 10) / 10
    ];

    return (
        <div className="my-4 p-4 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-4 text-gray-700">{chartTitle}</h4>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedData}
                        margin={{ top: 20, right: 20, left: -15, bottom: 5 }}
                        barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                            dataKey="horse_number" 
                            interval="preserveStartEnd"
                            fontSize={12} 
                            tick={{ fill: '#4A5568' }} 
                            stroke="#d1d5db"
                        />
                        <YAxis
                            allowDecimals={true}
                            tickFormatter={(tick) => tick.toFixed(1)}
                            fontSize={12}
                            tick={{ fill: '#4A5568' }}
                            stroke="#d1d5db"
                            domain={yAxisDomain}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(229, 231, 235, 0.5)' }} />
                        <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" />
                        <Bar dataKey="advantage_score" radius={[4, 4, 0, 0]}>
                            {sortedData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={getBarColor(entry.advantage_score)}
                                />
                            ))}
                            {/* ★★★ 修正箇所 ★★★ */}
                            {/* formatterの引数の型をanyに変更し、内部で数値に変換してから比較することで型エラーを解消 */}
                            <LabelList 
                                dataKey="advantage_score" 
                                position="top" 
                                formatter={(value: any) => {
                                    const numValue = Number(value);
                                    if (numValue > 0.15) return '▲';
                                    if (numValue < -0.15) return '▼';
                                    return '';
                                }}
                                fontSize={12}
                                fill="#374151"
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1 px-4">
                <span style={{ color: 'rgba(239, 68, 68, 0.8)' }}>■ 不利 ▼</span>
                <span style={{ color: 'rgba(52, 211, 153, 0.8)' }}>▲ 有利 ■</span>
            </div>
        </div>
    );
};