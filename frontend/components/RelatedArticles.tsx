/**
 * 関連記事表示コンポーネント
 *
 * レース条件（競馬場、距離、コースタイプ）に基づいて
 * 関連する記事を自動で推薦
 */

import React from 'react';
import Link from 'next/link';
import { getLatestArticles } from '@/lib/articles';

interface RelatedArticlesProps {
    venue: string;
    distance: number;
    courseType: 'turf' | 'dirt';
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({
    venue,
    distance,
    courseType,
}) => {
    /**
     * レース条件に基づいて、推奨する記事を特定
     */
    const getRecommendedArticles = (): { slug: string; title: string; reason: string }[] => {
        const recommendations: { slug: string; title: string; reason: string }[] = [];

        // 距離別の推薦
        if (distance <= 1200) {
            recommendations.push({
                slug: 'distance-suitability-data',
                title: '距離別適性データ：短距離・中距離・長距離の違い',
                reason: '短距離レースでの馬の適性を知ることが重要です',
            });
        } else if (distance >= 2400) {
            recommendations.push({
                slug: 'distance-suitability-data',
                title: '距離別適性データ：短距離・中距離・長距離の違い',
                reason: '長距離レースのスタミナ重視の特性を理解しましょう',
            });
        }

        // コース・距離別の推薦
        if (courseType === 'turf' && distance === 2000) {
            recommendations.push({
                slug: 'frame-number-analysis',
                title: '枠順データ完全分析｜有利な枠はどこか？',
                reason: `${venue}の芝での枠順傾向を確認できます`,
            });
        }

        // 競馬場別の推薦
        if (venue.includes('京都')) {
            recommendations.push({
                slug: 'frame-number-analysis',
                title: '枠順データ完全分析｜有利な枠はどこか？',
                reason: '京都は外枠が圧倒的に有利。枠順データを要チェック',
            });
        } else if (venue.includes('東京')) {
            recommendations.push({
                slug: 'frame-number-analysis',
                title: '枠順データ完全分析｜有利な枠はどこか？',
                reason: '東京の長い直線でのレース展開を理解しましょう',
            });
        }

        // 馬場関連の推薦
        recommendations.push({
            slug: 'ground-condition-impact',
            title: '馬場状態が与える影響｜良・稍重・重・不良の徹底比較',
            reason: '馬場状態による馬の適性の違いを理解することが重要です',
        });

        // 血統分析の推薦
        recommendations.push({
            slug: 'bloodline-sire-analysis',
            title: '血統データ分析｜種牡馬別成績ランキング',
            reason: '種牡馬の血統から馬の適性をより深く理解できます',
        });

        return recommendations.slice(0, 3); // 最大3件まで
    };

    const recommendedArticles = getRecommendedArticles();

    if (recommendedArticles.length === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-md border border-green-200 p-6 mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    📚
                </span>
                このレースの予想に役立つ記事
            </h3>

            <div className="space-y-2">
                {recommendedArticles.map((article) => (
                    <Link
                        key={article.slug}
                        href={`/articles/${article.slug}`}
                        className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-md transition-all group"
                    >
                        <h4 className="font-semibold text-sm text-gray-800 group-hover:text-green-600 transition-colors">
                            {article.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">{article.reason}</p>
                    </Link>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-green-200">
                <Link
                    href="/articles"
                    className="inline-block text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
                >
                    すべての記事を見る →
                </Link>
            </div>
        </div>
    );
};
