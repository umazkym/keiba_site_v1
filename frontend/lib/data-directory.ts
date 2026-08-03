import type {
    DataEntitySummary,
    DataEntityType,
    DataSearchResult,
} from '@/lib/types';
import { venueNameToSlug, venueSlugToName } from '@/lib/race-url';


export const DATA_ENTITY_LABELS: Record<Exclude<DataEntityType, 'grade'>, string> = {
    horse: '競走馬',
    jockey: '騎手',
    trainer: '調教師',
    course: 'コース',
};

export const DATA_DIRECTORY_LINKS = [
    { href: '/horses', label: '競走馬', entityType: 'horse' as const },
    { href: '/jockeys', label: '騎手', entityType: 'jockey' as const },
    { href: '/trainers', label: '調教師', entityType: 'trainer' as const },
    { href: '/courses', label: 'コース', entityType: 'course' as const },
];

export const TRAINER_AFFILIATION_OPTIONS = [
    '栃木・宇都宮',
    'ばんえい帯広',
    '北海道',
    '美浦',
    '栗東',
    '岩手',
    '上山',
    '新潟',
    '金沢',
    '愛知',
    '笠松',
    '兵庫',
    '福山',
    '益田',
    '高知',
    '中津',
    '佐賀',
    '荒尾',
    '高崎',
    '大井',
    '川崎',
    '船橋',
    '浦和',
    '門別',
    '盛岡',
    '水沢',
    '名古屋',
    '園田',
    '姫路',
    '帯広',
    '外国',
] as const;

export interface PersonDisplayName {
    name: string;
    affiliation: string | null;
}

export function splitPersonDisplayName(
    rawName: string,
    entityType: DataEntityType,
    explicitAffiliation?: string | null,
): PersonDisplayName {
    const trimmedName = rawName.trim();
    if (entityType !== 'trainer') {
        return {
            name: trimmedName,
            affiliation: explicitAffiliation?.trim() || null,
        };
    }

    const parenthesized = trimmedName.match(/^[（(]([^）)]+)[）)]\s*(.+)$/u);
    if (parenthesized) {
        return {
            affiliation: explicitAffiliation?.trim() || parenthesized[1].trim(),
            name: parenthesized[2].trim(),
        };
    }

    const affiliation = explicitAffiliation?.trim()
        || TRAINER_AFFILIATION_OPTIONS.find((candidate) => (
            trimmedName.startsWith(candidate)
            && trimmedName.length >= candidate.length + 2
        ))
        || null;

    if (!affiliation || !trimmedName.startsWith(affiliation)) {
        return { name: trimmedName, affiliation };
    }

    return {
        affiliation,
        name: trimmedName.slice(affiliation.length).trim(),
    };
}

export function normalizeDataEntitySummary(item: DataEntitySummary): DataEntitySummary {
    const person = splitPersonDisplayName(item.name, item.entity_type, item.affiliation);
    const publicationStatus = ['candidate', 'published', 'held', 'retired'].includes(
        item.search_publication_status,
    )
        ? item.search_publication_status
        : 'candidate';
    const qualityEligible = item.quality_eligible === true;
    return {
        ...item,
        name: person.name,
        affiliation: person.affiliation,
        quality_eligible: qualityEligible,
        search_publication_status: publicationStatus,
        indexable: qualityEligible && publicationStatus === 'published',
    };
}

export function normalizeDataSearchResult(item: DataSearchResult): DataSearchResult {
    const person = splitPersonDisplayName(item.name, item.entity_type, item.affiliation);
    const publicationStatus = ['candidate', 'published', 'held', 'retired'].includes(
        item.search_publication_status,
    )
        ? item.search_publication_status
        : 'candidate';
    const qualityEligible = item.quality_eligible === true;
    return {
        ...item,
        name: person.name,
        affiliation: person.affiliation,
        quality_eligible: qualityEligible,
        search_publication_status: publicationStatus,
        indexable: qualityEligible && publicationStatus === 'published',
    };
}

