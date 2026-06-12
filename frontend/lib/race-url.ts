const VENUE_SLUGS: Record<string, string> = {
    札幌: 'sapporo',
    函館: 'hakodate',
    福島: 'fukushima',
    新潟: 'niigata',
    東京: 'tokyo',
    中山: 'nakayama',
    中京: 'chukyo',
    京都: 'kyoto',
    阪神: 'hanshin',
    小倉: 'kokura',
    門別: 'monbetsu',
    盛岡: 'morioka',
    水沢: 'mizusawa',
    浦和: 'urawa',
    船橋: 'funabashi',
    大井: 'ohi',
    川崎: 'kawasaki',
    金沢: 'kanazawa',
    笠松: 'kasamatsu',
    名古屋: 'nagoya',
    園田: 'sonoda',
    姫路: 'himeji',
    高知: 'kochi',
    佐賀: 'saga',
    帯広: 'obihiro',
    帯広ば: 'obihiro',
    ばんえい帯広: 'obihiro',
};

const VENUE_SLUG_LABELS: Record<string, string> = {
    sapporo: '札幌',
    hakodate: '函館',
    fukushima: '福島',
    niigata: '新潟',
    tokyo: '東京',
    nakayama: '中山',
    chukyo: '中京',
    kyoto: '京都',
    hanshin: '阪神',
    kokura: '小倉',
    monbetsu: '門別',
    morioka: '盛岡',
    mizusawa: '水沢',
    urawa: '浦和',
    funabashi: '船橋',
    ohi: '大井',
    kawasaki: '川崎',
    kanazawa: '金沢',
    kasamatsu: '笠松',
    nagoya: '名古屋',
    sonoda: '園田',
    himeji: '姫路',
    kochi: '高知',
    saga: '佐賀',
    obihiro: '帯広ば',
};

export const RACE_INDEX_PAST_DAYS = 14;
export const RACE_INDEX_FUTURE_DAYS = 2;

export function normalizeVenueName(venueName: string): string {
    return venueName
        .trim()
        .replace(/競馬場$/u, '')
        .replace(/\s+/g, '');
}

export function venueNameToSlug(venueName: string): string {
    const normalized = normalizeVenueName(venueName);
    return VENUE_SLUGS[normalized] ?? encodeURIComponent(normalized.toLowerCase());
}

export function venueSlugToName(venueSlug: string): string | null {
    try {
        const decodedSlug = decodeURIComponent(venueSlug).trim();
        const normalizedSlug = decodedSlug.toLowerCase();
        if (VENUE_SLUG_LABELS[normalizedSlug]) {
            return VENUE_SLUG_LABELS[normalizedSlug];
        }

        return /^[a-z0-9-]+$/.test(normalizedSlug) ? null : decodedSlug;
    } catch {
        return null;
    }
}

export function isVenueSlugForName(slug: string, venueName: string): boolean {
    try {
        const decodedSlug = decodeURIComponent(slug).toLowerCase();
        return decodedSlug === venueNameToSlug(venueName).toLowerCase();
    } catch {
        return false;
    }
}

export function getRaceDetailPath(date: string, venueName: string, raceNumber: number | string): string {
    const race = typeof raceNumber === 'number' ? raceNumber : parseInt(raceNumber, 10);
    return `/races/${date}/${venueNameToSlug(venueName)}/${race}`;
}

export function parseRaceNumberParam(value: string | null | undefined): number | null {
    if (!value) return null;
    const normalized = value.trim().replace(/r$/i, '');
    if (!/^\d{1,2}$/.test(normalized)) return null;

    const raceNumber = parseInt(normalized, 10);
    return raceNumber >= 1 && raceNumber <= 18 ? raceNumber : null;
}

export function isValidRaceDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    );
}

export function getJstTodayString(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
}

function toUtcMidnight(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

export function getDaysFromToday(date: string): number {
    const today = getJstTodayString();
    return Math.round((toUtcMidnight(date) - toUtcMidnight(today)) / 86400000);
}

export function isGradeRaceName(raceName: string | null | undefined): boolean {
    if (!raceName) return false;
    return /(G1|G2|G3|Ｇ[１２３]|GⅠ|GⅡ|GⅢ|J・G[1-3]|J-G[1-3]|重賞)/u.test(raceName);
}

export function getRaceIndexPolicy(
    date: string,
    options: { isGradeRace?: boolean } = {},
): { index: boolean; follow: boolean; reason: string } {
    if (!isValidRaceDate(date)) {
        return { index: false, follow: true, reason: 'invalid-date' };
    }

    const daysFromToday = getDaysFromToday(date);
    const inFreshWindow =
        daysFromToday >= -RACE_INDEX_PAST_DAYS &&
        daysFromToday <= RACE_INDEX_FUTURE_DAYS;

    if (inFreshWindow) {
        return { index: true, follow: true, reason: 'fresh-race-window' };
    }

    if (options.isGradeRace) {
        return { index: true, follow: true, reason: 'grade-race' };
    }

    return { index: false, follow: true, reason: 'old-race-archive' };
}
