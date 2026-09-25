'use client';

// 開催日ボード：その日の全会場×全レースを1画面で。PCは会場ごとの列、スマホは会場を選んで1列。
// 各行はレース詳細へのリンク。中央／地方と会場の切り替えは、従来の日付ページと同じ計測イベントを送る。
// 見出し（h1）と開催の説明・日付送りもここで描く。説明はデータを取り直したときに変わるため（2026-09-25 スマホの見直し：
// 見本どおり説明を h1 の直下へ移した。以前は日付送りの下にあった）。
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { getPredictionsForDate } from '@/lib/api';
import { buildRaceDaySummary, type BoardRace, type BoardVenue, type RaceDaySummary } from '@/lib/race-day-summary';
import { sendRaceGroupSelectEvent, sendRaceVenueSelectEvent } from '@/lib/analytics';
import { getSurfaceLabel } from '@/lib/race-display';
import { GradeBadge, HorseNumber, RaceNumberBox } from '@/components/RaceParts';
import { GuideHorse } from '@/components/BrandLogo';
import { LineIcon } from '@/components/LineIcon';

type GroupKey = 'jra' | 'nar';

type RaceDayBoardProps = {
    initialSummary: RaceDaySummary;
    // ページの見出し（例：9月24日(木)のレース分析）と、日付送り（サーバーで組み立てて渡す）
    title: string;
    dateNav?: ReactNode;
    // サーバーで描いたコース図（会場名 → 要素）。コースのデータをクライアントへ送らないため
    glyphs?: Record<string, ReactNode>;
    // 当日・翌日などデータの到着前に表示した場合に、クライアントで一度だけ取り直す
    refetchIfEmpty?: boolean;
    // レースが無い日の主ボタン（翌日または今日のボードへ）と、その下に置くもの（最新の分析記事）
    emptyPrimary?: { href: string; label: string };
    emptyAside?: ReactNode;
};

// APIの理由は「新馬戦のため、予測対象外です。」の形で届く。見本の「新馬戦のためAI偏差値の対象外」にそろえる
const unpredictableText = (reason: string | null) => {
    if (!reason) return 'AI偏差値の対象外';
    const base = reason.replace(/[、,]?\s*(予測|AI偏差値の)?対象外(です)?。?$/, '').replace(/。$/, '');
    if (!base) return 'AI偏差値の対象外';
    return base.endsWith('ため') ? `${base}AI偏差値の対象外` : base;
};

function BoardRow({ race }: { race: BoardRace }) {
    return (
        // 最後の行は下線を引かない（外枠の線と二重になるため）
        <li className="[&:last-child>a]:border-b-0">
            <Link
                href={race.href}
                prefetch={false}
                className="flex gap-2.5 border-b border-slate-200 px-3 py-2.5 transition-colors duration-150 hover:bg-slate-50"
            >
                <RaceNumberBox raceNumber={race.raceNumber} size={34} />
                {/* スマホは行送りを詰める（以前はレース画面の行間1.6を受け継ぎ、1行ごとに約25px空いていた。文字の大きさは変えない）。PC は今のまま */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.35] md:gap-1 md:leading-normal">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-bold text-slate-900">{race.name}</span>
                        <GradeBadge grade={race.grade} />
                    </span>
                    <span className="whitespace-nowrap text-[12px] text-slate-500">
                        {getSurfaceLabel(race.courseType)}{race.distance ?? ''}{race.distance ? 'm' : ''}
                        {race.runners > 0 ? ` · ${race.runners}頭` : ''}
                    </span>
                    {race.top ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="whitespace-nowrap text-[11px] font-bold text-ai-deep">AI 1位</span>
                            <HorseNumber number={race.top.number} waku={race.top.waku} size={19} />
                            <span className="min-w-0 flex-1 break-words text-[13px] font-bold text-slate-900">{race.top.name}</span>
                            <span className="ml-auto shrink-0 font-num text-[15px] font-bold text-ai-deep">{race.top.score.toFixed(1)}</span>
                        </span>
                    ) : (
                        <span className="text-[12px] text-slate-500">{unpredictableText(race.unpredictableReason)}</span>
                    )}
                </span>
            </Link>
        </li>
    );
}

