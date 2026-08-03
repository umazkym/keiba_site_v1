import { createHash } from 'node:crypto';
import registry from '@/content/reference/grade-race-entities.json';

export type GradeRaceEntity = {
  entity_key: string;
  name: string;
  aliases: string[];
  circuit: 'jra' | 'nar' | 'overseas';
  grade: string;
  archive_slug?: string;
};

export type GradeRaceCircuit = GradeRaceEntity['circuit'];

export type GradeRaceIdentityResolution = {
  entityKey: string;
  source: 'curated_registry' | 'deterministic_schedule' | 'unresolved';
  circuit: GradeRaceCircuit | '';
  normalizedName: string;
  archiveSlug: string;
  error: string;
};

export const GRADE_RACE_IDENTITY_VERSION = 'v1';

export const gradeRaceEntities = registry as GradeRaceEntity[];

export function normalizeGradeRaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/20\d{2}年?/g, '')
    .replace(/[\s　・･()（）【】「」『』｜|:：_-]/g, '')
    .toLowerCase();
}

function normalizeCircuit(value: string): GradeRaceCircuit | '' {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'jra' || normalized === 'nar' || normalized === 'overseas'
    ? normalized
    : '';
}

export function deterministicGradeRaceEntityKey(value: string, circuit: string): string {
  const normalizedName = normalizeGradeRaceText(value);
  const normalizedCircuit = normalizeCircuit(circuit);
  if (!normalizedName || !normalizedCircuit) return '';
  const material = `${GRADE_RACE_IDENTITY_VERSION}|${normalizedCircuit}|${normalizedName}`;
  const digest = createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 16);
  return `auto-${normalizedCircuit}-${digest}`;
}

export function resolveScheduledGradeRaceEntity(input: {
  raceName: string;
  circuit: string;
  trustedSchedule: boolean;
}): GradeRaceIdentityResolution {
  const normalizedName = normalizeGradeRaceText(input.raceName);
  const circuit = normalizeCircuit(input.circuit);
  if (!normalizedName) {
    return { entityKey: '', source: 'unresolved', circuit, normalizedName: '', archiveSlug: '', error: 'empty_race_name' };
  }
  if (!circuit) {
    return { entityKey: '', source: 'unresolved', circuit: '', normalizedName, archiveSlug: '', error: 'invalid_circuit' };
  }

  const matches = gradeRaceEntities.filter((entity) => (
    entity.circuit === circuit
    && [entity.name, ...entity.aliases].some((alias) => normalizeGradeRaceText(alias) === normalizedName)
  ));
  const unique = [...new Map(matches.map((entity) => [entity.entity_key, entity])).values()];
  if (unique.length === 1) {
    const entity = unique[0];
    return {
      entityKey: entity.entity_key,
      source: 'curated_registry',
      circuit,
      normalizedName,
      archiveSlug: entity.archive_slug || entity.entity_key,
      error: '',
    };
  }
  if (unique.length > 1) {
    return {
      entityKey: '',
      source: 'unresolved',
      circuit,
      normalizedName,
      archiveSlug: '',
      error: 'ambiguous_registry_alias',
    };
  }
  if (!input.trustedSchedule) {
    return {
      entityKey: '',
      source: 'unresolved',
      circuit,
      normalizedName,
      archiveSlug: '',
      error: 'untrusted_schedule_fallback',
    };
  }
  const entityKey = deterministicGradeRaceEntityKey(input.raceName, circuit);
  return {
    entityKey,
    source: entityKey ? 'deterministic_schedule' : 'unresolved',
    circuit,
    normalizedName,
    archiveSlug: '',
    error: entityKey ? '' : 'deterministic_key_failed',
  };
}

const contextPrefixPattern = /^(?:(?:jra|nar|地方競馬|中央競馬|競馬|重賞|交流重賞|地方重賞|g[123]|jpn(?:i{1,3}|[123])|jg[123]|s[123]|m[123]|bg[123]|札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉|門別|盛岡|水沢|浦和|船橋|大井|川崎|金沢|笠松|名古屋|園田|姫路|高知|佐賀|帯広)+)/;

type GradeRaceAliasRow = {
  alias: string;
  entity: GradeRaceEntity;
};

function gradeRaceAliasRows(): GradeRaceAliasRow[] {
  return gradeRaceEntities
    .flatMap((entity) => [entity.name, ...entity.aliases].map((value) => ({
      alias: normalizeGradeRaceText(value),
      entity,
    })))
    .filter((row) => Boolean(row.alias))
    .sort((left, right) => right.alias.length - left.alias.length || left.alias.localeCompare(right.alias));
}

export function findGradeRaceEntityByName(value: string): GradeRaceEntity | null {
  const normalized = normalizeGradeRaceText(value);
  if (!normalized) return null;
  const matches = gradeRaceAliasRows()
    .filter((row) => row.alias === normalized)
    .map((row) => row.entity);
  const unique = [...new Map(matches.map((entity) => [entity.entity_key, entity])).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function findGradeRaceEntity(value: string): GradeRaceEntity | null {
  const normalized = normalizeGradeRaceText(value).replace(contextPrefixPattern, '');
  if (!normalized) return null;
  const matches = gradeRaceAliasRows().filter((row) => normalized.startsWith(row.alias));
  if (matches.length === 0) return null;
  const longest = matches[0].alias.length;
  const unique = [...new Map(
    matches
      .filter((row) => row.alias.length === longest)
      .map((row) => [row.entity.entity_key, row.entity]),
  ).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function getGradeRaceEntity(entityKey: string): GradeRaceEntity | null {
  return gradeRaceEntities.find((entity) => entity.entity_key === entityKey) || null;
}
