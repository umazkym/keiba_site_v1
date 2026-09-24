import type {
    RaceDayPrediction,
    RacePrediction,
    SpecialPick,
    VenueRaces,
    WeeklyGradeRace,
} from '@/lib/types';
import { getSurfaceKey, resolveWaku } from '@/lib/race-display';

export type HomeRaceType = 'jra' | 'nar';

export type HomeVenueMainRace = {
    race_number: number;
    race_name: string;
    grade: string | null;
    // 重賞・中央の11R は「メイン」、それ以外は「最終レース」（地方はメインの判定材料が無いため）
    label: 'メイン' | '最終レース';
    top: { number: number; waku: number | null; name: string; score: number } | null;
};

export type HomeVenueSummary = {
    venue_name: string;
    race_count: number;
    first_race_number: number | null;
    race_type: HomeRaceType;
    // 「芝・ダート」「ダート」など
    surfaces: string;
    main: HomeVenueMainRace | null;
};

export type HomeSpecialPickSet = {
    favored: SpecialPick | null;
    value: SpecialPick | null;
    nar: SpecialPick | null;
};

export type GradeRaceTopHorse = {
    horseName: string;
    score: number | null;
};

export type GradeRaceTopHorseMap = Record<string, GradeRaceTopHorse>;

type HomeHorseCandidate = {
    horse_id: string;
    horse_name: string;
    horse_number: number;
    waku_number: number | null;
    venue_name: string;
    race_number: number;
    race_name: string;
    race_id: string;
    course_type: string | null;
    distance: number | null;
    runners: number;
    deviation_score: number;
    mark: string;
    is_nar: boolean;
};

export function getGradeRaceSummaryKey(
    raceDate: string,
    venueName: string,
    raceNumber: number,
): string {
    return `${raceDate}__${venueName}__${raceNumber}`;
}

const summarizeSurfaces = (venue: VenueRaces): string => {
    const keys = new Set(venue.races.map((race) => getSurfaceKey(race.course_type)).filter(Boolean));
    const labels = [keys.has('turf') ? '芝' : null, keys.has('dirt') ? 'ダート' : null, keys.has('jump') ? '障害' : null].filter(Boolean);
    return labels.join('・');
};

const pickMainRace = (venue: VenueRaces, raceType: HomeRaceType): HomeVenueMainRace | null => {
    const races = [...venue.races].sort((a, b) => a.race_number - b.race_number);
    if (races.length === 0) return null;
    const graded = races.filter((race) => race.grade);
    const jraMain = raceType === 'jra' ? races.find((race) => race.race_number === 11) : undefined;
    const main = graded[graded.length - 1] ?? jraMain ?? races[races.length - 1];
    const top = main.predictions
        .filter((p) => p.deviation_score != null)
        .sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];
    return {
        race_number: main.race_number,
        race_name: main.race_name,
        grade: main.grade ?? null,
        label: graded.length > 0 || jraMain ? 'メイン' : '最終レース',
        top: top
            ? { number: top.horse_number, waku: resolveWaku(top, main.predictions.length), name: top.horse_name, score: top.deviation_score as number }
            : null,
    };
};

const summarizeVenue = (venue: VenueRaces, raceType: HomeRaceType): HomeVenueSummary => ({
    venue_name: venue.venue_name,
    race_count: venue.races.length,
    first_race_number: venue.races[0]?.race_number ?? null,
    race_type: raceType,
    surfaces: summarizeSurfaces(venue),
    main: pickMainRace(venue, raceType),
});

export function summarizeHomeVenues(predictions: RaceDayPrediction | null): HomeVenueSummary[] {
    return [
        ...(predictions?.jra ?? []).map((venue) => summarizeVenue(venue, 'jra')),
        ...(predictions?.nar ?? []).map((venue) => summarizeVenue(venue, 'nar')),
    ];
}

export function getHomeRaceDaySummary(venues: HomeVenueSummary[]) {
    return {
        venueCount: venues.length,
        raceCount: venues.reduce((total, venue) => total + venue.race_count, 0),
    };
}

export function getHomeVenueNamesString(venues: HomeVenueSummary[]): string {
    if (venues.length === 0) return '';
    return `本日開催の${venues.map((venue) => venue.venue_name).join('・')}`;
}

// 「中央2場・地方2場」のような開催の数え方
export function describeHomeVenues(venues: HomeVenueSummary[]): string {
    const jra = venues.filter((venue) => venue.race_type === 'jra').length;
    const nar = venues.filter((venue) => venue.race_type === 'nar').length;
    return [jra ? `中央${jra}場` : null, nar ? `地方${nar}場` : null].filter(Boolean).join('・');
}

