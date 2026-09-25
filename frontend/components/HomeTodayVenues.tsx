'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AffiliateSlot } from '@/components/AffiliateSlot';
import { getPredictionsForDate } from '@/lib/api';
import {
    summarizeHomeVenues,
    type HomeVenueSummary,
} from '@/lib/home-page-summary';
import { buildRaceDaySummary, type BoardVenue, type RaceDaySummary } from '@/lib/race-day-summary';
import { CompactRaceRow, RaceListCaption } from '@/components/RaceDayRows';
import { getRaceDetailPath } from '@/lib/race-url';
import { sendHomeRaceEntryClickEvent } from '@/lib/analytics';
import { GradeBadge, HorseNumber, RaceNumberBox } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

type RefreshStatus = 'ready' | 'checking' | 'waiting' | 'empty';

type HomeTodayVenuesProps = {
    date: string;
    initialVenues: HomeVenueSummary[];
    // スマホの「会場を選ぶ→その場でレースの一覧」用の要約（開催日ボードと同じ形。全馬の予測は送らない）
    initialRaceDay: RaceDaySummary;
    // サーバーで描いたコース図（会場名 → 要素）
    glyphs?: Record<string, ReactNode>;
};

// wide：スマホの2列で会場数が奇数のとき、最後のカードを2列ぶんに広げて空きを作らない。
// 広げたカードは「メイン」と「AI 1位」を左右に並べ、縦を伸ばさない（xl以上はふつうの1枠）。
function VenueTile({ venue, date, glyph, wide = false }: { venue: HomeVenueSummary; date: string; glyph?: ReactNode; wide?: boolean }) {
    const main = venue.main;
    return (
        <Link
            prefetch={false}
            href={venue.first_race_number
                ? getRaceDetailPath(date, venue.venue_name, venue.first_race_number)
                : `/races/${date}`}
            onClick={() => {
                sendHomeRaceEntryClickEvent({
                    race_date: date,
                    entry_method: 'venue_card',
                    race_type: venue.race_type,
                    venue_name: venue.venue_name,
                });
            }}
            className={`flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors duration-150 hover:border-brand-300 md:gap-3 md:px-[18px] md:pb-4 md:pt-[18px] ${wide ? 'col-span-2 xl:col-span-1' : ''}`}
        >
            {/* スマホは区切りの線を上の枠線にまとめ、「メイン／最終レース」の札を省いて縦を詰める（R番号とレース名で分かる。2026-09-26） */}
            <span className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-1">
                    <span className="font-display text-[21px] font-bold leading-none text-slate-900 md:text-[26px]">{venue.venue_name}</span>
                    <span className="whitespace-nowrap text-[12px] font-bold text-slate-500">
                        全{venue.race_count}R{venue.surfaces ? ` · ${venue.surfaces}` : ''}
                    </span>
                </span>
                {glyph && <span className="block w-[58px] min-w-0 max-w-[35%] max-[359px]:w-[44px] xl:w-[92px]" aria-hidden="true">{glyph}</span>}
            </span>
            {main && (
                <span className={`min-w-0 border-t border-slate-200 pt-2 md:pt-3 ${wide ? 'grid grid-cols-2 gap-3 xl:flex xl:flex-col' : 'flex flex-col gap-1.5 md:gap-3'}`}>
                    <span className="flex min-w-0 flex-col gap-1.5">
                        <span className="hidden items-center gap-1.5 text-[11.5px] font-bold text-slate-500 md:flex">
                            {main.label}
                            <GradeBadge grade={main.grade} />
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5">
                            <RaceNumberBox raceNumber={main.race_number} size={24} />
                            <span className="min-w-0 truncate text-[13px] font-bold text-slate-900 md:text-[14.5px]">{main.race_name}</span>
                            <span className="shrink-0 md:hidden"><GradeBadge grade={main.grade} /></span>
                        </span>
                    </span>
                    {main.top ? (
                        // スマホ・タブレットは「AI 1位 … 偏差値」と馬名を2段に分け、馬名を切れにくくする。lg以上は1行
                        <span className="flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-1.5">
                            <span className="flex items-baseline justify-between lg:contents">
                                <span className="whitespace-nowrap text-[11.5px] font-bold text-ai-deep">AI 1位</span>
                                <span className="font-num text-[16px] font-bold leading-none text-ai-deep md:text-[17px] lg:order-last">{main.top.score.toFixed(1)}</span>
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 lg:flex-1">
                                <HorseNumber number={main.top.number} waku={main.top.waku} size={20} />
                                <span className="min-w-0 break-words text-[13px] font-bold text-slate-900 md:text-[14px]">{main.top.name}</span>
                            </span>
                        </span>
                    ) : (
                        <span className="text-[12px] text-slate-500">AI偏差値の対象外のレースです</span>
                    )}
                </span>
            )}
            <span className="hidden h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-50 text-[13.5px] font-bold text-brand-700 md:flex">
                1Rから確認する
                <LineIcon name="arrowR" size={16} />
            </span>
        </Link>
    );
}

