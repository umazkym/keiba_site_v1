'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SpecialPick, RaceDayPrediction } from "@/lib/types";
import { formatDate } from '@/lib/utils';
import { getRaceDetailPath } from '@/lib/race-url';

type Props = {
    pick?: SpecialPick | null;
    date?: string;
    predictions?: RaceDayPrediction | null;
};

// スケルトン
const Skeleton = () => (
    <div className="h-[180px] animate-pulse rounded-xl border border-slate-100 bg-white p-4 sm:p-6">
        <div className="flex gap-2 mb-4">
            <div className="h-6 bg-slate-100 rounded w-20"></div>
            <div className="h-6 bg-slate-100 rounded w-20"></div>
            <div className="h-6 bg-slate-100 rounded w-20"></div>
        </div>
        <div className="flex justify-between items-center mt-2">
            <div className="h-4 bg-slate-100 rounded w-1/3 sm:h-5"></div>
            <div className="h-8 bg-slate-100 rounded-full w-24"></div>
        </div>
        <div className="h-6 bg-slate-100 rounded w-3/4 mt-3"></div>
        <div className="h-4 bg-slate-100 rounded w-full mt-2"></div>
    </div>
);

export const SpecialPickCard = ({ pick: initialPick, date, predictions }: Props) => {
    const [activeTab, setActiveTab] = useState<'favored' | 'value' | 'nar'>('favored');

    const getEffectiveDate = () => {
        if (date) return date;
        const now = new Date();
        const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        return jstDate.toISOString().split('T')[0];
    };

    const effectiveDate = getEffectiveDate();
    const formattedDate = formatDate(effectiveDate);

    // 予測データから注目馬を動的に抽出
    const extractedPicks = useMemo(() => {
        if (!predictions) {
            // predictionsが無い場合はinitialPickを本命候補に入れる
            return {
                favored: initialPick || null,
                value: null,
                nar: null
            };
        }

        const jraVenues = predictions.jra ?? [];
        const narVenues = predictions.nar ?? [];
        const allVenues = [...jraVenues, ...narVenues];

        const allHorses: Array<{
            horse_name: string;
            horse_id: string;
            venue_name: string;
            race_number: number;
            race_name: string;
            race_id: string;
            deviation_score: number;
            mark: string;
            is_nar: boolean;
        }> = [];

        allVenues.forEach(venue => {
            const isNar = narVenues.some(nv => nv.venue_name === venue.venue_name);
            venue.races.forEach(race => {
                race.predictions.forEach(p => {
                    if (p.deviation_score != null) {
                        allHorses.push({
                            horse_id: p.horse_id,
                            horse_name: p.horse_name,
                            venue_name: venue.venue_name,
                            race_number: race.race_number,
                            race_name: race.race_name,
                            race_id: race.id,
                            deviation_score: p.deviation_score,
                            mark: p.mark,
                            is_nar: isNar,
                        });
                    }
                });
            });
        });

        if (allHorses.length === 0) {
            return {
                favored: initialPick || null,
                value: null,
                nar: null
            };
        }

        const selectTopHorse = <T extends { deviation_score: number }>(horses: T[]): T | null => {
            if (horses.length === 0) return null;
            return horses.reduce((max, horse) => horse.deviation_score > max.deviation_score ? horse : max, horses[0]);
        };

        // 1. 本命候補 (◎の中で偏差値最大。なければ全体の最大)
        const favCandidates = allHorses.filter(h => h.mark === '◎');
        const bestFav = selectTopHorse(favCandidates) ?? selectTopHorse(allHorses);

        if (!bestFav) {
            return {
                favored: initialPick || null,
                value: null,
                nar: null
            };
        }

        const favoredPick: SpecialPick = {
            horse_id: bestFav.horse_id,
            horse_name: bestFav.horse_name,
            race_id: bestFav.race_id,
            race_name: bestFav.race_name,
            venue_name: bestFav.venue_name,
            race_number: bestFav.race_number,
            deviation_score: bestFav.deviation_score,
            commentary: `AI偏差値 ${bestFav.deviation_score.toFixed(1)}。本日の全開催を通じて上位に位置する評価です。能力面の条件は整っており、当日の馬場状態や展開面も合わせて確認したい一頭です。`,
        };

        // 2. 地方注目 (NARの中から◎で偏差値最大。なければ地方開催の上位評価)
        const narCandidates = allHorses.filter(h => h.is_nar && h.mark === '◎');
        const narPool = allHorses.filter(h => h.is_nar);
        const bestNar = selectTopHorse(narCandidates) ?? selectTopHorse(narPool);

        const narPick: SpecialPick | null = bestNar ? {
            horse_id: bestNar.horse_id,
            horse_name: bestNar.horse_name,
            race_id: bestNar.race_id,
            race_name: bestNar.race_name,
            venue_name: bestNar.venue_name,
            race_number: bestNar.race_number,
            deviation_score: bestNar.deviation_score,
            commentary: `AI偏差値 ${bestNar.deviation_score.toFixed(1)}。本日の地方競馬（NAR）開催の中で目立つ評価を受けています。ダート適性と馬場の利条件を合わせて判断材料にしたい一頭。`,
        } : null;

        // 3. オッズ妙味 (◎以外で○▲△☆の中から偏差値最大。なければ本命以外の最大)
        const valueCandidates = allHorses.filter(h =>
            h.horse_id !== bestFav.horse_id &&
            (h.mark === '○' || h.mark === '▲' || h.mark === '△' || h.mark === '☆' || h.mark === '〇')
        );
        const bestValue = valueCandidates.length > 0
            ? valueCandidates.reduce((max, h) => h.deviation_score > max.deviation_score ? h : max, valueCandidates[0])
            : allHorses.find(h => h.horse_id !== bestFav.horse_id) || bestFav;

        const valuePick: SpecialPick = {
            horse_id: bestValue.horse_id,
            horse_name: bestValue.horse_name,
            race_id: bestValue.race_id,
            race_name: bestValue.race_name,
            venue_name: bestValue.venue_name,
            race_number: bestValue.race_number,
            deviation_score: bestValue.deviation_score,
            commentary: `AI偏差値 ${bestValue.deviation_score.toFixed(1)}。展開面や枠順条件次第で評価を上げたい相手候補です。人気馬とのオッズ差も考慮しながら判断材料にしたい一頭。`,
        };

        return { favored: favoredPick, value: valuePick, nar: narPick };
    }, [predictions, initialPick]);

    // NARのピックが無い場合は、デフォルトタブをfavoredにし、narタブを選べなくする
    useEffect(() => {
        if (activeTab === 'nar' && !extractedPicks.nar) {
            setActiveTab('favored');
        }
    }, [extractedPicks.nar, activeTab]);

    const currentPick = useMemo(() => {
        if (activeTab === 'value' && extractedPicks.value) return extractedPicks.value;
        if (activeTab === 'nar' && extractedPicks.nar) return extractedPicks.nar;
        return extractedPicks.favored;
    }, [activeTab, extractedPicks]);

    if (!currentPick) {
        return (
            <div className="bg-white text-gray-600 p-6 rounded-xl border border-gray-200 h-full flex items-center justify-center">
                <p>本日のAI注目馬はありません。</p>
            </div>
        );
    }

    // 偏差値をプログレスバーの%に変換 (偏差値40〜70の範囲でマッピング)
    const barPercent = Math.min(100, Math.max(10, ((currentPick.deviation_score - 40) / 30) * 100));

    // 偏差値のスコア別カラー
    const getProgressBarColor = (score: number) => {
        if (score >= 70) return 'bg-rose-500';
        if (score >= 60) return 'bg-orange-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-blue-500';
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
            {/* タブ切り替えヘッダー */}
            <div className="flex gap-1.5 sm:gap-2 mb-3.5 border-b border-slate-100 pb-2 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab('favored')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'favored' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                >
                    本命候補
                </button>
                {extractedPicks.value && (
                    <button
                        onClick={() => setActiveTab('value')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'value' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        オッズ妙味
                    </button>
                )}
                {extractedPicks.nar && (
                    <button
                        onClick={() => setActiveTab('nar')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'nar' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                        地方注目
                    </button>
                )}
            </div>

            {/* 注目馬情報カード */}
            <Link
                href={getRaceDetailPath(effectiveDate, currentPick.venue_name, currentPick.race_number)}
                className="block group"
            >
                <div className="relative overflow-hidden rounded-xl bg-slate-50/50 hover:bg-slate-50 p-3.5 border border-slate-100 transition-all group-hover:border-primary/20">
                    <div className="flex justify-between items-start gap-3 mb-2">
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{formattedDate} · {currentPick.venue_name} {currentPick.race_number}R</span>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 truncate leading-tight group-hover:text-primary transition-colors">
                                {currentPick.horse_name}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-500">
                                {currentPick.race_name}
                            </span>
                        </div>

                        <div className="shrink-0 text-right">
                            <div className="text-[10px] font-bold text-slate-400">AI偏差値</div>
                            <div className="text-xl font-black text-primary font-mono">{currentPick.deviation_score.toFixed(1)}</div>
                        </div>
                    </div>

                    {/* 偏差値プログレスバー */}
                    <div className="mb-3">
                        <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(currentPick.deviation_score)}`}
                                style={{ width: `${barPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* 解説コメント */}
                    <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 font-medium">
                        {currentPick.commentary}
                    </p>

                    <div className="mt-2 text-right">
                        <span className="inline-flex items-center text-[10px] sm:text-xs font-bold text-primary group-hover:underline">
                            分析データを詳しく確認する →
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
};
