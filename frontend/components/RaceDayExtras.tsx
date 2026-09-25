'use client';

// 開催日ボードの下に置く部分。従来の日付ページと同じ順・同じ計測・同じ広告枠（PRと記事内広告の実験）を保つ。
// 免責は黄色の警告帯をやめ、ボードの直後の1文（DisclaimerNote）にした（2026-09-25）。
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import { DisclaimerNote } from '@/components/DisclaimerNote';
import { SectionHeader } from '@/components/SectionHeader';
import { InFeedAd } from '@/components/InFeedAd';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { useRaceRevenueExperiment } from '@/hooks/useRaceRevenueExperiment';
import type { GradeRaceTopHorseMap, HomeSpecialPickSet } from '@/lib/home-page-summary';
import type { TopPayoutHit, WeeklyGradeRace } from '@/lib/types';

type RaceDayExtrasProps = {
    date: string;
    hasRaces: boolean;
    hasNarRaces: boolean;
    specialPicks?: HomeSpecialPickSet;
    topHits?: TopPayoutHit[];
    weeklyGradeRaces?: WeeklyGradeRace[];
    gradeRaceTopHorses?: GradeRaceTopHorseMap;
};

export function RaceDayExtras({
    date,
    hasRaces,
    hasNarRaces,
    specialPicks,
    topHits,
    weeklyGradeRaces,
    gradeRaceTopHorses,
}: RaceDayExtrasProps) {
    const raceRevenueExperiment = useRaceRevenueExperiment();

    return (
        <div
            className="flex flex-col gap-2 sm:gap-3"
            data-race-revenue-variant={raceRevenueExperiment.ready ? raceRevenueExperiment.variant : 'pending'}
            data-race-revenue-eligible={raceRevenueExperiment.eligible ? 'true' : 'false'}
        >
            {hasRaces && <DisclaimerNote className="px-1.5 md:px-1" />}

            <RecentRaceReturn />

            {/* 注目馬は見出しと白い紙面の中に置く（以前は見出しなしで、ボードの下に別レースの馬だけが浮いて見えていた） */}
            {hasRaces && specialPicks?.favored && (
                <section aria-labelledby="race-day-pick-heading" className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
                    <SectionHeader id="race-day-pick-heading" title="この日の分析注目馬" className="!mb-3" compact />
                    <SpecialPickCard date={date} precomputedPicks={specialPicks} />
                </section>
            )}

            {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                <WeeklyGradeRaces races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} compact />
            )}

            <TopHitsDisplay initialHits={topHits} />

            <AffiliateSlot
                context="race_after_top_hits"
                raceType={hasNarRaces ? 'nar' : 'jra'}
                selectionKey={date}
                variant="compact"
            />

            {hasRaces && raceRevenueExperiment.shouldRenderLegacySlot && (
                <InFeedAd
                    refreshKey={`race-after-top-hits-${date}`}
                    analyticsPlacement="race_after_top_hits_infeed"
                    analyticsVariant={raceRevenueExperiment.eligible ? 'legacy' : undefined}
                    lazyRootMargin="520px 0px 520px 0px"
                    refreshRootMarginPx={600}
                />
            )}
        </div>
    );
}
