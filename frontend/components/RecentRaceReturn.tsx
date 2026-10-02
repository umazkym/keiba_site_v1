'use client';

// 14日以内にレースを見た人へ、「前回の続き」のカードを1つ出す。
// 見たレースは localStorage にあり、サーバーでは分からない。表示のあとでカードを差し込むと、下の物が丸ごと下へ動く。
// そこで、カードと同じ高さの箱を最初から hidden 属性つきで HTML に出し、すぐ後ろの小さなスクリプトが
// 最初の描画の前に hidden を外して場所を取る（2026-10-02。RaceDateTodayLink と同じ形）。中身は React が入れる。
// 見たレースが無い人（初めての人）は hidden のままで、場所も取らない。
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    LAST_RACE_STORAGE_KEY,
    RACE_MEMORY_MAX_AGE_MS,
    StoredRaceView,
} from '@/lib/race-memory';
import { sendRecentRaceReturnClickEvent } from '@/lib/analytics';
import { RacePlate } from '@/components/RaceParts';
import { LineIcon } from '@/components/LineIcon';

type RecentRaceReturnProps = {
    className?: string;
};

// 箱とカードの高さ（同じ値を両方に付ける。中身が入っても高さが変わらないように）。
// 58px ＝ 枠線 1+1 ＋ 上下の余白 8+8 ＋ 中身 40（文字2行：11.5px×1.5 ＋ すき間2 ＋ 14px×1.5 ＝ 40.25。プレートは 34）
const CARD_HEIGHT_CLASS = 'h-[58px]';

const formatRaceDate = (date: string) => {
    const [, month, day] = date.split('-');
    if (!month || !day) return date;
    return `${Number(month)}/${Number(day)}`;
};

const isStoredRaceView = (value: unknown): value is StoredRaceView => {
    if (!value || typeof value !== 'object') return false;
    const race = value as Partial<StoredRaceView>;
    return (
        typeof race.href === 'string' &&
        race.href.startsWith('/races/') &&
        typeof race.date === 'string' &&
        typeof race.venueName === 'string' &&
        typeof race.raceNumber === 'number' &&
        typeof race.raceName === 'string' &&
        typeof race.viewedAt === 'number'
    );
};

// 保存した値から、出すレースを決める（無ければ null）。discard は「保存が壊れている・古いので消す」。
// 下の REVEAL_SCRIPT と同じ条件にする（どちらかを直すときは、もう片方も直す）
export const pickRecentRace = (
    raw: string | null,
    now: number,
    currentHref: string,
): { race: StoredRaceView | null; discard: boolean } => {
    if (!raw) return { race: null, discard: false };

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { race: null, discard: false };
    }

    if (!isStoredRaceView(parsed)) return { race: null, discard: true };
    if (now - parsed.viewedAt > RACE_MEMORY_MAX_AGE_MS) return { race: null, discard: true };
    return { race: parsed.href === currentHref ? null : parsed, discard: false };
};

// HTML の解析中にその場で動くスクリプト。中身は ASCII だけにする（日本語や全角の記号を入れると、構文エラーになることがある）。
// 鍵と期限は直前の箱の data 属性から読む（値を文字列に差し込まない）。判定は上の pickRecentRace と同じ。
// 読むだけで、保存は消さない（消すのは React の側）。失敗したら何もしない。
const REVEAL_SCRIPT = '(function(){try{var s=document.currentScript,el=s&&s.previousElementSibling;if(!el)return;var k=el.getAttribute("data-storage-key")||"",m=Number(el.getAttribute("data-max-age-ms"));if(!k||!(m>0))return;var raw=window.localStorage.getItem(k);if(!raw)return;var r=JSON.parse(raw);if(!r||typeof r!=="object")return;if(typeof r.href!=="string"||r.href.indexOf("/races/")!==0||typeof r.date!=="string"||typeof r.venueName!=="string"||typeof r.raceNumber!=="number"||typeof r.raceName!=="string"||typeof r.viewedAt!=="number")return;if(Date.now()-r.viewedAt>m)return;if(r.href===window.location.pathname+window.location.search)return;el.removeAttribute("hidden")}catch(e){}})();';

// サーバーでは useLayoutEffect が使えないため、サーバーでは useEffect にする
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RecentRaceReturn({ className = '' }: RecentRaceReturnProps) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [recentRace, setRecentRace] = useState<StoredRaceView | null>(null);

    // 画面内の移動で来たときは上のスクリプトが動かないので、ここでも同じ判定をして、描画の前に箱を出す。
    // hidden は React の状態にせず、要素を直接動かす（スクリプトが外した hidden を、React が元に戻さないように）
    useIsomorphicLayoutEffect(() => {
        let race: StoredRaceView | null = null;
        try {
            const currentHref = `${window.location.pathname}${window.location.search}`;
            const picked = pickRecentRace(window.localStorage.getItem(LAST_RACE_STORAGE_KEY), Date.now(), currentHref);
            if (picked.discard) window.localStorage.removeItem(LAST_RACE_STORAGE_KEY);
            race = picked.race;
        } catch {
            race = null;
        }

        // 見たレースが無いときは hidden のまま（今日のレースへの入口はヒーローと固定CTAが持つ）
        const box = boxRef.current;
        if (box) box.hidden = !race;
        setRecentRace(race);
    }, []);

    return (
        <>
            {/* 包む要素ごと hidden にする（カードの flex が hidden 属性に勝ってしまうため）。ここに flex などの display の class を足さない */}
            <div
                ref={boxRef}
                data-storage-key={LAST_RACE_STORAGE_KEY}
                data-max-age-ms={RACE_MEMORY_MAX_AGE_MS}
                hidden
                suppressHydrationWarning
                className={className ? `${CARD_HEIGHT_CLASS} ${className}` : CARD_HEIGHT_CLASS}
            >
                {recentRace && (
                    <Link
                        href={recentRace.href}
                        prefetch={false}
                        onClick={() => sendRecentRaceReturnClickEvent({
                            destination_path: recentRace.href,
                            race_date: recentRace.date,
                            venue_name: recentRace.venueName,
                            race_number: recentRace.raceNumber,
                            age_hours: Math.max(0, Math.floor((Date.now() - recentRace.viewedAt) / 3_600_000)),
                        })}
                        className={`flex ${CARD_HEIGHT_CLASS} items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-3 transition-colors duration-150 hover:border-brand-300`}
                    >
                        <RacePlate venue={recentRace.venueName} raceNumber={recentRace.raceNumber} size="xs" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[11.5px] font-bold text-slate-500">前回の続き · {formatRaceDate(recentRace.date)}</span>
                            <span className="truncate text-[14px] font-bold text-slate-900">
                                {recentRace.raceName}の出走表に戻る
                            </span>
                        </span>
                        <LineIcon name="chevR" size={18} className="block shrink-0 text-slate-500" />
                    </Link>
                )}
            </div>
            <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
        </>
    );
}
