// レース詳細の見出し（サーバーで描く）。会場×Rのプレート・レース名・グレード・条件・コース図。
// 重賞は季節の写真を入口に置く（スマホは上の帯、PCは右側）。当該レースの着順・結果は表示しない。
import type { RacePrediction } from '@/lib/types';
import { CourseGlyph } from '@/components/CourseGlyph';
import { GradeBadge, RacePlate, SurfaceLabel } from '@/components/RaceParts';
import {
    formatRaceDateLabel,
    getSeason,
    getSurfaceLabel,
} from '@/lib/race-display';

type RaceHeadProps = {
    race: RacePrediction;
    venueName: string;
};

function GradePhoto({ raceDate, className, sizes }: { raceDate: string; className: string; sizes: string }) {
    const base = `/images/photos/grade-${getSeason(raceDate)}`;
    return (
        // eslint-disable-next-line @next/next/no-img-element -- 事前に書き出したWebPを直接配信し、サーバーの画像最適化を使わない
        <img
            src={`${base}-720.webp`}
            srcSet={`${base}-720.webp 720w, ${base}-1200.webp 1200w`}
            sizes={sizes}
            alt=""
            decoding="async"
            className={className}
        />
    );
}

// 未発表の馬場・天候は API が「-」などで返すことがあるため、値として扱わない
const isKnownCondition = (value?: string | null): value is string => Boolean(value && !/^[\s\-‐‑‒–—―−－ー～~・.．?？*]*$/.test(value));

export function RaceHead({ race, venueName }: RaceHeadProps) {
    const isGrade = Boolean(race.grade);
    const runners = race.total_horses || race.predictions.length;
    const courseLabel = `${getSurfaceLabel(race.course_type)}${race.distance ?? ''}${race.distance ? 'm' : ''}`;
    const conditions = [
        isKnownCondition(race.ground_condition) ? `馬場 ${race.ground_condition}` : null,
        isKnownCondition(race.weather) ? `天候 ${race.weather}` : null,
    ].filter(Boolean);

    return (
        <header className="-mt-1 mb-2 flex flex-col gap-2 sm:mt-0 md:mb-3 md:gap-2.5">
            {isGrade && (
                <div className="relative h-[60px] overflow-hidden rounded-xl md:hidden">
                    <GradePhoto raceDate={race.race_date} sizes="100vw" className="absolute inset-0 h-full w-full object-cover object-[60%_80%]" />
                    <div className="photo-scrim-left absolute inset-0" aria-hidden="true" />
                    {/* グレード・コースは下の見出しに出すため、帯は開催日と競馬場だけ（以前は「重賞 重賞・園田 ダ1400m」と重なっていた） */}
                    <p className="absolute inset-y-0 left-3 flex items-center text-[13px] font-bold text-white">
                        {formatRaceDateLabel(race.race_date, { year: true })} · {venueName}競馬場
                    </p>
                </div>
            )}

            <section className="relative overflow-hidden md:rounded-xl md:border md:border-slate-200 md:bg-white md:px-7 md:py-6">
                {isGrade && (
                    <div className="absolute inset-y-0 right-0 hidden w-[520px] md:block" aria-hidden="true">
                        <GradePhoto raceDate={race.race_date} sizes="520px" className="h-full w-full object-cover object-[55%_75%]" />
                        <div className="photo-fade-left absolute inset-0" />
                    </div>
                )}

                <div className="relative flex items-center gap-3 md:gap-6">
                    <RacePlate venue={venueName} raceNumber={race.race_number} size="m" className="md:hidden" />
                    <RacePlate venue={venueName} raceNumber={race.race_number} size="xl" className="hidden md:inline-flex" />

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-2.5">
                        <p className="hidden text-sm font-bold text-slate-500 md:block">
                            {formatRaceDateLabel(race.race_date, { year: true })} · {venueName}競馬場
                        </p>
                        <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[22px] font-bold leading-tight text-slate-900 md:text-[34px]">
                            <span className="line-clamp-2 break-words">{race.race_name}</span>
                            <GradeBadge grade={race.grade} size="m" />
                        </h1>
                        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] font-bold text-slate-500 md:gap-y-1 md:text-sm">
                            {/* 重賞はスマホの写真の帯に日付を出すため、ここでは出さない。スマホは「9/24(木)」の短い形 */}
                            {!isGrade && <span className="md:hidden">{formatRaceDateLabel(race.race_date, { short: true })}</span>}
                            <SurfaceLabel courseType={race.course_type} distance={race.distance} className="text-[13px] md:text-sm" />
                            {runners > 0 && (
                                <span className="text-slate-700">
                                    <span className="font-num text-[15px] md:text-base">{runners}</span>頭
                                </span>
                            )}
                            {/* 馬場・天候：スマホは枠の無い文字（以前の札は3行目の高さを増やしていた）、PC は札 */}
                            {conditions.map((condition) => (
                                <span key={condition} className="text-[12px] text-slate-700 md:rounded-md md:border md:border-slate-200 md:bg-white md:px-1.5 md:py-0.5">
                                    {condition}
                                </span>
                            ))}
                        </p>
                    </div>

                    <CourseGlyph
                        venue={venueName}
                        width={56}
                        activeCourseType={race.course_type}
                        className="block shrink-0 md:hidden"
                    />
                    <figure className={`relative m-0 hidden shrink-0 flex-col items-center gap-1.5 md:flex ${isGrade ? 'self-end rounded-xl bg-white/90 px-3 pb-2 pt-2.5' : ''}`}>
                        <CourseGlyph
                            venue={venueName}
                            width={isGrade ? 120 : 180}
                            activeCourseType={race.course_type}
                            title={`${venueName}競馬場のコース図`}
                        />
                        <figcaption className="text-xs font-bold text-slate-500">{venueName} {courseLabel}</figcaption>
                    </figure>
                </div>
            </section>
        </header>
    );
}
