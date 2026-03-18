'use client';
import { Adsense } from './Adsense';

type MultiplexAdProps = {
    /** マルチプレックス専用スロットID */
    slot: string;
    /** SPAでのリフレッシュキー */
    refreshKey?: string;
};

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * MultiplexMimicry (関連記事への完全擬態)
 * 
 * "autorelaxed" フォーマットを使用し、サイトの「関連コンテンツ」と
 * 視覚的に同化させる高CTRアプローチ。
 * DynamicRelatedArticles の直前に配置し、脳をハックする。
 */
export const MultiplexAd = ({ slot, refreshKey = '' }: MultiplexAdProps) => {
    return (
        <section className="mt-8 sm:mt-10 mb-4 sm:mb-6 px-1">
            {/* 関連記事のヘッダーデザイン（DynamicRelatedArticles.tsx）を完全に模倣 */}
            <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-5 sm:h-6 bg-secondary rounded-full"></span>
                    おすすめの関連情報
                </div>
                {/* 小さく合法的にラベル付け */}
                <span className="text-[10px] text-gray-400 font-normal">スポンサーリンク</span>
            </h3>
            
            <div className="w-full bg-white rounded-lg border border-gray-100 shadow-sm min-h-[300px] p-2 sm:p-4">
                <Adsense
                    client={AD_CLIENT}
                    slot={slot}
                    refreshKey={refreshKey}
                    style={{ display: 'block' }}
                    isResponsive={true}
                    format="autorelaxed"
                />
            </div>
        </section>
    );
};
