'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { RaceArticleMeta } from '@/lib/articles';

interface DynamicRelatedArticlesProps {
    venueName: string;
    courseType: string | null;
    distance: number | null;
    articlesMeta: RaceArticleMeta[];
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
        <section className="mb-3 mt-3 sm:mb-5 sm:mt-5">
            <h3 className="race-section-heading mb-2 sm:mb-3">関連する分析記事</h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-3">
                {relatedArticles.map((article) => (
                    <Link
                        href={`/articles/${article.slug}`}
                        key={article.slug}
                        prefetch={false}
                        className="group flex min-h-[68px] overflow-hidden rounded-lg border border-slate-200 bg-white transition-[border-color,background-color] duration-150 hover:border-slate-300 hover:bg-slate-50 sm:block"
                    >
                        <div className="h-[68px] w-14 shrink-0 overflow-hidden bg-slate-100 sm:h-28 sm:w-full">
                            <img
                                src={article.eyecatch || '/images/articles/data-analysis-eyecatch.png'}
                                alt={article.title}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover object-center"
                            />
                        </div>
                        <div className="flex min-w-0 flex-grow flex-col justify-center p-2 sm:justify-between sm:p-3">
                            <div>
                                <span className="mb-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-primary-dark sm:mb-1 sm:text-[10px]">
                                    {article.category}
                                </span>
                                <h4 className="mb-0 line-clamp-2 text-[11px] font-bold leading-snug text-text-primary transition-colors group-hover:text-primary sm:text-sm">
                                    {article.title}
                                </h4>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
