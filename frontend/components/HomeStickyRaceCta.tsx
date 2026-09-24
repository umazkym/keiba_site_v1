'use client';

import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';
import { LineIcon } from '@/components/LineIcon';

type HomeStickyRaceCtaProps = {
    raceDate: string;
    raceCount: number;
};

export function HomeStickyRaceCta({ raceDate, raceCount }: HomeStickyRaceCtaProps) {
    return (
        <div
            className="home-sticky-race-cta"
        >
            {/* Safariタブ変色防止: ビューポート最下端にサイト背景色の物理シールドを配置し
                Safariの色サンプリングが青色ボタンを検出しないようにする */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[6px]" style={{ background: '#F3F5FA' }} aria-hidden="true" />
            <div className="relative mx-auto flex max-w-[1600px] items-center justify-center px-3 pb-[8px] pt-[2px] sm:px-4 md:px-6">
                <HomeRaceEntryLink
                    href={`/races/${raceDate}`}
                    raceDate={raceDate}
                    entryMethod="sticky_cta"
                    className="flex h-[52px] w-full items-center gap-2.5 rounded-[14px] bg-brand-600 pl-2.5 pr-2 text-white shadow-[0_10px_24px_rgba(76,78,255,0.32)] transition-colors duration-150 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 sm:max-w-md"
                >
                    {raceCount > 0 && (
                        <span className="shrink-0 rounded-[9px] bg-white/[0.18] px-2.5 py-1.5 font-num text-[15px] font-bold leading-none">本日 {raceCount}R</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-center text-[15px] font-bold">今日の全レースを確認する</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden="true">
                        <LineIcon name="arrowR" size={20} />
                    </span>
                </HomeRaceEntryLink>
            </div>
        </div>
    );
}
