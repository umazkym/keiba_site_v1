// コース図（芝＝緑、ダート＝茶）。コースのデータは server-only のため、サーバーコンポーネントからだけ使う。
// クライアント側で表示したいときは、サーバーで描いた要素を props（ReactNode）で渡す。
import { COURSE_SHAPES } from '@/lib/course-shapes';
import { getSurfaceKey } from '@/lib/race-display';

type CourseGlyphProps = {
    venue: string;
    width?: number;
    // 今回のレースのコース（芝／ダート）だけを濃く塗る。null なら両方とも濃く塗る
    activeCourseType?: string | null;
    // 選ばれていない会場など、全体を灰色で描く
    muted?: boolean;
    className?: string;
    title?: string;
};

const PAD = 14;

export function CourseGlyph({ venue, width = 120, activeCourseType = null, muted = false, className, title }: CourseGlyphProps) {
    const shape = COURSE_SHAPES[venue];
    if (!shape) return null;
    const [x, y, w, h] = shape.bbox;
    const height = Math.round((width * (h + PAD * 2)) / (w + PAD * 2));
    const active = getSurfaceKey(activeCourseType);
    const turfOn = !active || active === 'turf';
    const dirtOn = !active || active === 'dirt';
    const turfFill = muted ? '#CDD2E2' : turfOn ? '#2E8B57' : '#BCD9C6';
    const dirtFill = muted ? '#CDD2E2' : dirtOn ? '#A5692F' : '#E3CDB5';
    return (
        <svg
            width={width}
            height={height}
            viewBox={`${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}`}
            className={className ?? 'block shrink-0'}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
            focusable="false"
        >
            {shape.turf && <path d={shape.turf} fill={turfFill} fillRule="evenodd" />}
            {shape.dirt && <path d={shape.dirt} fill={dirtFill} fillRule="evenodd" />}
        </svg>
    );
}
