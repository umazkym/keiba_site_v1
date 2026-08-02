const SITE_ORIGIN = 'https://uma-free.com';
const DATASET_LICENSE_URL = `${SITE_ORIGIN}/terms`;
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 5000;

export type DatasetSchemaInput = {
    name: string;
    description: string;
    url: string;
    measurementTechnique: string;
    startDate?: string | null;
    endDate?: string | null;
};

export type DatasetSchemaData = {
    '@context': 'https://schema.org';
    '@type': 'Dataset';
    '@id': string;
    name: string;
    description: string;
    url: string;
    creator: {
        '@type': 'Organization';
        name: 'UMA-FREE';
        url: typeof SITE_ORIGIN;
    };
    license: typeof DATASET_LICENSE_URL;
    measurementTechnique: string;
    isAccessibleForFree: true;
    temporalCoverage?: string;
};

function isValidIsoDate(value: string | null | undefined): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

function normalizeDatasetUrl(value: string): string {
    const url = new URL(value, SITE_ORIGIN);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
}

export function buildDatasetSchema(input: DatasetSchemaInput): DatasetSchemaData {
    const name = input.name.trim();
    const description = input.description.trim();
    const measurementTechnique = input.measurementTechnique.trim();
    if (!name) throw new Error('Datasetのnameは必須です。');
    if (!measurementTechnique) throw new Error('DatasetのmeasurementTechniqueは必須です。');
    if (
        description.length < MIN_DESCRIPTION_LENGTH
        || description.length > MAX_DESCRIPTION_LENGTH
    ) {
        throw new Error(
            `Datasetのdescriptionは${MIN_DESCRIPTION_LENGTH}〜${MAX_DESCRIPTION_LENGTH}文字で指定してください。`,
        );
    }

    const url = normalizeDatasetUrl(input.url);
    const temporalCoverage = isValidIsoDate(input.startDate)
        && isValidIsoDate(input.endDate)
        && input.startDate <= input.endDate
        ? `${input.startDate}/${input.endDate}`
        : undefined;

    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        '@id': `${url}#dataset`,
        name,
        description,
        url,
        creator: {
            '@type': 'Organization',
            name: 'UMA-FREE',
            url: SITE_ORIGIN,
        },
        license: DATASET_LICENSE_URL,
        measurementTechnique,
        isAccessibleForFree: true,
        ...(temporalCoverage ? { temporalCoverage } : {}),
    };
}