function VenueColumn({ venue, glyph }: { venue: BoardVenue; glyph?: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby={`board-venue-${venue.venue}`}>
            <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3.5 py-3">
                <div className="flex flex-1 flex-col gap-0.5">
                    <h2 id={`board-venue-${venue.venue}`} className="text-[22px] font-extrabold leading-tight text-slate-900">{venue.venue}</h2>
                    <p className="text-[12px] font-bold text-slate-500">
                        全{venue.races.length}R
                    </p>
                </div>
                {glyph && <span className="block w-[78px] shrink-0" aria-hidden="true">{glyph}</span>}
            </header>
            <ul>
                {venue.races.map((race) => <BoardRow key={race.raceNumber} race={race} />)}
            </ul>
        </section>
    );
}

const describeDay = (summary: RaceDaySummary) => {
    const parts: string[] = [];
    if (summary.jra.length) parts.push(`中央${summary.jra.length}場`);
    if (summary.nar.length) parts.push(`地方${summary.nar.length}場`);
    const races = `${summary.totalRaces}レース`;
    return `${parts.join('・')} · ${races}`;
};

export function RaceDayBoard({
    initialSummary,
    title,
    dateNav,
    glyphs = {},
    refetchIfEmpty = false,
    emptyPrimary,
    emptyAside,
}: RaceDayBoardProps) {
    const [summary, setSummary] = useState(initialSummary);
    const [isLoading, setIsLoading] = useState(refetchIfEmpty && initialSummary.totalRaces === 0);
    const [group, setGroup] = useState<GroupKey>(initialSummary.jra.length > 0 ? 'jra' : 'nar');
    const [venueIndex, setVenueIndex] = useState(0);

    useEffect(() => {
        if (!refetchIfEmpty || initialSummary.totalRaces > 0) return undefined;
        let cancelled = false;
        getPredictionsForDate(initialSummary.date)
            .then((data) => {
                if (cancelled) return;
                const next = buildRaceDaySummary(data, initialSummary.date);
                setSummary(next);
                setGroup(next.jra.length > 0 ? 'jra' : 'nar');
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [initialSummary, refetchIfEmpty]);

    // 見出し・開催の説明・日付送り。説明は h1 の直下（見本）。PC（1024px以上）は右に日付送り
    const pageHead = (
        <header className="flex flex-col gap-3 md:mb-1 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-1 md:gap-1.5">
                <h1 className="text-[22px] font-extrabold leading-tight text-slate-900 md:text-[32px]">{title}</h1>
                {!isLoading && summary.totalRaces > 0 && (
                    <p className="text-[12.5px] font-bold text-slate-500 md:text-sm">{describeDay(summary)}</p>
                )}
            </div>
            {dateNav}
        </header>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 md:gap-4">
                {pageHead}
                <div className="h-[420px] rounded-xl border border-slate-200 bg-slate-50" aria-busy="true" aria-label="レース一覧を読み込み中" />
            </div>
        );
    }

    if (summary.totalRaces === 0) {
        // 見本（開催のない日）：案内役の馬・1行の見出しと説明・主と副のボタン。その下に最新の分析記事
        return (
            <div className="flex flex-col gap-3 md:gap-4">
                {pageHead}
                <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center md:py-8">
                    <GuideHorse size={110} mood="sleep" />
                    {/* 狭い画面で折り返すときは「この日のレースは／まだありません」の区切りで折る */}
                    <h2 className="text-[20px] font-extrabold text-slate-900">
                        <span className="inline-block">この日のレースは</span><span className="inline-block">まだありません</span>
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-700">開催がないか、データの公開前です。</p>
                    <div className="flex w-full max-w-md flex-col gap-2">
                        {emptyPrimary && (
                            <Link href={emptyPrimary.href} prefetch={false} className="ui-btn ui-btn--primary ui-btn--full">
                                {emptyPrimary.label}
                                <LineIcon name="arrowR" size={18} className="block shrink-0" />
                            </Link>
                        )}
                        <Link href="/keiba-data" prefetch={false} className="ui-btn ui-btn--secondary ui-btn--full">
                            過去のデータを調べる
                            <LineIcon name="chevR" size={18} className="block shrink-0" />
                        </Link>
                    </div>
                </section>
                {emptyAside}
            </div>
        );
    }

    const groups: Array<{ key: GroupKey; label: string; venues: BoardVenue[] }> = [
        { key: 'jra', label: '中央競馬', venues: summary.jra },
        { key: 'nar', label: '地方競馬', venues: summary.nar },
    ];
    const venues = group === 'jra' ? summary.jra : summary.nar;
    const selectedVenue = venues[Math.min(venueIndex, venues.length - 1)];

    const selectGroup = (key: GroupKey) => {
        if (key === group) return;
        setGroup(key);
        setVenueIndex(0);
        sendRaceGroupSelectEvent({ race_date: summary.date, race_type: key });
    };
    const selectVenue = (index: number) => {
        if (index === venueIndex) return;
        setVenueIndex(index);
        const venue = venues[index];
        if (venue) sendRaceVenueSelectEvent({ race_date: summary.date, race_type: group, venue_name: venue.venue });
    };

    return (
        <div className="flex flex-col gap-3 md:gap-4">
            {pageHead}

            <div role="tablist" aria-label="中央・地方" className="flex gap-1 border-b border-slate-300">
                {groups.map((item) => {
                    const count = item.venues.reduce((sum, venue) => sum + venue.races.length, 0);
                    const active = item.key === group;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            disabled={item.venues.length === 0}
                            onClick={() => selectGroup(item.key)}
                            className={`relative flex h-12 items-center gap-2 px-3 text-[14.5px] font-bold transition-colors duration-150 disabled:cursor-default md:px-4 md:text-[15.5px] ${active ? 'text-navy' : 'text-slate-500 hover:text-navy disabled:hover:text-slate-500'}`}
                        >
                            {item.label}
                            <span className={`font-num text-[13px] font-semibold ${active ? 'text-brand-700' : 'text-slate-400'}`}>
                                {item.venues.length > 0 ? `${item.venues.length}場 ${count}R` : '開催なし'}
                            </span>
                            {active && <span className="absolute inset-x-2.5 -bottom-px h-[3px] rounded-[3px] bg-brand-600" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>

            {/* スマホ：会場を選んで1列 */}
            <div className="flex flex-col gap-3 md:hidden">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(venues.length, 1), 4)}, minmax(0, 1fr))` }}>
                    {venues.map((venue, index) => {
                        const active = venue === selectedVenue;
                        return (
                            <button
                                key={venue.venue}
                                type="button"
                                aria-pressed={active}
                                onClick={() => selectVenue(index)}
                                className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors duration-150 ${active ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                            >
                                {/* コース図は場ごとに縦の長さが違うため、同じ高さの箱の中で上下の中央に置く（名前とR数の高さをそろえる） */}
                                {glyphs[venue.venue] && (
                                    <span className={`flex h-7 w-10 items-center ${active ? '' : 'opacity-50 grayscale'}`} aria-hidden="true">{glyphs[venue.venue]}</span>
                                )}
                                <span className="text-[14px] font-bold">{venue.venue}</span>
                                <span className="font-num text-[12px] opacity-75">{venue.races.length}R</span>
                            </button>
                        );
                    })}
                </div>
                {selectedVenue && (
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label={`${selectedVenue.venue}のレース`}>
                        <ul>
                            {selectedVenue.races.map((race) => <BoardRow key={race.raceNumber} race={race} />)}
                        </ul>
                    </section>
                )}
            </div>

            {/* PC：会場ごとの列 */}
            <div
                className="hidden items-start gap-4 md:grid"
                style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(venues.length, 1), 4)}, minmax(0, 1fr))` }}
            >
                {venues.map((venue) => (
                    <VenueColumn key={venue.venue} venue={venue} glyph={glyphs[venue.venue]} />
                ))}
            </div>
        </div>
    );
}
