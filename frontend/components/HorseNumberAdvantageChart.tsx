'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HorseNumberAdvantage } from '@/lib/types';

type Props = {
    advantages: HorseNumberAdvantage[];
};

export const HorseNumberAdvantageChart: React.FC<Props> = ({ advantages }) => {
    if (!advantages || advantages.length === 0) {
        return (
            <div className="my-4 p-4 bg-white border rounded-lg shadow-inner text-center text-gray-500">
                <p>このレース条件での馬番有利不利データはありません。</p>
            </div>
        );
    }

    const sortedData = [...advantages].sort((a, b) => a.horse_number - b.horse_number);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
                    <p className="font-bold">{`馬番: ${label}`}</p>
                    <p className="text-sm">{`有利不利指数: ${payload[0].value.toFixed(3)}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="my-4 p-4 bg-white border rounded-lg shadow-inner">
            <h4 className="font-bold text-center mb-4 text-gray-700">コース別・馬番有利不利</h4>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="horse_number" interval={0} fontSize={12} tick={{ fill: '#4A5568' }} />
                        <YAxis 
                            allowDecimals={false} 
                            tickFormatter={(tick) => tick.toFixed(1)} 
                            fontSize={12}
                            tick={{ fill: '#4A5568' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(230, 230, 230, 0.5)' }} />
                        <Bar dataKey="advantage_score">
                            {sortedData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.advantage_score > 0 ? '#48BB78' : '#F56565'} 
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                <span className='text-red-500'>■ 不利</span>
                <span className='text-green-500'>有利 ■</span>
            </div>
        </div>
    );
};