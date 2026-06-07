'use client';
import { Adsense } from './Adsense';
import { isManualAdsEnabled } from '@/lib/ad-config';

type MultiplexAdProps = {
    slot: string;
    refreshKey?: string;
};

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * MultiplexAd（関連コンテンツ風広告）
 * 
 * 関連記事セクションと同じデザインで広告を表示。
 * autorelaxedフォーマットはサイト規模の条件あり(未達の場合表示されない)ため、
 * 標準のレスポンシブ広告にフォールバック。
 */
export const MultiplexAd = ({ slot, refreshKey = '' }: MultiplexAdProps) => {
    if (!isManualAdsEnabled) return null;

    return (
        <section className="mt-4 mb-2 px-1">
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1 h-4 sm:h-5 bg-secondary rounded-full"></span>
                    おすすめの関連情報
                </div>
                <span className="text-[10px] text-gray-400 font-normal">スポンサーリンク</span>
            </h3>
            
            <div className="w-full bg-white rounded-lg border border-gray-100 overflow-hidden">
                <Adsense
                    client={AD_CLIENT}
                    slot={slot}
                    refreshKey={refreshKey}
                    style={{ display: 'block', minHeight: '250px' }}
                    isResponsive={true}
                />
            </div>
        </section>
    );
};
