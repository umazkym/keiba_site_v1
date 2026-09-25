// ホームの1画面目（A×C）。写真を全面に敷き、紺の幕の上に見出しと主な操作を置く。
// スマホ：縦の写真の下寄せに見出し、4つの視点は写真に重ねた白い1行。CTAは下の追従ボタンだけ（2026-09-26）。
// PC（1024px以上）：横の写真の左に見出しとCTA、右上に今週の重賞、下に4つの視点の帯。
import type { ReactNode } from 'react';
import type { WeeklyGradeRace } from '@/lib/types';
import type { GradeRaceTopHorseMap } from '@/lib/home-page-summary';
import { HomeRaceEntryLink } from '@/components/HomeRaceEntryLink';
import { RaceAnalysisValueGrid } from '@/components/RaceAnalysisValueGrid';
import { HomeGradeMini } from '@/components/WeeklyGradeRaces';

export type HomeHeroPhoto = 'jra' | 'nar-day' | 'night';

type HomeHeroProps = {
    todayStr: string;
    title: ReactNode;
    // 開催がある日は「本日の開催」
    tagLabel: string;
    updateLabel: string;
    photo: HomeHeroPhoto;
    gradeRaces: WeeklyGradeRace[];
    gradeTopHorses: GradeRaceTopHorseMap;
};

const LEAD = 'AI偏差値・対戦成績・展開・馬番の傾向を、毎朝7時ごろに更新しています。登録は必要ありません。';
// スマホ〜タブレットは1行。4つの名前は直下のカード、更新時刻は上のタグに出ているため繰り返さない（2026-09-25 スマホの見直し）
const LEAD_SHORT = '登録なし・無料で使えます。';

function HeroCta({ todayStr, className }: { todayStr: string; className: string }) {
    return (
        <HomeRaceEntryLink
            href={`/races/${todayStr}`}
            raceDate={todayStr}
            entryMethod="hero_cta"
            data-home-primary-race-cta
            className={className}
        >
            今日の全レースを確認する
            <span aria-hidden="true">→</span>
        </HomeRaceEntryLink>
    );
}

export function HomeHero({ todayStr, title, tagLabel, updateLabel, photo, gradeRaces, gradeTopHorses }: HomeHeroProps) {
    const base = `/images/photos/hero-${photo}`;
    return (
        <section className="relative" aria-labelledby="home-hero-heading">
            {/* スマホは300px（見本は430px）。同じ文言の主ボタンは下の追従ボタンだけにし、写真の下は4つの視点の1行にする
                （2026-09-26 縦の高さの見直し。以前は2×2のカードと主ボタンで写真の下に約240px使っていた） */}
            <div className="relative -mx-4 h-[300px] overflow-hidden sm:mx-0 sm:h-[400px] sm:rounded-xl lg:h-[480px]">
                <picture>
                    <source
                        media="(min-width: 768px)"
                        srcSet={`${base}-pc-1280.webp 1280w, ${base}-pc-1920.webp 1920w`}
                        sizes="(min-width: 1280px) 1232px, 100vw"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- 事前に書き出したWebPを直接配信し、サーバーの画像最適化を使わない */}
                    <img
                        src={`${base}-sp-720.webp`}
                        srcSet={`${base}-sp-720.webp 720w, ${base}-sp-1080.webp 1080w`}
                        sizes="100vw"
                        alt=""
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-[50%_6%] md:object-[62%_42%]"
                    />
                </picture>
                <div className="home-hero-scrim absolute inset-0" aria-hidden="true" />

                <div className="absolute inset-x-4 bottom-[40px] top-3.5 flex flex-col justify-between text-white lg:inset-auto lg:left-11 lg:top-11 lg:w-[min(560px,calc(100%-440px))] lg:justify-start lg:gap-[18px]">
                    <p className="flex items-center gap-2">
                        <span className="rounded-[5px] bg-white px-2 py-0.5 text-[12px] font-bold text-night">{tagLabel}</span>
                        <span className="text-[12.5px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] lg:text-night-sub lg:[text-shadow:none]">{updateLabel}</span>
                    </p>
                    <div className="flex flex-col gap-2 lg:gap-[18px]">
                        <h1 id="home-hero-heading" className="font-brand text-[26px] font-extrabold leading-[1.35] text-white lg:text-[40px]">
                            {title}
                        </h1>
                        <p className="text-[13.5px] leading-relaxed text-night-sub lg:text-base lg:leading-[1.8]">
                            <span className="lg:hidden">{LEAD_SHORT}</span>
                            <span className="hidden lg:inline">{LEAD}</span>
                        </p>
                        <div className="hidden lg:block">
                            <HeroCta todayStr={todayStr} className="ui-btn ui-btn--primary ui-btn--l gap-2.5" />
                        </div>
                    </div>
                </div>

                {gradeRaces.length > 0 && (
                    <div className="absolute right-8 top-8 hidden lg:block">
                        <HomeGradeMini races={gradeRaces} topHorses={gradeTopHorses} />
                    </div>
                )}
            </div>

            {/* スマホ〜タブレット：写真に重ねた白い1行（4つの視点）。主ボタンは画面下の追従ボタンが担う */}
            <div className="relative -mt-7 rounded-xl bg-white px-2 py-2.5 shadow-elevated sm:mx-6 lg:hidden">
                <RaceAnalysisValueGrid variant="strip" />
            </div>

            {/* PC：写真の下端に重ねた4つの視点の帯 */}
            <div className="relative -mt-[46px] ml-8 hidden w-[790px] max-w-[calc(100%-4rem)] lg:block">
                <RaceAnalysisValueGrid variant="bar" />
            </div>
        </section>
    );
}
