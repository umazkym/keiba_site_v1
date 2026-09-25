'use client';

// 開催日ボードの下に置く部分。免責の1文・前回見たレース・PR・記事内広告（実験）。計測名と広告枠は従来の日付ページと同じ。
// 免責は黄色の警告帯をやめ、ボードの直後の1文（DisclaimerNote）にした（2026-09-25）。
// 「注目馬・近日の重賞・高配当」は見本（スマホ・PC とも）に無いため外した（2026-09-25 スマホの見直し。ホームにある）。
import { DisclaimerNote } from '@/components/DisclaimerNote';
import { InFeedAd } from '@/components/InFeedAd';
import { RecentRaceReturn } from '@/components/RecentRaceReturn';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { useRaceRevenueExperiment } from '@/hooks/useRaceRevenueExperiment';

type RaceDayExtrasProps = {
    date: string;
    hasRaces: boolean;
    hasNarRaces: boolean;
};

export function RaceDayExtras({
    date,
    hasRaces,
    hasNarRaces,
}: RaceDayExtrasProps) {
    const raceRevenueExperiment = useRaceRevenueExperiment();

    return (
        <div
            className="flex flex-col gap-3"
            data-race-revenue-variant={raceRevenueExperiment.ready ? raceRevenueExperiment.variant : 'pending'}
            data-race-revenue-eligible={raceRevenueExperiment.eligible ? 'true' : 'false'}
        >
            {/* スマホは一覧の左端（外枠の16px）にそろえる。PC は今のまま */}
            {hasRaces && <DisclaimerNote className="md:px-1" />}

            <RecentRaceReturn />

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