// タブレットは2列を保ち、広いPCで会場数に合わせる。図と名称の幅を確保する。
const venueGridCols = (count: number) => (count >= 4 ? 'xl:grid-cols-4' : count === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2');

const hasVenueData = (venues: HomeVenueSummary[]): boolean => (
    venues.length > 0
);

// スマホの会場の一覧（2026-09-26 画面の案D）。会場を選ぶと、その場でレースが並ぶ（開催日ボードへ移らずに選べる）。
// 会場は横に隠さず全部見せる。5場までは1段、6場以上は2段にそろえる（6場→3列、8場→4列、9〜10場→5列）。
// 11場以上は5列で3段になる。レースは5件まで出し、残りはその場で開く。
const FIRST_ROWS = 5;
const venueTabColumns = (count: number) => (count <= 5 ? Math.max(count, 1) : Math.min(5, Math.ceil(count / 2)));

function HomeVenueRaces({ date, raceDay, glyphs }: { date: string; raceDay: RaceDaySummary; glyphs: Record<string, ReactNode> }) {
    const groups: Array<{ type: 'jra' | 'nar'; venue: BoardVenue }> = [
        ...raceDay.jra.map((venue) => ({ type: 'jra' as const, venue })),
        ...raceDay.nar.map((venue) => ({ type: 'nar' as const, venue })),
    ];
    const [selected, setSelected] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const current = groups[Math.min(selected, groups.length - 1)];
    if (!current) return null;
    const { venue, type } = current;
    const rest = venue.races.length - FIRST_ROWS;
    const visible = expanded ? venue.races : venue.races.slice(0, FIRST_ROWS);
    const panelId = 'home-venue-races';

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white md:hidden" aria-label="会場ごとのレース">
            <div
                role="tablist"
                aria-label="会場"
                className="grid border-b border-slate-200"
                style={{ gridTemplateColumns: `repeat(${venueTabColumns(groups.length)}, minmax(0, 1fr))` }}
            >
                {groups.map(({ venue: item }, index) => {
                    const active = index === selected;
                    return (
                        <button
                            key={item.venue}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={panelId}
                            onClick={() => {
                                setSelected(index);
                                setExpanded(false);
                            }}
                            className={`relative flex min-w-0 flex-col items-center gap-0.5 pb-1.5 pt-2 transition-colors duration-150 ${active ? 'text-navy' : 'text-slate-500'}`}
                        >
                            {glyphs[item.venue] && (
                                <span className={`flex h-6 w-9 items-center ${active ? '' : 'opacity-50 grayscale'}`} aria-hidden="true">{glyphs[item.venue]}</span>
                            )}
                            <span className="text-[15px] font-bold leading-tight">{item.venue}</span>
                            <span className="font-num text-[11px] font-semibold leading-none">{item.races.length}R</span>
                            {active && <span className="absolute inset-x-[20%] bottom-0 h-[3px] rounded-t-[3px] bg-brand-600" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
            <div id={panelId} role="tabpanel" aria-label={`${venue.venue}のレース`} className="px-3.5">
                <RaceListCaption className="pt-1.5" />
                <ul>
                    {visible.map((race) => (
                        <CompactRaceRow
                            key={race.raceNumber}
                            race={race}
                            onClick={() => {
                                sendHomeRaceEntryClickEvent({
                                    race_date: date,
                                    entry_method: 'venue_card',
                                    race_type: type,
                                    venue_name: venue.venue,
                                });
                            }}
                        />
                    ))}
                </ul>
            </div>
            {rest > 0 && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setExpanded((value) => !value)}
                    className="flex h-10 w-full items-center justify-center gap-1 border-t border-slate-200 text-[13.5px] font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50"
                >
                    {expanded ? '閉じる' : `${venue.venue}の残り${rest}レースを表示`}
                    <LineIcon name="chevD" size={16} className={`block transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                </button>
            )}
        </section>
    );
}

export function HomeTodayVenues({
    date,
    initialVenues,
    initialRaceDay,
    glyphs = {},
}: HomeTodayVenuesProps) {
    const initialHasVenueData = hasVenueData(initialVenues);
    const [venues, setVenues] = useState<HomeVenueSummary[]>(initialVenues);
    const [raceDay, setRaceDay] = useState<RaceDaySummary>(initialRaceDay);
    const [status, setStatus] = useState<RefreshStatus>(
        initialHasVenueData ? 'ready' : 'checking',
    );
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (hasVenueData(initialVenues)) {
            setVenues(initialVenues);
            setRaceDay(initialRaceDay);
            setStatus('ready');
            return;
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const refresh = async (attempt: number) => {
            setStatus(attempt === 0 ? 'checking' : 'waiting');
            const freshPredictions = await getPredictionsForDate(date, { bypassCache: true });

            if (cancelled) return;

            const freshVenues = summarizeHomeVenues(freshPredictions);
            if (hasVenueData(freshVenues)) {
                setVenues(freshVenues);
                setRaceDay(buildRaceDaySummary(freshPredictions, date));
                setStatus('ready');
                return;
            }

            if (attempt === 0) {
                setStatus('waiting');
                retryTimer = setTimeout(() => {
                    void refresh(1);
                }, 60_000);
                return;
            }

            setStatus('empty');
        };

        void refresh(0);

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, [date, initialVenues, initialRaceDay, refreshKey]);

    const jraVenues = venues.filter((venue) => venue.race_type === 'jra');
    const narVenues = venues.filter((venue) => venue.race_type === 'nar');
    const showVenues = jraVenues.length > 0 || narVenues.length > 0;
    const orderedVenues = [...jraVenues, ...narVenues];

    return (
        <>
            {showVenues && <HomeVenueRaces date={date} raceDay={raceDay} glyphs={glyphs} />}

            {/* タブレット・PC は会場カード（スマホは上の会場の一覧） */}
            <div className={`grid grid-cols-2 gap-2.5 md:gap-4 ${venueGridCols(orderedVenues.length)} ${showVenues ? 'max-md:hidden' : ''}`}>
                {orderedVenues.map((venue, index) => (
                    <VenueTile
                        key={venue.venue_name}
                        venue={venue}
                        date={date}
                        glyph={glyphs[venue.venue_name]}
                        wide={orderedVenues.length % 2 === 1 && index === orderedVenues.length - 1}
                    />
                ))}

                {!showVenues && (
                    <div className="col-span-full rounded-xl border border-slate-200 bg-white py-6 text-center">
                        <p className="text-sm text-slate-600">
                            {status === 'checking' && '本日のレースデータを確認しています。'}
                            {status === 'waiting' && '本日のレースデータを更新中です。約1分後に自動で再確認します。'}
                            {status === 'empty' && '本日のレースデータの反映に時間がかかっています。'}
                        </p>
                        {status === 'empty' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setStatus('checking');
                                    setRefreshKey((current) => current + 1);
                                }}
                                className="ui-btn ui-btn--ghost mt-2"
                            >
                                データを再確認
                            </button>
                        )}
                    </div>
                )}
            </div>

            {narVenues.length > 0 && (
                <AffiliateSlot
                    context="home_nar_voting"
                    raceType="nar"
                    selectionKey={date}
                    // スマホは外側の余白を持たず、親の gap（12px）で間を決める。PCは今までどおり上16px・下12px
                    className="sm:mt-4 sm:mb-3"
                />
            )}
        </>
    );
}
