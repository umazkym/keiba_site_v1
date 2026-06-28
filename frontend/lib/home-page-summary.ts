import type {
    RaceDayPrediction,
    RacePrediction,
    SpecialPick,
    WeeklyGradeRace,
} from '@/lib/types';

export type HomeRaceType = 'jra' | 'nar';

export type HomeVenueSummary = {
    venue_name: string;
    race_count: number;
    first_race_number: number | null;
    race_type: HomeRaceType;
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
    venue_name: string;
    race_number: number;
    race_name: string;
    race_id: string;
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

export function summarizeHomeVenues(predictions: RaceDayPrediction | null): HomeVenueSummary[] {
    const jraVenues = predictions?.jra ?? [];
    const narVenues = predictions?.nar ?? [];

    return [
        ...jraVenues.map((venue) => ({
            venue_name: venue.venue_name,
            race_count: venue.races.length,
            first_race_number: venue.races[0]?.race_number ?? null,
            race_type: 'jra' as const,
        })),
        ...narVenues.map((venue) => ({
            venue_name: venue.venue_name,
            race_count: venue.races.length,
            first_race_number: venue.races[0]?.race_number ?? null,
            race_type: 'nar' as const,
        })),
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
                    venue_name: venue.venue_name,
                    race_number: race.race_number,
                    race_name: race.race_name,
                    race_id: race.id,
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
        `AI偏差値 ${bestFavored.deviation_score.toFixed(1)}。本日の全開催を通じて上位に位置する評価です。能力面の条件は整っており、当日の馬場状態や展開面も合わせて確認したい一頭です。`,
    );

    const narCandidates = allHorses.filter((horse) => horse.is_nar && horse.mark === '◎');
    const narPool = allHorses.filter((horse) => horse.is_nar);
    const bestNar = selectTopHorse(narCandidates) ?? selectTopHorse(narPool);
    const nar = bestNar
        ? toSpecialPick(
            bestNar,
            `AI偏差値 ${bestNar.deviation_score.toFixed(1)}。本日の地方競馬（NAR）開催の中で目立つ評価を受けています。ダート適性と馬場の利条件を合わせて判断材料にしたい一頭。`,
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
            `AI偏差値 ${bestValue.deviation_score.toFixed(1)}。展開面や枠順条件次第で評価を上げたい相手候補です。人気馬とのオッズ差も考慮しながら判断材料にしたい一頭。`,
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
