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
            <div className="my-4 p-6 bg-gradient-to-r from-gray-50 to-white border rounded-lg shadow-inner text-center text-gray-500">
                <p className="font-bold text-base">枠順傾向スコア</p>
                <p className="mt-2 text-sm">このレース条件での枠順傾向データはありません。</p>
            </div>
        );
    }
    
    const getBarColor = (value: number) => {
        if (value > 0.05) return 'rgba(34, 197, 94, 0.9)'; // 明確に有利
        if (value > 0) return 'rgba(134, 239, 172, 0.8)'; // やや有利
        if (value < -0.05) return 'rgba(239, 68, 68, 0.9)'; // 明確に不利
        if (value < 0) return 'rgba(252, 165, 165, 0.8)'; // やや不利
        return 'rgba(156, 163, 175, 0.8)'; // ニュートラル
    };
    
    const sortedAdvantages = advantages.sort((a, b) => a.horse_number - b.horse_number);
    const scores = sortedAdvantages.map(item => item.advantage_score);
    const yAxisDomain = [
        Math.floor((Math.min(...scores, -0.1) - 0.05) * 20) / 20,
        Math.ceil((Math.max(...scores, 0.1) + 0.05) * 20) / 20
    ];
    
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const interpretation = data.advantage_score > 0.05 ? "有利" : 
                                   data.advantage_score < -0.05 ? "不利" : "平均的";
            return (
                <div className="bg-white p-3 border rounded-lg shadow-lg text-sm text-gray-800">
                    <p className="font-bold mb-1">{`馬番 ${data.horse_number}番`}</p>
                    <p>{`スコア: ${data.advantage_score.toFixed(3)}`}</p>
                    <p className="text-xs text-gray-600 mt-1">判定: {interpretation}</p>
                </div>
            );
        }
        return null;
    };
    
    const chartTitle = `枠順傾向スコア (${courseType || ''}${distance || ''}m)`;
    
    return (
        <div className="my-4 p-6 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-4 text-gray-700 text-base">{chartTitle}</h4>
            <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedAdvantages}
                        margin={{ top: 20, right: 30, left: 30, bottom: 25 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                        <XAxis
                            dataKey="horse_number"
                            tick={{ fill: '#4a5568', fontSize: 13 }}
                            axisLine={{ stroke: '#9ca3af' }}
                            tickLine={{ stroke: '#9ca3af' }}
                            label={{ value: '馬番', position: 'insideBottom', offset: -5, fill: '#4a5568', fontSize: 14 }}
                        />
                        <YAxis
                            domain={yAxisDomain}
                            tick={{ fill: '#4a5568', fontSize: 13 }}
                            axisLine={{ stroke: '#9ca3af' }}
                            tickLine={{ stroke: '#9ca3af' }}
                            label={{ value: '有利不利スコア', angle: -90, position: 'insideLeft', offset: 10, fill: '#4a5568', fontSize: 14 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                        <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" />
                        <Bar dataKey="advantage_score" radius={[4, 4, 0, 0]}>
                            {sortedAdvantages.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.advantage_score)} />
                            ))}
                            <LabelList
                                dataKey="advantage_score"
                                position="top"
                                formatter={(value: any) => typeof value === 'number' ? value.toFixed(3) : value}
                                fill="#374151"
                                fontSize={11}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-3 px-4 font-medium">
                <span className="flex items-center">
                    <span className="w-3 h-3 rounded mr-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}></span>
                    不利
                </span>
                <span className="flex items-center">
                    <span className="w-3 h-3 rounded mr-1" style={{ backgroundColor: 'rgba(156, 163, 175, 0.8)' }}></span>
                    平均
                </span>
                <span className="flex items-center">
                    <span className="w-3 h-3 rounded mr-1" style={{ backgroundColor: 'rgba(34, 197, 94, 0.9)' }}></span>
                    有利
                </span>
            </div>
        </div>
    );
};