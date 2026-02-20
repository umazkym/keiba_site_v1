'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/articles';

interface DynamicRelatedArticlesProps {
    venueName: string;
    courseType: string | null;
    distance: number | null;
    articlesMeta: Omit<Article, 'content'>[];
    count?: number;
}

export function DynamicRelatedArticles({
    venueName,
    courseType,
    distance,
    articlesMeta,
    count = 3
}: DynamicRelatedArticlesProps) {

    const relatedArticles = useMemo(() => {
        // 競馬場名のローマ字マッピング
        const venueMap: Record<string, string> = {
            '東京': 'tokyo', '中山': 'nakayama', '京都': 'kyoto', '阪神': 'hanshin',
            '中京': 'chukyo', '札幌': 'sapporo', '函館': 'hakodate', '福島': 'fukushima',
            '新潟': 'niigata', '小倉': 'kokura',
            // 地方競馬
            '大井': 'ohi', '川崎': 'kawasaki', '船橋': 'funabashi', '浦和': 'urawa',
            '門別': 'mombetsu', '盛岡': 'morioka', '水沢': 'mizusawa', '金沢': 'kanazawa',
            '笠松': 'kasamatsu', '名古屋': 'nagoya', '園田': 'sonoda', '姫路': 'himeji',
            '高知': 'kochi', '佐賀': 'saga'
        };

        const venueEn = venueMap[venueName] || '';
        const distanceStr = distance != null ? distance.toString() : '';
        const courseEn = courseType ? (courseType.includes('芝') ? 'turf' : (courseType.includes('ダ') ? 'dirt' : '')) : '';

        const scoredArticles = articlesMeta.map(article => {
            let score = 0;
            const slug = article.slug.toLowerCase();
            const title = article.title;

            // 競馬場の一致
            if (venueName && title.includes(venueName)) score += 3;
            if (venueEn && slug.includes(venueEn)) score += 3;

            // 距離の一致
            if (distanceStr && (title.includes(distanceStr) || slug.includes(distanceStr))) score += 2;

            // コースの一致
            if (courseType && title.includes(courseType)) score += 1;
            if (courseEn && slug.includes(courseEn)) score += 1;

            // カテゴリが関連しそうな場合の加点
            if (article.category === 'データ分析' || article.category === 'コース分析') score += 0.5;

            // それでもスコアがない場合、初心者向けガイドに少しスコアを与える
            if (score === 0 && article.category === '初心者向けガイド') score += 0.1;

            return { article, score };
        });

        // スコア降順、同スコアなら新しい順
        scoredArticles.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return a.article.date < b.article.date ? 1 : -1;
        });

        return scoredArticles.slice(0, count).map(sa => sa.article);
    }, [venueName, courseType, distance, articlesMeta, count]);

    if (relatedArticles.length === 0) {
        return null;
    }

    return (
        <section className="mt-6 mb-4">
            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-secondary rounded-full"></span>
                    関連する分析記事
                </div>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedArticles.map((article) => (
                    <Link
                        href={`/articles/${article.slug}`}
                        key={article.slug}
                        className="block group border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white"
                    >
                        <div className="relative w-full h-32 overflow-hidden bg-slate-100">
                            <Image
                                src={article.eyecatch || '/images/articles/data-analysis-eyecatch.png'}
                                alt={article.title}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                style={{ objectFit: 'cover' }}
                                className="transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                        <div className="p-3">
                            <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded mb-1.5 border border-blue-100">
                                {article.category}
                            </span>
                            <h4
                                className="font-bold text-sm mb-1 text-gray-800 group-hover:text-primary transition-colors line-clamp-2 leading-snug"
                            >
                                {article.title}
                            </h4>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
