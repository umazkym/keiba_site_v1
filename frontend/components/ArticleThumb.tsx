// 記事のサムネイル。写真・記事ごとのアイキャッチ・カテゴリ色の面のいずれか（lib/article-visual.ts で決める）。
// カテゴリ色の面は、スマホの小さい行では文字とアイコンを小さく、md以上のカードでは大きくする。
import type { ArticleThumb as ArticleThumbData } from '@/lib/article-visual';
import { getArticleCategoryStyle } from '@/lib/article-visual';
import { LineIcon } from '@/components/LineIcon';

type ArticleThumbProps = {
    thumb: ArticleThumbData;
    // 画像の表示幅の目安（srcSet の sizes）
    sizes: string;
    className?: string;
};

export function ArticleThumb({ thumb, sizes, className = '' }: ArticleThumbProps) {
    if (thumb.kind === 'category') {
        const style = getArticleCategoryStyle(thumb.category);
        return (
            <span className={`flex items-end justify-between p-2 text-white md:p-3.5 ${style.fillClass} ${className}`} aria-hidden="true">
                <span className="text-[10.5px] font-bold opacity-90 md:text-[13px]">{thumb.category}</span>
                <LineIcon name={style.icon} size={22} strokeWidth={1.8} className="block h-[22px] w-[22px] text-white/85 md:h-[34px] md:w-[34px]" />
            </span>
        );
    }
    return (
        <span className={`block overflow-hidden bg-slate-100 ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 事前に書き出した画像を直接配信し、サーバーの画像最適化を使わない */}
            <img
                src={thumb.src}
                srcSet={thumb.kind === 'photo' ? thumb.srcSet : undefined}
                sizes={thumb.kind === 'photo' ? sizes : undefined}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
            />
        </span>
    );
}
