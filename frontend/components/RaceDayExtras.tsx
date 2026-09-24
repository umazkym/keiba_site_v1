'use client';

// 開催日ボードの下に置く部分。従来の日付ページと同じ順・同じ計測・同じ広告枠（PRと記事内広告の実験）を保つ。
import { SpecialPickCard } from '@/components/SpecialPickCard';
import { TopHitsDisplay } from '@/components/TopHitsDisplay';
import { WeeklyGradeRaces } from '@/components/WeeklyGradeRaces';
import DisclaimerAlert from '@/components/DisclaimerAlert';
import { InFeedAd } from '@/components/InFeedAd';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { useRaceRevenueExperiment } from '@/hooks/useRaceRevenueExperiment';
import type { GradeRaceTopHorseMap } from '@/lib/home-page-summary';
import type { SpecialPick, TopPayoutHit, WeeklyGradeRace } from '@/lib/types';

type RaceDayExtrasProps = {
    date: string;
    hasRaces: boolean;
    hasNarRaces: boolean;
    specialPick?: SpecialPick | null;
    topHits?: TopPayoutHit[];
    weeklyGradeRaces?: WeeklyGradeRace[];
    gradeRaceTopHorses?: GradeRaceTopHorseMap;
};

export function RaceDayExtras({
    date,
    hasRaces,
    hasNarRaces,
    specialPick,
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
            <RecentRaceReturn />

            {hasRaces && specialPick && <SpecialPickCard pick={specialPick} date={date} />}

            {weeklyGradeRaces && weeklyGradeRaces.length > 0 && (
                <WeeklyGradeRaces races={weeklyGradeRaces} topHorses={gradeRaceTopHorses} compact />
            )}

            <DisclaimerAlert />

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
