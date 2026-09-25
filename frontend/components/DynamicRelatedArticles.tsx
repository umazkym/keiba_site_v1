'use client';

import { useMemo } from 'react';
import { RaceArticleMeta } from '@/lib/articles';
import { pickArticleThumbs } from '@/lib/article-visual';
import { RelatedArticleList } from '@/components/ArticleParts';

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

        // 競馬場か距離が合う記事だけにする（カテゴリだけの加点で、関係の薄い記事や入門記事が並ばないように）
        return scoredArticles.filter(sa => sa.score >= 2).slice(0, count).map(sa => sa.article);
    }, [venueName, courseType, distance, articlesMeta, count]);

    if (relatedArticles.length === 0) {
        return null;
    }

    // 記事ページの「次に読む分析」と同じ形（汎用のアイキャッチは出さず、カテゴリの写真にする）
    const thumbs = pickArticleThumbs(relatedArticles);
    return (
        <div className="my-3 sm:my-5">
            <RelatedArticleList
                headingId="race-related-articles-heading"
                title="関連する分析記事"
                items={relatedArticles.map((article, index) => ({
                    slug: article.slug,
                    title: article.title,
                    category: article.category,
                    date: article.date,
                    thumb: thumbs[index],
                }))}
            />
        </div>
    );
}
