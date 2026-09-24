// レース詳細の見出し（サーバーで描く）。会場×Rのプレート・レース名・グレード・条件・コース図。
// 重賞は季節の写真を入口に置く（スマホは上の帯、PCは右側）。結果が出ていれば1着とAI順位を並べる。
import type { RacePrediction } from '@/lib/types';
import { CourseGlyph } from '@/components/CourseGlyph';
import { GradeBadge, HorseNumber, RacePlate, SurfaceLabel } from '@/components/RaceParts';
import {
    formatRaceDateLabel,
    getAiRanks,
    getFinishRanks,
    getSeason,
    getSurfaceLabel,
    resolveWaku,
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

function ResultLine({ race }: { race: RacePrediction }) {
    const finishRanks = getFinishRanks(race);
    const winnerNumber = Array.from(finishRanks.entries()).find(([, rank]) => rank === 1)?.[0];
    if (winnerNumber == null) return null;
    const winner = race.predictions.find((p) => p.horse_number === winnerNumber);
    const winnerName = winner?.horse_name ?? race.results.find((r) => r.horse_number === winnerNumber)?.horse_name ?? '';
    const aiRank = getAiRanks(race.predictions).get(winnerNumber);
    const score = winner?.deviation_score;
    return (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-700 md:inline-flex md:w-fit md:max-w-full md:bg-white/90 md:text-sm">
            <span className="rounded-[5px] bg-navy px-1.5 py-0.5 text-[11px] font-bold leading-snug text-white">結果確定</span>
            <span className="inline-flex items-center gap-1.5 font-bold">
                1着
                <HorseNumber number={winnerNumber} waku={winner ? resolveWaku(winner, race.predictions.length) : null} size={22} />
                {winnerName}
            </span>
            <span>
                {aiRank
                    ? `AI偏差値 ${score != null ? score.toFixed(1) : '--'}（${race.predictions.length}頭中${aiRank}位）`
                    : 'AI偏差値の対象外'}
            </span>
        </p>
    );
}

export function RaceHead({ race, venueName }: RaceHeadProps) {
    const isGrade = Boolean(race.grade);
    const runners = race.total_horses || race.predictions.length;
    const courseLabel = `${getSurfaceLabel(race.course_type)}${race.distance ?? ''}${race.distance ? 'm' : ''}`;
    const conditions = [
        race.ground_condition ? `馬場 ${race.ground_condition}` : null,
        race.weather ? `天候 ${race.weather}` : null,
    ].filter(Boolean);

    return (
        <header className="mb-2 flex flex-col gap-2.5 md:mb-3">
            {isGrade && (
                <div className="relative h-[60px] overflow-hidden rounded-xl md:hidden">
                    <GradePhoto raceDate={race.race_date} sizes="100vw" className="absolute inset-0 h-full w-full object-cover object-[60%_40%]" />
                    <div className="photo-scrim-left absolute inset-0" aria-hidden="true" />
                    <p className="absolute inset-y-0 left-3 flex items-center gap-2 text-[12.5px] font-bold text-white">
                        <GradeBadge grade={race.grade} size="m" />
                        重賞 · {venueName} {courseLabel}
                    </p>
                </div>
            )}

            <section className="relative overflow-hidden md:rounded-xl md:border md:border-slate-200 md:bg-white md:px-7 md:py-6">
                {isGrade && (
                    <div className="absolute inset-y-0 right-0 hidden w-[520px] md:block" aria-hidden="true">
                        <GradePhoto raceDate={race.race_date} sizes="520px" className="h-full w-full object-cover object-[55%_45%]" />
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
                        <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[22px] font-extrabold leading-tight text-slate-900 md:text-[34px]">
                            <span className="line-clamp-2 break-words">{race.race_name}</span>
                            <GradeBadge grade={race.grade} size="m" />
                        </h1>
                        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-bold text-slate-500 md:text-sm">
                            <span className="md:hidden">{formatRaceDateLabel(race.race_date)}</span>
                            <SurfaceLabel courseType={race.course_type} distance={race.distance} className="text-[13px] md:text-sm" />
                            {runners > 0 && (
                                <span className="text-slate-700">
                                    <span className="font-num text-[15px] md:text-base">{runners}</span>頭
                                </span>
                            )}
                            {conditions.map((condition) => (
                                <span key={condition} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] text-slate-700">
                                    {condition}
                                </span>
                            ))}
                        </p>
                        <div className="hidden md:block">
                            <ResultLine race={race} />
                        </div>
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

            <div className="md:hidden">
                <ResultLine race={race} />
            </div>
        </header>
    );
}
