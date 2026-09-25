// 開催日ボード用の要約。全馬の予測データをクライアントへ送らず、一覧に必要な値だけにする。
// サーバー（/races/[date]）で作り、データ到着前にクライアントで取り直したときも同じ関数で作る。
import type { RaceDayPrediction, RacePrediction } from '@/lib/types';
import { getRaceDetailPath } from '@/lib/race-url';
import { getUnpredictableReason, resolveWaku } from '@/lib/race-display';

export type BoardHorse = {
    number: number;
    waku: number | null;
    name: string;
};

export type BoardRace = {
    raceNumber: number;
    name: string;
    grade: string | null;
    courseType: string | null;
    distance: number | null;
    runners: number;
    href: string;
    top: (BoardHorse & { score: number }) | null;
    unpredictableReason: string | null;
};

export type BoardVenue = {
    venue: string;
    races: BoardRace[];
};

export type RaceDaySummary = {
    date: string;
    jra: BoardVenue[];
    nar: BoardVenue[];
    totalRaces: number;
};

const summarizeRace = (race: RacePrediction, date: string, venue: string): BoardRace => {
    const runners = race.total_horses || race.predictions.length;
    const topPrediction = race.predictions
        .filter((p) => p.deviation_score != null)
        .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];
    return {
        raceNumber: race.race_number,
        name: race.race_name,
        grade: race.grade ?? null,
        courseType: race.course_type,
        distance: race.distance,
        runners,
        href: getRaceDetailPath(date, venue, race.race_number),
        top: topPrediction
            ? {
                number: topPrediction.horse_number,
                waku: resolveWaku(topPrediction, race.predictions.length),
                name: topPrediction.horse_name,
                score: topPrediction.deviation_score as number,
            }
            : null,
        unpredictableReason: topPrediction ? null : getUnpredictableReason(race),
    };
};

const summarizeVenues = (venues: RaceDayPrediction['jra'], date: string): BoardVenue[] => (
    (venues ?? []).map((venue) => {
        const races = [...venue.races]
            .sort((a, b) => a.race_number - b.race_number)
            .map((race) => summarizeRace(race, date, venue.venue_name));
        return {
            venue: venue.venue_name,
            races,
        };
    })
);

export const buildRaceDaySummary = (predictions: RaceDayPrediction | null, date: string): RaceDaySummary => {
    const jra = summarizeVenues(predictions?.jra ?? [], date);
    const nar = summarizeVenues(predictions?.nar ?? [], date);
    const all = [...jra, ...nar];
    return {
        date,
        jra,
        nar,
        totalRaces: all.reduce((sum, venue) => sum + venue.races.length, 0),
    };
};
