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
    
    // ★ここを修正: 配列をコピーしてからソート
    const sortedAdvantages = [...advantages].sort((a, b) => a.horse_number - b.horse_number);
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

    const CustomXAxisTick = ({ x, y, payload }: any) => {
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={0}
                    dy={isMobile ? 12 : 4}
                    textAnchor="middle"
                    fill="#4a5568"
                    fontSize={xAxisFontSize}
                    fontWeight={500}
                    transform={isMobile ? "rotate(0)" : "rotate(0)"}
                    style={{ transformOrigin: "0 0" }}
                >
                    {payload.value}
                </text>
            </g>
        );
    };
    
    const chartTitle = `枠順傾向スコア (${courseType || ''}${distance || ''}m)`;

    // レスポンシブ設定
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const chartHeight = isMobile ? 300 : 280;
    const chartMargin = isMobile
        ? { top: 20, right: 10, left: 5, bottom: 80 }
        : { top: 20, right: 15, left: 10, bottom: 35 };
    const xAxisFontSize = isMobile ? 12 : 13;
    const labelFontSize = isMobile ? 10 : 11;

    return (
        <div className="my-4 p-3 md:p-4 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-3 text-gray-700 text-sm md:text-base">{chartTitle}</h4>
            <div style={{ width: '100%', height: chartHeight }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedAdvantages}
                        margin={chartMargin}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                        <XAxis
                            dataKey="horse_number"
                            tick={<CustomXAxisTick />}
                            axisLine={{ stroke: '#9ca3af' }}
                            tickLine={{ stroke: '#9ca3af' }}
                            interval={0}
                            label={{ value: '馬番', position: 'insideBottom', offset: isMobile ? -20 : -8, fill: '#4a5568', fontSize: isMobile ? 11 : 12, fontWeight: 500 }}
                            height={isMobile ? 80 : 50}
                        />
                        <YAxis hide domain={yAxisDomain} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                        <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} />
                        <Bar dataKey="advantage_score" radius={[4, 4, 0, 0]}>
                            {sortedAdvantages.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.advantage_score)} />
                            ))}
                            <LabelList
                                dataKey="advantage_score"
                                position="top"
                                formatter={(value: any) => typeof value === 'number' ? value.toFixed(3) : value}
                                fill="#374151"
                                fontSize={labelFontSize}
                                fontWeight={600}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs md:text-sm text-gray-700 mt-3 font-medium">
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.9)' }}></span>
                    <span>有利</span>
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}></span>
                    <span>不利</span>
                </span>
            </div>
        </div>
    );
};