function collectHomeHorseCandidates(predictions: RaceDayPrediction | null): HomeHorseCandidate[] {
    if (!predictions) return [];

    const narVenueNames = new Set((predictions.nar ?? []).map((venue) => venue.venue_name));
    const allVenues = [...(predictions.jra ?? []), ...(predictions.nar ?? [])];
    const horses: HomeHorseCandidate[] = [];

    allVenues.forEach((venue) => {
        const isNar = narVenueNames.has(venue.venue_name);
        venue.races.forEach((race) => {
            race.predictions.forEach((prediction) => {
                if (prediction.deviation_score == null) return;
                horses.push({
                    horse_id: prediction.horse_id,
                    horse_name: prediction.horse_name,
                    horse_number: prediction.horse_number,
                    waku_number: resolveWaku(prediction, race.predictions.length),
                    venue_name: venue.venue_name,
                    race_number: race.race_number,
                    race_name: race.race_name,
                    race_id: race.id,
                    course_type: race.course_type,
                    distance: race.distance,
                    runners: race.total_horses || race.predictions.length,
                    deviation_score: prediction.deviation_score,
                    mark: prediction.mark,
                    is_nar: isNar,
                });
            });
        });
    });

    return horses;
}

function selectTopHorse<T extends { deviation_score: number }>(horses: T[]): T | null {
    if (horses.length === 0) return null;
    return horses.reduce((max, horse) => (
        horse.deviation_score > max.deviation_score ? horse : max
    ), horses[0]);
}

function toSpecialPick(candidate: HomeHorseCandidate, commentary: string): SpecialPick {
    return {
        horse_id: candidate.horse_id,
        horse_name: candidate.horse_name,
        race_id: candidate.race_id,
        race_name: candidate.race_name,
        venue_name: candidate.venue_name,
        race_number: candidate.race_number,
        deviation_score: candidate.deviation_score,
        commentary,
        horse_number: candidate.horse_number,
        waku_number: candidate.waku_number,
        course_type: candidate.course_type,
        distance: candidate.distance,
        runners: candidate.runners,
    };
}

export function extractHomeSpecialPicks(
    predictions: RaceDayPrediction | null,
    fallbackPick?: SpecialPick | null,
): HomeSpecialPickSet {
    const allHorses = collectHomeHorseCandidates(predictions);

    if (allHorses.length === 0) {
        return {
            favored: fallbackPick ?? null,
            value: null,
            nar: null,
        };
    }

    const favoredCandidates = allHorses.filter((horse) => horse.mark === '◎');
    const bestFavored = selectTopHorse(favoredCandidates) ?? selectTopHorse(allHorses);

    if (!bestFavored) {
        return {
            favored: fallbackPick ?? null,
            value: null,
            nar: null,
        };
    }

    const favored = toSpecialPick(
        bestFavored,
        `本日の全レースで上位のAI偏差値（${bestFavored.deviation_score.toFixed(1)}）です。展開予測と馬番の傾向もあわせて確認できます。`,
    );

    const narCandidates = allHorses.filter((horse) => horse.is_nar && horse.mark === '◎');
    const narPool = allHorses.filter((horse) => horse.is_nar);
    const bestNar = selectTopHorse(narCandidates) ?? selectTopHorse(narPool);
    const nar = bestNar
        ? toSpecialPick(
            bestNar,
            `本日の地方競馬の中で上位のAI偏差値（${bestNar.deviation_score.toFixed(1)}）です。当日の馬場と展開予測をあわせて確認できます。`,
        )
        : null;

    const valueCandidates = allHorses.filter((horse) => (
        horse.horse_id !== bestFavored.horse_id
        && ['○', '〇', '▲', '△', '☆'].includes(horse.mark)
    ));
    const bestValue = valueCandidates.length > 0
        ? selectTopHorse(valueCandidates)
        : allHorses.find((horse) => horse.horse_id !== bestFavored.horse_id) ?? bestFavored;
    const value = bestValue
        ? toSpecialPick(
            bestValue,
            `◎以外の印の馬で最も高いAI偏差値（${bestValue.deviation_score.toFixed(1)}）です。展開や馬番の条件がそろうかを確認したい一頭です。`,
        )
        : null;

    return { favored, value, nar };
}

function findRace(
    predictions: RaceDayPrediction | null,
    venueName: string,
    raceNumber: number,
): RacePrediction | null {
    const allVenues = [...(predictions?.jra ?? []), ...(predictions?.nar ?? [])];
    const venue = allVenues.find((item) => item.venue_name === venueName);
    return venue?.races.find((race) => race.race_number === raceNumber) ?? null;
}

export function buildGradeRaceTopHorseMap(
    predictions: RaceDayPrediction | null,
    races: WeeklyGradeRace[],
): GradeRaceTopHorseMap {
    return races.reduce<GradeRaceTopHorseMap>((rows, race) => {
        const predictionRace = findRace(predictions, race.venue_name, race.race_number);
        if (!predictionRace || predictionRace.predictions.length === 0) return rows;

        const favorite = predictionRace.predictions.find((prediction) => prediction.mark === '◎')
            ?? predictionRace.predictions[0];
        rows[getGradeRaceSummaryKey(race.race_date, race.venue_name, race.race_number)] = {
            horseName: favorite.horse_name,
            score: favorite.deviation_score,
        };
        return rows;
    }, {});
}
