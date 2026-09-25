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
        // 「おすすめの関連情報」の見出しと色の棒は外し、広告であることの表示だけを残す（見出しで記事の一部と誤認させない。2026-09-25）
        <section className="mb-1 sm:mb-2 sm:mt-4" aria-label="スポンサーリンク">
            <p className="mb-1 text-[11px] font-medium text-slate-400">スポンサーリンク</p>
            <div className="ad-reserve-stripes w-full overflow-hidden rounded-lg border border-slate-200">
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
