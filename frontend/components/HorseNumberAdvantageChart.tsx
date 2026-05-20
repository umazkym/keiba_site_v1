'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { HorseNumberAdvantage } from '@/lib/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type Props = {
    advantages: HorseNumberAdvantage[];
    courseType: string | null;
    distance: number | null;
};

export const HorseNumberAdvantageChart: React.FC<Props> = ({ advantages, courseType, distance }) => {
    const isMobile = useMediaQuery('(max-width: 767px)');

    if (!advantages || advantages.length === 0) {
        return (
            <div className="my-4 p-4 bg-gray-50 border rounded-lg text-center text-gray-500 text-sm">
                <p>データ不足のため表示できません</p>
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
                    dy={isMobile ? 8 : 4}
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

    const chartTitle = `このコースの枠順傾向 (${courseType || ''}${distance || ''}m)`;

    // レスポンシブ設定
    // 高さ削減: 320 -> 180 (gap排除のため大幅圧縮)
    const chartHeight = isMobile ? 180 : 300;
    const chartMargin = isMobile
        ? { top: 10, right: 0, left: 0, bottom: 0 }
        : { top: 30, right: 15, left: 10, bottom: 35 };
    const xAxisFontSize = isMobile ? 10 : 13;
    const labelFontSize = isMobile ? 9 : 10;

    return (
        // パディング・背景削除 (フラット化)
        <div className="my-4 md:p-4 md:bg-white md:border md:rounded-lg md:shadow-inner h-full flex flex-col justify-center">
            <h4 className="font-bold text-center mb-1 text-gray-700 text-sm md:text-base md:mb-2">{chartTitle}</h4>
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
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            // ラベル削除（馬番表記をなくす）
                            height={isMobile ? 20 : 50}
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
                                formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value}
                                fill="#374151"
                                fontSize={labelFontSize}
                                fontWeight={600}
                                offset={isMobile ? 5 : 3}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs md:text-sm text-gray-700 mt-1 font-medium">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.9)' }}></span>
                    <span>有利</span>
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}></span>
                    <span>不利</span>
                </span>
            </div>
        </div>
    );
};
