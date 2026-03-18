'use client';

import { Adsense } from './Adsense';

type InFeedAdProps = {
    /** 広告スロットID (インフィード専用、またはディスプレイを代用) */
    slot: string;
    /** レース切替等でリフレッシュするためのキー */
    refreshKey?: string;
    /** カードデザインに合わせるための追加CSSクラス */
    className?: string;
};

const AD_CLIENT = 'ca-pub-4411270831448240';

/**
 * インフィード広告専用コンポーネント (ハイブリッド戦略対応)
 * 
 * データカードの合間に挟まってもUXを損なわないよう、
 * 「他のカードと同じ横幅」「固定された高さ（ガタつかない）」を保証する設計。
 * 
 * - 高さを固定することで、Googleにスマホ定番サイズのバナー配信を強制する
 * - 自動サイズ（responsive）によるレイアウト崩れ・コンテンツの圧迫を防止する
 */
export const InFeedAd = ({
    slot,
    refreshKey = '',
    className = '',
}: InFeedAdProps) => {
    return (
        <div className={`overflow-hidden rounded-xl border-l-[3px] border-l-slate-300 border border-y-slate-200 border-r-slate-200 shadow-sm relative w-full flex flex-col items-center justify-center bg-slate-50 p-1.5 sm:p-3 mt-2 mb-2 ${className}`}>
            
            {/* 広告ラベル: コンテンツとの誤認を防ぐための表示 */}
            <div className="absolute top-0 right-0 max-w-fit px-2 py-0.5 rounded-bl text-[9px] text-slate-400 font-medium tracking-wider bg-slate-100/80 z-10 pointer-events-none">
                Sponsored
            </div>
            
            {/* 
              * ★ 250pxに拡大: ミディアムレクタングル(300x250)の配信を許可
              * 300x250はAdSense最高eCPMのフォーマット。100px制限では配信対象外だった。
              * isResponsive={false}で高さを固定し、レイアウトの安定性を維持。
              */}
            <Adsense
                client={AD_CLIENT}
                slot={slot}
                refreshKey={refreshKey}
                style={{ display: 'inline-block', width: '100%', height: '250px' }}
                isResponsive={false}
            />
        </div>
    );
};
