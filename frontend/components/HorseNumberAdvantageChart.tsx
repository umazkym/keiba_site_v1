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
                <p className="font-semibold">枠順傾向スコア</p>
                <p className="mt-2 text-sm">このレース条件での枠順傾向データはありません。</p>
            </div>
        );
    }

    // 0点を基準に有利・不利で色を分ける
    const getBarColor = (value: number) => {
        if (value > 0) return 'rgba(52, 211, 153, 0.8)'; // Green for advantage
        if (value < 0) return 'rgba(239, 68, 68, 0.8)'; // Red for disadvantage
        return 'rgba(156, 163, 175, 0.8)'; // Gray for neutral
    };

    // データを馬番順にソート (馬番は1から8、またはそれ以上)
    const sortedAdvantages = advantages.sort((a, b) => a.horse_number - b.horse_number);

    // Y軸の表示範囲を動的に調整
    const scores = sortedAdvantages.map(item => item.advantage_score);
    const yAxisDomain = [
      Math.floor((Math.min(...scores) - 0.1) * 10) / 10, // 最小値より少し下
      Math.ceil((Math.max(...scores) + 0.1) * 10) / 10   // 最大値より少し上
    ];

    // カスタムツールチップ
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border rounded-lg shadow-lg text-sm text-gray-800">
                    <p className="font-bold mb-1">{`馬番: ${data.horse_number}`}</p>
                    <p>{`スコア: ${data.advantage_score.toFixed(2)}`}</p>
                    <p className="text-xs text-gray-600 mt-1">※スコアが高いほど有利</p>
                </div>
            );
        }
        return null;
    };

    const chartTitle = `枠順傾向スコア (${courseType || ''}${distance || ''}m)`;

    return (
        <div className="my-4 p-4 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-4 text-gray-700">{chartTitle}</h4>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedAdvantages}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                        <XAxis
                            dataKey="horse_number"
                            tick={{ fill: '#4a5568', fontSize: 12 }}
                            axisLine={{ stroke: '#ccc' }}
                            tickLine={{ stroke: '#ccc' }}
                            label={{ value: '馬番', position: 'insideBottom', offset: 0, fill: '#4a5568' }}
                        />
                        <YAxis
                            domain={yAxisDomain}
                            tick={{ fill: '#4a5568', fontSize: 12 }}
                            axisLine={{ stroke: '#ccc' }}
                            tickLine={{ stroke: '#ccc' }}
                            label={{ value: '有利不利スコア', angle: -90, position: 'insideLeft', offset: -10, fill: '#4a5568' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(230, 230, 230, 0.4)' }} />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        <Bar dataKey="advantage_score">
                            {sortedAdvantages.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.advantage_score)} />
                            ))}
                            {/* スコア値をバーの上に表示 */}
                            <LabelList
                                dataKey="advantage_score"
                                position="top"
                                formatter={(value: number) => value.toFixed(2)}
                                fill="#4a5568"
                                fontSize={12}
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