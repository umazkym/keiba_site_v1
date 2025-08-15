'use client';

import { useState, useEffect } from 'react';
import { getSpecialPick } from '@/lib/api';
import { SpecialPick } from "@/lib/types";
import { SparklesIcon } from '@/components/icons';

// スケルトンコンポーネント
const Skeleton = () => (
    <div className="bg-gray-200 p-6 rounded-xl shadow-lg mb-6 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-gray-300 rounded w-2/3 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="mt-4 pt-4 border-t border-gray-300/50">
             <div className="h-4 bg-gray-300 rounded w-full"></div>
             <div className="h-4 bg-gray-300 rounded w-5/6 mt-2"></div>
        </div>
    </div>
);

// プロパティの型定義を修正
type Props = {
  pick?: SpecialPick | null; // サーバーサイドから渡されるデータ（オプショナル）
  date?: string;             // クライアントサイドでfetchする日付（オプショナル）
};

// コンポーネント定義を修正
export const SpecialPickCard = ({ pick: initialPick, date }: Props) => {
    // stateの初期値を修正
    // initialPickが渡されていればそれを初期値に、なければnull
    const [pick, setPick] = useState<SpecialPick | null>(initialPick === undefined ? null : initialPick);
    
    // ローディング状態の初期値を修正
    // initialPickが渡されていない場合のみ、ローディング状態を開始する
    const [isLoading, setIsLoading] = useState(initialPick === undefined);

    useEffect(() => {
        // `initialPick`がpropsとして渡されている場合（サーバーサイドでデータ取得済み）、
        // クライアントサイドでの再取得は行わない
        if (initialPick !== undefined) {
            setPick(initialPick);
            setIsLoading(false);
            return;
        }

        // `date`プロパティがない場合も取得できないので処理を終了
        if (!date) {
            setIsLoading(false);
            setPick(null);
            return;
        }

        // `initialPick`がなく、`date`がある場合のみAPIからデータを取得
        setIsLoading(true);
        getSpecialPick(date)
            .then(data => setPick(data))
            .catch(e => {
                console.error("Failed to fetch special pick:", e);
                setPick(null); // エラー時はnullを設定
            })
            .finally(() => setIsLoading(false));
            
    }, [date, initialPick]); // 依存配列に`date`と`initialPick`を指定

    if (isLoading) {
        return <Skeleton />;
    }

    if (!pick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl shadow-md mb-6 text-center border">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-xl shadow-lg mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center">
                <SparklesIcon className="w-5 h-5 mr-2" />
                AIの注目馬！
            </h3>
            <p className="text-3xl font-bold">{pick.horse_name}</p>
            <p className="text-lg opacity-90">{pick.venue_name} {pick.race_number}R - {pick.race_name}</p>
            <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-sm italic">「{pick.commentary}」</p>
            </div>
        </div>
    );
};