export type CourseSurface = 'turf' | 'dirt' | 'obstacle' | 'other';

export interface NormalizedCourseItem {
    id: string;
    name: string;
    url: string;
    venueName: string;
    venueSlug: string;
    surface: CourseSurface;
    surfaceLabel: string;
    distance: number | null;
    sampleSize: number;
    raceCount: number | null;
    lastRaceDate: string | null;
}

function parseCourseSlug(value: string): {
    surface: CourseSurface;
    surfaceLabel: string;
    distance: number | null;
} {
    const match = value.match(/^(turf|dirt|obstacle)-(\d{3,4})m$/u);
    if (!match) {
        return { surface: 'other', surfaceLabel: 'その他', distance: null };
    }
    const labels: Record<Exclude<CourseSurface, 'other'>, string> = {
        turf: '芝',
        dirt: 'ダート',
        obstacle: '障害',
    };
    const surface = match[1] as Exclude<CourseSurface, 'other'>;
    return {
        surface,
        surfaceLabel: labels[surface],
        distance: Number(match[2]),
    };
}

export function normalizeCourseItem(item: DataEntitySummary): NormalizedCourseItem {
    const [idVenueSlug = '', idCourseSlug = ''] = item.id.split('/');
    const urlMatch = item.url.match(/^\/courses\/([^/]+)\/([^/]+)$/u);
    const venueSlug = item.venue_slug || urlMatch?.[1] || idVenueSlug;
    const courseSlug = urlMatch?.[2] || idCourseSlug;
    const parsed = parseCourseSlug(courseSlug);
    const venueName = item.venue_name
        || venueSlugToName(venueSlug)
        || item.name.replace(/(芝|ダート|障害)\d{3,4}m.*$/u, '')
        || venueSlug;
    const courseType = item.course_type?.trim();
    const surface = courseType === '芝'
        ? 'turf'
        : courseType === 'ダ' || courseType === 'ダート'
            ? 'dirt'
            : courseType === '障' || courseType === '障害'
                ? 'obstacle'
                : parsed.surface;
    const surfaceLabel = surface === 'turf'
        ? '芝'
        : surface === 'dirt'
            ? 'ダート'
            : surface === 'obstacle'
                ? '障害'
                : parsed.surfaceLabel;

    return {
        id: item.id,
        name: item.name,
        url: item.url,
        venueName,
        venueSlug: venueSlug || venueNameToSlug(venueName),
        surface,
        surfaceLabel,
        distance: item.distance ?? parsed.distance,
        sampleSize: item.sample_size,
        raceCount: item.race_count ?? null,
        lastRaceDate: item.last_race_date,
    };
}

export const CENTRAL_VENUE_ORDER = [
    'sapporo',
    'hakodate',
    'fukushima',
    'niigata',
    'tokyo',
    'nakayama',
    'chukyo',
    'kyoto',
    'hanshin',
    'kokura',
] as const;

export const LOCAL_VENUE_ORDER = [
    'monbetsu',
    'morioka',
    'mizusawa',
    'urawa',
    'funabashi',
    'ohi',
    'kawasaki',
    'kanazawa',
    'kasamatsu',
    'nagoya',
    'sonoda',
    'himeji',
    'kochi',
    'saga',
    'obihiro',
] as const;

export function getVenueSortIndex(slug: string): number {
    const centralIndex = CENTRAL_VENUE_ORDER.indexOf(slug as typeof CENTRAL_VENUE_ORDER[number]);
    if (centralIndex >= 0) return centralIndex;
    const localIndex = LOCAL_VENUE_ORDER.indexOf(slug as typeof LOCAL_VENUE_ORDER[number]);
    if (localIndex >= 0) return CENTRAL_VENUE_ORDER.length + localIndex;
    return CENTRAL_VENUE_ORDER.length + LOCAL_VENUE_ORDER.length;
}

export function isCentralVenue(slug: string): boolean {
    return CENTRAL_VENUE_ORDER.includes(slug as typeof CENTRAL_VENUE_ORDER[number]);
}
